/**
 * Alle Kommunikation mit dem Google Sheets Backend.
 *
 * Verwendung:
 *   import { initApi, fetchPlayers, fetchMatches, createPlayer, updatePlayer, createMatch } from './src/api.js';
 *   initApi('https://your-backend-url');
 *
 * Jede Funktion:
 *   - gibt bei Erfolg die relevanten Daten zurück
 *   - wirft bei Netzwerkfehlern oder data.success === false einen Error
 */

let baseUrl = '';

export function initApi(url) {
    baseUrl = url;
}

async function get(params) {
    const query = new URLSearchParams({ ...params }).toString();
    const response = await fetch(`${baseUrl}?${query}`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
        throw new Error(data.message || 'Unbekannter Fehler');
    }
    return data;
}

/**
 * Alle Spieler laden.
 * @returns {Promise<Object>} players-Objekt { [id]: { name, elo, ... } }
 */
export async function fetchPlayers() {
    const data = await get({ action: 'getPlayers' });
    return data.players;
}

/**
 * Alle Matches laden.
 * @returns {Promise<Array>} matches-Array
 */
export async function fetchMatches() {
    const data = await get({ action: 'getMatches' });
    return data.matches;
}

/**
 * Neuen Spieler anlegen.
 * @param {string} id
 * @param {{ name: string, elo: number, matches: number, wins: number, losses: number,
 *           doublesElo: number, doublesMatches: number, doublesWins: number, doublesLosses: number }} player
 */
export async function createPlayer(id, player) {
    await get({
        action: 'addPlayer',
        id,
        name:          player.name,
        elo:           player.elo,
        matches:       player.matches,
        wins:          player.wins,
        losses:        player.losses,
        doublesElo:    player.doublesElo,
        doublesMatches: player.doublesMatches,
        doublesWins:   player.doublesWins,
        doublesLosses: player.doublesLosses,
    });
}

/**
 * Spieler-Statistiken aktualisieren.
 * @param {string} id
 * @param {{ elo: number, matches: number, wins: number, losses: number,
 *           doublesElo: number, doublesMatches: number, doublesWins: number, doublesLosses: number }} player
 */
export async function updatePlayer(id, player) {
    await get({
        action: 'updatePlayer',
        id,
        elo:           player.elo,
        matches:       player.matches,
        wins:          player.wins,
        losses:        player.losses,
        doublesElo:    player.doublesElo,
        doublesMatches: player.doublesMatches,
        doublesWins:   player.doublesWins,
        doublesLosses: player.doublesLosses,
    });
}

/**
 * Match speichern.
 * @param {{ date: string, type: string, winnerId: string, loserId: string,
 *           winnerName: string, loserName: string, eloChange: number }} match
 */
export async function createMatch(match) {
    await get({
        action:     'addMatch',
        date:       match.date,
        type:       match.type,
        winnerId:   match.winnerId,
        loserId:    match.loserId,
        winnerName: match.winnerName,
        loserName:  match.loserName,
        eloChange:  match.eloChange,
    });
}
