import { AnalyzedLootItem, AnalyzedLootTable, Loot, LootBucket, LootBucketItem, LootTable, LootTableItem, NumberRange } from "./Loot";

interface LootTableLookup {
    [lootTableId: string]: LootTable;
}

interface LootBucketLookup {
    [lootBucketName: string]: LootBucket;
}

const Comparison = {
    Min: '>',
    Max: '<',
    Equals: '='
}

const CrossRefereceTags = {
    LootTable: "[LTID]",
    LootBucket: "[LBID]"
}

/**
 * Settings to influence probability calculations.
 */
interface ProbabilityContext {
    /**
     * Location where the character is. `undefined` means any location,
     * i.e. the location is not considered. If this is set, even without any
     * information, no conditional items are returned (unless conditions match).
     */
    Location?: {
        Name?: string,
        Type?: string,
        Level?: number
    },
    /**
     * Information about the enemy. `undefined` means no evaluation. If this
     * is set, even without any information, no conditional items are returned
     * (unless conditions match).
     */
    Enemy?: {
        Name?: string,
        Type?: string,
        Level?: number,
        /**
         * Flag if the enemy is an elite. `undefined` returns loot for both common and elite enemies.
         */
        Elite?: boolean,
    }
    /**
     * Fresh or salt water, only relevant for fishing. `false` means fresh water, `true` means salt water.
     */
    Salt?: boolean
    /**
     * The character's level.
     */
     CharacterLevel?: number
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
    analyze(context?: ProbabilityContext): AnalyzedLootTable[] {
        //TODO: Consider luck bonuses
        this.#buildLookupTables();
        return this.#analyzeLootTables(context || {});
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
    #analyzeLootTables(context: ProbabilityContext): AnalyzedLootTable[] {
        let analyzedTables = [] as AnalyzedLootTable[];
        for (let lootTable of this.#dataTables.lootTables) {
            let table: AnalyzedLootTable = {
                Id: lootTable.LootTableID,
                GearScoreBonus: lootTable.GearScoreBonus,
                HighWaterMarkMultiplier: lootTable.HighWaterMarkMultiplier,
                Multiple: lootTable.AndOr === "AND",
                LuckSafe: lootTable.LuckSafe,
                UseLevelGearScore: lootTable.UseLevelGearScore,
                Items: []
            };
            analyzedTables.push(table);

            for (let item of lootTable.Items) {
                this.#dereferenceItem(table.Items, item, lootTable);
            }
            table.Items = table.Items.filter(item => this.#filterByContext(item, context));
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
     * @param fromNamed Called from a named item. Used in recursion only.
     */
    #dereferenceItem(items: AnalyzedLootItem[], item: LootTableItem, lootTable: LootTable, baseQuantity: NumberRange | number = 1, baseProbability: number = 1, fromNamed: boolean = false) {
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
                    this.#dereferenceItem(items, referencedItem, referencedTable, itemQuantity, itemProbability, fromNamed);
                }
                crossReferenceResolved = true;
            }
        } else if (item.Name.startsWith(CrossRefereceTags.LootBucket)) {
            let referencedBucket = this.#lootBuckets[item.Name.substring(CrossRefereceTags.LootBucket.length)];
            if (!referencedBucket) {
                console.warn(`Loot table ${lootTable.LootTableID} has unknown reference ${item.Name}`);
            } else {
                if (this.#resolveLootBucketThreshhold !== undefined && this.#resolveLootBucketThreshhold >= referencedBucket.Items.length) {
                    for (let referencedItem of referencedBucket.Items) {
                        items.push({
                            Name: referencedItem.Name,
                            //If the bucket is MatchOne, then probability for each item is the same (selection depends on tags)
                            //Otherwise it can be any one of the items, and the probability is reduced accordingly
                            //TODO: Check with conditions!
                            Probability: referencedBucket.MatchOne ? itemProbability : itemProbability / referencedBucket.Items.length,
                            Quantity: this.#multiplyRange(itemQuantity, referencedItem.Quantity),
                            GearScore: item.GearScore,
                            PerkBucketOverrides: item.PerkBucketOverrides,
                            PerkOverrides: item.PerkOverrides,
                            Conditions: referencedItem.Conditions
                        });
                    }
                } else {
                    items.push({
                        Name: 'Pick from loot bucket: ' + referencedBucket.Name,
                        Probability: itemProbability,
                        Quantity: itemQuantity,
                        GearScore: item.GearScore,
                        PerkBucketOverrides: item.PerkBucketOverrides,
                        PerkOverrides: item.PerkOverrides,
                        Conditions: item.Conditions
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
                Conditions: item.Conditions
            });
        }
    }

     /**
     * Filter items in the loot table according to the given context.
     * @param table Loot table, item list will be modified.
     * @param context The context for evaluating conditions.
     */
    #filterByContext(item: AnalyzedLootItem, context: ProbabilityContext): boolean {
        if (this.#conditionFailed(context.Enemy?.Elite, item.Conditions.Elite)) {
            return false;
        }
        if (this.#conditionFailed(context.Salt, item.Conditions.Fishing?.Salt)) {
            return false;
        }
        if (this.#conditionFailed(context.CharacterLevel, item.Conditions.Levels.Character)) {
            return false;
        }
        if (this.#conditionFailed(context.Location?.Level, item.Conditions.Levels.Content)) {
            return false;
        }
        if (this.#conditionFailed(context.Enemy?.Level, item.Conditions.Levels.Enemy)) {
            return false;
        }
        //Evaluate named condition if either location or enemy information are set
        let matchedNames = [context.Enemy?.Name, context.Enemy?.Type, context.Location?.Name, context.Location?.Type].filter(item => item !== undefined);
        if (context.Enemy !== undefined || context.Location !== undefined) {
            for (let name of item.Conditions.Named) {
                let index = matchedNames.indexOf(name);
                if (index >= 0) {
                    matchedNames.splice(index, 1);
                }
            }
            if (matchedNames.length > 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if a condition has been failed.
     * @param contextField Evaluated context field, may be `undefined`.
     * @param expectedValue The expected value if the context field.
     */
    #conditionFailed(contextField: any, expectedValue: any): boolean {
        if (contextField === undefined || expectedValue === undefined) {
            return false;
        }
        if (typeof expectedValue === 'object' && "Low" in expectedValue && "High" in expectedValue) {
            let expectedRange = expectedValue as NumberRange;
            return expectedRange.Low <= contextField && contextField <= expectedRange.High;
        } else {
            return contextField == expectedValue
        }
    }

    /**
     * Calculate the actual probability of an item.
     * 
     * @param tableMaxRoll Max roll property of the table.
     * @param itemProbability Individual item probability value.
     * @returns Mathematical probability (between 0 and 1 inclusive).
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
     * @param conditions Conditions of the table.
     */
    #adaptMultiProbabilities(table: AnalyzedLootTable) {
        if (!table.Multiple) {
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