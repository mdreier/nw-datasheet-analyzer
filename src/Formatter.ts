import { AnalyzedLootTable } from "./Loot";
import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const TEMPLATE_DIR = dirname(fileURLToPath(import.meta.url)) + "/templates/";

const Templates = {
    html: Handlebars.compile(readFileSync(TEMPLATE_DIR + "analysis.html", {encoding: 'utf-8'}))
}

/**
 * Format analyzed loot tables.
 */
export class Formatter {
    /**
     * Loot tables.
     */
    #lootTables: AnalyzedLootTable[];

    constructor(lootTables: AnalyzedLootTable[]) {
        this.#lootTables = lootTables;
    }

    html(): string {
        return Templates.html({lootTables: this.#lootTables});
    }

}