/**
 * Wendet das BRANDING-Objekt aus config.js auf die App an.
 * Wird einmalig beim Start aufgerufen.
 *
 * Alle Felder sind optional — fehlende Werte behalten den CSS-Default.
 */
export function applyBranding(branding = {}) {
    const root = document.documentElement;

    if (branding.primaryColor) {
        root.style.setProperty('--brand-primary', branding.primaryColor);
        // Dunklere Variante automatisch ableiten wenn nicht explizit gesetzt
        root.style.setProperty('--brand-primary-dark',
            branding.primaryColorDark || darken(branding.primaryColor, 0.15));
        root.style.setProperty('--brand-primary-glow',
            branding.primaryColorGlow || hexToRgba(branding.primaryColor, 0.3));
    }

    if (branding.fontHeading) {
        root.style.setProperty('--brand-font-heading', `'${branding.fontHeading}', cursive`);
    }

    if (branding.fontBody) {
        root.style.setProperty('--brand-font-body', `'${branding.fontBody}', sans-serif`);
    }

    if (branding.googleFonts) {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = branding.googleFonts;
        document.head.appendChild(link);
    }

    const appName = branding.name || 'SpeedHennen 🏸🐔';

    document.title = appName;

    const h1 = document.querySelector('.header h1');
    if (h1) h1.textContent = appName;

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && branding.primaryColor) metaTheme.content = branding.primaryColor;

    const metaTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (metaTitle && branding.shortName) metaTitle.content = branding.shortName;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function expandHex(hex) {
    // Expand 3-digit shorthand (#f00 → #ff0000)
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
        return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return hex;
}

function hexToRgba(hex, alpha) {
    hex = expandHex(hex);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex, amount) {
    hex = expandHex(hex);
    const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
    const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
    const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
