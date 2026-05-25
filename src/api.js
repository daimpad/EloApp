/**
 * Alle Kommunikation mit dem Supabase-Backend.
 *
 * Verwendung:
 *   import { initApi, fetchPlayers, fetchMatches,
 *            createPlayer, updatePlayer, createMatch } from './src/api.js';
 *   initApi('https://YOUR_PROJECT.supabase.co', 'YOUR_ANON_KEY');
 *
 * Jede Funktion gibt bei Erfolg die Daten zurück oder wirft einen Error.
 * Das Mapping zwischen App-Format (camelCase) und DB-Format (snake_case)
 * passiert ausschließlich hier.
 */

let supabaseUrl = '';
let supabaseKey = '';
let appSecret   = '';

export function initApi(url, key, secret = '') {
    supabaseUrl = String(url    || '').replace(/\/$/, '');
    supabaseKey = String(key    || '');
    appSecret   = String(secret || '');
}

// ── HTTP-Hilfsfunktionen ───────────────────────────────────────────────────

function headers(extra = {}) {
    const h = {
        apikey:         supabaseKey,
        Authorization:  `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        ...extra,
    };
    if (appSecret) h['x-app-secret'] = appSecret;
    return h;
}

async function request(path, options = {}) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        headers: headers(options.headers),
        ...options,
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Zugriff verweigert. Bitte APP_SECRET in config.js prüfen.');
        }
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // 204 No Content bei Mutations (Prefer: return=minimal)
    return response.status === 204 ? null : response.json();
}

// ── Typ-Mapping ────────────────────────────────────────────────────────────

/** DB-Zeile → App-Spielerobjekt */
function rowToPlayer(row) {
    return {
        name:           row.name,
        elo:            row.elo,
        matches:        row.matches,
        wins:           row.wins,
        losses:         row.losses,
        doublesElo:     row.doubles_elo,
        doublesMatches: row.doubles_matches,
        doublesWins:    row.doubles_wins,
        doublesLosses:  row.doubles_losses,
    };
}

/** DB-Zeile → App-Match-Objekt */
function rowToMatch(row) {
    return {
        id:         row.id,
        date:       row.date,
        type:       row.type,
        winnerId:   row.winner_id,
        loserId:    row.loser_id,
        winnerName: row.winner_name,
        loserName:  row.loser_name,
        eloChange:  row.elo_change,
    };
}

// ── Öffentliche API ────────────────────────────────────────────────────────

/**
 * Alle Spieler laden.
 * @returns {Promise<Object>} { [id]: { name, elo, ... } }
 */
export async function fetchPlayers() {
    const rows = await request('players?select=*&order=created_at.asc');
    return Object.fromEntries(rows.map(row => [row.id, rowToPlayer(row)]));
}

/**
 * Alle Matches laden.
 * @returns {Promise<Array>}
 */
export async function fetchMatches() {
    const rows = await request('matches?select=*&order=date.asc');
    return rows.map(rowToMatch);
}

/**
 * Neuen Spieler anlegen.
 * @param {string} id
 * @param {{ name, elo, matches, wins, losses,
 *           doublesElo, doublesMatches, doublesWins, doublesLosses }} player
 */
export async function createPlayer(id, player) {
    await request('players', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
            id,
            name:           player.name,
            elo:            player.elo,
            matches:        player.matches,
            wins:           player.wins,
            losses:         player.losses,
            doubles_elo:    player.doublesElo,
            doubles_matches: player.doublesMatches,
            doubles_wins:   player.doublesWins,
            doubles_losses: player.doublesLosses,
        }),
    });
}

/**
 * Spieler-Statistiken aktualisieren.
 * @param {string} id
 * @param {{ elo, matches, wins, losses,
 *           doublesElo, doublesMatches, doublesWins, doublesLosses }} player
 */
export async function updatePlayer(id, player) {
    await request(`players?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
            elo:            player.elo,
            matches:        player.matches,
            wins:           player.wins,
            losses:         player.losses,
            doubles_elo:    player.doublesElo,
            doubles_matches: player.doublesMatches,
            doubles_wins:   player.doublesWins,
            doubles_losses: player.doublesLosses,
        }),
    });
}

/**
 * Match löschen.
 * @param {number} id  Supabase-ID des Matches
 */
export async function deleteMatch(id) {
    await request(`matches?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
    });
}

/**
 * Match speichern.
 * @param {{ date, type, winnerId, loserId, winnerName, loserName, eloChange }} match
 */
export async function createMatch(match) {
    await request('matches', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
            date:       match.date,
            type:       match.type,
            winner_id:  match.winnerId,
            loser_id:   match.loserId,
            winner_name: match.winnerName,
            loser_name:  match.loserName,
            elo_change:  match.eloChange,
        }),
    });
}
