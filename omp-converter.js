const fs = require('fs');
const path = require('path');

// Statistics
let stats = {
    filesProcessed: 0,
    filesModified: 0,
    totalReplacements: 0,
    replacementsByType: {}
};

function findPawnFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                findPawnFiles(filePath, fileList);
            }
        } else if (file.endsWith('.pwn') || file.endsWith('.inc')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

function convertToOMP(content, functionName, conversions) {
    let count = 0;
    
    const regex = new RegExp(`${functionName}\\s*\\(([^)]+)\\)`, 'g');
    
    content = content.replace(regex, (match, params) => {
        const paramArray = splitParameters(params);
        
        conversions.forEach(({ paramIndex, type, mapping }) => {
            if (paramArray.length > paramIndex) {
                const param = paramArray[paramIndex].trim();
                
                if (type === 'boolean') {
                    if (param === '0') {
                        paramArray[paramIndex] = paramArray[paramIndex].replace('0', 'false');
                        count++;
                    } else if (param === '1') {
                        paramArray[paramIndex] = paramArray[paramIndex].replace('1', 'true');
                        count++;
                    }
                } else if (type === 'constant') {
                    if (mapping && mapping[param]) {
                        paramArray[paramIndex] = paramArray[paramIndex].replace(param, mapping[param]);
                        count++;
                    }
                }
            }
        });
        
        return `${functionName}(${paramArray.join(',')})`;
    });
    
    return { content, count };
}

function splitParameters(params) {
    const result = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < params.length; i++) {
        const char = params[i];
        
        if ((char === '"' || char === "'") && params[i - 1] !== '\\') {
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
            { paramIndex: 4, type: 'boolean' }, // loop
            { paramIndex: 5, type: 'boolean' }, // lockX
            { paramIndex: 6, type: 'boolean' }, // lockY
            { paramIndex: 7, type: 'boolean' }  // freeze
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

function processFile(filePath) {
    console.log(`Processing: ${filePath}`);
    stats.filesProcessed++;
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileReplacements = 0;
    
    CONVERSION_RULES.forEach(rule => {
        const result = convertToOMP(content, rule.name, rule.conversions);
        content = result.content;
        fileReplacements += result.count;
        stats.replacementsByType[rule.name] = (stats.replacementsByType[rule.name] || 0) + result.count;
    });
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath + '.bak', originalContent, 'utf8');
        fs.writeFileSync(filePath, content, 'utf8');
        stats.filesModified++;
        stats.totalReplacements += fileReplacements;
        console.log(`  - Modified (${fileReplacements} replacements) - backup created`);
    } else {
        console.log(`  - No changes needed`);
    }
}

console.log(' ----- omp converter ----- \n');
console.log('searching for .pwn and .inc files...\n');

const startDir = process.cwd();
const files = findPawnFiles(startDir);

console.log(`Found ${files.length} files to process\n`);
console.log('----- \n');

files.forEach(file => {
    try {
        processFile(file);
    } catch (error) {
        console.error(`error processing ${file}:`, error.message);
    }
});

console.log('\n----- ----- ----- ----- ----- ----- ----- ');
console.log('\n----- summary ----- ');
console.log(`files processed: ${stats.filesProcessed}`);
console.log(`files modified: ${stats.filesModified}`);
console.log(`total replacements: ${stats.totalReplacements}`);
console.log('\nReplacements by function:');
Object.entries(stats.replacementsByType).forEach(([func, count]) => {
    console.log(`  ${func}: ${count}`);
});
console.log('\nbackup files (.bak) created for all modified files.');
