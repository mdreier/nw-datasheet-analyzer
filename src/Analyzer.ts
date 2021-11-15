import { AnalyzedLootTable, Loot, LootBucket, LootTable, NumberRange } from "./Loot";

interface LootTableLookup {
    [lootTableId: string]: LootTable;
}

interface LootBucketLookup {
    [lootBucketName: string]: LootBucket;
}

const CrossRefereceTags = {
    LootTable: "[LTID]",
    LootBucket: "[LBID]"
}

/**
 * Analysis tool for data files.
 */
export class Analyzer {

    /**
     * Initial data tables.
     */
    #dataTables: Loot;

    /**
     * Lookup table: Loot Table ID -> Loot Table.
     */
    #lootTables: LootTableLookup;

    /**
     * Lookup table: Loot Bucket Name -> Loot Bucket.
     */
    #lootBuckets: LootBucketLookup;

    /**
     * Create a new instance for analysis of data tables.
     * @param dataTables Data tables to be analyzed.
     */
    constructor(dataTables: Loot) {
        this.#dataTables = dataTables;
    }

    /**
     * Analyze the data tables.
     */
    analyze(): AnalyzedLootTable[] {
        //TODO: Consider luck bonuses
        this.#buildLookupTables();
        return this.#analyzeLootTables();
    }

    /**
     * Build lookup tables for cross-references.
     */
    #buildLookupTables() {
        // Loot Table ID -> Loot Table
        if (!this.#lootTables) {
            this.#lootTables = {};
            for (let lootTable of this.#dataTables.lootTables) {
                this.#lootTables[lootTable.LootTableID] = lootTable;
            }
        }

        //Loot Bucket Name -> Loot Bucket
        if (!this.#lootBuckets) {
            this.#lootBuckets = {};
            for (let lootBucket of this.#dataTables.lootBuckets) {
                this.#lootBuckets[lootBucket.Name] = lootBucket;
            }
        }
    }

    /**
     * Analyze the loot tables.
     * @returns Analyzed tables.
     */
    #analyzeLootTables(): AnalyzedLootTable[] {
        let analyzedTables = [] as AnalyzedLootTable[];
        for (let lootTable of this.#dataTables.lootTables) {
            let table: AnalyzedLootTable = {
                Id: lootTable.LootTableID,
                GearScoreBonus: lootTable.GearScoreBonus,
                HighWaterMarkMultiplier: lootTable.HighWaterMarkMultiplier,
                Multiple: lootTable.AndOr === "OR",
                LuckSafe: lootTable.LuckSafe,
                Conditions: lootTable.Conditions,
                UseLevelGearScore: lootTable.UseLevelGearScore,
                Items: []
            };
            analyzedTables.push(table);

            for (let item of lootTable.Items) {
                //Calculate base item probabilities
                let itemProbability = this.#calculateItemProbability(lootTable.MaxRoll, item.Probability);

                //Resolve possible cross references
                let crossReferenceResolved = false;
                if (item.Name.startsWith(CrossRefereceTags.LootTable)) {
                    let referencedTable = this.#lootTables[item.Name.substring(CrossRefereceTags.LootTable.length)];
                    if (!referencedTable) {
                        console.warn(`Loot table ${lootTable.LootTableID} has unknown reference ${item.Name}`);
                    } else {
                        for (let referencedItem of referencedTable.Items) {
                            table.Items.push({
                                Name: referencedItem.Name,
                                Probability: itemProbability * this.#calculateItemProbability(referencedTable.MaxRoll, referencedItem.Probability),
                                Quantity: this.#multiplyRange(item.Quantity, referencedItem.Quantity),
                                GearScore: referencedItem.GearScore
                            })
                        }
                        crossReferenceResolved = true;
                    }
                } else if (item.Name.startsWith(CrossRefereceTags.LootBucket)) {
                    let referencedBucket = this.#lootBuckets[item.Name.substring(CrossRefereceTags.LootBucket.length)];
                    if (!referencedBucket) {
                        console.warn(`Loot table ${lootTable.LootTableID} has unknown reference ${item.Name}`);
                    } else {
                        table.Items.push({
                            Name: referencedBucket.Item,
                            Probability: itemProbability,
                            Quantity: this.#multiplyRange(item.Quantity, referencedBucket.Quantity),
                            GearScore: item.GearScore
                        });
                        crossReferenceResolved = true;
                    }
                }

                if (!crossReferenceResolved) {
                    //Normal item or invalid reference
                    table.Items.push({
                        Name: item.Name,
                        Probability: itemProbability,
                        Quantity: item.Quantity,
                        GearScore: item.GearScore
                    });
                }
            }
        }
        return analyzedTables;
    }

    /**
     * Calculate the actual probability of an item.
     * 
     * @param tableMaxRoll Max roll property of the table.
     * @param itemProbability Individual item probability value.
     * @returns Mathematical robability.
     */
    #calculateItemProbability(tableMaxRoll: number, itemProbability: number): number {
        if (tableMaxRoll > 0) {
            if (itemProbability > tableMaxRoll) {
                return 0;
            } else {
                return 1 - (itemProbability / tableMaxRoll);
            }
        } else {
            return itemProbability === 0 ? 1 : 0;
        }
    }

    /**
     * Multiply two number ranges or a range with a number.
     * @param baseRange One range.
     * @param multiplier Value to multiply with.
     * @returns Multiplied Range.
     */
    #multiplyRange(baseRange: NumberRange, multiplier: NumberRange | number): NumberRange {
        if (typeof multiplier === 'number') {
            return {
                Low: baseRange.Low * multiplier,
                High: baseRange.High * multiplier
            }
        } else {
            return {
                Low: baseRange.Low * multiplier.Low,
                High: baseRange.High * multiplier.High
            }
        }
    }
}