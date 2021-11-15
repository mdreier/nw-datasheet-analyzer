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
     * Directory for data files.
     */
    #dataFilesDirectory: string;

    /**
     * Download source for data files.
     */
    #repository: string;

    /**
     * Create a new data loader instance.
     * @param repository Download source for data files.
     * @param dataFilesDirectory Directory for data files.
     */
    constructor(repository?: string, dataFilesDirectory?: string) {
        this.#dataFilesDirectory = dataFilesDirectory || DATA_FILES_DIRECTORY;
        if (!this.#dataFilesDirectory.endsWith('/')) {
            this.#dataFilesDirectory += '/';
        }
        this.#repository = repository || REPOSITORY;
        if (!this.#repository.endsWith('/')) {
            this.#dataFilesDirectory += '/';
        }
    }

    /**
     * Parse the data files.
     * 
     * @returns Parsed loot data files.
     */
    parse(): Loot {
        let parser = new LootParser();
        
        return {
            lootTables: parser.parseLootTables(this.#dataFilesDirectory + DataFiles.LootTables),
            lootBuckets: parser.parseLootBuckets(this.#dataFilesDirectory + DataFiles.LootBuckets)
        }
    }

    /**
     * Download data files from the source repository.
     * 
     * @returns Completes when files are downloaded.
     */
    async download() {
        console.debug("Loading data files");
        await fs.mkdir(this.#dataFilesDirectory, {recursive: true});
        let downloads = [];
        for(let file in DataFiles) {
            downloads.push(
                fetch(this.#repository + DataFiles[file])
                    .then(response => response.text())
                    .then(text => fs.writeFile(this.#dataFilesDirectory + DataFiles[file], text))
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
            if (!existsSync(this.#dataFilesDirectory + DataFiles[file])) {
                return false;
            }
            return true;
        }
    }

}