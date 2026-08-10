/**
 * Die eine Stelle, an der die Match-Historie abgespielt wird.
 *
 * Vorher existierte dieser Ablauf zweimal: einmal in state.js
 * (recalculateStatsFromHistory) für Statistiken und einmal in chart.js
 * (buildEloHistory) für den Verlauf. Beide sortierten, erkannten Doppel und
 * rechneten ELO auf leicht unterschiedliche Weise — driftete eine der Kopien
 * ab, zeigte der Chart einen anderen Endwert als die Rangliste.
 *
 * Der Replay besitzt die Iteration und die ELO-Buchführung. Die Aufrufer
 * bekommen pro gültigem Match ein Ereignis und entscheiden selbst, was sie
 * damit tun.
 */

import { STARTING_ELO, calculateSinglesMatch, calculateDoublesMatch } from './elo.js';
import { normaliseMatch, sortMatchesAsc } from './match.js';

/**
 * Ist das Match rechenbar? Alle Beteiligten müssen bekannt sein, beide Seiten
 * besetzt, und niemand darf auf beiden Seiten stehen.
 */
function isPlayable(winnerIds, loserIds, pool) {
    if (winnerIds.length === 0 || loserIds.length === 0) return false;

    const all = [...winnerIds, ...loserIds];
    if (new Set(all).size !== all.length) return false;

    return all.every(id => pool.has(id));
}

/**
 * Spielt die Historie chronologisch ab.
 *
 * @param {Array}  matches    Rohe Match-Objekte, unsortiert erlaubt
 * @param {Iterable<string>} knownIds  IDs aller bekannten Spieler
 * @param {(event: {
 *   match: object,          // das ursprüngliche Match-Objekt
 *   index: number,          // laufende Nummer über alle gültigen Matches (ab 1)
 *   isDoubles: boolean,
 *   winnerIds: string[],
 *   loserIds: string[],
 *   eloChange: number,      // immer positiv: Gewinn der Sieger, Verlust der Verlierer
 *   updated: Array<{ id: string, elo: number, won: boolean }>,
 * }) => void} [onMatch]
 * @returns {{ skipped: number, singles: Map<string, number>, doubles: Map<string, number> }}
 */
export function replayMatches(matches, knownIds, onMatch) {
    const singles = new Map();
    const doubles = new Map();

    for (const id of knownIds) {
        singles.set(id, STARTING_ELO);
        doubles.set(id, STARTING_ELO);
    }

    let index   = 0;
    let skipped = 0;

    for (const match of sortMatchesAsc(matches)) {
        const { isDoubles, winnerIds, loserIds } = normaliseMatch(match);
        const pool = isDoubles ? doubles : singles;

        if (!isPlayable(winnerIds, loserIds, pool)) {
            skipped++;
            continue;
        }

        index++;

        let eloChange;
        const updated = [];

        if (isDoubles) {
            ({ eloChange } = calculateDoublesMatch(
                winnerIds.map(id => pool.get(id)),
                loserIds.map(id  => pool.get(id)),
            ));

            for (const id of winnerIds) {
                pool.set(id, pool.get(id) + eloChange);
                updated.push({ id, elo: pool.get(id), won: true });
            }
            for (const id of loserIds) {
                pool.set(id, pool.get(id) - eloChange);
                updated.push({ id, elo: pool.get(id), won: false });
            }
        } else {
            const winnerId = winnerIds[0];
            const loserId  = loserIds[0];
            const result   = calculateSinglesMatch(pool.get(winnerId), pool.get(loserId));

            eloChange = result.eloChange;
            pool.set(winnerId, result.winnerElo);
            pool.set(loserId,  result.loserElo);

            updated.push(
                { id: winnerId, elo: result.winnerElo, won: true },
                { id: loserId,  elo: result.loserElo,  won: false },
            );
        }

        onMatch?.({ match, index, isDoubles, winnerIds, loserIds, eloChange, updated });
    }

    return { skipped, singles, doubles };
}
