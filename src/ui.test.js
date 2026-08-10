import { describe, it, expect, beforeEach } from 'vitest';
import { state } from './state.js';
import { renderHistory, renderRankings, showError, showSuccess, clearToasts } from './ui.js';
import { STARTING_ELO } from './elo.js';

// Der Payload, der vorher funktioniert hätte: der Name wurde per innerHTML
// gesetzt, also hätte der Browser hier ein <img> gebaut und onerror gefeuert.
const PAYLOAD = '<img src=x onerror="globalThis.__pwned = true">';

function player(name, overrides = {}) {
    return {
        name,
        elo: STARTING_ELO, matches: 1, wins: 1, losses: 0,
        doublesElo: STARTING_ELO, doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
        ...overrides,
    };
}

beforeEach(() => {
    delete globalThis.__pwned;

    document.body.innerHTML = `
        <div id="toast-stack"></div>
        <table id="rankingsTable">
            <thead><tr>
                <th scope="col">Rang</th>
                <th aria-sort="none"><button class="th-sort" data-sort="name">Spieler</button></th>
                <th aria-sort="descending"><button class="th-sort" data-sort="elo" id="th-elo">ELO</button></th>
                <th aria-sort="none"><button class="th-sort" data-sort="matches">Spiele</button></th>
                <th aria-sort="none"><button class="th-sort" data-sort="wins">Siege</button></th>
                <th aria-sort="none"><button class="th-sort" data-sort="losses">Niederlagen</button></th>
                <th scope="col">Serie</th>
            </tr></thead>
            <tbody id="rankingsBody"></tbody>
        </table>
        <table id="historyTable"><tbody id="historyBody"></tbody></table>
    `;

    state.players = {};
    state.matches = [];
});

// ── XSS ────────────────────────────────────────────────────────────────────

describe('Spielernamen werden nie als HTML interpretiert', () => {
    it('in der Rangliste', () => {
        state.players = { p1: player(PAYLOAD) };
        state.matches = [{ id: 1, date: '2025-01-01T10:00:00Z', type: 'singles', winnerId: 'p1', loserId: 'p2' }];

        renderRankings();

        const body = document.getElementById('rankingsBody');
        expect(body.querySelector('img')).toBeNull();
        expect(globalThis.__pwned).toBeUndefined();
        // Der Name steht als Text da — sichtbar, aber wirkungslos.
        expect(body.textContent).toContain('onerror');
    });

    it('im Spielverlauf', () => {
        state.players = { p1: player(PAYLOAD), p2: player('Ben') };
        state.matches = [{
            id: 1, date: '2025-01-01T10:00:00Z', type: 'singles',
            winnerId: 'p1', loserId: 'p2', winnerName: PAYLOAD, loserName: 'Ben', eloChange: 16,
        }];

        renderHistory({ allowDelete: false });

        const body = document.getElementById('historyBody');
        expect(body.querySelector('img')).toBeNull();
        expect(globalThis.__pwned).toBeUndefined();
    });

    it('bei Doppel-Teams im Spielverlauf', () => {
        state.players = {
            p1: player(PAYLOAD), p2: player('Ben'),
            p3: player('Clara'), p4: player('David'),
        };
        state.matches = [{
            id: 1, date: '2025-01-01T10:00:00Z', type: 'doubles',
            winnerId: 'p1,p2', loserId: 'p3,p4',
            winnerName: 'X & Ben', loserName: 'Clara & David', eloChange: 16,
        }];

        renderHistory({ allowDelete: false });

        expect(document.getElementById('historyBody').querySelector('img')).toBeNull();
        expect(globalThis.__pwned).toBeUndefined();
    });

    it('in Toast-Meldungen', () => {
        showError(PAYLOAD);
        expect(document.getElementById('toast-stack').querySelector('img')).toBeNull();
        expect(globalThis.__pwned).toBeUndefined();
    });
});

// ── Rendering ──────────────────────────────────────────────────────────────

describe('Rangliste', () => {
    it('zeigt einen Empty State statt einer leeren Tabelle', () => {
        renderRankings();
        const cell = document.querySelector('#rankingsBody .empty-cell');
        expect(cell).not.toBeNull();
        expect(cell.textContent).toMatch(/keine Spieler/i);
    });

    it('blendet Spieler ohne Spiele standardmäßig aus', () => {
        state.players = {
            p1: player('Anna', { matches: 2 }),
            p2: player('Ben',  { matches: 0 }),
        };

        renderRankings();

        const text = document.getElementById('rankingsBody').textContent;
        expect(text).toContain('Anna');
        expect(text).not.toContain('Ben');
    });

    it('macht den Namen zu einer Schaltfläche — das Profil ist per Tastatur erreichbar', () => {
        state.players = { p1: player('Anna') };
        renderRankings();

        const button = document.querySelector('#rankingsBody .player-link');
        expect(button).not.toBeNull();
        expect(button.tagName).toBe('BUTTON');
        expect(button.getAttribute('aria-label')).toContain('Anna');
    });

    it('versteckt Avatar-Emoji vor Screenreadern', () => {
        state.players = { p1: player('Anna') };
        renderRankings();

        const avatar = document.querySelector('#rankingsBody .avatar-emoji');
        expect(avatar.getAttribute('aria-hidden')).toBe('true');
    });

    it('gibt der Serie einen lesbaren Text neben dem Emoji', () => {
        state.players = { p1: player('Anna'), p2: player('Ben') };
        state.matches = [{ id: 1, date: '2025-01-01T10:00:00Z', type: 'singles', winnerId: 'p1', loserId: 'p2' }];

        renderRankings();

        const label = document.querySelector('#rankingsBody .streak-win .sr-only');
        expect(label).not.toBeNull();
        expect(label.textContent).toMatch(/Siege in Folge/);
    });
});

describe('Spielverlauf', () => {
    it('zeigt einen Empty State', () => {
        renderHistory({ allowDelete: false });
        expect(document.querySelector('#historyBody .empty-cell').textContent)
            .toMatch(/keine Spiele/i);
    });

    it('gibt dem Löschen-Knopf eine Beschriftung', () => {
        state.players = { p1: player('Anna'), p2: player('Ben') };
        state.matches = [{
            id: 1, date: '2025-01-01T10:00:00Z', type: 'singles',
            winnerId: 'p1', loserId: 'p2', winnerName: 'Anna', loserName: 'Ben', eloChange: 16,
        }];

        renderHistory({ allowDelete: true });

        const button = document.querySelector('.btn-delete-match');
        expect(button.getAttribute('aria-label')).toMatch(/löschen/i);
    });

    it('zeigt unbekannte Spieler-IDs als „Unbekannt“ statt leer', () => {
        state.matches = [{
            id: 1, date: '2025-01-01T10:00:00Z', type: 'singles',
            winnerId: 'weg', loserId: 'auch-weg', winnerName: '?', loserName: '?', eloChange: 0,
        }];

        renderHistory({ allowDelete: false });
        expect(document.getElementById('historyBody').textContent).toContain('Unbekannt');
    });
});

describe('Toasts', () => {
    it('Fehler bekommen role=alert und bleiben stehen', () => {
        showError('Kaputt');
        const toast = document.querySelector('.toast-error');
        expect(toast.getAttribute('role')).toBe('alert');
    });

    it('Erfolge bekommen role=status', () => {
        showSuccess('Gespeichert');
        expect(document.querySelector('.toast-success').getAttribute('role')).toBe('status');
    });

    it('mehrere Meldungen stehen nebeneinander statt sich zu ersetzen', () => {
        showSuccess('Eins');
        showError('Zwei');
        expect(document.querySelectorAll('.toast')).toHaveLength(2);
    });

    it('lassen sich einzeln schließen', () => {
        showError('Weg damit');
        document.querySelector('.toast-close').click();
        expect(document.querySelectorAll('.toast')).toHaveLength(0);
    });

    it('clearToasts leert den Stapel', () => {
        showError('A');
        showSuccess('B');
        clearToasts();
        expect(document.querySelectorAll('.toast')).toHaveLength(0);
    });
});
