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

let loader = new DataLoader(commandLine.source, commandLine.data);
if (commandLine.forceDownload || !loader.dataFilesExist()) {
    await loader.download();
}

let dataTables = loader.parse();
let analyzer = new Analyzer(dataTables);
let analyzedTables = analyzer.analyze();

let outputFolder = commandLine.output || './docs';

mkdirSync(outputFolder, {recursive: true});
writeFileSync(outputFolder + '/lootTables.html', new Formatter(analyzedTables).html());