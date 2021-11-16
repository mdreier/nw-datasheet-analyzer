# New World Data File Analyzer

This tool allows analysis of the data files of New World. It is built to work on the converted data files produced by [Kattor's Data Sheet Reader](https://github.com/Kattoor/nw-datasheet-reader), which it can retrieve automatically.

Some samples:

* [All loot tables, probabilites calculated without luck influence](https://mdreier.github.io/nw-datasheet-analyzer/lootTables.html)
* [Available loot buckets, may be referenced from loot tables](https://mdreier.github.io/nw-datasheet-analyzer/lootBuckets.html)

## Installation

This tool is available on [npm](https://www.npmjs.com/package/nw-datasheet-analyzer). If you want to just use the command-line tool, install it globally:

```
npm install -g nw-datasheet-analyzer
```

If you want to use it in your own application or write custom scripts, install it into your dependencies:

```
npm install nw-datasheet-analyzer
```

## Using the command line tool

You can run a basic analysis using the command line script `nw-datasheet-analyzer`. After you cloned the project, run `npm start` to run the script. By default, it will download [Kattoor's data files](https://github.com/Kattoor/nw-datasheets-json) into the folder `data` and prints the result to the standard output. You can see more options by running `npm start -- --help`.

To analyze the data (e.g filter for certain loot tables), use the command line options `--parsedQuery` (working on the parsed data) or `--query` (working on the analyzed data). Both commands use JSONPath syntax, consult the [documentation](https://github.com/JSONPath-Plus/JSONPath#syntax-through-examples) to see your options. The data types on which you are querying are [`Loot`](https://mdreier.github.io/nw-datasheet-analyzer/api/interfaces/Loot.html) (parsed data) and [`AnalyzedLootTable[]`](https://mdreier.github.io/nw-datasheet-analyzer/api/interfaces/AnalyzedLootTable.html) (analyzed data).

## Using the library

For more powerful analysis, you can run your own analysis. This is done in multiple steps. For an example, check out the [command line script](https://github.com/mdreier/nw-datasheet-analyzer/blob/main/src/bin/nwAnalyzer.ts).

### Load the data files

The raw data files are already in a JSON format which could be easily loaded, but the content has a structure which do not lend themselves well to analysis. Therefor the first step is to load and parse the data files into something which resembles a useful format.

```js
import { DataLoader } from 'nw-analyzer'

let loader = new DataLoader(downloadSource, dataFolder);
if (!loader.dataFilesExist()) {
    await loader.download();
}
let dataTables = loader.parse();
```

If you already have the data sheets available locally (e.g. because you parsed the game yourself), you can point the data loader to the folder containing the sheets and use them directly. If you want to use a different table that is shared online, you can point the data loader at the download URL. Note that the file names and folder layout must match the output of the [Data Sheet Reader](https://github.com/Kattoor/nw-datasheet-reader) when run for JSON files.

The resulting data is still in a raw format and not interpreted in any way, except for the restructuring of the contents. Check out the [API documentation](https://mdreier.github.io/nw-datasheet-analyzer/api/index.html) for details on the data format.

### Analyze the data files

The parsed data files still have cross-references between loot tables and use a hard-to-read probability format. This can be made more understandable by running the analyzer.

```js
import { Analyzer } from 'nw-analyzer'

let analyzer = new Analyzer(dataTables);
let analyzedTables = analyzer.analyze();
```

The analyzed tables resolve all cross-references and normalizes probability. The probability will now be in a range between 0 (impossible) and 1 (100%, guaranteed). Again, check the [API documentation](https://mdreier.github.io/nw-datasheet-analyzer/api/index.html) for more information.

### Output

For a quick and simple output of analyzed tables, use the Formatter class.

```js
import { DataLoader } from 'nw-analyzer'

let output = new Formatter(analyzedTables).html();
```

## Ideas for future versions

* Consider luck ratings in the probability calculation
* Compare versions and luck settings
* More analysis options? Create an [issue](https://github.com/mdreier/nw-datasheet-analyzer/issues) if you have ideas.

## Legal

New World is trademarked by Amazone Game Studios. This project has no affiliation with
Amazon or Amazon Game Studios.