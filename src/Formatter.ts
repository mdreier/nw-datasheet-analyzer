import { AnalyzedLootItem, AnalyzedLootTable, NumberRange } from "./Loot";
import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { LootBucket } from ".";

const TEMPLATE_DIR = dirname(fileURLToPath(import.meta.url)) + "/../templates/";

Handlebars.registerHelper("range", function(range: NumberRange): string {
    if (!range) {
        return "";
    } else if (range.Low === range.High) {
        return "" + range.Low;
    } else {
        return range.Low + "-" + range.High;
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