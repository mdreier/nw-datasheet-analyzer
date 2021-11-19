import { AnalyzedLootItem, AnalyzedLootTable, NumberRange } from "./Loot";
import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { Conditions, LootBucket } from ".";

const TEMPLATE_DIR = dirname(fileURLToPath(import.meta.url)) + "/../templates/";

function formatRange(range: NumberRange): string {
    if (!range) {
        return "";
    } else if (range.Low === range.High) {
        return "" + range.Low;
    } else {
        return range.Low + "-" + (range.High >= Number.MAX_SAFE_INTEGER ? '\u221E' : range.High);
    }
}

Handlebars.registerHelper("range", formatRange);

Handlebars.registerHelper("list", function(list: Array<any>): string {
    if (!list || list.length === 0) {
        return "";
    } else {
        return list.join(', ');
    }
});

function formatLevelRange(range: NumberRange, text: string) {
    if (range.Low === range.High) {
        return `${text} level ${range.Low}`;
    } else if (range.Low <= 0) {
        return `max ${text} level ${range.High}`;
    } else if (range.High >= Number.MAX_SAFE_INTEGER) {
        return `min ${text} level ${range.Low}`;
    } else {
        return `${text} level ${formatRange(range)}`;
    }
}

Handlebars.registerHelper("conditions", function(conditions: Conditions): string {
    if (!conditions) {
        return "";
    } else {
        let conditionTexts = [];
        if (conditions.Elite !== undefined) {
            conditionTexts.push(conditions.Elite ? 'elite' : 'common');
        }
        if (conditions.Fishing !== undefined) {
            conditionTexts.push(conditions.Fishing.Salt ? "salt water" : "fresh water");
        }
        if (conditions.GlobalMod !== undefined) {
            conditionTexts.push("Global Mod");
        }
        if (conditions.Levels.Character !== undefined) {
            conditionTexts.push(formatLevelRange(conditions.Levels.Character, "character"));
        }
        if (conditions.Levels.Content !== undefined) {
            conditionTexts.push(formatLevelRange(conditions.Levels.Content, "content"));
        }
        if (conditions.Levels.Enemy !== undefined) {
            conditionTexts.push(formatLevelRange(conditions.Levels.Enemy, "enemy"));
        }
        if (conditions.Named !== undefined && conditions.Named.length > 0) {
            conditionTexts.push(`named (${conditions.Named.join(', ')})`);
        }
        return conditionTexts.join(", ");
    }
});

Handlebars.registerHelper("probability", function(probability: number): string {
    if (!probability) {
        return "0.000%";
    } else {
        return (probability * 100).toFixed(3) + "%";
    }
});

const Templates = {
    analyzedLootTable: Handlebars.compile(readFileSync(TEMPLATE_DIR + "analysis.html", {encoding: 'utf-8'})),
    lootBucket: Handlebars.compile(readFileSync(TEMPLATE_DIR + "bucket.html", {encoding: 'utf-8'}))
}

/**
 * Format analyzed loot tables.
 */
export class Formatter {
    lootTables(lootTables: AnalyzedLootTable[]): string {
        return Templates.analyzedLootTable({lootTables: lootTables});
    }

    lootBuckets(lootBuckets: LootBucket[]): string {
        return Templates.lootBucket({lootBuckets: lootBuckets});
    }
}