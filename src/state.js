import { STARTING_ELO, calculateSinglesMatch, calculateDoublesMatch } from './elo.js';

// ── Match-Normalisierung ───────────────────────────────────────────────────

/**
 * Normalises a raw match object, correcting the column-shift bug present in
 * data imported from old Google Sheets exports where winnerId held the type.
 * Returns { type, winnerId, loserId } with correct values.
 */
export function normaliseMatch(match) {
    const rawType     = String(match.type     || '').toLowerCase();
    const rawWinnerId = String(match.winnerId || '').toLowerCase();

    const columnShifted = rawWinnerId.includes('doubles') || rawWinnerId.includes('singles');
    const type      = columnShifted ? rawWinnerId : rawType;
    const winnerId  = columnShifted ? match.loserId    : match.winnerId;
    const loserId   = columnShifted ? match.winnerName : match.loserId;

    return { type, winnerId, loserId };
}

// ================= APP-ZUSTAND =================

export const state = {
    players:         {},
    matches:         [],
    selectedPlayers: [],
    currentGameMode: 'singles',
    isDataLoading:   false,
};

// ================= PERSISTENZ =================

export function persistPlayers() {
    localStorage.setItem('eloPlayers', JSON.stringify(state.players));
}

export function persistMatches() {
    localStorage.setItem('eloMatches', JSON.stringify(state.matches));
}

export function loadLocalPlayers() {
    const raw = localStorage.getItem('eloPlayers');
    if (!raw) return false;
    try {
        state.players = JSON.parse(raw);
        return true;
    } catch {
        localStorage.removeItem('eloPlayers');
        return false;
    }
}

export function loadLocalMatches() {
    const raw = localStorage.getItem('eloMatches');
    if (!raw) return false;
    try {
        state.matches = JSON.parse(raw);
        return true;
    } catch {
        localStorage.removeItem('eloMatches');
        return false;
    }
}

// ================= STATISTIK-NEUBERECHNUNG =================

/**
 * Setzt alle Spieler-Statistiken auf Startwerte zurück und
 * berechnet sie aus der Match-History neu (chronologisch).
 * Wird nach jedem Laden vom Server aufgerufen.
 */
/**
 * @returns {number} Anzahl der übersprungenen Matches (unbekannte Spieler-IDs)
 */
export function recalculateStatsFromHistory() {
    Object.keys(state.players).forEach(id => {
        state.players[id].elo            = STARTING_ELO;
        state.players[id].matches        = 0;
        state.players[id].wins           = 0;
        state.players[id].losses         = 0;
        state.players[id].doublesElo     = STARTING_ELO;
        state.players[id].doublesMatches = 0;
        state.players[id].doublesWins    = 0;
        state.players[id].doublesLosses  = 0;
    });

    const sorted = [...state.matches].sort((a, b) =>
        new Date(a.date || 0) - new Date(b.date || 0)
    );

    const getIds = (val) => {
        const s = String(val || '').trim();
        return s.includes(',') ? s.split(',').map(x => x.trim()) : [s];
    };

    let skipped = 0;

    sorted.forEach(match => {
        const { type: actualType, winnerId: wRaw, loserId: lRaw } = normaliseMatch(match);
        const isDoubles = actualType.includes('doubles') || String(wRaw || '').includes(',');

        if (!isDoubles) {
            const winnerId = String(wRaw || '').trim();
            const loserId  = String(lRaw || '').trim();
            const winner   = state.players[winnerId];
            const loser    = state.players[loserId];
            if (!winner || !loser) {
                skipped++;
                console.warn(`[ELO] Match ${match.id} übersprungen – unbekannte Spieler-ID (${winnerId}, ${loserId})`);
                return;
            }

            const result       = calculateSinglesMatch(winner.elo, loser.elo);
            winner.elo         = result.winnerElo;
            winner.matches     = (winner.matches || 0) + 1;
            winner.wins        = (winner.wins    || 0) + 1;
            loser.elo          = result.loserElo;
            loser.matches      = (loser.matches  || 0) + 1;
            loser.losses       = (loser.losses   || 0) + 1;
        } else {
            const winners = getIds(wRaw);
            const losers  = getIds(lRaw);
            if (winners.some(id => !state.players[id]) || losers.some(id => !state.players[id])) {
                skipped++;
                console.warn(`[ELO] Match ${match.id} übersprungen – unbekannte Spieler-ID`);
                return;
            }

            const { eloChange } = calculateDoublesMatch(
                winners.map(id => state.players[id].doublesElo),
                losers.map(id =>  state.players[id].doublesElo),
            );

            winners.forEach(id => {
                state.players[id].doublesElo     = (state.players[id].doublesElo     || STARTING_ELO) + eloChange;
                state.players[id].doublesMatches = (state.players[id].doublesMatches || 0) + 1;
                state.players[id].doublesWins    = (state.players[id].doublesWins    || 0) + 1;
            });
            losers.forEach(id => {
                state.players[id].doublesElo     = (state.players[id].doublesElo     || STARTING_ELO) - eloChange;
                state.players[id].doublesMatches = (state.players[id].doublesMatches || 0) + 1;
                state.players[id].doublesLosses  = (state.players[id].doublesLosses  || 0) + 1;
            });
        }
    });

    persistPlayers();
    return skipped;
}
