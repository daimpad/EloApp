export const K_FACTOR = 32;
export const STARTING_ELO = 1000;

/**
 * Erwartete Gewinnwahrscheinlichkeit für Spieler A gegen Spieler B.
 * @param {number} eloA
 * @param {number} eloB
 * @returns {number} Wert zwischen 0 und 1
 */
export function expectedScore(eloA, eloB) {
    return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Neues ELO nach einem Spiel berechnen.
 * @param {number} elo        Aktuelles ELO des Spielers
 * @param {number} score      Tatsächliches Ergebnis: 1 = Sieg, 0 = Niederlage
 * @param {number} expected   Erwartete Gewinnwahrscheinlichkeit (aus expectedScore)
 * @param {number} [k]        K-Faktor (Standard: 32)
 * @returns {number} Neues ELO (ganzzahlig gerundet)
 */
export function newElo(elo, score, expected, k = K_FACTOR) {
    return Math.round(elo + k * (score - expected));
}

/**
 * ELO-Änderung nach einem Einzel-Match berechnen.
 * Gibt die neuen ELO-Werte beider Spieler zurück.
 * @param {number} winnerElo
 * @param {number} loserElo
 * @param {number} [k]
 * @returns {{ winnerElo: number, loserElo: number, eloChange: number }}
 */
export function calculateSinglesMatch(winnerElo, loserElo, k = K_FACTOR) {
    const expWinner = expectedScore(winnerElo, loserElo);
    const expLoser  = expectedScore(loserElo,  winnerElo);

    const newWinnerElo = newElo(winnerElo, 1, expWinner, k);
    const newLoserElo  = newElo(loserElo,  0, expLoser,  k);

    return {
        winnerElo:  newWinnerElo,
        loserElo:   newLoserElo,
        eloChange:  newWinnerElo - winnerElo,
    };
}

/**
 * ELO-Änderung nach einem Doppel-Match berechnen.
 * Team-ELO ist der Durchschnitt der Einzel-ELOs.
 * @param {number[]} winnerElos  ELO-Werte der Gewinner (doublesElo)
 * @param {number[]} loserElos   ELO-Werte der Verlierer (doublesElo)
 * @param {number}   [k]
 * @returns {{ eloChange: number }}
 */
export function calculateDoublesMatch(winnerElos, loserElos, k = K_FACTOR) {
    const teamWinnerElo = winnerElos.reduce((s, e) => s + e, 0) / winnerElos.length;
    const teamLoserElo  = loserElos.reduce( (s, e) => s + e, 0) / loserElos.length;

    const expWinner = expectedScore(teamWinnerElo, teamLoserElo);
    const eloChange = Math.round(k * (1 - expWinner));

    return { eloChange };
}
