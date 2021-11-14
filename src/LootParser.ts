import { readFileSync } from "fs";
import { basename } from "path";
import { LootBucket, LootTable, NumberRange } from "./Loot";

/**
 * Number of items in a row.
 */
const ROW_ITEMS_BOUND = 152;

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

const Suffixes = {
    Quantity: "_Qty",
    Probability: "_Probs"
}

export class LootParser {

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

    parseLootBuckets(bucketFile: string): LootBucket[] {
        console.debug("Loading loot bucket");
        let rawContent = JSON.parse(readFileSync(bucketFile, {encoding: 'utf-8'})) as RawLootBucketRow[];
        console.debug(`Loaded ${rawContent.length} databse rows in loot bucket ${basename(bucketFile)}`);

        let lootBuckets = [] as LootBucket[];
        for (let row of rawContent) {
            let itemIndex = 0;
            while (row["Quantity" + ++itemIndex]) {
                if (itemIndex > ROW_ITEMS_BOUND) {
                    //Seems to be the maximum index currently
                    console.warn("Detected bounds violation, did data file structure change?");
                    //Terminate loop to prevent endless loop
                    break;
                }

                if (row["Quantity" + itemIndex] === 0) {
                    //Empty row
                    continue;
                }
                lootBuckets.push({
                    Name: row["Name" + itemIndex],
                    MatchOne: this.#parseBoolean(row["MatchOne" + itemIndex]),
                    Item: row["Item" + itemIndex],
                    Quantity: row["Quantity" + itemIndex],
                    Tags: row["Tags" + itemIndex] 
                });
            }
        }

        console.debug(`Parsed ${lootBuckets.length} loot buckets`);
        return lootBuckets;
    }

    #removeSuffix(lootTableName: string, suffix: string): string {
        return lootTableName.substr(0, lootTableName.length - suffix.length);
    }

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

    #parseProbabilityEntry(mainEntry: LootTable, probabilityEntry: RawLootTableEntry) {
        if (!mainEntry) {
            console.warn(`Main table for loot table ${probabilityEntry.LootTableID} not found`);
            return;
        }

        mainEntry.MaxRoll = probabilityEntry.MaxRoll;

        let itemIndex = 0;
        while(probabilityEntry["Item" + ++itemIndex]) {
            mainEntry.Items[itemIndex - 1].Probability = Number.parseInt(probabilityEntry["Item" + itemIndex]);
        }
    }

    #parseMainEntry(rawEntry: RawLootTableEntry): LootTable {
        var table = {
            LootTableID: rawEntry.LootTableID,
            AndOr: rawEntry["AND/OR"],
            Conditions: rawEntry.Conditions,
            HighWaterMarkMultiplier: rawEntry.HWMMult,
            UseLevelGearScore: this.#parseBoolean(rawEntry.UseLevelGS),
            GearScoreBonus: rawEntry.GSBonus,
            LuckSafe: this.#parseBoolean(rawEntry.LuckSafe),
            Items: []
        } as LootTable;

        let itemIndex = 0;

        while (rawEntry["Item" + ++itemIndex]) {
            table.Items.push({
                Name: rawEntry["Item" + itemIndex] as string,
                Quantity: {Low: 0, High: 0},
                Probability: 0,
                GearScore: this.#parseRange(rawEntry["GearScoreRange" + itemIndex])
            });
        }

        return table;
    }

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
    #parseRange(range: string): NumberRange {
        if (!range) {
            return undefined;
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
}