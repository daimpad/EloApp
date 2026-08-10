import { STARTING_ELO } from './elo.js';
import { replayMatches } from './replay.js';

// Re-Export, damit bestehende Importe aus state.js weiter funktionieren.
// Die Definition lebt in match.js — dort, wo sie hingehört.
export {
    normaliseMatch, parsePlayerIds, matchInvolves, isWinner,
    compareMatches, sortMatchesAsc, sortMatchesDesc,
    SINGLES, DOUBLES,
} from './match.js';

// ================= APP-ZUSTAND =================

export const state = {
    players:         {},
    matches:         [],
    selectedPlayers: [],   // Doppel: Klickreihenfolge, Index 0-1 = Team 1
    selectedSingles: [],   // Einzel: Klickreihenfolge, Index 0 = Gewinner
    currentGameMode: 'singles',
    isDataLoading:   false,
    lastSyncedAt:    null, // ISO-Zeitstempel des letzten erfolgreichen Server-Abrufs
};

// ================= PERSISTENZ =================
//
// Die Schlüssel werden pro Instanz benannt: zwei White-Label-Instanzen unter
// user.github.io/clubA/ und /clubB/ teilen sich sonst denselben localStorage
// und überschreiben sich gegenseitig.

let storagePrefix  = 'elo';
let storageEnabled = true;
let storageWarned  = false;

const LEGACY_KEYS = { players: 'eloPlayers', matches: 'eloMatches' };

/**
 * @param {{ namespace?: string, enabled?: boolean }} options
 *   namespace — beliebiger Instanz-Schlüssel, üblicherweise die Supabase-URL
 *   enabled   — im Demo-Modus false, damit Beispieldaten den echten Cache
 *               nicht überschreiben
 */
export function initStorage({ namespace = '', enabled = true } = {}) {
    storagePrefix  = namespace ? `elo:${slug(namespace)}` : 'elo';
    storageEnabled = enabled;
    storageWarned  = false;
}

/** Macht aus einer Supabase-URL einen lesbaren, eindeutigen Schlüsselteil. */
function slug(value) {
    return String(value)
        .replace(/^https?:\/\//, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 60);
}

function key(name) {
    return `${storagePrefix}:${name}`;
}

/**
 * Schreibt in den localStorage und meldet Misserfolg, statt zu werfen.
 * setItem wirft real: Safari-Privatmodus, blockierter Storage, volle Quote.
 * @returns {boolean} true wenn geschrieben wurde
 */
function safeSet(name, value) {
    if (!storageEnabled) return false;
    try {
        localStorage.setItem(key(name), JSON.stringify(value));
        return true;
    } catch {
        if (!storageWarned) {
            storageWarned = true;
            console.warn('[Storage] Offline-Zwischenspeicher nicht verfügbar.');
        }
        return false;
    }
}

function safeGet(name, legacyName) {
    let raw = null;
    try {
        raw = localStorage.getItem(key(name));
        // Einmalige Übernahme des alten, nicht benannten Schlüssels.
        if (raw === null && legacyName) raw = localStorage.getItem(legacyName);
    } catch {
        return undefined;
    }

    if (raw === null) return undefined;

    try {
        return JSON.parse(raw);
    } catch {
        try {
            localStorage.removeItem(key(name));
            if (legacyName) localStorage.removeItem(legacyName);
        } catch { /* nicht kritisch */ }
        return undefined;
    }
}

/** @returns {boolean} true wenn der Zwischenspeicher verfügbar ist */
export function persistPlayers() {
    return safeSet('players', state.players);
}

/** @returns {boolean} true wenn der Zwischenspeicher verfügbar ist */
export function persistMatches() {
    const ok = safeSet('matches', state.matches);
    safeSet('syncedAt', state.lastSyncedAt);
    return ok;
}

export function loadLocalPlayers() {
    const players = safeGet('players', LEGACY_KEYS.players);
    if (!players || typeof players !== 'object') return false;
    state.players = players;
    return true;
}

export function loadLocalMatches() {
    const matches = safeGet('matches', LEGACY_KEYS.matches);
    if (!Array.isArray(matches)) return false;

    state.matches      = matches;
    state.lastSyncedAt = safeGet('syncedAt') ?? null;
    return true;
}

// ================= STATISTIK-NEUBERECHNUNG =================

/**
 * Setzt alle Spieler-Statistiken auf Startwerte zurück und berechnet sie aus
 * der Match-History neu (chronologisch). Die Historie ist die Wahrheitsquelle,
 * nicht die gespeicherten ELO-Werte.
 *
 * Schreibt nebenbei die tatsächlich berechnete `eloChange` in jedes Match
 * zurück. Damit stimmen Spielverlauf und Rangliste auch für importierte
 * Altdaten überein, in denen der Wert erfunden oder gerundet war.
 *
 * Persistiert bewusst NICHT selbst — das entscheidet der Aufrufer, damit ein
 * Kaltstart nicht mehrfach synchron in den localStorage schreibt.
 *
 * @returns {number} Anzahl der übersprungenen Matches (unbekannte Spieler-IDs)
 */
export function recalculateStatsFromHistory() {
    for (const player of Object.values(state.players)) {
        player.elo            = STARTING_ELO;
        player.matches        = 0;
        player.wins           = 0;
        player.losses         = 0;
        player.doublesElo     = STARTING_ELO;
        player.doublesMatches = 0;
        player.doublesWins    = 0;
        player.doublesLosses  = 0;
    }

    const { skipped } = replayMatches(
        state.matches,
        Object.keys(state.players),
        ({ match, isDoubles, eloChange, updated }) => {
            match.eloChange = eloChange;

            for (const { id, elo, won } of updated) {
                const player = state.players[id];

                if (isDoubles) {
                    player.doublesElo     = elo;
                    player.doublesMatches += 1;
                    if (won) player.doublesWins += 1;
                    else     player.doublesLosses += 1;
                } else {
                    player.elo      = elo;
                    player.matches += 1;
                    if (won) player.wins += 1;
                    else     player.losses += 1;
                }
            }
        },
    );

    if (skipped > 0) {
        console.warn(`[ELO] ${skipped} Spiel(e) übersprungen – unbekannte oder doppelte Spieler-IDs.`);
    }

    return skipped;
}

/**
 * Fügt ein Match hinzu und rechnet die Statistiken vollständig neu.
 *
 * Der Replay ist die Wahrheitsquelle — die Werte optimistisch im Aufrufer zu
 * berechnen, ließ die players-Tabelle über die Zeit von der Historie
 * abdriften, weil bei jedem Schreibvorgang In-Memory-Werte statt
 * nachgerechneter Werte hochgeladen wurden.
 *
 * @returns {number} übersprungene Matches
 */
export function applyMatch(match) {
    state.matches.push(match);
    return recalculateStatsFromHistory();
}

/**
 * Nimmt ein zuvor per applyMatch hinzugefügtes Match wieder zurück.
 */
export function revertMatch(match) {
    state.matches = state.matches.filter(m => m !== match);
    return recalculateStatsFromHistory();
}

/**
 * Entfernt ein Match anhand seiner ID und rechnet neu.
 */
export function removeMatchById(id) {
    state.matches = state.matches.filter(m => m.id !== id);
    return recalculateStatsFromHistory();
}
