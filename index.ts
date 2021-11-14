import { writeFileSync } from "fs";
import { DataLoader } from "./src/DataLoader.js";
import commandLineArgs from 'command-line-args';
import { CommandLine, commandLineDefinition, printHelp } from "./src/commandline.js";

const commandLine = commandLineArgs(commandLineDefinition) as CommandLine;

if (commandLine.help) {
    printHelp();
    process.exit();
}

let loader = new DataLoader();
if (commandLine.forceDownload || !loader.dataFilesExist()) {
    await loader.download();
}

let dataTables = loader.parse();

writeFileSync("data.json", JSON.stringify(dataTables), {encoding: 'utf-8'});