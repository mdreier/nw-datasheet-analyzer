import commandLineUsage from 'command-line-usage';

interface CommandLine {
    forceDownload: boolean,
    help: boolean
}

const commandLineDefinition = [
    { 
        name: 'forceDownload', 
        alias: 'f', 
        type: Boolean,
        description: 'Force download of data files, even if they exist'
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
            content: 'Analyze the data files of New World'
        },
        {
            header: 'Options',
            optionList: commandLineDefinition
        }
    ];

    process.stdout.write(commandLineUsage(sections));
}

export {commandLineDefinition, printHelp, CommandLine};