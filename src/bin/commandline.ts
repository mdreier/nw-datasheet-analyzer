import commandLineUsage, {OptionDefinition} from 'command-line-usage';

interface CommandLine {
    forceDownload: boolean,
    help: boolean,
    source: string,
    data: string,
    output: string,
    query: string,
    parsedQuery: string,
    "no-analysis": boolean,
    table: string[]
}

const commandLineDefinition: OptionDefinition[] = [
    { 
        name: 'forceDownload', 
        alias: 'f', 
        type: Boolean,
        description: 'Force download of data files, even if they exist'
    },
    {
        name: 'source',
        alias: 's',
        type: String,
        description: 'Data file source (URL)'
    },
    {
        name: 'data',
        alias: 'd',
        type: String,
        description: 'Data directory'
    },
    {
        name: 'table',
        alias: 't',
        type: String,
        description: 'Table to analyze. Can be specified multiple times',
        multiple: true
    },
    {
        name: 'parsedQuery',
        alias: 'p',
        type: String,
        description: 'JSONPath query to be executed on the parsed tables (type Loot) before analysis'
    },
    {
        name: 'no-analysis',
        type: Boolean,
        description: 'Skip analysis step, output raw data. Cannot be combined with --output.'
    },
    {
        name: 'query',
        alias: 'q',
        type: String,
        description: 'JSONPath query to be executed on the analyzed tables (type AnalyzedLootTable[]) before output'
    },
    {
        name: 'output',
        alias: 'o',
        type: String,
        description: 'Output directory'
    },
    { 
        name: 'help', 
        type: Boolean,
        description: 'Show this help'
    }
]

function printHelp() {
    const sections = [
        {
            header: 'New World Data File Analyzer',
            content: 'Analyze the data files of New World. Creates HTML output.'
        },
        {
            header: 'Options',
            optionList: commandLineDefinition
        }
    ];

    process.stdout.write(commandLineUsage(sections));
}

export {commandLineDefinition, printHelp, CommandLine};