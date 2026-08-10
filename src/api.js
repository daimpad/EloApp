/**
 * Alle Kommunikation mit dem Supabase-Backend.
 *
 * Verwendung:
 *   import { initApi, fetchPlayers, fetchMatches,
 *            createPlayer, updatePlayer, createMatch } from './src/api.js';
 *   initApi('https://YOUR_PROJECT.supabase.co', 'YOUR_ANON_KEY', 'SECRET');
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
    // `headers` muss aus den Optionen herausgelöst werden, bevor der Rest
    // gespreadet wird: stünde `...options` hinter `headers:`, ersetzte ein
    // mitgegebenes headers-Objekt die berechneten Header vollständig — und
    // damit apikey, Authorization und x-app-secret. Genau das war der Grund,
    // warum jeder Schreibzugriff mit 401 scheiterte.
    const { headers: extraHeaders, ...rest } = options;

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        ...rest,
        headers: headers(extraHeaders),
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Zugriff verweigert. Bitte APP_SECRET in config.js prüfen.');
        }
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Auf den Statuscode zu prüfen reicht nicht: PostgREST antwortet auf POST
    // mit 201 und — bei Prefer: return=minimal — leerem Body. `json()` würde
    // daran scheitern und einen erfolgreichen INSERT als Fehler melden.
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
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

/** App-Spielerobjekt → DB-Statistikspalten */
function playerToStats(player) {
    return {
        elo:             player.elo,
        matches:         player.matches,
        wins:            player.wins,
        losses:          player.losses,
        doubles_elo:     player.doublesElo,
        doubles_matches: player.doublesMatches,
        doubles_wins:    player.doublesWins,
        doubles_losses:  player.doublesLosses,
    };
}

/** DB-Zeile → App-Matchobjekt */
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
        winnerScore: row.winner_score ?? null,
        loserScore:  row.loser_score  ?? null,
    };
}

/** App-Matchobjekt → DB-Zeile (ohne id — die vergibt Postgres) */
function matchToRow(match) {
    const row = {
        date:        match.date,
        type:        match.type,
        winner_id:   match.winnerId,
        loser_id:    match.loserId,
        winner_name: match.winnerName,
        loser_name:  match.loserName,
        elo_change:  match.eloChange,
    };

    // Satzergebnisse sind optional und werden nur mitgeschickt, wenn sie
    // wirklich eingetragen wurden. Datenbanken ohne die Spalten (siehe
    // supabase/migrate_scores.sql) bleiben damit voll funktionsfähig.
    if (Number.isFinite(match.winnerScore) && Number.isFinite(match.loserScore)) {
        row.winner_score = match.winnerScore;
        row.loser_score  = match.loserScore;
    }

    return row;
}

// ── Lesen ──────────────────────────────────────────────────────────────────

/**
 * Alle Spieler laden.
 * @returns {Promise<{ [id: string]: object }>}
 */
export async function fetchPlayers() {
    const rows = await request('players?select=*');
    const players = {};
    for (const row of rows ?? []) {
        players[row.id] = rowToPlayer(row);
    }
    return players;
}

/**
 * Alle Matches laden — chronologisch, mit der ID als Tie-Break.
 *
 * Der Tie-Break ist nicht kosmetisch: bei identischem Zeitstempel wäre die
 * Reihenfolge sonst beliebig, und weil die ELO-Berechnung nicht kommutativ
 * ist, änderte sich die Rangliste dann allein durch einen Reload.
 *
 * @returns {Promise<Array>}
 */
export async function fetchMatches() {
    const rows = await request('matches?select=*&order=date.asc,id.asc');
    return (rows ?? []).map(rowToMatch);
}

// ── Schreiben ──────────────────────────────────────────────────────────────

/**
 * Neuen Spieler anlegen.
 * @param {string} id
 * @param {object} player
 */
export async function createPlayer(id, player) {
    await request('players', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
            id,
            name: player.name,
            ...playerToStats(player),
        }),
    });
}

/**
 * Spieler-Statistiken aktualisieren.
 * @param {string} id
 * @param {object} player
 */
export async function updatePlayer(id, player) {
    await request(`players?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(playerToStats(player)),
    });
}

/**
 * Spieler umbenennen. Anzeigenamen werden zur Laufzeit aus state.players
 * aufgelöst, historische Matches müssen also nicht angefasst werden.
 * @param {string} id
 * @param {string} name
 */
export async function renamePlayer(id, name) {
    await request(`players?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ name }),
    });
}

/**
 * Match speichern und das gespeicherte Match mit der echten Datenbank-ID
 * zurückgeben.
 *
 * Die ID muss vom Server kommen: `matches.id` ist BIGSERIAL, eine lokal per
 * Date.now() vergebene ID trifft beim späteren Löschen null Zeilen — und
 * PostgREST meldet das als Erfolg.
 *
 * @param {object} match
 * @returns {Promise<object>} Match inklusive `id`
 */
export async function createMatch(match) {
    const rows = await request('matches', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(matchToRow(match)),
    });

    const row = Array.isArray(rows) ? rows[0] : rows;
    return row ? rowToMatch(row) : { ...match };
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
