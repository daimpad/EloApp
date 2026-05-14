import { describe, it, expect } from 'vitest';
import {
    K_FACTOR,
    STARTING_ELO,
    expectedScore,
    newElo,
    calculateSinglesMatch,
    calculateDoublesMatch,
} from './elo.js';

// ── expectedScore ──────────────────────────────────────────────────────────

describe('expectedScore', () => {
    it('gibt 0.5 zurück wenn beide Spieler gleiche ELO haben', () => {
        expect(expectedScore(1000, 1000)).toBe(0.5);
    });

    it('gibt > 0.5 zurück wenn Spieler A stärker ist', () => {
        expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    });

    it('gibt < 0.5 zurück wenn Spieler A schwächer ist', () => {
        expect(expectedScore(800, 1000)).toBeLessThan(0.5);
    });

    it('ergibt zusammen mit dem Gegner-Score 1.0', () => {
        const a = expectedScore(1200, 1000);
        const b = expectedScore(1000, 1200);
        expect(a + b).toBeCloseTo(1.0);
    });

    it('liegt immer zwischen 0 und 1', () => {
        expect(expectedScore(3000, 100)).toBeLessThan(1);
        expect(expectedScore(100, 3000)).toBeGreaterThan(0);
    });
});

// ── newElo ─────────────────────────────────────────────────────────────────

describe('newElo', () => {
    it('erhöht ELO bei Sieg gegen gleich starken Gegner um K/2', () => {
        // Sieg gegen gleich starken Gegner: Änderung = K * (1 - 0.5) = 16
        expect(newElo(1000, 1, 0.5)).toBe(1016);
    });

    it('verringert ELO bei Niederlage gegen gleich starken Gegner um K/2', () => {
        expect(newElo(1000, 0, 0.5)).toBe(984);
    });

    it('gibt fast nichts für Sieg gegen viel schwächeren Gegner', () => {
        const gain = newElo(2000, 1, 0.99) - 2000;
        expect(gain).toBeLessThanOrEqual(1);
    });

    it('rundet auf ganze Zahl', () => {
        const result = newElo(1000, 1, 0.51);
        expect(Number.isInteger(result)).toBe(true);
    });

    it('respektiert benutzerdefinierten K-Faktor', () => {
        expect(newElo(1000, 1, 0.5, 16)).toBe(1008);
    });
});

// ── calculateSinglesMatch ──────────────────────────────────────────────────

describe('calculateSinglesMatch', () => {
    it('ELO-Summe bleibt nahezu konstant (Nullsummenspiel)', () => {
        const { winnerElo, loserElo } = calculateSinglesMatch(1000, 1000);
        // Rundungsfehler von max. 1 Punkt erlaubt
        expect(Math.abs((winnerElo + loserElo) - 2000)).toBeLessThanOrEqual(1);
    });

    it('Gewinner gewinnt ELO, Verlierer verliert ELO', () => {
        const before = { winner: 1000, loser: 1000 };
        const { winnerElo, loserElo } = calculateSinglesMatch(before.winner, before.loser);
        expect(winnerElo).toBeGreaterThan(before.winner);
        expect(loserElo).toBeLessThan(before.loser);
    });

    it('Außenseiter gewinnt mehr ELO als Favorit', () => {
        const upset   = calculateSinglesMatch(800, 1200);  // Außenseiter gewinnt
        const expected = calculateSinglesMatch(1200, 800); // Favorit gewinnt
        expect(upset.eloChange).toBeGreaterThan(expected.eloChange);
    });

    it('eloChange entspricht der tatsächlichen Änderung des Gewinners', () => {
        const { winnerElo, eloChange } = calculateSinglesMatch(1000, 1000);
        expect(eloChange).toBe(winnerElo - 1000);
    });

    it('eloChange ist immer positiv', () => {
        const cases = [
            [1000, 1000],
            [1500, 800],
            [800, 1500],
        ];
        cases.forEach(([w, l]) => {
            expect(calculateSinglesMatch(w, l).eloChange).toBeGreaterThan(0);
        });
    });
});

// ── calculateDoublesMatch ──────────────────────────────────────────────────

describe('calculateDoublesMatch', () => {
    it('eloChange > 0 wenn Teams gleich stark sind', () => {
        const { eloChange } = calculateDoublesMatch([1000, 1000], [1000, 1000]);
        expect(eloChange).toBeGreaterThan(0);
    });

    it('eloChange kleiner wenn Gewinnerteam viel stärker ist', () => {
        const dominant = calculateDoublesMatch([1400, 1400], [800, 800]);
        const balanced = calculateDoublesMatch([1000, 1000], [1000, 1000]);
        expect(dominant.eloChange).toBeLessThan(balanced.eloChange);
    });

    it('eloChange ist ganzzahlig', () => {
        const { eloChange } = calculateDoublesMatch([1050, 950], [1100, 900]);
        expect(Number.isInteger(eloChange)).toBe(true);
    });

    it('funktioniert auch mit ungleich starken Teampartnern', () => {
        const { eloChange } = calculateDoublesMatch([1200, 800], [1000, 1000]);
        // Beide Teams haben Durchschnitt 1000 → Gewinner bekommt ~16
        expect(eloChange).toBe(16);
    });
});

// ── Konstanten ─────────────────────────────────────────────────────────────

describe('Konstanten', () => {
    it('K_FACTOR ist 32', () => expect(K_FACTOR).toBe(32));
    it('STARTING_ELO ist 1000', () => expect(STARTING_ELO).toBe(1000));
});
