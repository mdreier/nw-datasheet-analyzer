#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "fs";
import commandLineArgs from 'command-line-args';
import { CommandLine, commandLineDefinition, printHelp } from "./commandline.js";
import { Analyzer, DataLoader, Formatter } from "../index.js";

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
let analyzer = new Analyzer(dataTables);
let analyzedTables = analyzer.analyze();

mkdirSync('./docs', {recursive: true});
writeFileSync('./docs/lootTables.html', new Formatter(analyzedTables).html());