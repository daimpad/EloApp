import { state } from './state.js';

/**
 * Berechnet die aktuelle und längste Siegesserie eines Spielers.
 * @param {string} playerId
 * @param {'singles'|'doubles'|'all'} type
 * @returns {{ current: number, isWin: boolean, longest: number }}
 */
export function getPlayerStreak(playerId, type = 'all') {
    const matches = [...state.matches]
        .filter(m => {
            if (type !== 'all' && String(m.type || '').toLowerCase() !== type) return false;
            const wIds = String(m.winnerId || '').split(',').map(s => s.trim());
            const lIds = String(m.loserId  || '').split(',').map(s => s.trim());
            return wIds.includes(playerId) || lIds.includes(playerId);
        })
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    if (matches.length === 0) return { current: 0, isWin: true, longest: 0 };

    const isWinFor = (m) =>
        String(m.winnerId || '').split(',').map(s => s.trim()).includes(playerId);

    // Aktuelle Serie: von hinten zählen
    let current = 0;
    const lastIsWin = isWinFor(matches[matches.length - 1]);
    for (let i = matches.length - 1; i >= 0; i--) {
        if (isWinFor(matches[i]) === lastIsWin) current++;
        else break;
    }

    // Längste Siegesserie
    let longest = 0;
    let run = 0;
    for (const m of matches) {
        if (isWinFor(m)) {
            run++;
            if (run > longest) longest = run;
        } else {
            run = 0;
        }
    }

    return { current, isWin: lastIsWin, longest };
}
