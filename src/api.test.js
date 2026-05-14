import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initApi, fetchPlayers, fetchMatches, createPlayer, updatePlayer, createMatch, deleteMatch } from './api.js';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function mockFetch(body, status = 200) {
    return vi.fn().mockResolvedValue({
        ok:     status < 400,
        status,
        statusText: status === 204 ? 'No Content' : 'OK',
        json: () => Promise.resolve(body),
    });
}

function mockFetch204() {
    return vi.fn().mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(null) });
}

function mockFetchError(status, message = 'Fehler') {
    return vi.fn().mockResolvedValue({
        ok: false, status, statusText: 'Error',
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

    it('wirft bei HTTP-Fehler mit der Server-Meldung', async () => {
        vi.stubGlobal('fetch', mockFetchError(403, 'Keine Berechtigung'));
        await expect(fetchPlayers()).rejects.toThrow('Keine Berechtigung');
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
        }]);
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
});

// ── createPlayer ───────────────────────────────────────────────────────────

describe('createPlayer', () => {
    const player = {
        name: 'Ben', elo: 1000, matches: 0, wins: 0, losses: 0,
        doublesElo: 1000, doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
    };

    it('sendet POST an /players mit snake_case-Feldern', async () => {
        vi.stubGlobal('fetch', mockFetch204());
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
        vi.stubGlobal('fetch', mockFetch204());
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

// ── updatePlayer ───────────────────────────────────────────────────────────

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

    it('wirft bei Netzwerkausfall', async () => {
        vi.stubGlobal('fetch', mockFetchNetworkError());
        await expect(updatePlayer('7', player)).rejects.toThrow();
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
        vi.stubGlobal('fetch', mockFetch204());
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

    it('sendet Doppel-Match korrekt (IDs mit Komma)', async () => {
        vi.stubGlobal('fetch', mockFetch204());
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

// ── fetchMatches (id-Feld) ─────────────────────────────────────────────────

describe('fetchMatches id-Mapping', () => {
    it('enthält die Supabase-ID im App-Match-Objekt', async () => {
        vi.stubGlobal('fetch', mockFetch([matchRow]));
        const result = await fetchMatches();
        expect(result[0].id).toBe(1);
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
});
