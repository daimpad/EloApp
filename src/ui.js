/**
 * Reine DOM-Schicht: baut Ansichten aus dem State, ruft weder API noch
 * verändert den State. Alle Rückkanäle laufen über die einmalig per initUi()
 * registrierten Handler.
 *
 * Wichtig: Spielernamen sind freier Nutzertext. Sie werden ausschließlich über
 * textContent gesetzt — nie über innerHTML.
 */

import { state } from './state.js';
import { getPlayerStreak } from './streaks.js';
import { normaliseMatch, sortMatchesDesc, matchInvolves, isWinner } from './match.js';
import { formatDateTime, formatRelative, pluralise } from './format.js';
import { brandColor } from './branding.js';

// ================= HANDLER =================

const handlers = {
    onOpenProfile:   () => {},
    onDeleteMatch:   () => {},
    onToggleSingles: () => {},
    onToggleDoubles: () => {},
};

/**
 * Registriert die Rückkanäle einmalig beim Start.
 *
 * Bewusst explizit statt als optionaler Parameter jeder Render-Funktion:
 * vorher wurde der Callback in einer Modulvariablen zwischengespeichert und
 * ein einziger Aufruf ohne Argument machte die Ranglistenzeilen still
 * unklickbar.
 */
export function initUi(overrides = {}) {
    Object.assign(handlers, overrides);
}

// ================= AVATAR =================

const avatarEmojis = ['😎','🤩','🤓','🤠','👻','🤖','👽','🦄','🐱','🐶','🦊','🦁','🐯','🐺','🦝','🐨','🐼','🐹','🐰','🦇','🐝','🐢','🦖','🐙','🦋','🦜','🦢','🦚','🦉','🐌','🦀','🦞','🦐','🐠','🐬','🐳','🦈','🦭','🐘','🦏','🦛','🐪','🦒','🦘','🦬','🐂','🐄','🐎','🦮','🐕','🐩','🐈','🦙','🦌','🐑','🐐','🐏','🐖','🐓','🦃','🦆','🦅'];

export function getAvatarEmoji(playerId) {
    const id = String(playerId || '');
    if (!id) return '🏸';
    const seed = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
    return avatarEmojis[seed % avatarEmojis.length];
}

/**
 * Avatar als dekoratives Element. Ohne aria-hidden liest ein Screenreader in
 * jeder Zeile den Emoji-Namen vor ("Einhorngesicht Anna").
 */
function avatarSpan(playerId) {
    const span = document.createElement('span');
    span.className = 'avatar-emoji';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = getAvatarEmoji(playerId);
    return span;
}

// ================= MELDUNGEN =================

const TOAST_SUCCESS_MS = 4000;

function toastStack() {
    return document.getElementById('toast-stack');
}

function pushToast(message, variant) {
    const stack = toastStack();
    if (!stack) {
        (variant === 'error' ? console.error : console.log)(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    // Fehler unterbrechen, Erfolge werden beiläufig vorgelesen.
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    toast.appendChild(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Meldung schließen');
    close.textContent = '✕';
    close.addEventListener('click', () => toast.remove());
    toast.appendChild(close);

    stack.appendChild(toast);

    // Erfolgsmeldungen verschwinden von selbst, Fehler bleiben stehen — sonst
    // ist der einzige Hinweis auf ein Problem nach fünf Sekunden weg.
    if (variant !== 'error') {
        setTimeout(() => toast.remove(), TOAST_SUCCESS_MS);
    }

    // Jeder Toast hat sein eigenes Timeout; mehrere Meldungen kürzen sich
    // dadurch nicht mehr gegenseitig ab.
    while (stack.children.length > 4) {
        stack.firstElementChild.remove();
    }
}

export function showError(message) {
    pushToast(message, 'error');
}

export function showSuccess(message) {
    pushToast(message, 'success');
}

export function clearToasts() {
    const stack = toastStack();
    if (stack) stack.textContent = '';
}

export function toggleLoading(show) {
    const overlay = document.getElementById('app-loader');
    if (overlay) overlay.hidden = !show;
}

export function showConfigPanel(show) {
    const panel = document.getElementById('config-panel');
    if (panel) panel.hidden = !show;
}

/** "Stand: vor 5 Min." im Kopf — macht sichtbar, wie alt die Anzeige ist. */
export function setSyncStatus(isoTimestamp, { offline = false } = {}) {
    const label = document.getElementById('last-synced');
    if (!label) return;

    if (!isoTimestamp) {
        label.textContent = offline ? 'Offline — keine Daten' : '';
        return;
    }

    label.textContent = `Stand: ${formatRelative(isoTimestamp)}${offline ? ' (offline)' : ''}`;
    label.title = formatDateTime(isoTimestamp);
}

export function setControlsEnabled(enabled) {
    document.querySelectorAll('[data-requires-config]').forEach(el => {
        el.disabled = !enabled;
    });
}

// ================= TABS =================

export function showTab(tabName) {
    const panel = document.getElementById(tabName);
    if (!panel) return;

    document.querySelectorAll('.tab-content').forEach(content => {
        const active = content === panel;
        content.classList.toggle('active', active);
        content.hidden = !active;
    });

    document.querySelectorAll('.tab').forEach(tab => {
        const active = tab.dataset.tab === tabName;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
    });
}

export function currentTab() {
    return document.querySelector('.tab[aria-selected="true"]')?.dataset.tab ?? 'add-match';
}

// ================= SPIELMODUS =================

export function renderGameModeSwitch(mode) {
    document.querySelectorAll('.mode-button').forEach(button => {
        const active = button.dataset.mode === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });

    document.getElementById('singles-interface').hidden = mode !== 'singles';
    document.getElementById('doubles-interface').hidden = mode !== 'doubles';
}

// ================= DROPDOWNS =================

export function renderPlayerDropdowns() {
    const winnerSelect = document.getElementById('winner');
    const loserSelect  = document.getElementById('loser');

    for (const select of [winnerSelect, loserSelect]) {
        const previous = select.value;
        select.textContent = '';
        select.appendChild(option('', '-- Spieler auswählen --'));

        for (const [id, player] of sortedByName(state.players)) {
            select.appendChild(option(id, player.name));
        }
        select.value = previous;
    }
}

function option(value, label) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    return node;
}

// ================= SPIELERKARTEN (EINZEL) =================

export function renderPlayerList() {
    const list = document.getElementById('playerList');
    list.textContent = '';

    const players = sortedByName(state.players);

    if (players.length === 0) {
        list.appendChild(emptyHint('Noch keine Spieler angelegt.', 'add-player', 'Spieler anlegen'));
        return;
    }

    for (const [id, player] of players) {
        const card = playerCardButton(id, player.name, 'player-card');
        card.addEventListener('click', () => handlers.onToggleSingles(id));
        list.appendChild(card);
    }

    renderSinglesSelection();
}

export function filterPlayerList() {
    const term = document.getElementById('player-search').value.trim().toLowerCase();
    document.querySelectorAll('#playerList .player-card').forEach(card => {
        const name = card.querySelector('.name').textContent.toLowerCase();
        card.hidden = !name.includes(term);
    });
}

/**
 * Spiegelt state.selectedSingles vollständig in Karten und Dropdowns.
 *
 * Vorher wurde die Auswahl aus dem DOM zurückgelesen
 * (querySelectorAll('.player-card.selected')) — das liefert Dokumentreihenfolge,
 * und weil die Karten alphabetisch sortiert sind, wurde aus "erst Zoe, dann
 * Anna geklickt" ein Sieg für Anna.
 */
export function renderSinglesSelection() {
    const [winnerId = '', loserId = ''] = state.selectedSingles;

    document.querySelectorAll('#playerList .player-card').forEach(card => {
        const id     = card.dataset.id;
        const isWin  = id === winnerId;
        const isLoss = id === loserId;

        card.classList.toggle('selected-winner', isWin);
        card.classList.toggle('selected-loser',  isLoss);
        card.classList.toggle('selected',        isWin || isLoss);
        card.setAttribute('aria-pressed', String(isWin || isLoss));

        let badge = card.querySelector('.card-badge');
        if (isWin || isLoss) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'card-badge';
                card.appendChild(badge);
            }
            badge.textContent = isWin ? 'Gewinner' : 'Verlierer';
        } else {
            badge?.remove();
        }
    });

    document.getElementById('winner').value = winnerId;
    document.getElementById('loser').value  = loserId;

    const hint = document.getElementById('singles-hint');
    if (hint) {
        hint.textContent = Object.keys(state.players).length < 2
            ? 'Mindestens zwei Spieler nötig.'
            : state.selectedSingles.length < 2
                ? 'Bitte Gewinner und Verlierer wählen.'
                : '';
    }

    const button = document.getElementById('record-singles');
    if (button) button.disabled = state.selectedSingles.length < 2;
}

export function clearPlayerCardSelection() {
    renderSinglesSelection();
}

// ================= SPIELERKARTEN (DOPPEL) =================

export function renderDoublesGrid() {
    const grid = document.getElementById('doublesPlayerGrid');
    grid.textContent = '';

    const players = sortedByName(state.players);

    if (players.length === 0) {
        grid.appendChild(emptyHint('Noch keine Spieler angelegt.', 'add-player', 'Spieler anlegen'));
        return;
    }

    for (const [id, player] of players) {
        const card = playerCardButton(id, player.name, 'doubles-player-card');

        const elo = document.createElement('span');
        elo.className = 'card-elo';
        elo.textContent = `Doppel: ${player.doublesElo}`;
        card.appendChild(elo);

        card.addEventListener('click', () => handlers.onToggleDoubles(id));
        grid.appendChild(card);
    }

    updateTeamDisplay();
}

/**
 * Leitet Teamzuordnung UND Kartenfarben vollständig aus state.selectedPlayers ab.
 *
 * Die Farbe beim Klick einmalig zu setzen ging schief, sobald jemand
 * abgewählt wurde: die verbleibenden Spieler rutschen im Array nach vorn und
 * wechseln damit das Team, behielten aber die alte Farbe.
 */
export function updateTeamDisplay() {
    const selected = state.selectedPlayers;

    const slots = ['team1-player1', 'team1-player2', 'team2-player1', 'team2-player2'];
    slots.forEach((slotId, index) => {
        const playerId = selected[index];
        document.getElementById(slotId).textContent =
            playerId ? state.players[playerId]?.name ?? 'Unbekannt' : '-';
    });

    document.querySelectorAll('.doubles-player-card').forEach(card => {
        const index = selected.indexOf(card.dataset.id);
        card.classList.toggle('selected-team1', index === 0 || index === 1);
        card.classList.toggle('selected-team2', index === 2 || index === 3);
        card.setAttribute('aria-pressed', String(index !== -1));
    });

    const winning = document.getElementById('winning-team').value;
    for (const [teamId, name] of [['team1', 'team1'], ['team2', 'team2']]) {
        const team = document.getElementById(teamId);
        team.classList.toggle('team-winner', winning === name);
        team.classList.toggle('team-loser',  winning !== '' && winning !== name);
    }

    const hint = document.getElementById('doubles-hint');
    if (hint) {
        hint.textContent = Object.keys(state.players).length < 4
            ? 'Mindestens vier Spieler nötig.'
            : selected.length < 4
                ? `Noch ${4 - selected.length} ${pluralise(4 - selected.length, 'Spieler', 'Spieler')} auswählen.`
                : winning === ''
                    ? 'Bitte das gewinnende Team wählen.'
                    : '';
    }

    const button = document.getElementById('record-doubles');
    if (button) button.disabled = selected.length !== 4 || winning === '';
}

export function clearTeamDisplay() {
    document.getElementById('winning-team').value = '';
    updateTeamDisplay();
}

// ================= RANGLISTE =================

let rankingType   = 'singles';
let rankingSort   = { key: 'elo', dir: -1 };
let rankingSearch = '';
let hideInactive  = true;

export function showRankingTab(type) {
    rankingType = type === 'doubles' ? 'doubles' : 'singles';

    document.querySelectorAll('.ranking-tab').forEach(tab => {
        const active = tab.dataset.type === rankingType;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
    });

    document.getElementById('th-elo').textContent = rankingType === 'singles' ? 'Einzel-ELO' : 'Doppel-ELO';
    renderRankings();
}

export function setRankingSort(key) {
    // Gleiche Spalte erneut: Richtung umdrehen. Neue Spalte: sinnvolle
    // Startrichtung — Namen aufsteigend, Zahlen absteigend.
    if (rankingSort.key === key) rankingSort.dir *= -1;
    else rankingSort = { key, dir: key === 'name' ? 1 : -1 };

    renderRankings();
}

export function setRankingSearch(term) {
    rankingSearch = String(term || '').trim().toLowerCase();
    renderRankings();
}

export function setHideInactive(value) {
    hideInactive = Boolean(value);
    renderRankings();
}

/** Vereinheitlicht den Zugriff auf Einzel- und Doppelwerte. */
function statsFor(player, type) {
    return type === 'doubles'
        ? { elo: player.doublesElo, matches: player.doublesMatches, wins: player.doublesWins, losses: player.doublesLosses }
        : { elo: player.elo,        matches: player.matches,        wins: player.wins,        losses: player.losses };
}

export function renderRankings() {
    const body = document.getElementById('rankingsBody');
    if (!body) return;
    body.textContent = '';

    // Die Markenfarbe einmal pro Render lesen statt einmal pro Zeile.
    const accent = brandColor();

    const rows = Object.entries(state.players)
        .map(([id, player]) => ({ id, player, stats: statsFor(player, rankingType) }))
        .filter(({ player, stats }) => {
            if (hideInactive && stats.matches === 0) return false;
            if (rankingSearch && !player.name.toLowerCase().includes(rankingSearch)) return false;
            return true;
        });

    // Der Rang folgt immer der ELO — auch wenn nach einer anderen Spalte
    // sortiert wird, damit "Rang 3" nicht plötzlich etwas anderes bedeutet.
    const rankByElo = new Map(
        [...rows].sort((a, b) => b.stats.elo - a.stats.elo).map((row, i) => [row.id, i + 1]),
    );

    rows.sort((a, b) => {
        const value = (row) => rankingSort.key === 'name' ? row.player.name : row.stats[rankingSort.key];
        const left = value(a), right = value(b);

        if (typeof left === 'string') return left.localeCompare(right) * rankingSort.dir;
        return (left - right) * rankingSort.dir;
    });

    updateSortIndicators();

    if (rows.length === 0) {
        body.appendChild(emptyRow(7, emptyRankingMessage()));
        return;
    }

    // Serien in einem Durchlauf vorberechnen statt pro Zeile.
    for (const row of rows) {
        body.appendChild(buildRankRow(rankByElo.get(row.id), row, accent));
    }
}

function emptyRankingMessage() {
    if (Object.keys(state.players).length === 0) return 'Noch keine Spieler angelegt.';
    if (rankingSearch) return `Kein Spieler passt zu „${rankingSearch}“.`;
    if (hideInactive)  return 'Noch keine Spiele in diesem Modus eingetragen.';
    return 'Keine Einträge.';
}

function updateSortIndicators() {
    document.querySelectorAll('#rankingsTable th[aria-sort]').forEach(th => {
        const key = th.querySelector('.th-sort')?.dataset.sort;
        const active = key === rankingSort.key;
        th.setAttribute('aria-sort', active ? (rankingSort.dir === 1 ? 'ascending' : 'descending') : 'none');
        th.classList.toggle('sorted', active);
        th.dataset.direction = active ? (rankingSort.dir === 1 ? 'asc' : 'desc') : '';
    });
}

function buildRankRow(rank, { id, player, stats }, accent) {
    const row = document.createElement('tr');

    // Rang
    const rankSpan = document.createElement('span');
    rankSpan.className = 'rank-badge';
    if (rank <= 3) rankSpan.classList.add(`rank-${rank}`);
    else rankSpan.style.backgroundColor = accent;
    rankSpan.textContent = String(rank);

    const rankCell = document.createElement('td');
    rankCell.appendChild(rankSpan);
    row.appendChild(rankCell);

    // Name — als Button, damit das Profil auch per Tastatur erreichbar ist.
    const nameCell = document.createElement('td');
    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'player-link';
    nameButton.appendChild(avatarSpan(id));
    nameButton.appendChild(document.createTextNode(' ' + player.name));
    nameButton.setAttribute('aria-label', `Profil von ${player.name} anzeigen`);
    nameButton.addEventListener('click', () => handlers.onOpenProfile(id));
    nameCell.appendChild(nameButton);
    row.appendChild(nameCell);

    for (const value of [stats.elo, stats.matches, stats.wins, stats.losses]) {
        row.appendChild(td(String(value)));
    }

    const streakCell = document.createElement('td');
    streakCell.appendChild(streakBadge(getPlayerStreak(id, rankingType)));
    row.appendChild(streakCell);

    return row;
}

/**
 * Serien-Kennzeichnung. Die Emoji tragen Bedeutung, deshalb steht daneben
 * immer ein für Screenreader lesbarer Text.
 */
function streakBadge({ current, isWin, longest }) {
    if (current === 0) {
        const none = document.createElement('span');
        none.className = 'streak-none';
        none.textContent = '—';
        none.setAttribute('aria-label', 'keine Serie');
        return none;
    }

    const badge = document.createElement('span');
    badge.className = isWin ? 'streak-win' : 'streak-loss';

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = isWin
        ? (current >= 5 ? '🔥🔥' : current >= 3 ? '🔥' : '⚡')
        : '💔';
    badge.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = isWin ? 'Siege in Folge: ' : 'Niederlagen in Folge: ';
    badge.appendChild(label);

    badge.appendChild(document.createTextNode(' ' + current));
    badge.title = isWin
        ? `Aktuell ${current} Siege in Folge — Rekord: ${longest}`
        : `Aktuell ${current} Niederlagen in Folge`;

    return badge;
}

// ================= SPIELVERLAUF =================

export function renderHistory({ allowDelete = true } = {}) {
    const body = document.getElementById('historyBody');
    if (!body) return;
    body.textContent = '';

    if (state.matches.length === 0) {
        body.appendChild(emptyRow(6, 'Noch keine Spiele eingetragen.'));
        return;
    }

    for (const match of sortMatchesDesc(state.matches)) {
        const { isDoubles, winnerIds, loserIds } = normaliseMatch(match);

        const row = document.createElement('tr');
        row.appendChild(dateCell(match.date));
        row.appendChild(typeCell(isDoubles));
        row.appendChild(playersCell(winnerIds));
        row.appendChild(playersCell(loserIds));

        const eloCell = document.createElement('td');
        const elo = document.createElement('span');
        elo.className = 'elo-positive';
        elo.textContent = '+' + (match.eloChange ?? 0);
        eloCell.appendChild(elo);

        if (Number.isFinite(match.winnerScore) && Number.isFinite(match.loserScore)) {
            const score = document.createElement('span');
            score.className = 'match-score';
            score.textContent = `${match.winnerScore}:${match.loserScore}`;
            eloCell.append(document.createTextNode(' '), score);
        }
        row.appendChild(eloCell);

        const actionCell = document.createElement('td');
        if (allowDelete) actionCell.appendChild(deleteButton(match));
        row.appendChild(actionCell);

        body.appendChild(row);
    }
}

function deleteButton(match) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-delete-match';
    button.textContent = '🗑';
    button.setAttribute('aria-label', `Spiel vom ${formatDateTime(match.date)} löschen`);
    button.title = 'Spiel löschen';

    button.addEventListener('click', () => {
        const question = `Spiel löschen?\n${match.winnerName} vs. ${match.loserName}\n\n`
                       + 'Die ELO-Werte aller Spieler werden anschließend neu berechnet.';
        if (confirm(question)) handlers.onDeleteMatch(match.id);
    });

    return button;
}

// ── Gemeinsame Zellen ──────────────────────────────────────────────────────

function dateCell(value) {
    return td(formatDateTime(value));
}

function typeCell(isDoubles) {
    const badge = document.createElement('span');
    badge.className = `match-type-indicator match-${isDoubles ? 'doubles' : 'singles'}`;
    badge.textContent = isDoubles ? 'Doppel' : 'Einzel';

    const cell = document.createElement('td');
    cell.appendChild(badge);
    return cell;
}

/** Spielernamen als Textknoten — nie als HTML. */
function playersCell(ids) {
    const cell = document.createElement('td');
    if (ids.length > 1) cell.className = 'team-display';

    ids.forEach((id, index) => {
        if (index > 0) cell.appendChild(document.createTextNode(' & '));
        cell.appendChild(avatarSpan(id));
        cell.appendChild(document.createTextNode(' ' + (state.players[id]?.name ?? 'Unbekannt')));
    });

    if (ids.length === 0) cell.textContent = 'Unbekannt';
    return cell;
}

// ================= SPIELER-PROFIL =================

let lastFocused = null;
let openProfileId = null;

export function openPlayerProfile(playerId, onChartTypeChange) {
    const player = state.players[playerId];
    if (!player) return;

    openProfileId = playerId;
    lastFocused = document.activeElement;

    document.getElementById('profile-avatar').textContent = getAvatarEmoji(playerId);
    document.getElementById('profile-name').textContent   = player.name;

    setRecord('profile-singles-elo', 'profile-singles-record', player.elo,
        player.wins, player.losses, player.matches, getPlayerStreak(playerId, 'singles'));
    setRecord('profile-doubles-elo', 'profile-doubles-record', player.doublesElo,
        player.doublesWins, player.doublesLosses, player.doublesMatches, getPlayerStreak(playerId, 'doubles'));

    document.querySelectorAll('.profile-chart-tab').forEach(tab => {
        const isSingles = tab.dataset.type === 'singles';
        tab.classList.toggle('active', isSingles);
        tab.setAttribute('aria-pressed', String(isSingles));
        tab.onclick = () => {
            document.querySelectorAll('.profile-chart-tab').forEach(other => {
                const active = other === tab;
                other.classList.toggle('active', active);
                other.setAttribute('aria-pressed', String(active));
            });
            onChartTypeChange(playerId, tab.dataset.type);
        };
    });

    renderProfileHistory(playerId);
    cancelRename();

    const modal = document.getElementById('player-profile-modal');
    modal.hidden = false;
    document.body.classList.add('modal-open');

    document.addEventListener('keydown', onModalKeydown, true);
    document.getElementById('profile-close').focus();
}

export function currentProfileId() {
    return openProfileId;
}

function setRecord(eloId, recordId, elo, wins, losses, matches, streak) {
    document.getElementById(eloId).textContent = elo;

    const record = document.getElementById(recordId);
    record.textContent = `${wins}S / ${losses}N (${matches} ${pluralise(matches, 'Spiel', 'Spiele')}) `;
    record.appendChild(streakBadge(streak));
}

export function closePlayerProfile() {
    const modal = document.getElementById('player-profile-modal');
    if (!modal || modal.hidden) return;

    modal.hidden = true;
    openProfileId = null;
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onModalKeydown, true);

    // Fokus dorthin zurückgeben, wo er herkam.
    lastFocused?.focus?.();
    lastFocused = null;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function onModalKeydown(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        closePlayerProfile();
        return;
    }

    if (event.key !== 'Tab') return;

    // Fokusfalle: ohne sie wandert der Tabulator hinter das Modal in die
    // Seite darunter.
    const card  = document.getElementById('profile-card');
    const items = [...card.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (items.length === 0) return;

    const first = items[0];
    const last  = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

export function startRename(currentName) {
    document.getElementById('profile-rename-form').hidden = false;
    document.getElementById('profile-rename').hidden = true;
    const input = document.getElementById('profile-rename-input');
    input.value = currentName;
    input.focus();
    input.select();
}

export function cancelRename() {
    document.getElementById('profile-rename-form').hidden = true;
    document.getElementById('profile-rename').hidden = false;
}

function renderProfileHistory(playerId) {
    const body = document.getElementById('profile-history-body');
    body.textContent = '';

    const played = sortMatchesDesc(state.matches.filter(match => matchInvolves(match, playerId))).slice(0, 15);

    if (played.length === 0) {
        body.appendChild(emptyRow(5, 'Noch keine Spiele eingetragen.'));
        return;
    }

    for (const match of played) {
        const { isDoubles, winnerIds, loserIds } = normaliseMatch(match);
        const won = isWinner(match, playerId);

        const row = document.createElement('tr');
        row.className = won ? 'win-row' : 'loss-row';

        row.appendChild(dateCell(match.date));
        row.appendChild(typeCell(isDoubles));
        row.appendChild(playersCell((won ? loserIds : winnerIds).filter(id => id !== playerId)));

        const result = td(won ? '🏆 Sieg' : '❌ Niederlage');
        result.className = won ? 'result-win' : 'result-loss';
        row.appendChild(result);

        const elo = td((won ? '+' : '−') + (match.eloChange ?? 0));
        elo.className = won ? 'elo-positive' : 'elo-negative';
        row.appendChild(elo);

        body.appendChild(row);
    }
}

// ================= IMPORT-VORSCHAU =================

export function showImportPreview(summary, onConfirm, onCancel) {
    const panel = document.getElementById('import-preview');
    panel.textContent = '';
    panel.hidden = false;

    const text = document.createElement('p');
    text.textContent = summary;
    panel.appendChild(text);

    const row = document.createElement('div');
    row.className = 'button-row';

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = 'Importieren';
    confirm.addEventListener('click', onConfirm);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Abbrechen';
    cancel.addEventListener('click', () => { panel.hidden = true; onCancel?.(); });

    row.append(confirm, cancel);
    panel.appendChild(row);
}

export function hideImportPreview() {
    const panel = document.getElementById('import-preview');
    if (panel) panel.hidden = true;
}

// ================= KONFETTI =================

export function showConfetti() {
    // 100 animierte Elemente sind für Menschen mit Bewegungsempfindlichkeit
    // unangenehm — hier entstehen sie gar nicht erst.
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', brandColor()];
    document.querySelectorAll('.confetti').forEach(piece => piece.remove());

    for (let i = 0; i < 100; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti';
        piece.setAttribute('aria-hidden', 'true');
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (Math.random() * 3 + 2) + 's';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 5000);
    }
}

// ================= HILFSFUNKTIONEN =================

function sortedByName(players) {
    return Object.entries(players).sort((a, b) => a[1].name.localeCompare(b[1].name, 'de'));
}

function playerCardButton(id, name, className) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = className;
    card.dataset.id = id;
    card.setAttribute('aria-pressed', 'false');

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = getAvatarEmoji(id);

    const label = document.createElement('span');
    label.className = 'name';
    label.textContent = name;

    card.append(avatar, label);
    return card;
}

function emptyRow(columns, message) {
    const row  = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns;
    cell.className = 'empty-cell';
    cell.textContent = message;
    row.appendChild(cell);
    return row;
}

function emptyHint(message, targetTab, actionLabel) {
    const box = document.createElement('div');
    box.className = 'empty-hint';

    const text = document.createElement('p');
    text.textContent = message;
    box.appendChild(text);

    if (targetTab) {
        const action = document.createElement('button');
        action.type = 'button';
        action.textContent = actionLabel;
        action.addEventListener('click', () => showTab(targetTab));
        box.appendChild(action);
    }

    return box;
}

function td(text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}
