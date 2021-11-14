import { readFileSync } from "fs";
import { basename } from "path";
import { LootTable, NumberRange } from "./Loot";

interface RawLootTableEntry {
    LootTableID: string,
    "AND/OR"?: "AND" | "OR",
    HWMMult: number,
    GSBonus: number,
    MaxRoll: number,
    Conditions?: string,
    [itemKey: string]: any
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
            UseLevelGearScore: rawEntry.UseLevelGS,
            GearScoreBonus: rawEntry.GSBonus,
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