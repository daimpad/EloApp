/**
 * Erzeugt die PWA-Icons als PNG.
 *
 * iOS ignoriert SVG als apple-touch-icon, und die vorherigen Icons enthielten
 * ein Emoji als <text>-Element — Emoji-Glyphen rastern je nach Plattform
 * unterschiedlich oder gar nicht.
 *
 * Aufruf: node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BRAND = [0xc5, 0x12, 0x16];
const WHITE = [0xff, 0xff, 0xff];

/** Federball-Silhouette, normiert auf eine 1×1-Fläche. */
function shuttlecock(x, y) {
    // Kork-Halbkugel unten
    const corkX = 0.5, corkY = 0.70, corkR = 0.145;
    const dx = x - corkX, dy = y - corkY;
    if (dx * dx + dy * dy <= corkR * corkR) return 'cork';

    // Federkranz: nach oben aufgeweiteter Trapez-Rock
    const top = 0.22, bottom = 0.70;
    if (y >= top && y <= bottom) {
        const t = (y - top) / (bottom - top);
        const half = 0.235 - t * (0.235 - 0.135);
        const offset = Math.abs(x - 0.5);

        if (offset <= half) {
            // Trennlinien zwischen den Federn
            const rel = (x - 0.5) / half;
            for (const line of [-0.62, -0.21, 0.21, 0.62]) {
                if (Math.abs(rel - line) < 0.055 && y > top + 0.03) return 'seam';
            }
            return 'skirt';
        }
    }

    return null;
}

/** Abgerundetes Quadrat als Hintergrund (volle Fläche, für maskable Icons). */
function insideRoundedSquare(x, y, radius = 0.22) {
    const cx = Math.min(Math.max(x, radius), 1 - radius);
    const cy = Math.min(Math.max(y, radius), 1 - radius);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
}

function renderIcon(size) {
    const samples = 3;
    const pixels = Buffer.alloc(size * size * 4);

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let r = 0, g = 0, b = 0, a = 0;

            for (let sy = 0; sy < samples; sy++) {
                for (let sx = 0; sx < samples; sx++) {
                    const x = (px + (sx + 0.5) / samples) / size;
                    const y = (py + (sy + 0.5) / samples) / size;

                    if (!insideRoundedSquare(x, y)) continue;

                    // Der Federball sitzt in der sicheren Zone (mittlere 80 %),
                    // damit maskable Icons nichts abschneiden.
                    const inner = { x: (x - 0.1) / 0.8, y: (y - 0.1) / 0.8 };
                    const part = (inner.x >= 0 && inner.x <= 1 && inner.y >= 0 && inner.y <= 1)
                        ? shuttlecock(inner.x, inner.y)
                        : null;

                    const colour = (part === 'skirt' || part === 'cork') ? WHITE : BRAND;

                    r += colour[0];
                    g += colour[1];
                    b += colour[2];
                    a += 255;
                }
            }

            const total = samples * samples;
            const i = (py * size + px) * 4;
            pixels[i]     = Math.round(r / total);
            pixels[i + 1] = Math.round(g / total);
            pixels[i + 2] = Math.round(b / total);
            pixels[i + 3] = Math.round(a / total);
        }
    }

    return encodePng(size, size, pixels);
}

// ── Minimaler PNG-Encoder ──────────────────────────────────────────────────

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);

    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);

    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);

    return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buffer) {
    let c = -1;
    for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return c ^ -1;
}

function encodePng(width, height, rgba) {
    const raw = Buffer.alloc(height * (width * 4 + 1));
    for (let y = 0; y < height; y++) {
        raw[y * (width * 4 + 1)] = 0; // Filter: None
        rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8]  = 8; // Bittiefe
    ihdr[9]  = 6; // Farbtyp: RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ── Ausgabe ────────────────────────────────────────────────────────────────

mkdirSync('icons', { recursive: true });

for (const size of [180, 192, 512]) {
    const file = `icons/icon-${size}.png`;
    writeFileSync(file, renderIcon(size));
    console.log(`${file} geschrieben`);
}
