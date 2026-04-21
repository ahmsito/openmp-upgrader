/* 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ core logging module                                                      │
 * │ provides formatted console output with rainbow timestamps and tags.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

let colorRotation = 0;
const colorRotationOffset = 5;

function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    
    let r, g, b;
    
    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }
    
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
}

function getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(2, '0').substring(0, 2);
    
    colorRotation += colorRotationOffset;
    if (colorRotation >= 360) colorRotation = 0;
    
    const rgb = hsvToRgb(colorRotation, 1, 1);
    const color = `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`;
    
    return `${color}[${hours}:${minutes}:${seconds}.${ms}]\x1b[0m`;
}

function padToTag(msg) {
    const tagStartPosition = 105;
    const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, '');
    const currentLength = 15 + cleanMsg.length;
    const spacesNeeded = Math.max(1, tagStartPosition - currentLength);
    return ' ' + msg + ' '.repeat(spacesNeeded);
}

const log = {
    error: (msg) => console.log(`${getTimestamp()} \x1b[31m${msg}\x1b[0m`),
    success: (msg) => console.log(`${getTimestamp()} \x1b[32m${msg}\x1b[0m`),
    info: (msg) => console.log(`${getTimestamp()}${padToTag(msg)}\x1b[36m[ INFO ]\x1b[0m`),
    warning: (msg) => console.log(`${getTimestamp()}\x1b[33m${padToTag(msg)}[ WARNING ]\x1b[0m`),
    dim: (msg) => console.log(`${getTimestamp()} \x1b[2m${msg}\x1b[0m`)
};

function printHeader(terminalWidth = 130) {
    console.clear();
    
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[8;30;130t');
    }
    
    const lines = [
        '',
        '                                                                      ',
        '  ▄████▄   ██▄███▄    ▄████▄   ██▄████▄            ████▄██▄  ██▄███▄  ',
        ' ██▀  ▀██  ██▀  ▀██  ██▄▄▄▄██  ██▀   ██            ██ ██ ██  ██▀  ▀██ ',
        ' ██    ██  ██    ██  ██▀▀▀▀▀▀  ██    ██            ██ ██ ██  ██    ██ ',
        ' ▀██▄▄██▀  ███▄▄██▀  ▀██▄▄▄▄█  ██    ██     ██     ██ ██ ██  ███▄▄██▀ ',
        '   ▀▀▀▀    ██ ▀▀▀      ▀▀▀▀▀   ▀▀    ▀▀     ▀▀     ▀▀ ▀▀ ▀▀  ██ ▀▀▀   ',
        '           ██                                                ██       ',
        'converter',
        '',
        '',
        'convert legacy pawn syntax to the new modern open.mp syntax',
        'this is still in very beta and any pull requests are welcome',
        ''
    ];
    
    lines.forEach(line => {
        const padding = Math.max(0, Math.floor((terminalWidth - line.length) / 2));
        console.log(' '.repeat(padding) + line);
    });
    console.log('');
}

module.exports = {
    log,
    printHeader,
    hsvToRgb,
    getTimestamp
};
