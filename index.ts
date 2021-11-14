import { writeFileSync } from "fs";
import { DataLoader } from "./src/DataLoader.js";

let loader = new DataLoader();
if (!loader.dataFilesExist()) {
    await loader.download();
}

let dataTables = loader.parse();

writeFileSync("data.json", JSON.stringify(dataTables), {encoding: 'utf-8'});