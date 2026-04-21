/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ formating module                                                         │
 * │ provides text formatting utilities for console output                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const TERMINAL_WIDTH = 130;

class Formatting {
    createDivider(title = null) {
        const dividerLength = Math.round(TERMINAL_WIDTH / 1.25);
        const divider = '═'.repeat(dividerLength);
        
        if (title) {
            const half = divider.substring(0, Math.round(divider.length / 2));
            return `${half} ${title} ${half}`;
        }
        
        return divider;
    }
    
    center(text) {
        const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');
        const padding = Math.max(0, Math.floor((TERMINAL_WIDTH - cleanText.length) / 2));
        return ' '.repeat(padding) + text;
    }
    
    space(text, length) {
        const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');
        const spacesNeeded = Math.max(0, length - cleanText.length);
        return text + ' '.repeat(spacesNeeded);
    }
    
    pad(text, totalWidth, align = 'left') {
        const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');
        const spacesNeeded = Math.max(0, totalWidth - cleanText.length);
        
        if (align === 'center') {
            const leftPad = Math.floor(spacesNeeded / 2);
            const rightPad = spacesNeeded - leftPad;
            return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
        } else if (align === 'right') {
            return ' '.repeat(spacesNeeded) + text;
        } else {
            return text + ' '.repeat(spacesNeeded);
        }
    }
}

module.exports = new Formatting();
