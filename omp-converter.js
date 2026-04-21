const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const readline = require('readline');
const { log, printHeader } = require('./cliui/core');
const AsciiTable = require('./cliui/asciitable');
const formatting = require('./cliui/formatting');

let foundFiles = [];

/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ STATISTICS                                                               │
 * │ Tracks conversion statistics across all processed files.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const stats = {
    filesProcessed: 0,
    filesModified: 0,
    totalReplacements: 0,
    replacementsByType: {},
    
    addReplacement(functionName, count) {
        this.replacementsByType[functionName] = (this.replacementsByType[functionName] || 0) + count;
        this.totalReplacements += count;
    },
    
    incrementProcessed() {
        this.filesProcessed++;
    },
    
    incrementModified() {
        this.filesModified++;
    }
};

/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ file system helpers                                                      │
 * │ utilities for finding and filtering pawn files                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const IGNORED_DIRS = ['node_modules', '.git', '.vscode', 'build', 'dist'];
const PAWN_EXTENSIONS = ['.pwn', '.inc'];

function isPawnFile(filename) {
    return PAWN_EXTENSIONS.some(ext => filename.endsWith(ext));
}

function shouldIgnoreDir(dirname) {
    return IGNORED_DIRS.includes(dirname);
}

function findPawnFiles(dir, fileList = []) {
    try {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                if (!shouldIgnoreDir(file)) {
                    findPawnFiles(filePath, fileList);
                }
            } else if (isPawnFile(file)) {
                fileList.push(filePath);
            }
        });
    } catch (error) {
        log.warning(`Cannot read directory: ${dir}`);
    }
    
    return fileList;
}

/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ parameter parsing                                                        │
 * │ splits function parameters while respecting strings and nesting          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

function splitParameters(params) {
    const result = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < params.length; i++) {
        const char = params[i];
        const prevChar = params[i - 1];
        
        if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }
        
        if (!inString) {
            if (char === '(' || char === '[') depth++;
            if (char === ')' || char === ']') depth--;
            
            if (char === ',' && depth === 0) {
                result.push(current);
                current = '';
                continue;
            }
        }
        
        current += char;
    }
    
    if (current) result.push(current);
    return result;
}

/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ conversion rules                                                         │
 * │ defines all function conversion patterns for open.mp syntax              │
 * │ here you can add / modify as you like                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const FONT_MAPPING = {
    '0': 'TEXT_DRAW_FONT_0',
    '1': 'TEXT_DRAW_FONT_1',
    '2': 'TEXT_DRAW_FONT_2',
    '3': 'TEXT_DRAW_FONT_3',
    '4': 'TEXT_DRAW_FONT_4',
    '5': 'TEXT_DRAW_FONT_5'
};

const CONVERSION_RULES = [
    {
        name: 'ApplyAnimation',
        conversions: [
            { paramIndex: 4, type: 'boolean' },
            { paramIndex: 5, type: 'boolean' },
            { paramIndex: 6, type: 'boolean' },
            { paramIndex: 7, type: 'boolean' }
        ]
    },
    {
        name: 'TextDrawFont',
        conversions: [{ paramIndex: 1, type: 'constant', mapping: FONT_MAPPING }]
    },
    {
        name: 'PlayerTextDrawFont',
        conversions: [{ paramIndex: 2, type: 'constant', mapping: FONT_MAPPING }]
    },
    {
        name: 'TextDrawUseBox',
        conversions: [{ paramIndex: 1, type: 'boolean' }]
    },
    {
        name: 'PlayerTextDrawUseBox',
        conversions: [{ paramIndex: 2, type: 'boolean' }]
    },
    {
        name: 'TogglePlayerControllable',
        conversions: [{ paramIndex: 1, type: 'boolean' }]
    },
    {
        name: 'TextDrawSetSelectable',
        conversions: [{ paramIndex: 1, type: 'boolean' }]
    },
    {
        name: 'PlayerTextDrawSetSelectable',
        conversions: [{ paramIndex: 2, type: 'boolean' }]
    }
];

/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ conversion helpers                                                       │
 * │ core logic for detecting and converting function parameters              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const DECLARATION_KEYWORDS = /^(public|native|forward|stock|callback|function:|function)\s+/;

function isFunctionDeclaration(content, offset) {
    const lineStart = content.lastIndexOf('\n', offset) + 1;
    const lineEnd = content.indexOf('\n', offset);
    const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd).trim();
    return DECLARATION_KEYWORDS.test(line);
}

function convertParameter(param, type, mapping) {
    const trimmed = param.trim();
    
    if (type === 'boolean') {
        if (trimmed === '0') return param.replace('0', 'false');
        if (trimmed === '1') return param.replace('1', 'true');
    } else if (type === 'constant' && mapping && mapping[trimmed]) {
        return param.replace(trimmed, mapping[trimmed]);
    }
    
    return param;
}

function convertToOMP(content, functionName, conversions) {
    let count = 0;
    const regex = new RegExp(`${functionName}\\s*\\(([^)]+)\\)`, 'g');
    
    content = content.replace(regex, (match, params, offset) => {
        if (isFunctionDeclaration(content, offset)) {
            return match;
        }
        
        const paramArray = splitParameters(params);
        
        conversions.forEach(({ paramIndex, type, mapping }) => {
            if (paramArray.length > paramIndex) {
                const original = paramArray[paramIndex];
                const converted = convertParameter(original, type, mapping);
                
                if (original !== converted) {
                    paramArray[paramIndex] = converted;
                    count++;
                }
            }
        });
        
        return `${functionName}(${paramArray.join(',')})`;
    });
    
    return { content, count };
}

function detectEncoding(buffer) {
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf8';
    }
    
    let isSequentiallyValidUtf8 = true;
    let win1251Chars = 0;
    let i = 0;
    
    const sampleSize = Math.min(buffer.length, 4096);
    
    while (i < sampleSize) {
        const byte = buffer[i];
        
        if (byte >= 0xC0 && byte <= 0xFF) {
            win1251Chars++;
        }
        
        if (byte <= 0x7F) {
            i++;
        } else if ((byte & 0xE0) === 0xC0) {
            if (i + 1 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80) {
                isSequentiallyValidUtf8 = false;
                break;
            }
            i += 2;
        } else if ((byte & 0xF0) === 0xE0) {
            if (i + 2 >= buffer.length || 
                (buffer[i + 1] & 0xC0) !== 0x80 || 
                (buffer[i + 2] & 0xC0) !== 0x80) {
                isSequentiallyValidUtf8 = false;
                break;
            }
            i += 3;
        } else {
            isSequentiallyValidUtf8 = false;
            break;
        }
    }
    
    if (!isSequentiallyValidUtf8 && win1251Chars > 0) {
        return 'win1251';
    }
    
    return 'utf8';
}

/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ file processing                                                          │
 * │ handles reading, converting, and writing pawn files                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

function createBackup(filePath, content, encoding) {
    const backupPath = filePath + '.bak';
    fs.writeFileSync(backupPath, iconv.encode(content, encoding));
}

function writeFile(filePath, content, encoding) {
    fs.writeFileSync(filePath, iconv.encode(content, encoding));
}

function processFile(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    log.info(`Processing: ${relativePath}`);
    stats.incrementProcessed();
    
    try {
        const buffer = fs.readFileSync(filePath);
        const encoding = detectEncoding(buffer);
        
        let content = iconv.decode(buffer, encoding);
        const originalContent = content;
        
        CONVERSION_RULES.forEach(rule => {
            const result = convertToOMP(content, rule.name, rule.conversions);
            content = result.content;
            stats.addReplacement(rule.name, result.count);
        });
        
        if (content !== originalContent) {
            createBackup(filePath, originalContent, encoding);
            writeFile(filePath, content, encoding);
            stats.incrementModified();
            
            const changeCount = CONVERSION_RULES.reduce((sum, rule) => {
                const result = convertToOMP(originalContent, rule.name, rule.conversions);
                return sum + result.count;
            }, 0);
            
            log.success(`Modified: ${changeCount} change(s) [${encoding}]`);
        } else {
            log.dim(`No changes [${encoding}]`);
        }
    } catch (error) {
        log.error(`Failed: ${error.message}`);
    }
}

/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ main menu                                                                │
 * │ entry point and summary reporting for the conversion process             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

function printSummary() {
    console.log('\n' + formatting.createDivider());
    console.log('\n📊 CONVERSION SUMMARY\n');
    console.log(`   Files processed: ${stats.filesProcessed}`);
    console.log(`   Files modified:  ${stats.filesModified}`);
    console.log(`   Total changes:   ${stats.totalReplacements}\n`);
    
    if (Object.keys(stats.replacementsByType).length > 0) {
        console.log('   Changes by function:');
        Object.entries(stats.replacementsByType)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .forEach(([func, count]) => {
                console.log(`     • ${func}: ${count}`);
            });
    }
    
    console.log('\n' + formatting.createDivider());
    
    if (stats.filesModified > 0) {
        log.success('Conversion completed! Backup files (.bak) created.');
    } else {
        log.info('No files needed conversion.');
    }
    console.log('');
}

function main() {
    printHeader();
    console.log('');
    
    const startDir = process.cwd();
    const files = findPawnFiles(startDir);
    log.info('Searching for .pwn and .inc files...');
    
    if (files.length === 0) {
        log.warning('No pawn files found in current directory.');
        return;
    }
    
    log.info(`Found ${files.length} file(s) to process\n`);
    console.log('─'.repeat(50) + '\n');
    
    files.forEach(processFile);
    printSummary();
}

function main() {
    printHeader();
    showMenu();
}

main();


function printMenu() {
    const terminalWidth = 130;
    const boxWidth = 118;
    const padding = Math.max(0, Math.floor((terminalWidth - boxWidth) / 2));
    const indent = ' '.repeat(padding);
    
    const menuContent = '\x1b[36m1\x1b[0m - Search for files            \x1b[36m2\x1b[0m - Convert found files            \x1b[36m3\x1b[0m - Exit';
    const cleanContent = menuContent.replace(/\x1b\[[0-9;]*m/g, '');
    const contentPadding = Math.max(0, Math.floor((boxWidth - 2 - cleanContent.length) / 2));
    const rightPadding = boxWidth - 2 - cleanContent.length - contentPadding;
    const paddedContent = ' '.repeat(contentPadding) + menuContent + ' '.repeat(rightPadding);
    
    console.log('');
    console.log(indent + '\x1b[2m╔' + '═'.repeat(boxWidth - 2) + '╗\x1b[0m');
    console.log(indent + '\x1b[2m║\x1b[0m' + paddedContent + '\x1b[2m║\x1b[0m');
    console.log(indent + '\x1b[2m╚' + '═'.repeat(boxWidth - 2) + '╝\x1b[0m');
    console.log('');
}

function searchFiles() {
    log.info('Searching for .pwn and .inc files...');
    
    const startDir = process.cwd();
    foundFiles = findPawnFiles(startDir);
    
    if (foundFiles.length === 0) {
        log.error('No PAWN files found in current directory.');
    } else {
        log.success(`Found ${foundFiles.length} file(s) ready to convert`);
    }
    
    setTimeout(() => showMenu(), 1000);
}

function convertFiles() {
    if (foundFiles.length === 0) {
        log.warning('No files found. Please search for files first (option 1).');
        setTimeout(() => showMenu(), 1500);
        return;
    }
    
    console.log('\n' + formatting.createDivider('CONVERTING') + '\n');
    
    foundFiles.forEach(processFile);
    
    printSummary();
    
    setTimeout(() => showMenu(), 2000);
}

function exitProgram() {
    console.log('\n');
    log.info('Goodbye!');
    console.log('\n');
    process.exit(0);
}

function showMenu() {
    console.clear();
    printHeader();
    printMenu();
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    // for (let i = 1; i <= 100; i++) {
    //     log.success(`Starting process sequence...`);
    // }
    rl.question('Choice: ', (answer) => {
        rl.close();
        
        switch(answer.trim()) {
            case '1':
                searchFiles();
                break;
            case '2':
                convertFiles();
                break;
            case '3':
                exitProgram();
                break;
            default:
                log.error('invalid option.');
                setTimeout(() => showMenu(), 1000);
        }
    });
}
