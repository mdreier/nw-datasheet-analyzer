interface NumberRange {
    Low: number,
    High: number
}

interface LootTableItem {
    Name: string,
    GearScore?: NumberRange,
    Quantity: NumberRange,
    Probability: number
}

interface LootTable {
    LootTableID: string,
    AndOr?: "AND" | "OR",
    HighWaterMarkMultiplier: number,
    GearScoreBonus: number,
    MaxRoll: number,
    Items: LootTableItem[],
    UseLevelGearScore: boolean,
    Conditions?: string,
    LuckSafe: boolean
}

interface Loot {
    lootTables: LootTable[],
    lootBuckets: LootBucket[]
}

interface LootBucket {
    Name: string,
    Tags: string,
    MatchOne: boolean,
    Item: string,
    Quantity: number
}

interface AnalyzedLootItem {
    Name: String,
    GearScore?: NumberRange,
    Quantity: NumberRange,
    Probability: number
}

interface AnalyzedLootTable {
    Id: string,
    Multiple: boolean,
    HighWaterMarkMultiplier: number,
    UseLevelGearScore: boolean,
    GearScoreBonus: number,
    LuckSafe: boolean,
    Conditions?: string,
    Items: AnalyzedLootItem[]
}


export {Loot, LootTable, LootTableItem, NumberRange, LootBucket, AnalyzedLootItem, AnalyzedLootTable};