import { state } from './state.js';
import { getPlayerStreak } from './streaks.js';

// ================= AVATAR =================

const avatarEmojis = ['😎','🤩','🤓','🤠','👻','🤖','👽','🦄','🐱','🐶','🦊','🦁','🐯','🐺','🦝','🐨','🐼','🐹','🐰','🦇','🐝','🐢','🦖','🐙','🦋','🦜','🦢','🦚','🦉','🦁','🐌','🦀','🦞','🦐','🐠','🐬','🐳','🦈','🦭','🐘','🦏','🦛','🐪','🦒','🦘','🦬','🐂','🐄','🐎','🦮','🐕','🐩','🐈','🦙','🦌','🐑','🐐','🐏','🐖','🐓','🦃','🦆','🦅'];

export function getAvatarEmoji(playerId) {
    playerId = String(playerId || '');
    if (!playerId) return '🐔';
    const seed = playerId.charCodeAt(0) + playerId.charCodeAt(playerId.length - 1);
    return avatarEmojis[seed % avatarEmojis.length];
}

// ================= NACHRICHTEN =================

export function showError(message) {
    const el = document.getElementById('errorMessage');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

export function showSuccess(message) {
    const el = document.getElementById('successMessage');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

export function toggleLoading(show) {
    const el = document.querySelector('.chicken-overlay');
    if (!el) return;
    el.style.display = show ? 'flex' : 'none';
    el.style.opacity = show ? 1 : 0;
}

// ================= TABS =================

export function openTab(element, tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    element.classList.add('active');
}

// ================= SPIELMODUS =================

export function renderGameModeSwitch(mode) {
    document.querySelectorAll('.mode-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.mode-button[data-mode="${mode}"]`)?.classList.add('active');

    document.getElementById('singles-interface').style.display = mode === 'singles' ? 'block' : 'none';
    document.getElementById('doubles-interface').style.display = mode === 'doubles' ? 'block' : 'none';
}

// ================= SPIELER-AUSWAHL ZURÜCKSETZEN =================

export function clearTeamDisplay() {
    ['team1-player1','team1-player2','team2-player1','team2-player2'].forEach(id => {
        document.getElementById(id).textContent = '-';
    });
    document.querySelectorAll('.doubles-player-card').forEach(card => {
        card.classList.remove('selected-team1', 'selected-team2');
    });
    document.getElementById('team1').classList.remove('team-winner', 'team-loser');
    document.getElementById('team2').classList.remove('team-winner', 'team-loser');
    document.getElementById('winning-team').value = '';
}

export function clearPlayerCardSelection() {
    document.querySelectorAll('.player-card').forEach(card => card.classList.remove('selected'));
    document.getElementById('winner').value = '';
    document.getElementById('loser').value  = '';
}

// ================= DROPDOWN-MENÜS =================

export function renderPlayerDropdowns() {
    const winnerSelect = document.getElementById('winner');
    const loserSelect  = document.getElementById('loser');

    winnerSelect.innerHTML = '<option value="">-- Spieler auswählen --</option>';
    loserSelect.innerHTML  = '<option value="">-- Spieler auswählen --</option>';

    sortedByName(state.players).forEach(([id, player]) => {
        const opt = (sel) => {
            const o = document.createElement('option');
            o.value = id;
            o.textContent = player.name;
            sel.appendChild(o);
        };
        opt(winnerSelect);
        opt(loserSelect);
    });
}

// ================= SPIELERKARTEN (EINZEL) =================

export function renderPlayerList(onSelect) {
    const list = document.getElementById('playerList');
    list.innerHTML = '';

    sortedByName(state.players).forEach(([id, player]) => {
        const card = createPlayerCard(id, player.name);
        card.addEventListener('click', () => onSelect(id));
        list.appendChild(card);
    });
}

export function filterPlayerList() {
    const term = document.getElementById('player-search').value.toLowerCase();
    document.querySelectorAll('.player-card').forEach(card => {
        const name = card.querySelector('.name').textContent.toLowerCase();
        card.style.display = name.includes(term) ? 'block' : 'none';
    });
}

export function highlightSinglesSelection() {
    const selected = [...document.querySelectorAll('.player-card.selected')];
    if (selected.length >= 1) document.getElementById('winner').value = selected[0].dataset.id;
    if (selected.length >= 2) document.getElementById('loser').value  = selected[1].dataset.id;
}

// ================= SPIELERKARTEN (DOPPEL) =================

export function renderDoublesGrid(onSelect) {
    const grid = document.getElementById('doublesPlayerGrid');
    grid.innerHTML = '';

    sortedByName(state.players).forEach(([id, player]) => {
        const card = document.createElement('div');
        card.className = 'doubles-player-card';
        card.dataset.id = id;

        const avatar  = el('div', { style: 'font-size:20px' }, getAvatarEmoji(id));
        const name    = el('div', { style: 'margin-top:5px;font-size:14px' }, player.name);
        const eloInfo = el('div', { style: 'font-size:12px;color:#666' }, `Doppel: ${player.doublesElo}`);

        card.append(avatar, name, eloInfo);
        card.addEventListener('click', () => onSelect(id));
        grid.appendChild(card);
    });
}

export function updateTeamDisplay() {
    const sp = state.selectedPlayers;

    document.getElementById('team1-player1').textContent = sp[0] ? state.players[sp[0]].name : '-';
    document.getElementById('team1-player2').textContent = sp[1] ? state.players[sp[1]].name : '-';
    document.getElementById('team2-player1').textContent = sp[2] ? state.players[sp[2]].name : '-';
    document.getElementById('team2-player2').textContent = sp[3] ? state.players[sp[3]].name : '-';

    const winning = document.getElementById('winning-team').value;
    document.getElementById('team1').classList.remove('team-winner', 'team-loser');
    document.getElementById('team2').classList.remove('team-winner', 'team-loser');

    if (winning === 'team1') {
        document.getElementById('team1').classList.add('team-winner');
        document.getElementById('team2').classList.add('team-loser');
    } else if (winning === 'team2') {
        document.getElementById('team2').classList.add('team-winner');
        document.getElementById('team1').classList.add('team-loser');
    }
}

// ================= RANGLISTE =================

export function showRankingTab(type) {
    document.querySelectorAll('.ranking-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === type);
    });
    document.getElementById('singles-ranking').style.display = type === 'singles' ? 'block' : 'none';
    document.getElementById('doubles-ranking').style.display = type === 'doubles' ? 'block' : 'none';
    renderRankings();
}

let _onPlayerRowClick = null;

export function renderRankings(onRowClick = null) {
    _onPlayerRowClick = onRowClick;
    renderSinglesRanking();
    renderDoublesRanking();
}

function renderSinglesRanking() {
    const body = document.getElementById('singlesRankingsBody');
    body.innerHTML = '';
    Object.entries(state.players)
        .sort((a, b) => b[1].elo - a[1].elo)
        .forEach(([id, player], i) =>
            body.appendChild(buildRankRow(i, id, player, 'elo', 'matches', 'wins', 'losses'))
        );
}

function renderDoublesRanking() {
    const body = document.getElementById('doublesRankingsBody');
    body.innerHTML = '';
    Object.entries(state.players)
        .sort((a, b) => b[1].doublesElo - a[1].doublesElo)
        .forEach(([id, player], i) =>
            body.appendChild(buildRankRow(i, id, player, 'doublesElo', 'doublesMatches', 'doublesWins', 'doublesLosses'))
        );
}

function buildRankRow(index, id, player, eloKey, matchesKey, winsKey, lossesKey) {
    const row = document.createElement('tr');

    if (_onPlayerRowClick) {
        row.style.cursor = 'pointer';
        row.title = `${player.name} Profil anzeigen`;
        row.addEventListener('click', () => _onPlayerRowClick(id));
    }

    const rankSpan = document.createElement('span');
    rankSpan.className = 'rank-badge';
    if      (index === 0) rankSpan.classList.add('rank-1');
    else if (index === 1) rankSpan.classList.add('rank-2');
    else if (index === 2) rankSpan.classList.add('rank-3');
    else                  rankSpan.style.backgroundColor = '#c51216';
    rankSpan.textContent = index + 1;

    const rankCell = document.createElement('td');
    rankCell.appendChild(rankSpan);
    row.appendChild(rankCell);

    const nameCell = document.createElement('td');
    nameCell.innerHTML = `${getAvatarEmoji(id)} ${player.name}`;
    row.appendChild(nameCell);

    [player[eloKey], player[matchesKey], player[winsKey], player[lossesKey]].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        row.appendChild(td);
    });

    const streakType = eloKey === 'elo' ? 'singles' : 'doubles';
    const streak     = getPlayerStreak(id, streakType);
    const streakCell = document.createElement('td');
    streakCell.innerHTML = streakBadge(streak);
    row.appendChild(streakCell);

    return row;
}

function streakBadge({ current, isWin, longest }) {
    if (current === 0) return '<span style="color:#ccc">—</span>';
    if (!isWin)        return `<span class="streak-loss" title="Niederlagenserie">💔 ${current}</span>`;
    const flame = current >= 5 ? '🔥🔥' : current >= 3 ? '🔥' : '⚡';
    const title = `Aktuell: ${current} Siege in Folge | Rekord: ${longest}`;
    return `<span class="streak-win" title="${title}">${flame} ${current}</span>`;
}

// ================= SPIELVERLAUF =================

export function renderHistory(onDelete = null) {
    const body = document.getElementById('historyBody');
    body.innerHTML = '';

    const sorted = [...state.matches].sort((a, b) =>
        new Date(b.date || 0) - new Date(a.date || 0)
    );

    const playerDisplay = (idStr) => {
        const ids   = String(idStr || '').split(',').map(s => s.trim());
        const parts = ids.map(id => {
            const p = state.players[id];
            return `${getAvatarEmoji(id)} ${p ? p.name : 'Unbekannt'}`;
        });
        return parts.length > 1
            ? `<div class="team-display">${parts.join(' & ')}</div>`
            : parts[0];
    };

    sorted.forEach(match => {
        let { id, date, type, winnerId, loserId, eloChange } = match;

        // Workaround für ältere Matches mit verschobenen Spalten
        const winnerIsType = String(winnerId).toLowerCase().includes('singles') ||
                             String(winnerId).toLowerCase().includes('doubles');
        if (winnerIsType) {
            type      = winnerId;
            winnerId  = loserId;
            loserId   = match.winnerName;
            eloChange = eloChange || 0;
        }

        const row = document.createElement('tr');

        const matchDate = new Date(date);
        row.appendChild(td(
            isNaN(matchDate.getTime())
                ? '-'
                : matchDate.toLocaleDateString() + ' ' +
                  matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ));

        const isSingles = String(type).toLowerCase().includes('singles');
        const typeSpan  = document.createElement('span');
        typeSpan.className = `match-type-indicator match-${isSingles ? 'singles' : 'doubles'}`;
        typeSpan.textContent = isSingles ? 'Einzel' : 'Doppel';
        const typeCell = document.createElement('td');
        typeCell.appendChild(typeSpan);
        row.appendChild(typeCell);

        const winnerCell = document.createElement('td');
        winnerCell.innerHTML = playerDisplay(winnerId);
        row.appendChild(winnerCell);

        const loserCell = document.createElement('td');
        loserCell.innerHTML = playerDisplay(loserId);
        row.appendChild(loserCell);

        const eloCell = td('+' + (eloChange ?? 0));
        eloCell.className = 'elo-positive';
        row.appendChild(eloCell);

        if (onDelete) {
            const deleteCell = document.createElement('td');
            const btn = document.createElement('button');
            btn.className = 'btn-delete-match';
            btn.textContent = '🗑';
            btn.title = 'Match löschen';
            btn.addEventListener('click', () => {
                if (confirm(`Match löschen?\n${match.winnerName} vs. ${match.loserName}\n\nDie ELO-Werte aller Spieler werden neu berechnet.`)) {
                    onDelete(id);
                }
            });
            deleteCell.appendChild(btn);
            row.appendChild(deleteCell);
        }

        body.appendChild(row);
    });
}

// ================= SPIELER-PROFIL =================

export function openPlayerProfile(playerId, onChartTypeChange) {
    const player = state.players[playerId];
    if (!player) return;

    document.getElementById('profile-avatar').textContent = getAvatarEmoji(playerId);
    document.getElementById('profile-name').textContent   = player.name;

    document.getElementById('profile-singles-elo').textContent    = player.elo;
    const sStreak = getPlayerStreak(playerId, 'singles');
    document.getElementById('profile-singles-record').innerHTML =
        `${player.wins}S / ${player.losses}N (${player.matches} Spiele) &nbsp;${streakBadge(sStreak)}`;

    document.getElementById('profile-doubles-elo').textContent    = player.doublesElo;
    const dStreak = getPlayerStreak(playerId, 'doubles');
    document.getElementById('profile-doubles-record').innerHTML =
        `${player.doublesWins}S / ${player.doublesLosses}N (${player.doublesMatches} Spiele) &nbsp;${streakBadge(dStreak)}`;

    // Chart-Tab-Buttons verdrahten
    document.querySelectorAll('.profile-chart-tab').forEach(t => {
        t.classList.remove('active');
        t.onclick = () => {
            document.querySelectorAll('.profile-chart-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            onChartTypeChange(playerId, t.getAttribute('data-type'));
        };
    });
    document.querySelector('.profile-chart-tab[data-type="singles"]')?.classList.add('active');

    _renderProfileHistory(playerId);

    document.getElementById('player-profile-modal').style.display = 'flex';
}

function _renderProfileHistory(playerId) {
    const body = document.getElementById('profile-history-body');
    body.innerHTML = '';

    const playerMatches = [...state.matches]
        .filter(m => {
            const wIds = String(m.winnerId || '').split(',').map(s => s.trim());
            const lIds = String(m.loserId  || '').split(',').map(s => s.trim());
            return wIds.includes(playerId) || lIds.includes(playerId);
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 15);

    if (playerMatches.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'Noch keine Spiele eingetragen.';
        cell.style.textAlign = 'center';
        cell.style.color = '#999';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    playerMatches.forEach(match => {
        const wIds = String(match.winnerId || '').split(',').map(s => s.trim());
        const isWin = wIds.includes(playerId);
        const isSingles = String(match.type || '').toLowerCase().includes('singles');

        const opponentId = isWin ? match.loserId : match.winnerId;
        const opponentIds = String(opponentId || '').split(',').map(s => s.trim());
        const opponentNames = opponentIds.map(id => {
            const p = state.players[id];
            return p ? `${getAvatarEmoji(id)} ${p.name}` : 'Unbekannt';
        }).join(' & ');

        const row = document.createElement('tr');
        row.className = isWin ? 'win-row' : 'loss-row';

        const matchDate = new Date(match.date);
        row.appendChild(td(
            isNaN(matchDate.getTime()) ? '-' :
                matchDate.toLocaleDateString() + ' ' +
                matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ));

        const typeSpan = document.createElement('span');
        typeSpan.className = `match-type-indicator match-${isSingles ? 'singles' : 'doubles'}`;
        typeSpan.textContent = isSingles ? 'Einzel' : 'Doppel';
        const typeCell = document.createElement('td');
        typeCell.appendChild(typeSpan);
        row.appendChild(typeCell);

        const oppCell = document.createElement('td');
        oppCell.innerHTML = opponentNames;
        row.appendChild(oppCell);

        const resultCell = td(isWin ? '🏆 Sieg' : '❌ Niederlage');
        resultCell.style.fontWeight = 'bold';
        resultCell.style.color = isWin ? '#27ae60' : '#e74c3c';
        row.appendChild(resultCell);

        const eloCell = td((isWin ? '+' : '−') + (match.eloChange ?? 0));
        eloCell.className = isWin ? 'elo-positive' : 'elo-negative';
        row.appendChild(eloCell);

        body.appendChild(row);
    });
}

export function closePlayerProfile() {
    document.getElementById('player-profile-modal').style.display = 'none';
}

// ================= KONFETTI =================

export function showConfetti() {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#c51216'];
    document.querySelectorAll('.confetti').forEach(c => c.remove());

    for (let i = 0; i < 100; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (Math.random() * 3 + 2) + 's';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 5000);
    }
}

// ================= HILFSFUNKTIONEN =================

function sortedByName(players) {
    return Object.entries(players).sort((a, b) => a[1].name.localeCompare(b[1].name));
}

function createPlayerCard(id, name) {
    const card   = document.createElement('div');
    card.className  = 'player-card';
    card.dataset.id = id;
    card.appendChild(el('div', { className: 'avatar' }, getAvatarEmoji(id)));
    card.appendChild(el('div', { className: 'name'   }, name));
    return card;
}

function el(tag, attrs = {}, text = '') {
    const node = document.createElement(tag);
    Object.assign(node, attrs);
    if (text) node.textContent = text;
    return node;
}

function td(text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}
