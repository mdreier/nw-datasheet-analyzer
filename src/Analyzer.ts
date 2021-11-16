import { AnalyzedLootItem, AnalyzedLootTable, Loot, LootBucket, LootTable, LootTableItem, NumberRange } from "./Loot";

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
     * Threshhold to resolve loot bucket references in loot table entries. Loot buckets with a number 
     * of items larger than this threshhold are not resolved.
     */
    #resolveLootBucketThreshhold: number;

    /**
     * Create a new instance for analysis of data tables.
     * @param dataTables Data tables to be analyzed.
     * @param resolveLootBucketThreshhold Threshhold to resolve loot bucket references in loot table entries. Loot buckets with a number 
     * of items larger than this threshhold are not resolved.
     */
    constructor(dataTables: Loot, resolveLootBucketThreshhold: number) {
        this.#dataTables = dataTables;
        this.#resolveLootBucketThreshhold = resolveLootBucketThreshhold;
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
                Multiple: lootTable.AndOr === "AND",
                LuckSafe: lootTable.LuckSafe,
                Conditions: lootTable.Conditions,
                UseLevelGearScore: lootTable.UseLevelGearScore,
                Items: []
            };
            analyzedTables.push(table);

            for (let item of lootTable.Items) {
                this.#dereferenceItem(table.Items, item, lootTable, 1, 1);
            }

            this.#adaptMultiProbabilities(table);
        }
        return analyzedTables;
    }

    /**
     * Dereference an item and add it or the dereferenced items to an item list.
     * 
     * @param items List of items, dereferenced item(s) will be added to this list.
     * @param item Item to process.
     * @param lootTable Loot Table where the item is from.
     * @param baseQuantity Base quantity for recursion, set to 1 in intial call.
     * @param baseProbability Base probability for recursion, set to 1 in intial call.
     */
    #dereferenceItem(items: AnalyzedLootItem[], item: LootTableItem, lootTable: LootTable, baseQuantity: NumberRange | number, baseProbability: number) {
        //Calculate base item probabilities
        let itemProbability = baseProbability * this.#calculateItemProbability(lootTable.MaxRoll, item.Probability);
        let itemQuantity = this.#multiplyRange(item.Quantity, baseQuantity);
        //Resolve possible cross references
        let crossReferenceResolved = false;
        if (item.Name.startsWith(CrossRefereceTags.LootTable)) {
            let referencedTable = this.#lootTables[item.Name.substring(CrossRefereceTags.LootTable.length)];
            if (!referencedTable) {
                console.warn(`Loot table ${lootTable.LootTableID} has unknown reference ${item.Name}`);
            } else {
                for (let referencedItem of referencedTable.Items) {
                    this.#dereferenceItem(items, referencedItem, referencedTable, itemQuantity, itemProbability);
                }
                crossReferenceResolved = true;
            }
        } else if (item.Name.startsWith(CrossRefereceTags.LootBucket)) {
            let referencedBucket = this.#lootBuckets[item.Name.substring(CrossRefereceTags.LootBucket.length)];
            if (!referencedBucket) {
                console.warn(`Loot table ${lootTable.LootTableID} has unknown reference ${item.Name}`);
            } else {
                if (this.#resolveLootBucketThreshhold !== undefined && this.#resolveLootBucketThreshhold >= referencedBucket.Items.length) {
                    console.debug(referencedBucket.Name + " -- " + referencedBucket.Items.length);
                    for (let referencedItem of referencedBucket.Items) {
                        items.push({
                            Name: referencedItem.Name,
                            //If the bucket is MatchOne, then probability for each item is the same (selection depends on tags)
                            //Otherwise it can be any one of the items, and the probability is reduced accordingly
                            Probability: referencedBucket.MatchOne ? itemProbability : itemProbability / referencedBucket.Items.length,
                            Quantity: this.#multiplyRange(itemQuantity, referencedItem.Quantity),
                            GearScore: item.GearScore,
                            Tags: referencedItem.Tags,
                            PerkBucketOverrides: item.PerkBucketOverrides,
                            PerkOverrides: item.PerkOverrides
                        });
                    }
                } else {
                    items.push({
                        Name: 'Pick from loot bucket: ' + referencedBucket.Name,
                        Probability: itemProbability,
                        Quantity: itemQuantity,
                        GearScore: item.GearScore,
                        Tags: [],
                        PerkBucketOverrides: item.PerkBucketOverrides,
                        PerkOverrides: item.PerkOverrides
                    });
                }
                crossReferenceResolved = true;
            }
        }

        if (!crossReferenceResolved) {
            //Normal item or invalid reference
            items.push({
                Name: item.Name,
                Probability: itemProbability,
                Quantity: item.Quantity,
                GearScore: item.GearScore,
                PerkBucketOverrides: item.PerkBucketOverrides,
                PerkOverrides: item.PerkOverrides,
                Tags: []
            });
        }
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
     * Adapt table item probabilities for tables where only one item can be selected.
     * @param table Analyzed loot table.
     */
    #adaptMultiProbabilities(table: AnalyzedLootTable) {
        if (table.Multiple === false) {
            //Only one of the possible items can be selected
            let possibleItemCount = table.Items.filter(item => item.Probability > 0).length;
            for (let item of table.Items) {
                item.Probability /= possibleItemCount;
            }
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