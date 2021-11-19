import { readFileSync } from "fs";
import { basename } from "path";
import { Conditions, LootBucket, LootTable, NumberRange } from "./Loot";

/**
 * Number of items in an item bucket row. Max value as of 1.0.4 is 152, higher bound here to future-proof.
 */
const ROW_ITEMS_BOUND = 1000;

interface RawLootTableEntry {
    LootTableID: string,
    "AND/OR"?: "AND" | "OR",
    HWMMult: number,
    GSBonus: number,
    MaxRoll: number,
    Conditions?: string,
    [itemKey: string]: any
}

interface RawLootBucketRow {
    RowPlaceholders: string,
    [entryKey: string]: any
}

interface LootTables {
    [lootTableName: string]: LootTable
}

interface InternalConditions extends Conditions {
    probabilityType?: string
}

const Suffixes = {
    Quantity: "_Qty",
    Probability: "_Probs"
}

const ConditionNames = {
    Named: "Named",
    Elite: "Elite",
    EnemyLevel: "EnemyLevel",
    Fish: {
        Fresh: "Fresh", 
        Salt: "Salt", 
        FishRarity: "FishRarity", 
        FishSize: "FishSize"
    },
    Common: "Common",
    GlobalMod: "GlobalMod",
    MinPOIContLevel: "MinPOIContLevel",
    Level: "Level"
}

const TagNames = {
    MinContLevel: "MinContLevel",
    Level: "Level",

}

export class LootParser {

    /**
     * Parse a loot table file.
     * 
     * @param lootTablesFile Path to the loot table file.
     * @returns Loot tables contained in the file.
     */
    parseLootTables(lootTablesFile: string): LootTable[] {
        //Load the JSON source file
        console.debug("Loading loot table");
        let rawContent = JSON.parse(readFileSync(lootTablesFile, {encoding: 'utf-8'})) as RawLootTableEntry[];
        console.debug(`Loaded ${rawContent.length} items in loot table ${basename(lootTablesFile)}`);

        let loadedTables = {} as LootTables;

        //Parse entries
        for (let rawEntry of rawContent) {
            if (rawEntry.LootTableID.endsWith(Suffixes.Quantity)) {
                let entry = loadedTables[this.#removeSuffix(rawEntry.LootTableID, Suffixes.Quantity)];
                this.#parseQuantityEntry(entry, rawEntry);
            } else if (rawEntry.LootTableID.endsWith(Suffixes.Probability)) {
                let entry = loadedTables[this.#removeSuffix(rawEntry.LootTableID, Suffixes.Probability)];
                this.#parseProbabilityEntry(entry, rawEntry);
            } else {
                loadedTables[rawEntry.LootTableID] = this.#parseMainEntry(rawEntry);
            }
        }

        console.debug(`Parsed ${Object.keys(loadedTables).length} loot tables`);
        return Object.values(loadedTables);
    }

    /**
     * Load and parse a loot bucket file.
     * 
     * @param bucketFile Path to the loot bucket file.
     * @returns Loot buckets in the file.
     */
    parseLootBuckets(bucketFile: string): LootBucket[] {
        console.debug("Loading loot bucket");
        let rawContent = JSON.parse(readFileSync(bucketFile, {encoding: 'utf-8'})) as RawLootBucketRow[];
        console.debug(`Loaded ${rawContent.length} databse rows in loot bucket ${basename(bucketFile)}`);

        let lootBuckets = [] as LootBucket[];
        for (let row of rawContent) {
            if (row.RowPlaceholders === "FIRSTROW") {
                lootBuckets = this.#parseLootBucketDefinitions(row);
                break;
            }
        }

        for (let row of rawContent) {
            for (let itemIndex = 1; itemIndex <= lootBuckets.length; itemIndex++) {
                if (!row["Quantity" + itemIndex] || row["Quantity" + itemIndex] === 0) {
                    //No more items in this bucket
                    continue;
                }

                lootBuckets[itemIndex - 1].Items.push({
                    Name: row["Item" + itemIndex],
                    Quantity: this.#parseRange(row["Quantity" + itemIndex]),
                    Conditions: this.#parseTags(this.#parseList(row["Tags" + itemIndex]))
                });
            }
        }

        console.debug(`Parsed ${lootBuckets.length} loot buckets`);
        return lootBuckets;
    }

    /**
     * Parse the item bucket definitions, usually contained in the first row of the loot bucket dats sheet.
     * 
     * @param row Item bucket row containing bucket definitions.
     * @returns Defined loot buckets.
     */
    #parseLootBucketDefinitions(row: RawLootBucketRow): LootBucket[] {
        let buckets = [] as LootBucket[];
        let itemIndex = 0;
        while (row["LootBucket" + ++itemIndex]) {
            if (itemIndex > ROW_ITEMS_BOUND) {
                //Seems to be the maximum index currently
                console.warn("Detected bounds violation, did data file structure change?");
                //Terminate loop to prevent endless loop
                break;
            }

            buckets.push({
                Name: row["LootBucket" + itemIndex],
                MatchOne: this.#parseBoolean(row["MatchOne" + itemIndex]),
                Items: []
            });
        }
        return buckets;
    }

    /**
     * Remove the suffix of a loot table to get the base name.
     * 
     * Loot tables are split into three entries:
     * - XXX
     * - XXX_Qty
     * - XXX_Probs
     * 
     * This function removes the suffix to get the base name.
     * 
     * @param lootTableName Full name of the loot table entry.
     * @param suffix The suffix to remove.
     * @returns Base name of the loot table entry.
     */
    #removeSuffix(lootTableName: string, suffix: string): string {
        return lootTableName.substr(0, lootTableName.length - suffix.length);
    }

    /**
     * Amends the main entry for a loot table with data from the quantity entry.
     * 
     * @param mainEntry Reference to the main entry.
     * @param quantityEntry Quantity entry
     */
    #parseQuantityEntry(mainEntry: LootTable, quantityEntry: RawLootTableEntry) {
        if (!mainEntry) {
            console.warn(`Main table for loot table ${quantityEntry.LootTableID} not found`);
            return;
        }

        let itemIndex = 0;
        while(quantityEntry["Item" + ++itemIndex]) {
            mainEntry.Items[itemIndex - 1].Quantity = this.#parseRange(quantityEntry["Item" + itemIndex]);
        }
    }

    /**
     * Amends the main entry for a loot table with data from the probability entry.
     * 
     * @param mainEntry Reference to the main entry.
     * @param probabilityEntry Probability entry
     */
    #parseProbabilityEntry(mainEntry: LootTable, probabilityEntry: RawLootTableEntry) {
        if (!mainEntry) {
            console.warn(`Main table for loot table ${probabilityEntry.LootTableID} not found`);
            return;
        }

        mainEntry.MaxRoll = probabilityEntry.MaxRoll;

        let itemIndex = 0;
        while(probabilityEntry["Item" + ++itemIndex]) {
            let item = mainEntry.Items[itemIndex - 1];
            let conditions = item.Conditions as InternalConditions;
            let probability = Number.parseInt(probabilityEntry["Item" + itemIndex]);
            if (conditions.probabilityType !== undefined) {
                //Probability is not a probability, but a value for the condition
                //See #parseConditions()
                item.Probability = 0;
                switch (conditions.probabilityType) {
                    case ConditionNames.Level:
                        item.Conditions.Levels.Character = {Low: probability, High: Number.MAX_SAFE_INTEGER};
                        break;
                    case ConditionNames.EnemyLevel:
                        item.Conditions.Levels.Enemy = {Low: probability, High: Number.MAX_SAFE_INTEGER};
                        break;
                    case ConditionNames.MinPOIContLevel:
                        item.Conditions.Levels.Content = {Low: probability, High: Number.MAX_SAFE_INTEGER};
                        break;
                }
            } else {
                item.Probability = probability;
            }
        }
    }

    /**
     * Parse the main entry for a loot table.
     * 
     * @param rawEntry Raw entry data.
     * @returns Parsed entry.
     */
    #parseMainEntry(rawEntry: RawLootTableEntry): LootTable {
        var table = {
            LootTableID: rawEntry.LootTableID,
            AndOr: rawEntry["AND/OR"],
            HighWaterMarkMultiplier: rawEntry.HWMMult,
            UseLevelGearScore: this.#parseBoolean(rawEntry.UseLevelGS),
            GearScoreBonus: rawEntry.GSBonus,
            LuckSafe: this.#parseBoolean(rawEntry.LuckSafe),
            Items: []
        } as LootTable;

        let itemIndex = 0;
        let conditions = this.#parseConditions(rawEntry.Conditions);

        while (rawEntry["Item" + ++itemIndex]) {
            table.Items.push({
                Name: rawEntry["Item" + itemIndex] as string,
                Quantity: {Low: 0, High: 0}, // Updated when quantity entry is parsed
                Probability: 0, // Updated when probability entry is parsed
                GearScore: this.#parseRange(rawEntry["GearScoreRange" + itemIndex]),
                PerkBucketOverrides: rawEntry["PerkBucketOverrides" + itemIndex],
                PerkOverrides: rawEntry["PerkOverrides" + itemIndex],
                Conditions: conditions
            });
        }

        return table;
    }

    /**
     * Booleans are stored as strings. Values are "TRUE" and "FALSE".
     * Undefined and invalid values result in false.
     * 
     * @param rawValue The string value.
     * @returns The boolean value. 
     */
    #parseBoolean(rawValue: string): boolean {
        if (rawValue === "TRUE") {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Parse a number range entry.
     * 
     * @param range Range in the format "100" or "100-150".
     * @returns Number range, or undefined if the argument is undefined.
     */
    #parseRange(range: string | number): NumberRange {        
        if (!range) {
            return {
                Low: 0,
                High: 0
            };
        }
        if (typeof range === 'number') {
            return {
                Low: range,
                High: range
            }
        }
        let dashIndex = range.indexOf('-');
        if (dashIndex < 0) {
            return {
                Low: Number.parseInt(range),
                High: Number.parseInt(range)
            }
        } else {
            return {
                Low: Number.parseInt(range.substring(0, dashIndex)),
                High: Number.parseInt(range.substring(dashIndex + 1))
            }
        }
    }

    /**
     * Parse a comma-separated list of values.
     * 
     * @param list List of values.
     */
    #parseList(list: string): string[] {
        if (!list) {
            return [];
        }
        if (list.trim().length === 0) {
            return [];
        }
        return list.split(',').map(value => value.trim()).filter(value => value.length !== 0);
    }

    /**
     * Parse conditions of a table.
     * @param table The conditions of the loot table.
     * @param item The loot item.
     * @returns Conditions for attaining the item.
     */
    #parseConditions(tableConditions: string): InternalConditions {
        let conditions: InternalConditions = {
            Levels: {},
            Named: []
        };
        if (!tableConditions) {
            return conditions;
        }
        for (let condition of tableConditions.split(',')) {
            switch(condition) {
                case ConditionNames.EnemyLevel:
                case ConditionNames.Level:
                case ConditionNames.MinPOIContLevel:
                    conditions.probabilityType = condition;
                    break;
                case ConditionNames.Common:
                case ConditionNames.Elite:
                    conditions.Elite = condition === ConditionNames.Elite;
                    break;
                case ConditionNames.GlobalMod:
                    conditions.GlobalMod = true;
                    break;
                case ConditionNames.Fish.Fresh:
                case ConditionNames.Fish.Salt:
                    conditions.Fishing = {
                        Salt: condition === ConditionNames.Fish.Salt
                    }
                    break;
                case ConditionNames.Named:
                case ConditionNames.Fish.FishRarity:
                case ConditionNames.Fish.FishSize:
                    //Not evaluated
                    break;
                default:
                    conditions.Named.push(condition);
                    break;
            }
        }
        return conditions;
    }

    /**
     * Parse loot bucket tags.
     * @param tags List of loot bucked tags.
     */
    #parseTags(tags: string[]): Conditions {
        let conditions: Conditions = {
            Levels: {},
            Named: []
        }
        for (let tag of tags) {
            let [name, value] = tag.split(':');
            switch (name) {
                case TagNames.MinContLevel:
                    conditions.Levels.Content = this.#parseRange(value);
                    break;
                case TagNames.Level: 
                    conditions.Levels.Character = this.#parseRange(value);
                    break;
                default:
                    conditions.Named.push(tag);
                    break;
            }
        }
        return conditions;
    }
}