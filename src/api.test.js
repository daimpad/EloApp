import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    initApi, fetchPlayers, fetchMatches,
    createPlayer, updatePlayer, renamePlayer, createMatch, deleteMatch,
} from './api.js';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────
//
// Die Mocks bilden eine echte Response nach: `text()` ist die Methode, die
// request() verwendet. Ein Mock, der nur `json()` anbietet, verdeckt genau die
// Fehlerklasse, um die es bei PostgREST geht (201 mit leerem Body).

function response(body, status = 200) {
    const text = body === null || body === undefined ? '' : JSON.stringify(body);
    return {
        ok: status < 400,
        status,
        statusText: status === 204 ? 'No Content' : 'OK',
        text: () => Promise.resolve(text),
        json: () => Promise.resolve(body),
    };
}

function mockFetch(body, status = 200) {
    return vi.fn().mockResolvedValue(response(body, status));
}

/** PostgREST-Antwort auf DELETE/PATCH mit Prefer: return=minimal */
function mockFetch204() {
    return vi.fn().mockResolvedValue(response(null, 204));
}

/** PostgREST-Antwort auf POST mit Prefer: return=minimal — 201, leerer Body */
function mockFetch201() {
    return vi.fn().mockResolvedValue(response(null, 201));
}

function mockFetchError(status, message = 'Fehler') {
    return vi.fn().mockResolvedValue({
        ok: false, status, statusText: 'Error',
        text: () => Promise.resolve(JSON.stringify({ message })),
        json: () => Promise.resolve({ message }),
    });
}

function mockFetchNetworkError() {
    return vi.fn().mockRejectedValue(new Error('Network Error'));
}

const BASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'test-anon-key';

// Beispiel-DB-Zeilen (snake_case, wie Supabase sie liefert)
const playerRow = {
    id: '1', name: 'Anna', elo: 1050, matches: 5, wins: 3, losses: 2,
    doubles_elo: 1020, doubles_matches: 2, doubles_wins: 1, doubles_losses: 1,
    created_at: '2025-01-01T00:00:00Z',
};
const matchRow = {
    id: 1, date: '2025-05-01T12:00:00Z', type: 'singles',
    winner_id: '1', loser_id: '2',
    winner_name: 'Anna', loser_name: 'Ben',
    elo_change: 16, created_at: '2025-05-01T12:00:00Z',
};

beforeEach(() => {
    initApi(BASE_URL, ANON_KEY);
});

// ── fetchPlayers ───────────────────────────────────────────────────────────

describe('fetchPlayers', () => {
    it('transformiert DB-Zeilen in das App-Format { [id]: player }', async () => {
        vi.stubGlobal('fetch', mockFetch([playerRow]));

        const result = await fetchPlayers();

        expect(result).toEqual({
            '1': {
                name: 'Anna', elo: 1050, matches: 5, wins: 3, losses: 2,
                doublesElo: 1020, doublesMatches: 2, doublesWins: 1, doublesLosses: 1,
            },
        });
    });

    it('gibt leeres Objekt zurück wenn keine Spieler vorhanden', async () => {
        vi.stubGlobal('fetch', mockFetch([]));
        expect(await fetchPlayers()).toEqual({});
    });

    it('sendet API-Key im Header', async () => {
        vi.stubGlobal('fetch', mockFetch([]));
        await fetchPlayers();

        const calledHeaders = vi.mocked(fetch).mock.calls[0][1].headers;
        expect(calledHeaders.apikey).toBe(ANON_KEY);
        expect(calledHeaders.Authorization).toBe(`Bearer ${ANON_KEY}`);
    });

    it('fragt den players-Endpoint ab', async () => {
        vi.stubGlobal('fetch', mockFetch([]));
        await fetchPlayers();

        const url = vi.mocked(fetch).mock.calls[0][0];
        expect(url).toContain(`${BASE_URL}/rest/v1/players`);
    });

    it('wirft bei 403 eine klare APP_SECRET-Fehlermeldung', async () => {
        vi.stubGlobal('fetch', mockFetchError(403, 'Keine Berechtigung'));
        await expect(fetchPlayers()).rejects.toThrow('APP_SECRET');
    });

    it('wirft bei sonstigen HTTP-Fehlern die Server-Meldung', async () => {
        vi.stubGlobal('fetch', mockFetchError(500, 'Interner Fehler'));
        await expect(fetchPlayers()).rejects.toThrow('Interner Fehler');
    });

    it('wirft bei Netzwerkausfall', async () => {
        vi.stubGlobal('fetch', mockFetchNetworkError());
        await expect(fetchPlayers()).rejects.toThrow('Network Error');
    });
});

// ── fetchMatches ───────────────────────────────────────────────────────────

describe('fetchMatches', () => {
    it('transformiert DB-Zeilen in das App-Format (camelCase)', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow]));

        const result = await fetchMatches();

        expect(result).toEqual([{
            id: 1,
            date: '2025-05-01T12:00:00Z', type: 'singles',
            winnerId: '1', loserId: '2',
            winnerName: 'Anna', loserName: 'Ben',
            eloChange: 16,
            winnerScore: null, loserScore: null,
        }]);
    });

    it('liest Satzergebnisse mit, wenn die Spalten vorhanden sind', async () => {
        vi.stubGlobal('fetch', mockFetch([{ ...matchRow, winner_score: 21, loser_score: 19 }]));

        const [match] = await fetchMatches();
        expect(match.winnerScore).toBe(21);
        expect(match.loserScore).toBe(19);
    });

    it('gibt leeres Array zurück wenn keine Matches vorhanden', async () => {
        vi.stubGlobal('fetch', mockFetch([]));
        expect(await fetchMatches()).toEqual([]);
    });

    it('fragt den matches-Endpoint ab', async () => {
        vi.stubGlobal('fetch', mockFetch([]));
        await fetchMatches();

        const url = vi.mocked(fetch).mock.calls[0][0];
        expect(url).toContain(`${BASE_URL}/rest/v1/matches`);
    });

    it('sortiert serverseitig nach Datum mit der ID als Tie-Break', async () => {
        vi.stubGlobal('fetch', mockFetch([]));
        await fetchMatches();

        const url = vi.mocked(fetch).mock.calls[0][0];
        expect(url).toContain('order=date.asc,id.asc');
    });

    it('enthält die Supabase-ID im App-Match-Objekt', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow]));
        const result = await fetchMatches();
        expect(result[0].id).toBe(1);
    });
});

// ── Auth-Header bei Schreibzugriffen ───────────────────────────────────────
//
// Regressionstests für den Bug, bei dem `...options` hinter `headers:` stand
// und das mitgegebene `Prefer`-Objekt die berechneten Header komplett ersetzt
// hat. Alle Mutationen übergeben eigene Header — genau deshalb muss jede
// einzelne geprüft werden, und nicht nur ein Lesepfad.

describe('Auth-Header bei Schreibzugriffen', () => {
    const player = {
        name: 'Ben', elo: 1000, matches: 0, wins: 0, losses: 0,
        doublesElo: 1000, doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
    };
    const match = {
        date: '2025-05-01T12:00:00.000Z', type: 'singles',
        winnerId: '1', loserId: '2',
        winnerName: 'Anna', loserName: 'Ben', eloChange: 16,
    };

    const mutations = [
        ['createPlayer', () => createPlayer('42', player)],
        ['updatePlayer', () => updatePlayer('42', player)],
        ['renamePlayer', () => renamePlayer('42', 'Neuer Name')],
        ['createMatch',  () => createMatch(match)],
        ['deleteMatch',  () => deleteMatch(42)],
    ];

    for (const [name, run] of mutations) {
        it(`${name} sendet apikey, Authorization und x-app-secret`, async () => {
            initApi(BASE_URL, ANON_KEY, 'mein-geheimnis');
            vi.stubGlobal('fetch', mockFetch([matchRow], 201));

            await run();

            const headers = vi.mocked(fetch).mock.calls[0][1].headers;
            expect(headers.apikey).toBe(ANON_KEY);
            expect(headers.Authorization).toBe(`Bearer ${ANON_KEY}`);
            expect(headers['x-app-secret']).toBe('mein-geheimnis');
        });

        it(`${name} behält den mitgegebenen Prefer-Header`, async () => {
            initApi(BASE_URL, ANON_KEY, 'mein-geheimnis');
            vi.stubGlobal('fetch', mockFetch([matchRow], 201));

            await run();

            const headers = vi.mocked(fetch).mock.calls[0][1].headers;
            expect(headers.Prefer).toMatch(/^return=(minimal|representation)$/);
        });
    }
});

// ── Antwort-Verarbeitung ───────────────────────────────────────────────────

describe('Antwort-Verarbeitung', () => {
    const player = {
        name: 'Ben', elo: 1000, matches: 0, wins: 0, losses: 0,
        doublesElo: 1000, doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
    };

    it('behandelt 201 mit leerem Body als Erfolg', async () => {
        vi.stubGlobal('fetch', mockFetch201());
        await expect(createPlayer('42', player)).resolves.toBeUndefined();
    });

    it('behandelt 204 mit leerem Body als Erfolg', async () => {
        vi.stubGlobal('fetch', mockFetch204());
        await expect(deleteMatch(1)).resolves.toBeUndefined();
    });
});

// ── createPlayer ───────────────────────────────────────────────────────────

describe('createPlayer', () => {
    const player = {
        name: 'Ben', elo: 1000, matches: 0, wins: 0, losses: 0,
        doublesElo: 1000, doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
    };

    it('sendet POST an /players mit snake_case-Feldern', async () => {
        vi.stubGlobal('fetch', mockFetch201());
        await createPlayer('42', player);

        const [url, opts] = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(opts.body);

        expect(url).toContain('/rest/v1/players');
        expect(opts.method).toBe('POST');
        expect(body.id).toBe('42');
        expect(body.name).toBe('Ben');
        expect(body.doubles_elo).toBe(1000);
        expect(body.doubles_matches).toBe(0);
    });

    it('mappt camelCase korrekt auf snake_case', async () => {
        vi.stubGlobal('fetch', mockFetch201());
        await createPlayer('1', { ...player, doublesWins: 3, doublesLosses: 2 });

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body.doubles_wins).toBe(3);
        expect(body.doubles_losses).toBe(2);
    });

    it('wirft bei HTTP-Fehler', async () => {
        vi.stubGlobal('fetch', mockFetchError(409, 'Duplikat'));
        await expect(createPlayer('42', player)).rejects.toThrow('Duplikat');
    });
});

// ── updatePlayer / renamePlayer ────────────────────────────────────────────

describe('updatePlayer', () => {
    const player = {
        elo: 1080, matches: 5, wins: 3, losses: 2,
        doublesElo: 1020, doublesMatches: 2, doublesWins: 1, doublesLosses: 1,
    };

    it('sendet PATCH an /players?id=eq.{id}', async () => {
        vi.stubGlobal('fetch', mockFetch204());
        await updatePlayer('7', player);

        const [url, opts] = vi.mocked(fetch).mock.calls[0];
        expect(url).toContain('/rest/v1/players?id=eq.7');
        expect(opts.method).toBe('PATCH');
    });

    it('enthält aktualisierte Statistiken im Body', async () => {
        vi.stubGlobal('fetch', mockFetch204());
        await updatePlayer('7', player);

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body.elo).toBe(1080);
        expect(body.doubles_elo).toBe(1020);
        expect(body.doubles_wins).toBe(1);
    });

    it('überträgt bewusst keinen Namen', async () => {
        vi.stubGlobal('fetch', mockFetch204());
        await updatePlayer('7', { ...player, name: 'Egal' });

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body.name).toBeUndefined();
    });

    it('wirft bei Netzwerkausfall', async () => {
        vi.stubGlobal('fetch', mockFetchNetworkError());
        await expect(updatePlayer('7', player)).rejects.toThrow();
    });
});

describe('renamePlayer', () => {
    it('sendet nur das name-Feld', async () => {
        vi.stubGlobal('fetch', mockFetch204());
        await renamePlayer('7', 'Sebastian');

        const [url, opts] = vi.mocked(fetch).mock.calls[0];
        expect(url).toContain('/rest/v1/players?id=eq.7');
        expect(opts.method).toBe('PATCH');
        expect(JSON.parse(opts.body)).toEqual({ name: 'Sebastian' });
    });
});

// ── createMatch ────────────────────────────────────────────────────────────

describe('createMatch', () => {
    const match = {
        date: '2025-05-01T12:00:00.000Z', type: 'singles',
        winnerId: '1', loserId: '2',
        winnerName: 'Anna', loserName: 'Ben',
        eloChange: 16,
    };

    it('sendet POST an /matches mit snake_case-Feldern', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow], 201));
        await createMatch(match);

        const [url, opts] = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(opts.body);

        expect(url).toContain('/rest/v1/matches');
        expect(opts.method).toBe('POST');
        expect(body.winner_id).toBe('1');
        expect(body.loser_id).toBe('2');
        expect(body.winner_name).toBe('Anna');
        expect(body.elo_change).toBe(16);
    });

    it('sendet keine lokal erfundene id mit — die vergibt Postgres', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow], 201));
        await createMatch({ ...match, id: 999 });

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body.id).toBeUndefined();
    });

    it('fordert die gespeicherte Zeile an und gibt die echte ID zurück', async () => {
        vi.stubGlobal('fetch', mockFetch([{ ...matchRow, id: 4711 }], 201));

        const saved = await createMatch(match);

        const headers = vi.mocked(fetch).mock.calls[0][1].headers;
        expect(headers.Prefer).toBe('return=representation');
        expect(saved.id).toBe(4711);
        expect(saved.winnerId).toBe('1');
    });

    it('sendet Doppel-Match korrekt (IDs mit Komma)', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow], 201));
        await createMatch({ ...match, type: 'doubles', winnerId: '1,2', loserId: '3,4' });

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body.type).toBe('doubles');
        expect(body.winner_id).toBe('1,2');
        expect(body.loser_id).toBe('3,4');
    });

    it('wirft bei HTTP-Fehler', async () => {
        vi.stubGlobal('fetch', mockFetchError(500, 'Schreibfehler'));
        await expect(createMatch(match)).rejects.toThrow('Schreibfehler');
    });
});

// ── deleteMatch ────────────────────────────────────────────────────────────

describe('deleteMatch', () => {
    it('sendet DELETE an /matches?id=eq.{id}', async () => {
        vi.stubGlobal('fetch', mockFetch204());
        await deleteMatch(42);

        const [url, opts] = vi.mocked(fetch).mock.calls[0];
        expect(url).toContain('/rest/v1/matches?id=eq.42');
        expect(opts.method).toBe('DELETE');
    });

    it('funktioniert auch mit großen IDs', async () => {
        vi.stubGlobal('fetch', mockFetch204());
        await deleteMatch(99999);

        const url = vi.mocked(fetch).mock.calls[0][0];
        expect(url).toContain('id=eq.99999');
    });

    it('wirft bei HTTP-Fehler', async () => {
        vi.stubGlobal('fetch', mockFetchError(404, 'Nicht gefunden'));
        await expect(deleteMatch(1)).rejects.toThrow('Nicht gefunden');
    });

    it('wirft bei Netzwerkausfall', async () => {
        vi.stubGlobal('fetch', mockFetchNetworkError());
        await expect(deleteMatch(1)).rejects.toThrow('Network Error');
    });
});

// ── initApi ────────────────────────────────────────────────────────────────

describe('initApi', () => {
    it('entfernt abschließenden Slash aus der URL', async () => {
        initApi('https://example.supabase.co/', ANON_KEY);
        vi.stubGlobal('fetch', mockFetch([]));
        await fetchPlayers();

        const url = vi.mocked(fetch).mock.calls[0][0];
        expect(url).not.toContain('//rest');
    });

    it('verwendet die neue URL nach erneutem initApi-Aufruf', async () => {
        const newUrl = 'https://other.supabase.co';
        initApi(newUrl, ANON_KEY);
        vi.stubGlobal('fetch', mockFetch([]));
        await fetchPlayers();

        expect(vi.mocked(fetch).mock.calls[0][0]).toContain(newUrl);
        initApi(BASE_URL, ANON_KEY);
    });

    it('sendet x-app-secret Header wenn Secret gesetzt ist', async () => {
        initApi(BASE_URL, ANON_KEY, 'mein-geheimnis');
        vi.stubGlobal('fetch', mockFetch([]));
        await fetchPlayers();

        const headers = vi.mocked(fetch).mock.calls[0][1].headers;
        expect(headers['x-app-secret']).toBe('mein-geheimnis');
        initApi(BASE_URL, ANON_KEY);
    });

    it('sendet keinen x-app-secret Header wenn Secret leer ist', async () => {
        initApi(BASE_URL, ANON_KEY, '');
        vi.stubGlobal('fetch', mockFetch([]));
        await fetchPlayers();

        const headers = vi.mocked(fetch).mock.calls[0][1].headers;
        expect(headers['x-app-secret']).toBeUndefined();
    });
});

// ── Satzergebnisse ─────────────────────────────────────────────────────────

describe('Satzergebnisse', () => {
    const match = {
        date: '2025-05-01T12:00:00.000Z', type: 'singles',
        winnerId: '1', loserId: '2',
        winnerName: 'Anna', loserName: 'Ben', eloChange: 16,
    };

    it('sendet die Spalten nicht mit, wenn kein Ergebnis eingetragen wurde', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow], 201));
        await createMatch(match);

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body).not.toHaveProperty('winner_score');
        expect(body).not.toHaveProperty('loser_score');
    });

    it('sendet sie, wenn beide Werte vorliegen', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow], 201));
        await createMatch({ ...match, winnerScore: 21, loserScore: 19 });

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body.winner_score).toBe(21);
        expect(body.loser_score).toBe(19);
    });

    it('sendet sie nicht, wenn nur einer der beiden Werte vorliegt', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow], 201));
        await createMatch({ ...match, winnerScore: 21, loserScore: null });

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body).not.toHaveProperty('winner_score');
    });
});
