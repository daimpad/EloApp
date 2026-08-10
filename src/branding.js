/**
 * Wendet das BRANDING-Objekt aus config.js auf die App an.
 * Wird einmalig beim Start aufgerufen.
 *
 * Alle Felder sind optional — fehlende Werte behalten den Standard.
 */

const DEFAULTS = {
    name:         'EloApp 🏸',
    shortName:    'EloApp',
    primaryColor: '#c51216',
    fontHeading:  'Fredoka One',
    fontBody:     'Quicksand',
    googleFonts:  'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Quicksand:wght@400;700&display=swap',
};

export function applyBranding(branding = {}) {
    const config = { ...DEFAULTS, ...branding };
    const root   = document.documentElement;

    root.style.setProperty('--brand-primary', config.primaryColor);
    root.style.setProperty('--brand-primary-dark',
        branding.primaryColorDark || darken(config.primaryColor, 0.15));
    root.style.setProperty('--brand-primary-glow',
        branding.primaryColorGlow || hexToRgba(config.primaryColor, 0.3));

    root.style.setProperty('--brand-font-heading', `'${config.fontHeading}', cursive`);
    root.style.setProperty('--brand-font-body',    `'${config.fontBody}', sans-serif`);

    // Die Schriften werden hier geladen, nicht im HTML — sonst würde bei
    // eigenem Branding zusätzlich zum eigenen Stylesheet noch der Standard
    // heruntergeladen.
    if (config.googleFonts) {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = config.googleFonts;
        document.head.appendChild(link);
    }

    document.title = config.name;

    const heading = document.querySelector('.header h1');
    if (heading) heading.textContent = config.name;

    setMeta('theme-color', config.primaryColor);
    setMeta('apple-mobile-web-app-title', config.shortName);

    applyManifest(config, branding);
}

/**
 * Die Markenfarbe als Hex-Wert — eine gemeinsame Quelle für die Stellen, die
 * sie in JavaScript brauchen (Diagramm, Konfetti). Vorher stand '#c51216' an
 * mehreren Stellen fest im Code und ignorierte damit das Branding.
 */
export function brandColor() {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-primary')
        .trim();
    return value || DEFAULTS.primaryColor;
}

// ── Manifest ───────────────────────────────────────────────────────────────

/**
 * Das statische manifest.json kennt das Branding nicht — auf dem Homescreen
 * eines rebrandeten Vereins stünde sonst weiterhin "EloApp". Wenn Branding
 * gesetzt ist, wird zur Laufzeit ein angepasstes Manifest erzeugt.
 */
function applyManifest(config, branding) {
    const customised = branding.name || branding.shortName || branding.primaryColor;
    if (!customised) return;

    const link = document.querySelector('link[rel="manifest"]');
    if (!link || typeof URL.createObjectURL !== 'function') return;

    // Relative Pfade würden gegen die blob:-URL aufgelöst — hier also absolut.
    const base = new URL('./', location.href).href;

    const manifest = {
        name:             config.name,
        short_name:       config.shortName,
        description:      branding.description || 'ELO-Ranking für Einzel und Doppel',
        start_url:        base,
        scope:            base,
        display:          'standalone',
        orientation:      'portrait-primary',
        background_color: '#ffffff',
        theme_color:      config.primaryColor,
        icons: [192, 512].map(size => ({
            src:     `${base}icons/icon-${size}.png`,
            sizes:   `${size}x${size}`,
            type:    'image/png',
            purpose: 'any maskable',
        })),
    };

    try {
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
        link.href = URL.createObjectURL(blob);
    } catch {
        // Kein Blob-Support: das statische Manifest bleibt aktiv.
    }
}

function setMeta(name, content) {
    if (!content) return;
    const meta = document.querySelector(`meta[name="${name}"]`);
    if (meta) meta.content = content;
}

// ── Farb-Hilfsfunktionen ───────────────────────────────────────────────────

function expandHex(hex) {
    // Kurzform erweitern (#f00 → #ff0000)
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
        return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return hex;
}

function channels(hex) {
    const expanded = expandHex(String(hex || ''));
    if (!/^#[0-9a-fA-F]{6}$/.test(expanded)) return null;
    return [
        parseInt(expanded.slice(1, 3), 16),
        parseInt(expanded.slice(3, 5), 16),
        parseInt(expanded.slice(5, 7), 16),
    ];
}

function hexToRgba(hex, alpha) {
    const rgb = channels(hex);
    if (!rgb) return `rgba(197, 18, 22, ${alpha})`;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function darken(hex, amount) {
    const rgb = channels(hex);
    if (!rgb) return hex;
    return '#' + rgb
        .map(c => Math.max(0, Math.round(c * (1 - amount))).toString(16).padStart(2, '0'))
        .join('');
}
