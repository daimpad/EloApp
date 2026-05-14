import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initApi, fetchPlayers, fetchMatches, createPlayer, updatePlayer, createMatch } from './api.js';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

/** Simuliert eine erfolgreiche fetch-Antwort mit JSON-Body. */
function mockFetch(body) {
    return vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(body),
    });
}

/** Simuliert eine erfolgreiche fetch-Antwort mit data.success = false. */
function mockFetchFailure(message = 'Serverfehler') {
    return mockFetch({ success: false, message });
}

/** Simuliert einen HTTP-Fehler (z.B. 500). */
function mockFetchHttpError(status = 500, statusText = 'Internal Server Error') {
    return vi.fn().mockResolvedValue({ ok: false, status, statusText });
}

/** Simuliert einen Netzwerkausfall. */
function mockFetchNetworkError() {
    return vi.fn().mockRejectedValue(new Error('Network Error'));
}

const BASE_URL = 'https://example.com/api';

beforeEach(() => {
    initApi(BASE_URL);
});

// ── fetchPlayers ───────────────────────────────────────────────────────────

describe('fetchPlayers', () => {
    it('gibt das players-Objekt zurück bei Erfolg', async () => {
        const players = { '1': { name: 'Anna', elo: 1050 } };
        vi.stubGlobal('fetch', mockFetch({ success: true, players }));

        const result = await fetchPlayers();
        expect(result).toEqual(players);
    });

    it('ruft die korrekte URL auf', async () => {
        vi.stubGlobal('fetch', mockFetch({ success: true, players: {} }));
        await fetchPlayers();

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain('action=getPlayers');
        expect(calledUrl).toContain(BASE_URL);
    });

    it('wirft bei data.success = false', async () => {
        vi.stubGlobal('fetch', mockFetchFailure('Keine Berechtigung'));
        await expect(fetchPlayers()).rejects.toThrow('Keine Berechtigung');
    });

    it('wirft bei HTTP-Fehler', async () => {
        vi.stubGlobal('fetch', mockFetchHttpError(503, 'Service Unavailable'));
        await expect(fetchPlayers()).rejects.toThrow('HTTP 503');
    });

    it('wirft bei Netzwerkausfall', async () => {
        vi.stubGlobal('fetch', mockFetchNetworkError());
        await expect(fetchPlayers()).rejects.toThrow('Network Error');
    });
});

// ── fetchMatches ───────────────────────────────────────────────────────────

describe('fetchMatches', () => {
    it('gibt das matches-Array zurück bei Erfolg', async () => {
        const matches = [{ date: '2025-01-01', winnerId: '1', loserId: '2' }];
        vi.stubGlobal('fetch', mockFetch({ success: true, matches }));

        const result = await fetchMatches();
        expect(result).toEqual(matches);
    });

    it('ruft die korrekte URL auf', async () => {
        vi.stubGlobal('fetch', mockFetch({ success: true, matches: [] }));
        await fetchMatches();

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain('action=getMatches');
    });

    it('wirft bei data.success = false', async () => {
        vi.stubGlobal('fetch', mockFetchFailure('Tabelle nicht gefunden'));
        await expect(fetchMatches()).rejects.toThrow('Tabelle nicht gefunden');
    });
});

// ── createPlayer ───────────────────────────────────────────────────────────

describe('createPlayer', () => {
    const player = {
        name: 'Ben', elo: 1000, matches: 0, wins: 0, losses: 0,
        doublesElo: 1000, doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
    };

    it('sendet alle Spieler-Felder an die API', async () => {
        vi.stubGlobal('fetch', mockFetch({ success: true }));
        await createPlayer('42', player);

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain('action=addPlayer');
        expect(calledUrl).toContain('id=42');
        expect(calledUrl).toContain('name=Ben');
        expect(calledUrl).toContain('elo=1000');
        expect(calledUrl).toContain('doublesElo=1000');
    });

    it('URL-kodiert Sonderzeichen im Namen', async () => {
        vi.stubGlobal('fetch', mockFetch({ success: true }));
        await createPlayer('99', { ...player, name: 'Müller & Co' });

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain('M%C3%BCller');
    });

    it('wirft bei data.success = false', async () => {
        vi.stubGlobal('fetch', mockFetchFailure('Duplikat'));
        await expect(createPlayer('42', player)).rejects.toThrow('Duplikat');
    });
});

// ── updatePlayer ───────────────────────────────────────────────────────────

describe('updatePlayer', () => {
    const player = {
        elo: 1080, matches: 5, wins: 3, losses: 2,
        doublesElo: 1020, doublesMatches: 2, doublesWins: 1, doublesLosses: 1,
    };

    it('sendet action=updatePlayer mit der korrekten ID', async () => {
        vi.stubGlobal('fetch', mockFetch({ success: true }));
        await updatePlayer('7', player);

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain('action=updatePlayer');
        expect(calledUrl).toContain('id=7');
        expect(calledUrl).toContain('elo=1080');
        expect(calledUrl).toContain('doublesElo=1020');
    });

    it('wirft bei Netzwerkausfall', async () => {
        vi.stubGlobal('fetch', mockFetchNetworkError());
        await expect(updatePlayer('7', player)).rejects.toThrow();
    });
});

// ── createMatch ────────────────────────────────────────────────────────────

describe('createMatch', () => {
    const match = {
        date: '2025-05-01T12:00:00.000Z',
        type: 'singles',
        winnerId: '1',
        loserId: '2',
        winnerName: 'Anna',
        loserName: 'Ben',
        eloChange: 16,
    };

    it('sendet alle Match-Felder an die API', async () => {
        vi.stubGlobal('fetch', mockFetch({ success: true }));
        await createMatch(match);

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain('action=addMatch');
        expect(calledUrl).toContain('type=singles');
        expect(calledUrl).toContain('winnerId=1');
        expect(calledUrl).toContain('loserId=2');
        expect(calledUrl).toContain('eloChange=16');
    });

    it('URL-kodiert Spielernamen mit Sonderzeichen', async () => {
        vi.stubGlobal('fetch', mockFetch({ success: true }));
        await createMatch({ ...match, winnerName: 'Anna & Bob' });

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain('Anna+%26+Bob');
    });

    it('sendet Doppel-Match korrekt (IDs mit Komma)', async () => {
        vi.stubGlobal('fetch', mockFetch({ success: true }));
        await createMatch({
            ...match,
            type: 'doubles',
            winnerId: '1,2',
            loserId: '3,4',
            winnerName: 'Anna & Ben',
            loserName: 'Clara & Dan',
        });

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain('type=doubles');
        expect(calledUrl).toContain('winnerId=1%2C2');
    });

    it('wirft bei data.success = false', async () => {
        vi.stubGlobal('fetch', mockFetchFailure('Schreibfehler'));
        await expect(createMatch(match)).rejects.toThrow('Schreibfehler');
    });
});

// ── initApi ────────────────────────────────────────────────────────────────

describe('initApi', () => {
    it('verwendet die neue URL nach erneutem initApi-Aufruf', async () => {
        const newUrl = 'https://other-backend.example.com/api';
        initApi(newUrl);
        vi.stubGlobal('fetch', mockFetch({ success: true, players: {} }));

        await fetchPlayers();
        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl).toContain(newUrl);

        // Zurücksetzen für andere Tests
        initApi(BASE_URL);
    });
});
