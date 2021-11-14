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
    Items: LootTableItem[]
    UseLevelGearScore: boolean
    Conditions?: string
}

interface Loot {
    lootTables: LootTable[]
}

export {Loot, LootTable, LootTableItem, NumberRange};