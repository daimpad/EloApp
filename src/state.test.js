import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { state, recalculateStatsFromHistory, applyMatch, revertMatch, removeMatchById,
         initStorage, persistPlayers, loadLocalPlayers, loadLocalMatches } from './state.js';
import { buildEloHistory } from './chart.js';
import { STARTING_ELO, calculateSinglesMatch } from './elo.js';

function player(name) {
    return {
        name,
        elo: STARTING_ELO, matches: 0, wins: 0, losses: 0,
        doublesElo: STARTING_ELO, doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
    };
}

function setup(players, matches) {
    state.players = Object.fromEntries(players.map(id => [id, player(id.toUpperCase())]));
    state.matches = matches;
}

const singles = (id, date, winnerId, loserId) => ({ id, date, type: 'singles', winnerId, loserId });
const doubles = (id, date, winnerId, loserId) => ({ id, date, type: 'doubles', winnerId, loserId });

beforeEach(() => {
    localStorage.clear();
    initStorage({ namespace: 'test', enabled: true });
    state.players = {};
    state.matches = [];
    state.lastSyncedAt = null;
});

// ── recalculateStatsFromHistory ────────────────────────────────────────────

describe('recalculateStatsFromHistory', () => {
    it('lässt bei leerer Historie alle Spieler auf dem Startwert', () => {
        setup(['p1', 'p2'], []);
        expect(recalculateStatsFromHistory()).toBe(0);

        expect(state.players.p1.elo).toBe(STARTING_ELO);
        expect(state.players.p1.matches).toBe(0);
    });

    it('bucht ein Einzel auf beide Spieler', () => {
        setup(['p1', 'p2'], [singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2')]);
        recalculateStatsFromHistory();

        const expected = calculateSinglesMatch(STARTING_ELO, STARTING_ELO);
        expect(state.players.p1.elo).toBe(expected.winnerElo);
        expect(state.players.p2.elo).toBe(expected.loserElo);
        expect(state.players.p1.wins).toBe(1);
        expect(state.players.p2.losses).toBe(1);
        expect(state.players.p1.matches).toBe(1);
    });

    it('ist unabhängig von der Reihenfolge im Array', () => {
        const matches = [
            singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2'),
            singles(2, '2025-01-02T10:00:00Z', 'p2', 'p1'),
            singles(3, '2025-01-03T10:00:00Z', 'p1', 'p2'),
        ];

        setup(['p1', 'p2'], [...matches]);
        recalculateStatsFromHistory();
        const forward = state.players.p1.elo;

        setup(['p1', 'p2'], [...matches].reverse());
        recalculateStatsFromHistory();
        expect(state.players.p1.elo).toBe(forward);
    });

    it('ist idempotent — zweimaliger Aufruf ändert nichts', () => {
        setup(['p1', 'p2'], [singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2')]);

        recalculateStatsFromHistory();
        const first = { ...state.players.p1 };
        recalculateStatsFromHistory();

        expect(state.players.p1).toEqual(first);
    });

    it('erhält bei Doppeln die ELO-Summe des Feldes', () => {
        setup(['p1', 'p2', 'p3', 'p4'], [doubles(1, '2025-01-01T10:00:00Z', 'p1,p2', 'p3,p4')]);
        recalculateStatsFromHistory();

        const total = ['p1', 'p2', 'p3', 'p4']
            .reduce((sum, id) => sum + state.players[id].doublesElo, 0);

        expect(total).toBe(4 * STARTING_ELO);
        expect(state.players.p1.doublesWins).toBe(1);
        expect(state.players.p3.doublesLosses).toBe(1);
        // Doppel dürfen die Einzelwerte nicht anfassen
        expect(state.players.p1.elo).toBe(STARTING_ELO);
        expect(state.players.p1.matches).toBe(0);
    });

    it('überspringt Matches mit unbekannten Spieler-IDs und zählt sie', () => {
        setup(['p1', 'p2'], [
            singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2'),
            singles(2, '2025-01-02T10:00:00Z', 'p1', 'geist'),
        ]);

        expect(recalculateStatsFromHistory()).toBe(1);
        expect(state.players.p1.matches).toBe(1);
    });

    it('überspringt Matches, in denen jemand auf beiden Seiten steht', () => {
        setup(['p1', 'p2', 'p3'], [doubles(1, '2025-01-01T10:00:00Z', 'p1,p2', 'p2,p3')]);
        expect(recalculateStatsFromHistory()).toBe(1);
        expect(state.players.p1.doublesMatches).toBe(0);
    });

    it('berücksichtigt den Spaltenversatz aus Sheets-Importen', () => {
        setup(['p1', 'p2'], [{
            id: 1, date: '2025-01-01T10:00:00Z',
            type: 'unsinn', winnerId: 'singles', loserId: 'p1', winnerName: 'p2',
        }]);

        expect(recalculateStatsFromHistory()).toBe(0);
        expect(state.players.p1.wins).toBe(1);
        expect(state.players.p2.losses).toBe(1);
    });

    it('schreibt die tatsächlich berechnete eloChange in das Match zurück', () => {
        const match = { ...singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2'), eloChange: 999 };
        setup(['p1', 'p2'], [match]);
        recalculateStatsFromHistory();

        expect(match.eloChange).toBe(calculateSinglesMatch(STARTING_ELO, STARTING_ELO).eloChange);
    });

    it('nutzt die ID als Tie-Break bei gleichem Zeitstempel', () => {
        const sameTime = '2025-01-01T10:00:00Z';
        const matches = [singles(2, sameTime, 'p2', 'p1'), singles(1, sameTime, 'p1', 'p2')];

        setup(['p1', 'p2'], [...matches]);
        recalculateStatsFromHistory();
        const forward = state.players.p1.elo;

        setup(['p1', 'p2'], [...matches].reverse());
        recalculateStatsFromHistory();

        expect(state.players.p1.elo).toBe(forward);
    });

    it('persistiert nicht selbst — das entscheidet der Aufrufer', () => {
        setup(['p1', 'p2'], []);
        recalculateStatsFromHistory();
        expect(localStorage.getItem('elo:test:players')).toBeNull();
    });
});

// ── applyMatch / revertMatch / removeMatchById ─────────────────────────────

describe('applyMatch und Rücknahme', () => {
    it('applyMatch fügt hinzu und rechnet neu', () => {
        setup(['p1', 'p2'], []);
        const match = singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2');

        applyMatch(match);

        expect(state.matches).toHaveLength(1);
        expect(state.players.p1.wins).toBe(1);
        expect(match.eloChange).toBeGreaterThan(0);
    });

    it('revertMatch stellt exakt den Ausgangszustand wieder her', () => {
        setup(['p1', 'p2'], [singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2')]);
        recalculateStatsFromHistory();
        const before = structuredClone(state.players);

        const added = singles(2, '2025-01-02T10:00:00Z', 'p2', 'p1');
        applyMatch(added);
        revertMatch(added);

        expect(state.players).toEqual(before);
        expect(state.matches).toHaveLength(1);
    });

    it('revertMatch entfernt nur die betroffene Instanz, nicht ID-Doubletten', () => {
        setup(['p1', 'p2'], []);
        const first  = singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2');
        const second = singles(1, '2025-01-02T10:00:00Z', 'p2', 'p1');

        applyMatch(first);
        applyMatch(second);
        revertMatch(second);

        expect(state.matches).toEqual([first]);
    });

    it('removeMatchById entfernt anhand der ID und rechnet neu', () => {
        setup(['p1', 'p2'], [
            singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2'),
            singles(2, '2025-01-02T10:00:00Z', 'p1', 'p2'),
        ]);
        recalculateStatsFromHistory();

        removeMatchById(2);

        expect(state.matches).toHaveLength(1);
        expect(state.players.p1.wins).toBe(1);
    });
});

// ── Kreuztest: Rangliste und Diagramm müssen übereinstimmen ────────────────

describe('Replay-Konsistenz zwischen Rangliste und Diagramm', () => {
    it('der letzte Punkt jeder Einzel-Kurve entspricht der ELO in der Rangliste', () => {
        setup(['p1', 'p2', 'p3'], [
            singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2'),
            singles(2, '2025-01-02T10:00:00Z', 'p3', 'p1'),
            singles(3, '2025-01-03T10:00:00Z', 'p2', 'p3'),
            singles(4, '2025-01-04T10:00:00Z', 'p1', 'p3'),
        ]);
        recalculateStatsFromHistory();

        const history = buildEloHistory('singles');

        for (const id of ['p1', 'p2', 'p3']) {
            const points = history[id];
            expect(points.at(-1).y).toBe(state.players[id].elo);
        }
    });

    it('der letzte Punkt jeder Doppel-Kurve entspricht der Doppel-ELO', () => {
        setup(['p1', 'p2', 'p3', 'p4'], [
            doubles(1, '2025-01-01T10:00:00Z', 'p1,p2', 'p3,p4'),
            doubles(2, '2025-01-02T10:00:00Z', 'p3,p4', 'p1,p2'),
            doubles(3, '2025-01-03T10:00:00Z', 'p1,p3', 'p2,p4'),
        ]);
        recalculateStatsFromHistory();

        const history = buildEloHistory('doubles');

        for (const id of ['p1', 'p2', 'p3', 'p4']) {
            expect(history[id].at(-1).y).toBe(state.players[id].doublesElo);
        }
    });

    it('trennt Einzel und Doppel sauber', () => {
        setup(['p1', 'p2', 'p3', 'p4'], [
            singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2'),
            doubles(2, '2025-01-02T10:00:00Z', 'p1,p2', 'p3,p4'),
        ]);
        recalculateStatsFromHistory();

        expect(buildEloHistory('singles').p1).toHaveLength(1);
        expect(buildEloHistory('doubles').p1).toHaveLength(1);
        expect(buildEloHistory('singles').p3).toHaveLength(0);
    });

    it('überspringt in beiden Pfaden dieselben ungültigen Matches', () => {
        setup(['p1', 'p2'], [
            singles(1, '2025-01-01T10:00:00Z', 'p1', 'p2'),
            singles(2, '2025-01-02T10:00:00Z', 'p1', 'geist'),
        ]);
        recalculateStatsFromHistory();

        expect(buildEloHistory('singles').p1).toHaveLength(1);
        expect(state.players.p1.matches).toBe(1);
    });
});

// ── Persistenz ─────────────────────────────────────────────────────────────

describe('Persistenz', () => {
    it('schreibt unter einem benannten Schlüssel', () => {
        setup(['p1'], []);
        persistPlayers();
        expect(localStorage.getItem('elo:test:players')).toContain('P1');
    });

    it('trennt zwei Instanzen voneinander', () => {
        initStorage({ namespace: 'club-a' });
        setup(['p1'], []);
        persistPlayers();

        initStorage({ namespace: 'club-b' });
        state.players = {};
        expect(loadLocalPlayers()).toBe(false);

        initStorage({ namespace: 'club-a' });
        expect(loadLocalPlayers()).toBe(true);
        expect(state.players.p1.name).toBe('P1');
    });

    it('schreibt im Demo-Modus gar nicht', () => {
        initStorage({ namespace: 'test', enabled: false });
        setup(['p1'], []);

        expect(persistPlayers()).toBe(false);
        expect(localStorage.getItem('elo:test:players')).toBeNull();
    });

    it('verwirft beschädigtes JSON, statt zu werfen', () => {
        localStorage.setItem('elo:test:players', '{kaputt');
        expect(loadLocalPlayers()).toBe(false);
        expect(localStorage.getItem('elo:test:players')).toBeNull();
    });

    it('lehnt einen Matches-Cache ab, der kein Array ist', () => {
        localStorage.setItem('elo:test:matches', '{"nicht":"array"}');
        expect(loadLocalMatches()).toBe(false);
    });

    it('übernimmt einmalig den alten, nicht benannten Schlüssel', () => {
        localStorage.setItem('eloPlayers', JSON.stringify({ alt: player('Alt') }));
        expect(loadLocalPlayers()).toBe(true);
        expect(state.players.alt.name).toBe('Alt');
    });
});

describe('Persistenz bei vollem Speicher', () => {
    afterEach(() => vi.restoreAllMocks());

    it('meldet Misserfolg statt zu werfen', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('voll', 'QuotaExceededError');
        });

        setup(['p1'], []);
        expect(() => persistPlayers()).not.toThrow();
        expect(persistPlayers()).toBe(false);
    });
});
