import { describe, it, expect, beforeEach } from 'vitest';
import { getPlayerStreak } from './streaks.js';
import { state } from './state.js';

function match(id, date, winnerId, loserId, type = 'singles') {
    return { id, date, type, winnerId, loserId, winnerName: '', loserName: '', eloChange: 16 };
}

beforeEach(() => {
    state.players = { p1: {}, p2: {}, p3: {} };
    state.matches  = [];
});

describe('getPlayerStreak', () => {
    it('gibt 0 zurück wenn keine Matches vorhanden', () => {
        const s = getPlayerStreak('p1');
        expect(s).toEqual({ current: 0, isWin: true, longest: 0 });
    });

    it('erkennt einfache Siegesserie', () => {
        state.matches = [
            match(1, '2024-01-01', 'p1', 'p2'),
            match(2, '2024-01-02', 'p1', 'p2'),
            match(3, '2024-01-03', 'p1', 'p2'),
        ];
        const s = getPlayerStreak('p1');
        expect(s.current).toBe(3);
        expect(s.isWin).toBe(true);
        expect(s.longest).toBe(3);
    });

    it('erkennt aktuelle Niederlagenserie', () => {
        state.matches = [
            match(1, '2024-01-01', 'p1', 'p2'),
            match(2, '2024-01-02', 'p2', 'p1'),
            match(3, '2024-01-03', 'p2', 'p1'),
        ];
        const s = getPlayerStreak('p1');
        expect(s.current).toBe(2);
        expect(s.isWin).toBe(false);
    });

    it('bricht Serie bei Niederlage ab', () => {
        state.matches = [
            match(1, '2024-01-01', 'p1', 'p2'),
            match(2, '2024-01-02', 'p1', 'p2'),
            match(3, '2024-01-03', 'p2', 'p1'),
            match(4, '2024-01-04', 'p1', 'p2'),
        ];
        const s = getPlayerStreak('p1');
        expect(s.current).toBe(1);
        expect(s.isWin).toBe(true);
    });

    it('berechnet längste Serie korrekt', () => {
        state.matches = [
            match(1, '2024-01-01', 'p1', 'p2'),
            match(2, '2024-01-02', 'p1', 'p2'),
            match(3, '2024-01-03', 'p1', 'p2'),
            match(4, '2024-01-04', 'p2', 'p1'),
            match(5, '2024-01-05', 'p1', 'p2'),
            match(6, '2024-01-06', 'p1', 'p2'),
        ];
        const s = getPlayerStreak('p1');
        expect(s.longest).toBe(3);
        expect(s.current).toBe(2);
    });

    it('filtert nach Spieltyp', () => {
        state.matches = [
            match(1, '2024-01-01', 'p1', 'p2', 'singles'),
            match(2, '2024-01-02', 'p1', 'p2', 'singles'),
            match(3, '2024-01-03', 'p2,p3', 'p1,p2', 'doubles'),
        ];
        const singles = getPlayerStreak('p1', 'singles');
        expect(singles.current).toBe(2);
        expect(singles.isWin).toBe(true);
    });

    it('erkennt Niederlage in Doppel-Matches', () => {
        state.players = { p1: {}, p2: {}, p3: {}, p4: {} };
        state.matches = [
            match(1, '2024-01-01', 'p2,p3', 'p1,p4', 'doubles'),
        ];
        const s = getPlayerStreak('p1');
        expect(s.isWin).toBe(false);
    });
});
