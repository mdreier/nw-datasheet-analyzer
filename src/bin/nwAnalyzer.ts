#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "fs";
import commandLineArgs from 'command-line-args';
import { CommandLine, commandLineDefinition, printHelp } from "./commandline.js";
import { Analyzer, DataLoader, Formatter } from "../index.js";
import { JSONPath } from "jsonpath-plus";

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
let endProcessing = false;
if (commandLine.parsedQuery) {
    dataTables = JSONPath({
        path: commandLine.parsedQuery,
        json: dataTables
    });
    endProcessing = true;
}

if (endProcessing || commandLine["no-analysis"]) {
    process.stdout.write(JSON.stringify(dataTables, null, 2));
    process.exit(0);
}

let analyzer = new Analyzer(dataTables);
let analyzedTables = analyzer.analyze(commandLine.table);

if (commandLine.query) {
    analyzedTables = JSONPath({
        path: commandLine.query,
        json: analyzedTables
    });
}

if (commandLine.output) {
    let formatter = new Formatter();
    mkdirSync(commandLine.output, {recursive: true});
    writeFileSync(commandLine.output + '/lootTables.html', formatter.lootTables(analyzedTables));
    writeFileSync(commandLine.output + '/lootBuckets.html', formatter.lootBuckets(dataTables.lootBuckets));
} else {
    process.stdout.write(JSON.stringify(analyzedTables, null, 2));
}
