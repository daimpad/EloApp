import { state } from './state.js';
import { normaliseMatch, sortMatchesAsc } from './match.js';

/**
 * Berechnet die aktuelle und längste Siegesserie eines Spielers.
 *
 * Nutzt dieselbe Match-Interpretation wie Rangliste und Diagramm: vorher las
 * diese Funktion `m.type` direkt, sodass Matches mit verschobenen Spalten aus
 * dem Sheets-Import in die ELO-Berechnung eingingen, aus der Serien-Spalte
 * aber verschwanden.
 *
 * @param {string} playerId
 * @param {'singles'|'doubles'|'all'} type
 * @returns {{ current: number, isWin: boolean, longest: number }}
 */
export function getPlayerStreak(playerId, type = 'all') {
    const relevant = state.matches.filter(match => {
        const { type: matchType, winnerIds, loserIds } = normaliseMatch(match);
        if (type !== 'all' && matchType !== type) return false;
        return winnerIds.includes(playerId) || loserIds.includes(playerId);
    });

    if (relevant.length === 0) return { current: 0, isWin: true, longest: 0 };

    const matches  = sortMatchesAsc(relevant);
    const isWinFor = (match) => normaliseMatch(match).winnerIds.includes(playerId);

    // Aktuelle Serie: von hinten zählen, solange das Ergebnis gleich bleibt
    const lastIsWin = isWinFor(matches[matches.length - 1]);
    let current = 0;
    for (let i = matches.length - 1; i >= 0; i--) {
        if (isWinFor(matches[i]) !== lastIsWin) break;
        current++;
    }

    // Längste Siegesserie über den gesamten Verlauf
    let longest = 0;
    let run = 0;
    for (const match of matches) {
        run = isWinFor(match) ? run + 1 : 0;
        if (run > longest) longest = run;
    }

    return { current, isWin: lastIsWin, longest };
}
