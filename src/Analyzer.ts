import { AnalyzedLootItem, AnalyzedLootTable, Loot, LootBucket, LootBucketItem, LootTable, LootTableItem, NumberRange } from "./Loot";
import clone from 'just-clone';
import { Conditions } from ".";

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
 * Internal: Item lookup table.
 */
interface ItemLookup {
    [itemName: string]: AnalyzedLootItem[];
}

/**
 * Options for the analyzer.
 */
interface AnalyzerOptions {
    /**
     * Force the merging of items, even when filters are not set.
     * 
     * Default: `false`.
     */
    forceMerging: boolean,

    /**
     * Threshhold to resolve loot bucket references in loot table entries. Loot buckets with a number 
     * of items larger than this threshhold are not resolved.
     * 
     * Default: `1`.
     */
    resolveLootBucketThreshhold: number
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
     * The context set up for this analyzer.
     */
    #context: ProbabilityContext;

    /**
     * Configuration of the analyzer.
     */
    #options: AnalyzerOptions;

    /**
     * Create a new instance for analysis of data tables.
     * @param context The context for analyzing loot. Thhis object is copied, subsequent changes
     * will not influence this analyzer instance.
     * @param dataTables Data tables to be analyzed.
     * @param resolveLootBucketThreshhold 
     */
    constructor(dataTables: Loot, context?: ProbabilityContext, options?: AnalyzerOptions) {
        if (context) {
            this.#context = clone(context);
        } else {
            this.#context = {};
        }
        this.#dataTables = dataTables;
        this.#options = {
            forceMerging: options?.forceMerging === true ? true : false,
            resolveLootBucketThreshhold: options.resolveLootBucketThreshhold === undefined ? 1 : options.resolveLootBucketThreshhold
        }
    }

    /**
     * Analyze the data tables.
     * @param tables Table or tables to analyze.
     */
    analyze(tables?: string|string[]): AnalyzedLootTable[] {
        //TODO: Consider luck bonuses
        this.#buildLookupTables();

        let tablesToAnalyze: string[] = [];
        if (typeof tables === 'string') {
            tablesToAnalyze.push(tables);
        } else if (Array.isArray(tables)) {
            tablesToAnalyze.push(...tables);
        }

        return this.#analyzeLootTables(tablesToAnalyze);
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
     * @param tables Table or tables to analyze. Empty to analyze all tables.
     * @returns Analyzed tables.
     */
    #analyzeLootTables(tables: string[]): AnalyzedLootTable[] {
        let analyzedTables = [] as AnalyzedLootTable[];
        for (let lootTable of this.#dataTables.lootTables) {
            if (tables.length > 0 && tables.indexOf(lootTable.LootTableID) < 0) {
                continue;
            }
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
            table.Items = table.Items.filter(item => this.#filterByContext(item));
            this.#mergeItems(table.Items);
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
        let currentItems: AnalyzedLootItem[] = [];
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
                    this.#dereferenceItem(currentItems, referencedItem, referencedTable, itemQuantity, itemProbability, fromNamed);
                }
                crossReferenceResolved = true;
            }
        } else if (item.Name.startsWith(CrossRefereceTags.LootBucket)) {
            let referencedBucket = this.#lootBuckets[item.Name.substring(CrossRefereceTags.LootBucket.length)];
            if (!referencedBucket) {
                console.warn(`Loot table ${lootTable.LootTableID} has unknown reference ${item.Name}`);
            } else {
                if (this.#options.resolveLootBucketThreshhold !== undefined && this.#options.resolveLootBucketThreshhold >= referencedBucket.Items.length) {
                    for (let referencedItem of referencedBucket.Items) {
                        currentItems.push({
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
                    currentItems.push({
                        Name: 'Pick from loot bucket: ' + referencedBucket.Name,
                        Probability: lootTable.AndOr === "AND" ? itemProbability : itemProbability / lootTable.Items.length,
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
            currentItems.push({
                Name: item.Name,
                Probability: itemProbability,
                Quantity: itemQuantity,
                GearScore: item.GearScore,
                PerkBucketOverrides: item.PerkBucketOverrides,
                PerkOverrides: item.PerkOverrides,
                Conditions: item.Conditions
            });
        }

        if (lootTable.AndOr === "OR") {
            this.#adaptMultiProbabilities(currentItems);
        }
        items.push(...currentItems);
    }

     /**
     * Filter items in the loot table according to the given context.
     * @param table Loot table, item list will be modified.
     */
    #filterByContext(item: AnalyzedLootItem): boolean {
        if (this.#conditionFailed(this.#context.Enemy?.Elite, item.Conditions.Elite)) {
            return false;
        }
        if (this.#conditionFailed(this.#context.Salt, item.Conditions.Fishing?.Salt)) {
            return false;
        }
        if (this.#conditionFailed(this.#context.CharacterLevel, item.Conditions.Levels.Character)) {
            return false;
        }
        if (this.#conditionFailed(this.#context.Location?.Level, item.Conditions.Levels.Content)) {
            return false;
        }
        if (this.#conditionFailed(this.#context.Enemy?.Level, item.Conditions.Levels.Enemy)) {
            return false;
        }
        //Evaluate named condition if either location or enemy information are set
        let matchedNames = [this.#context.Enemy?.Name, this.#context.Enemy?.Type, this.#context.Location?.Name, this.#context.Location?.Type].filter(item => item !== undefined);
        if (this.#context.Enemy !== undefined || this.#context.Location !== undefined) {
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
    #adaptMultiProbabilities(items: AnalyzedLootItem[]) {
        //Only one of the possible items can be selected
        let possibleItemCount = items.filter(item => item.Probability > 0).length;
        for (let item of items) {
            item.Probability /= possibleItemCount;
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

    /**
     * Merge multiple instance of the same item in an item list.
     * @param items Item list to compress.
     */
    #mergeItems(items: AnalyzedLootItem[]) {
        let lookup: ItemLookup = {};
        for (let item of items) {
            if (!lookup[item.Name]) {
                //First time this item is encountered
                lookup[item.Name] = [item];
            } else {
                for (let match of lookup[item.Name]) {
                    //TODO: Implement merging if context is not set,
                    //then conditions must match!
                    if (this.#options.forceMerging || this.#hasContext()) {
                        //Filters already applied, merge independent of conditions
                        this.#mergeItem(item, match);
                        break;
                    }
                }
            }
        }
    }

    /**
     * Merge a source item into a target item..
     * @param source Source item.
     * @param target Target item, will be modified.
     */
    #mergeItem(source: AnalyzedLootItem, target: AnalyzedLootItem) {
        target.GearScore = this.#mergeRange(source.GearScore, target.GearScore);
        target.PerkBucketOverrides += source.PerkBucketOverrides;
        target.PerkOverrides += source.PerkOverrides;
        target.Quantity = this.#mergeRange(source.Quantity, target.Quantity);
        target.Probability += source.Probability;
        this.#mergeConditions(source.Conditions, target.Conditions);
    }

    /**
     * Merge source conditions into target conditions.
     * @param source Source conditions to merge.
     * @param target Target conditions, will be modified.
     */
    #mergeConditions(source: Conditions, target: Conditions) {
        //General logic: if source and target define different options,
        // the merged condition is "either one", i.e. undefined
        if (source.Elite !== target.Elite) {
            target.Elite = undefined;
        }
        if (target.Fishing?.Salt !== source.Fishing?.Salt) {
            target.Fishing = {
                Salt: undefined
            }
        }
        if (source.GlobalMod !== target.GlobalMod) {
            target.GlobalMod = undefined;
        }
        target.Levels = {
            Character: this.#mergeRange(source.Levels.Character, target.Levels.Character),
            Content: this.#mergeRange(source.Levels.Content, target.Levels.Content),
            Enemy: this.#mergeRange(source.Levels.Enemy, target.Levels.Enemy)
        }
        //Combine all named conditions
        target.Named.push(...source.Named);
    }

    /**
     * Merge two number ranges. Low will be the minimum of the lows, high will be
     * the maximum of the highs. If either range is `undefined`, it will return `undefined`.
     * @param range1 First range.
     * @param range2 Second range.
     * @returns Merged range.
     */
    #mergeRange(range1: NumberRange, range2: NumberRange) {
        if (range1 && range2) {
            return {
                Low: Math.min(range1.Low, range2.Low),
                High: Math.max(range1.High, range2.High)
            }
        } else {
            //Only merge if both ranges are given. If one of them is not set,
            // combined range us unbounded.
            return undefined;
        }
    }

    /**
     * Check if a context has been provided for this analyzer instance.
     * @returns `true` if the context is set, `false` if the context is empty.
     */
    #hasContext(): boolean {
        return Boolean(this.#context.CharacterLevel 
        || this.#context.Enemy 
        || this.#context.Location
        || this.#context.Salt);
    }
}