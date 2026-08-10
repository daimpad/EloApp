/**
 * Interpretation eines Match-Objekts — die einzige Stelle, an der entschieden
 * wird, was Typ, Gewinner und Verlierer eines Matches sind.
 *
 * Bewusst abhängigkeitsfrei, damit state.js, chart.js, ui.js und streaks.js
 * dieselbe Sicht auf ein Match haben. Vorher existierte diese Logik in fünf
 * Varianten, die sich in Details unterschieden (Trim, toLowerCase, Umgang mit
 * leeren IDs) — mit dem Ergebnis, dass dasselbe Match je nach Ansicht als
 * Einzel oder Doppel gezählt wurde.
 */

export const SINGLES = 'singles';
export const DOUBLES = 'doubles';

/**
 * Zerlegt ein ID-Feld ("p1" oder "p1,p2") in eine Liste von Spieler-IDs.
 * Leere Einträge werden verworfen, damit "p1,p2," dieselbe Liste ergibt wie "p1,p2".
 * @param {string|number|null|undefined} value
 * @returns {string[]}
 */
export function parsePlayerIds(value) {
    return String(value ?? '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
}

/**
 * Normalisiert ein rohes Match-Objekt.
 *
 * Korrigiert dabei den Spaltenversatz aus alten Google-Sheets-Exporten, bei
 * denen `winnerId` den Typ enthält und alle Folgespalten um eins verschoben
 * sind.
 *
 * @param {object} match
 * @returns {{ type: 'singles'|'doubles', isDoubles: boolean,
 *             winnerId: string, loserId: string,
 *             winnerIds: string[], loserIds: string[] }}
 */
export function normaliseMatch(match = {}) {
    const rawType     = String(match.type     ?? '').toLowerCase();
    const rawWinnerId = String(match.winnerId ?? '').toLowerCase();

    const columnShifted = rawWinnerId.includes(DOUBLES) || rawWinnerId.includes(SINGLES);

    const typeSource = columnShifted ? rawWinnerId      : rawType;
    const winnerId   = columnShifted ? match.loserId    : match.winnerId;
    const loserId    = columnShifted ? match.winnerName : match.loserId;

    const winnerIds = parsePlayerIds(winnerId);
    const loserIds  = parsePlayerIds(loserId);

    // Der Typ-String ist die primäre Quelle; mehrere IDs pro Seite sind der
    // Fallback für Altdaten, in denen der Typ fehlt.
    const isDoubles = typeSource.includes(DOUBLES)
        || winnerIds.length > 1
        || loserIds.length > 1;

    return {
        type: isDoubles ? DOUBLES : SINGLES,
        isDoubles,
        winnerId: winnerId ?? '',
        loserId:  loserId  ?? '',
        winnerIds,
        loserIds,
    };
}

/** Nimmt ein Spieler an diesem Match teil? */
export function matchInvolves(match, playerId) {
    const { winnerIds, loserIds } = normaliseMatch(match);
    return winnerIds.includes(playerId) || loserIds.includes(playerId);
}

/** Hat der Spieler dieses Match gewonnen? */
export function isWinner(match, playerId) {
    return normaliseMatch(match).winnerIds.includes(playerId);
}

// ── Sortierung ─────────────────────────────────────────────────────────────

function timeOf(match) {
    const time = new Date(match?.date ?? 0).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function idOf(match) {
    const id = Number(match?.id);
    return Number.isFinite(id) ? id : 0;
}

/**
 * Chronologischer Vergleich mit der ID als Tie-Break.
 *
 * Ohne den Tie-Break ist die Reihenfolge zweier Matches mit identischem
 * Zeitstempel beliebig — und da die ELO-Berechnung nicht kommutativ ist,
 * änderte sich die Rangliste dann allein durch einen Reload.
 */
export function compareMatches(a, b) {
    return (timeOf(a) - timeOf(b)) || (idOf(a) - idOf(b));
}

/** Kopie der Matches, älteste zuerst. */
export function sortMatchesAsc(matches) {
    return [...matches].sort(compareMatches);
}

/** Kopie der Matches, neueste zuerst. */
export function sortMatchesDesc(matches) {
    return [...matches].sort((a, b) => compareMatches(b, a));
}
