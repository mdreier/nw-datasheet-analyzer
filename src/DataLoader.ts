import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import fetch from 'node-fetch';
import { LootParser } from './LootParser.js';
import { Loot } from './Loot.js';

/**
 * Local directory to store data files.
 */
const DATA_FILES_DIRECTORY = "./data/";
/**
 * Data files needed by the application.
 */
const DATA_FILES = {
    LOOT_TABLES: "javelindata_loottables.json"
};
/**
 * Source repository.
 */
const REPOSITORY = "https://raw.githubusercontent.com/Kattoor/nw-datasheets-json/main/"

/**
 * Data loader for New World data files.
 */
export class DataLoader {
    /**
     * Parse the data files.
     * 
     * @returns Parsed loot data files.
     */
    parse(): Loot {
        let parser = new LootParser();
        
        return {
            lootTables: parser.parseLootTables(DATA_FILES_DIRECTORY + DATA_FILES.LOOT_TABLES)
        }
    }

    /**
     * Download data files from the source repository.
     * 
     * @returns Completes when files are downloaded.
     */
    async download() {
        await fs.mkdir(DATA_FILES_DIRECTORY, {recursive: true});
        let downloads = [];
        for(let file in DATA_FILES) {
            downloads.push(
                fetch(REPOSITORY + DATA_FILES[file])
                    .then(response => response.text())
                    .then(text => fs.writeFile(DATA_FILES_DIRECTORY + DATA_FILES[file], text))
            );
        }
        return Promise.all(downloads);
    }

    /**
     * Check if all data files are downloaded.
     * @returns true if all data files are present, false if one or more file are missing.
     */
    dataFilesExist(): boolean {
        for(let file in DATA_FILES) {
            if (!existsSync(DATA_FILES + DATA_FILES[file])) {
                return false;
            }
            return true;
        }
    }

}