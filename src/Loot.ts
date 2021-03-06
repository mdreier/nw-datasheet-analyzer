/**
 * A number range (from ... to).
 */
interface NumberRange {
    /**
     * Lower end of the range.
     */
    Low: number,
    /**
     * Upper end of the range.
     */
    High: number
}

/**
 * Item in the loot table.
 */
interface LootTableItem {
    /**
     * Item name. This is the technical key of the item, not a UI text.
     */
    Name: string,
    /**
     * Gear score range of the item.
     */
    GearScore?: NumberRange,
    /**
     * Quantity range of the item. Can be expected to be a single-number range,
     * i.e. Low === High.
     */
    Quantity: NumberRange,
    /**
     * Probability for the item. This is not a mathematical probability or percentage,
     * but a lower limit on the item roll. This means you would need to roll at least
     * this number to get the item.
     */
    Probability: number,
    PerkBucketOverrides?: string,
    PerkOverrides?: string,
    /**
     * Conditions for attaining the item.
     */
    Conditions: Conditions
}

/**
 * A loot table.
 */
interface LootTable {
    /**
     * ID of the table.
     */
    LootTableID: string,
    AndOr?: "AND" | "OR",
    HighWaterMarkMultiplier: number,
    GearScoreBonus: number,
    /**
     * The maximum unmodified loot roll on this table.
     */
    MaxRoll: number,
    /**
     * Items in this loot table.
     */
    Items: LootTableItem[],
    /**
     * Determine possible gear score from the character level.
     * (unconfirmed)
     */
    UseLevelGearScore: boolean,
    /**
     * Roll is not influenced by luck.
     */
    LuckSafe: boolean
}

/**
 * Parsed loot data.
 */
interface Loot {
    /**
     * Loot tables.
     */
    lootTables: LootTable[],
    /**
     * Loot buckets.
     */
    lootBuckets: LootBucket[]
}

/**
 * Item in  a loot bucket.
 */
interface LootBucketItem {
    /**
     * Item name.
     */
    Name: string,
    /**
     * Quantity.
     */
    Quantity: NumberRange,
    /**
     * Conditions for attaining the item.
     */
     Conditions: Conditions
}

/**
 * Loot bucket.
 */
interface LootBucket {
    /**
     * Name of the bucket. This is a technical key.
     */
    Name: string,
    /**
     * Only match one item.
     */
    MatchOne: boolean,
    /**
     * Loot bucket item.
     */
    Items: LootBucketItem[]
}

/**
 * Conditions for attaining an item. Properties that are
 * `undefined` are not evaluated.
 */
interface Conditions {
    /**
     * Global modifier. Unclear, what this does.
     */
    GlobalMod?: boolean;
    Levels: {
        /**
         * Character level.
         */
        Character?: NumberRange,
        /**
         * Content or POI level.
         */
        Content?: NumberRange,
        /**
         * Enemy level.
         */
        Enemy?: NumberRange
    };
    /**
     * Enemy or POI names and tags. An empty array means no
     * limitations, otherwise at least one name must match.
     */
    Named: string[];
    Fishing?: {
        Salt: boolean
    };
    Elite?: boolean;
}

/**
 * Loot item after analysis.
 */
interface AnalyzedLootItem {
    /**
     * Item name. This is the technical key of the item, not a UI text. It may be a
     * reference to another loot table (prefix [LTID]) or to a loot bucket (prefix
     * [LBID]).
     */
    Name: string,
    /**
     * Gear score range of the item.
     */
    GearScore?: NumberRange,
    /**
     * Quantity range of the item. Can be expected to be a single-number range,
     * i.e. Low === High.
     */
    Quantity: NumberRange,
    /**
     * Probability for the item. This is a number between 0 (impossible) and
     * 1 (guaranteed).
     */
    Probability: number,
    PerkBucketOverrides?: string,
    PerkOverrides?: string,
    /**
     * Conditions under which this item can be obtained.
     */
    Conditions: Conditions
}

/**
 * Loot table after analysis
 */
interface AnalyzedLootTable {
    /**
     * ID of the table.
     */
    Id: string,
    /**
     * Multiple items from the loot table can be recieved.
     */
    Multiple: boolean,
    HighWaterMarkMultiplier: number,
    /**
     * Determine possible gear score from the character level.
     * (unconfirmed)
     */
    UseLevelGearScore: boolean,
    GearScoreBonus: number,
    /**
     * Roll is not influenced by luck.
     */
    LuckSafe: boolean,
    /**
     * Items in the loot table.
     */
    Items: AnalyzedLootItem[]
}


export {Loot, LootTable, LootTableItem, NumberRange, LootBucket, LootBucketItem, AnalyzedLootItem, AnalyzedLootTable, Conditions};