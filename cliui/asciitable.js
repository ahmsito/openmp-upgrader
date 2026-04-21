/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ascii art tables module                                                  │
 * │ creates ascii tables with box-drawing characters                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const PIPES = {
    downright: '╔',
    downleft: '╗',
    leftright: '═',
    updown: '║',
    upright: '╚',
    upleft: '╝',
    downleftright: '╦',
    upleftright: '╩',
    updownleft: '╣',
    updownright: '╠',
    updownleftright: '╬'
};

class AsciiTable {
    constructor(options = {}) {
        this.columns = [];
        this.rows = [];
        this.showDividers = options.showDividers !== false;
        this.rainbowDividers = options.rainbowDividers || false;
        this.center = options.center || false;
        this.colWidth = 0;
    }
    
    addColumn(header) {
        this.columns.push(header);
        return this;
    }
    
    addRow(...cells) {
        this.rows.push(cells);
        return this;
    }
    
    calculateColWidth() {
        let maxWidth = 0;
        
        this.columns.forEach(col => {
            if (col.length > maxWidth) maxWidth = col.length;
        });
        
        this.rows.forEach(row => {
            row.forEach(cell => {
                const cellStr = String(cell);
                if (cellStr.length > maxWidth) maxWidth = cellStr.length;
            });
        });
        
        this.colWidth = maxWidth + 4;
    }
    
    buildTopLine() {
        let line = PIPES.downright;
        for (let i = 0; i < this.columns.length; i++) {
            if (i > 0) line += PIPES.downleftright;
            line += PIPES.leftright.repeat(this.colWidth - 1);
        }
        line += PIPES.downleft;
        return line;
    }
    
    buildBottomLine() {
        let line = PIPES.upright;
        for (let i = 0; i < this.columns.length; i++) {
            if (i > 0) line += PIPES.upleftright;
            line += PIPES.leftright.repeat(this.colWidth - 1);
        }
        line += PIPES.upleft;
        return line;
    }
    
    buildDivider() {
        let line = PIPES.updownright;
        for (let i = 0; i < this.columns.length; i++) {
            if (i > 0) line += PIPES.updownleftright;
            line += PIPES.leftright.repeat(this.colWidth - 1);
        }
        line += PIPES.updownleft;
        return line;
    }
    
    buildRow(cells) {
        const formatted = cells.map(cell => {
            const str = String(cell);
            const padding = this.colWidth - str.length - 3;
            return str + ' '.repeat(Math.max(0, padding));
        });
        
        while (formatted.length < this.columns.length) {
            formatted.push(' '.repeat(this.colWidth - 3));
        }
        
        return `${PIPES.updown} ${formatted.join(` ${PIPES.updown} `)} ${PIPES.updown}`;
    }
    
    toString() {
        this.calculateColWidth();
        
        const lines = [];
        
        lines.push(this.buildTopLine());
        lines.push(this.buildRow(this.columns));
        
        this.rows.forEach(row => {
            if (this.showDividers) {
                lines.push(this.buildDivider());
            }
            lines.push(this.buildRow(row));
        });
        
        lines.push(this.buildBottomLine());
        
        return lines.join('\n');
    }
    
    print() {
        const terminalWidth = 130;
        const lines = this.toString().split('\n');
        
        lines.forEach(line => {
            if (this.center) {
                const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
                const padding = Math.max(0, Math.floor((terminalWidth - cleanLine.length) / 2));
                console.log(' '.repeat(padding) + (this.rainbowDividers ? `\x1b[2m${line}\x1b[0m` : line));
            } else {
                console.log(this.rainbowDividers ? `\x1b[2m${line}\x1b[0m` : line);
            }
        });
    }
}

module.exports = AsciiTable;
