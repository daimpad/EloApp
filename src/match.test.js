import { describe, it, expect } from 'vitest';
import {
    parsePlayerIds, normaliseMatch, matchInvolves, isWinner,
    compareMatches, sortMatchesAsc, sortMatchesDesc,
} from './match.js';

describe('parsePlayerIds', () => {
    it('liefert eine einzelne ID', () => {
        expect(parsePlayerIds('p1')).toEqual(['p1']);
    });

    it('zerlegt Komma-Listen und trimmt', () => {
        expect(parsePlayerIds('p1, p2')).toEqual(['p1', 'p2']);
    });

    it('verwirft leere Einträge — "p1,p2," ist dasselbe wie "p1,p2"', () => {
        expect(parsePlayerIds('p1,p2,')).toEqual(['p1', 'p2']);
    });

    it('liefert eine leere Liste für null/undefined/leer', () => {
        expect(parsePlayerIds(null)).toEqual([]);
        expect(parsePlayerIds(undefined)).toEqual([]);
        expect(parsePlayerIds('')).toEqual([]);
        expect(parsePlayerIds('  ,  ')).toEqual([]);
    });
});

describe('normaliseMatch', () => {
    it('erkennt ein normales Einzel', () => {
        const result = normaliseMatch({ type: 'singles', winnerId: 'p1', loserId: 'p2' });
        expect(result.type).toBe('singles');
        expect(result.isDoubles).toBe(false);
        expect(result.winnerIds).toEqual(['p1']);
        expect(result.loserIds).toEqual(['p2']);
    });

    it('erkennt ein normales Doppel', () => {
        const result = normaliseMatch({ type: 'doubles', winnerId: 'p1,p2', loserId: 'p3,p4' });
        expect(result.type).toBe('doubles');
        expect(result.isDoubles).toBe(true);
        expect(result.winnerIds).toEqual(['p1', 'p2']);
        expect(result.loserIds).toEqual(['p3', 'p4']);
    });

    it('erkennt ein Doppel auch ohne Typ-Angabe an den Komma-IDs', () => {
        const result = normaliseMatch({ type: '', winnerId: 'p1,p2', loserId: 'p3,p4' });
        expect(result.isDoubles).toBe(true);
    });

    it('korrigiert den Spaltenversatz aus Sheets-Importen', () => {
        // winnerId enthält den Typ, alle Folgespalten sind um eins verschoben
        const result = normaliseMatch({
            type:       'irgendwas',
            winnerId:   'doubles',
            loserId:    'p1,p2',
            winnerName: 'p3,p4',
        });

        expect(result.type).toBe('doubles');
        expect(result.winnerIds).toEqual(['p1', 'p2']);
        expect(result.loserIds).toEqual(['p3', 'p4']);
    });

    it('korrigiert den Spaltenversatz auch bei Einzeln', () => {
        const result = normaliseMatch({
            type:       'x',
            winnerId:   'Singles',
            loserId:    'p1',
            winnerName: 'p2',
        });

        expect(result.type).toBe('singles');
        expect(result.winnerIds).toEqual(['p1']);
        expect(result.loserIds).toEqual(['p2']);
    });

    it('ist unempfindlich gegen Groß-/Kleinschreibung des Typs', () => {
        expect(normaliseMatch({ type: 'DOUBLES', winnerId: 'p1', loserId: 'p2' }).isDoubles).toBe(true);
    });

    it('wirft nicht bei einem leeren Objekt', () => {
        const result = normaliseMatch({});
        expect(result.winnerIds).toEqual([]);
        expect(result.loserIds).toEqual([]);
    });
});

describe('matchInvolves / isWinner', () => {
    const doublesMatch = { type: 'doubles', winnerId: 'p1,p2', loserId: 'p3,p4' };

    it('erkennt Teilnahme auf beiden Seiten', () => {
        expect(matchInvolves(doublesMatch, 'p2')).toBe(true);
        expect(matchInvolves(doublesMatch, 'p4')).toBe(true);
        expect(matchInvolves(doublesMatch, 'p9')).toBe(false);
    });

    it('erkennt den Sieger', () => {
        expect(isWinner(doublesMatch, 'p1')).toBe(true);
        expect(isWinner(doublesMatch, 'p3')).toBe(false);
    });

    it('berücksichtigt den Spaltenversatz', () => {
        const shifted = { type: 'x', winnerId: 'singles', loserId: 'p1', winnerName: 'p2' };
        expect(isWinner(shifted, 'p1')).toBe(true);
        expect(isWinner(shifted, 'p2')).toBe(false);
    });
});

describe('compareMatches', () => {
    it('sortiert nach Datum aufsteigend', () => {
        const a = { id: 1, date: '2025-01-01T10:00:00Z' };
        const b = { id: 2, date: '2025-01-02T10:00:00Z' };
        expect(compareMatches(a, b)).toBeLessThan(0);
    });

    it('nutzt die ID als Tie-Break bei identischem Datum', () => {
        const a = { id: 5, date: '2025-01-01T10:00:00Z' };
        const b = { id: 3, date: '2025-01-01T10:00:00Z' };
        expect(compareMatches(a, b)).toBeGreaterThan(0);
    });

    it('behandelt ungültige Datumswerte als 0 statt NaN', () => {
        const a = { id: 1, date: 'kein datum' };
        const b = { id: 2, date: 'auch nicht' };
        expect(Number.isNaN(compareMatches(a, b))).toBe(false);
        expect(compareMatches(a, b)).toBeLessThan(0);
    });

    it('ist deterministisch — dieselbe Eingabe in anderer Reihenfolge ergibt dieselbe Sortierung', () => {
        const matches = [
            { id: 3, date: '2025-01-01T10:00:00Z' },
            { id: 1, date: '2025-01-01T10:00:00Z' },
            { id: 2, date: '2025-01-01T10:00:00Z' },
        ];

        const forward = sortMatchesAsc(matches).map(m => m.id);
        const backward = sortMatchesAsc([...matches].reverse()).map(m => m.id);

        expect(forward).toEqual([1, 2, 3]);
        expect(backward).toEqual([1, 2, 3]);
    });

    it('sortMatchesDesc ist die exakte Umkehrung', () => {
        const matches = [
            { id: 1, date: '2025-01-01T10:00:00Z' },
            { id: 2, date: '2025-01-02T10:00:00Z' },
        ];
        expect(sortMatchesDesc(matches).map(m => m.id)).toEqual([2, 1]);
    });

    it('lässt das Original unverändert', () => {
        const matches = [{ id: 2, date: '2025-01-02T10:00:00Z' }, { id: 1, date: '2025-01-01T10:00:00Z' }];
        sortMatchesAsc(matches);
        expect(matches.map(m => m.id)).toEqual([2, 1]);
    });
});
