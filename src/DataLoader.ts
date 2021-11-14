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
const DataFiles = {
    LootTables: "javelindata_loottables.json",
    LootBuckets: "javelindata_lootbuckets.json"
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
            lootTables: parser.parseLootTables(DATA_FILES_DIRECTORY + DataFiles.LootTables),
            lootBuckets: parser.parseLootBuckets(DATA_FILES_DIRECTORY + DataFiles.LootBuckets)
        }
    }

    /**
     * Download data files from the source repository.
     * 
     * @returns Completes when files are downloaded.
     */
    async download() {
        console.debug("Loading data files");
        await fs.mkdir(DATA_FILES_DIRECTORY, {recursive: true});
        let downloads = [];
        for(let file in DataFiles) {
            downloads.push(
                fetch(REPOSITORY + DataFiles[file])
                    .then(response => response.text())
                    .then(text => fs.writeFile(DATA_FILES_DIRECTORY + DataFiles[file], text))
            );
        }
        console.debug(`${downloads.length} data files queued for download`);
        return Promise.all(downloads);
    }

    /**
     * Check if all data files are downloaded.
     * @returns true if all data files are present, false if one or more file are missing.
     */
    dataFilesExist(): boolean {
        for(let file in DataFiles) {
            if (!existsSync(DataFiles + DataFiles[file])) {
                return false;
            }
            return true;
        }
    }

}