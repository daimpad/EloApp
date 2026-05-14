// ================= KONFIGURATION =================

// API-URL wird aus config.js geladen (nicht im Repository enthalten).
// Kopiere config.example.js → config.js und trage deine URL ein.
const GOOGLE_SHEETS_API_URL = (typeof CONFIG !== 'undefined')
    ? CONFIG.GOOGLE_SHEETS_API_URL
    : '';

// ================= GLOBALE VARIABLEN =================

const avatarEmojis = ["😎", "🤩", "🤓", "🤠", "👻", "🤖", "👽", "🦄", "🐱", "🐶", "🦊", "🦁", "🐯", "🐺", "🦝", "🐨", "🐼", "🐹", "🐰", "🦇", "🐝", "🐢", "🦖", "🐙", "🦋", "🦜", "🦢", "🦚", "🦉", "🦁", "🐌", "🦀", "🦞", "🦐", "🐠", "🐬", "🐳", "🦈", "🦭", "🐘", "🦏", "🦛", "🐪", "🦒", "🦘", "🦬", "🐂", "🐄", "🐎", "🦮", "🐕", "🐩", "🐈", "🦙", "🦌", "🐑", "🐐", "🐏", "🐖", "🐓", "🦃", "🦆", "🦅"];

let players = {};
let matches = [];
let selectedPlayers = [];
let currentGameMode = 'singles';
let isDataLoading = false;

const K_FACTOR = 32;
const STARTING_ELO = 1000;

// ================= HAUPTFUNKTIONEN =================

function openTab(element, tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }

    const tabs = document.getElementsByClassName('tab');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }

    document.getElementById(tabName).classList.add('active');
    element.classList.add('active');
}

function selectGameMode(mode) {
    currentGameMode = mode;

    document.querySelectorAll('.mode-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (mode === 'singles') {
        document.getElementById('singles-interface').style.display = 'block';
        document.getElementById('doubles-interface').style.display = 'none';
    } else {
        document.getElementById('singles-interface').style.display = 'none';
        document.getElementById('doubles-interface').style.display = 'block';
        updateDoublesPlayerGrid();
    }

    clearSelections();
}

function clearSelections() {
    selectedPlayers = [];
    document.querySelectorAll('.player-card').forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.doubles-player-card').forEach(card => {
        card.classList.remove('selected-team1', 'selected-team2');
    });
    clearTeams();

    document.getElementById('winner').value = '';
    document.getElementById('loser').value = '';
    document.getElementById('winning-team').value = '';
}

function clearTeams() {
    selectedPlayers = [];
    document.getElementById('team1-player1').textContent = '-';
    document.getElementById('team1-player2').textContent = '-';
    document.getElementById('team2-player1').textContent = '-';
    document.getElementById('team2-player2').textContent = '-';

    document.querySelectorAll('.doubles-player-card').forEach(card => {
        card.classList.remove('selected-team1', 'selected-team2');
    });

    document.getElementById('team1').classList.remove('team-winner', 'team-loser');
    document.getElementById('team2').classList.remove('team-winner', 'team-loser');
    document.getElementById('winning-team').value = '';
}

function getAvatarEmoji(playerId) {
    playerId = String(playerId || "");
    if (!playerId) return "🐔";
    const seed = playerId.charCodeAt(0) + playerId.charCodeAt(playerId.length - 1);
    return avatarEmojis[seed % avatarEmojis.length];
}

function showError(message) {
    const el = document.getElementById('errorMessage');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function showSuccess(message) {
    const el = document.getElementById('successMessage');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function toggleLoading(show) {
    const el = document.querySelector('.chicken-overlay');
    if (!el) return;
    el.style.display = show ? 'flex' : 'none';
    el.style.opacity = show ? 1 : 0;
}

// ================= DATEN LADEN UND SPEICHERN =================

window.onload = async function() {
    if (!GOOGLE_SHEETS_API_URL) {
        showError('Keine API-URL konfiguriert. Bitte config.js anlegen (siehe config.example.js).');
    }
    await loadPlayers();
    await loadMatches();
};

async function loadPlayers() {
    toggleLoading(true);
    isDataLoading = true;

    try {
        const localPlayers = localStorage.getItem('eloPlayers');
        if (localPlayers) {
            players = JSON.parse(localPlayers);
            updatePlayerDropdowns();
            updatePlayerList();
            updateDoublesPlayerGrid();
            updateRankings();
        }

        const response = await fetch(`${GOOGLE_SHEETS_API_URL}?action=getPlayers`);
        const data = await response.json();

        if (data.success) {
            players = data.players;

            Object.keys(players).forEach(id => {
                if (!players[id].doublesElo) {
                    players[id].doublesElo = STARTING_ELO;
                    players[id].doublesMatches = 0;
                    players[id].doublesWins = 0;
                    players[id].doublesLosses = 0;
                }
            });

            localStorage.setItem('eloPlayers', JSON.stringify(players));
            updatePlayerDropdowns();
            updatePlayerList();
            updateDoublesPlayerGrid();
            updateRankings();
            showSuccess("Spieler erfolgreich geladen!");
        } else {
            showError(`Fehler beim Laden der Spieler: ${data.message}`);
        }
    } catch (error) {
        console.error("Netzwerkfehler:", error);
        showError("Netzwerkfehler beim Laden der Spieler. Lokale Daten werden verwendet.");
    } finally {
        isDataLoading = false;
        toggleLoading(false);
    }
}

async function loadMatches() {
    toggleLoading(true);
    isDataLoading = true;

    try {
        const localMatches = localStorage.getItem('eloMatches');
        if (localMatches) {
            matches = JSON.parse(localMatches);
            recalculateStatsFromHistory();
            updateHistory();
        }

        const response = await fetch(`${GOOGLE_SHEETS_API_URL}?action=getMatches`);
        const data = await response.json();

        if (data.success) {
            matches = data.matches;
            localStorage.setItem('eloMatches', JSON.stringify(matches));
            recalculateStatsFromHistory();
            updateHistory();
            updateRankings();
            showSuccess("Spielverlauf erfolgreich geladen!");
        } else {
            showError(`Fehler beim Laden des Spielverlaufs: ${data.message}`);
        }
    } catch (error) {
        console.error("Netzwerkfehler:", error);
        showError("Netzwerkfehler beim Laden des Spielverlaufs. Lokale Daten werden verwendet.");
    } finally {
        isDataLoading = false;
        toggleLoading(false);
    }
}

function recalculateStatsFromHistory() {
    Object.keys(players).forEach(id => {
        players[id].elo           = STARTING_ELO;
        players[id].matches       = 0;
        players[id].wins          = 0;
        players[id].losses        = 0;
        players[id].doublesElo    = STARTING_ELO;
        players[id].doublesMatches = 0;
        players[id].doublesWins   = 0;
        players[id].doublesLosses = 0;
    });

    const chronologicalMatches = [...matches].sort((a, b) =>
        new Date(a.date || 0) - new Date(b.date || 0)
    );

    const getIds = (val) => {
        const s = String(val || "").trim();
        return s.includes(',') ? s.split(',').map(x => x.trim()) : [s];
    };

    chronologicalMatches.forEach(match => {
        const rawType     = String(match.type     || "").toLowerCase();
        const rawWinnerId = String(match.winnerId || "").toLowerCase();

        const columnShifted = rawWinnerId.includes('doubles') || rawWinnerId.includes('singles');

        let actualType = rawType;
        if (columnShifted) actualType = rawWinnerId;

        const isDoubles = actualType.includes('doubles') || String(match.winnerId).includes(',');

        let wRaw, lRaw;
        if (columnShifted) {
            wRaw = match.loserId;
            lRaw = match.winnerName;
        } else {
            wRaw = match.winnerId;
            lRaw = match.loserId;
        }

        if (!isDoubles) {
            const winnerId = String(wRaw || "").trim();
            const loserId  = String(lRaw || "").trim();
            const winner = players[winnerId];
            const loser  = players[loserId];
            if (!winner || !loser) return;

            const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
            const expectedLoser  = 1 / (1 + Math.pow(10, (winner.elo - loser.elo) / 400));

            winner.elo     = Math.round(winner.elo + K_FACTOR * (1 - expectedWinner));
            winner.matches = (winner.matches || 0) + 1;
            winner.wins    = (winner.wins    || 0) + 1;

            loser.elo      = Math.round(loser.elo  + K_FACTOR * (0 - expectedLoser));
            loser.matches  = (loser.matches  || 0) + 1;
            loser.losses   = (loser.losses   || 0) + 1;
        } else {
            const winners = getIds(wRaw);
            const losers  = getIds(lRaw);

            if (winners.some(id => !players[id]) || losers.some(id => !players[id])) return;

            const teamWinnerElo = winners.reduce((s, id) => s + players[id].doublesElo, 0) / winners.length;
            const teamLoserElo  = losers.reduce( (s, id) => s + players[id].doublesElo, 0) / losers.length;

            const expectedWinner = 1 / (1 + Math.pow(10, (teamLoserElo - teamWinnerElo) / 400));
            const eloChange = Math.round(K_FACTOR * (1 - expectedWinner));

            winners.forEach(id => {
                players[id].doublesElo     = (players[id].doublesElo     || STARTING_ELO) + eloChange;
                players[id].doublesMatches = (players[id].doublesMatches || 0) + 1;
                players[id].doublesWins    = (players[id].doublesWins    || 0) + 1;
            });

            losers.forEach(id => {
                players[id].doublesElo     = (players[id].doublesElo     || STARTING_ELO) - eloChange;
                players[id].doublesMatches = (players[id].doublesMatches || 0) + 1;
                players[id].doublesLosses  = (players[id].doublesLosses  || 0) + 1;
            });
        }
    });

    localStorage.setItem('eloPlayers', JSON.stringify(players));
}

// ================= SPIELER VERWALTEN =================

async function addPlayer() {
    const playerName = document.getElementById('playerName').value.trim();

    if (!playerName) {
        showError('Bitte gib einen Namen ein!');
        return;
    }

    for (const id in players) {
        if (players[id].name.toLowerCase() === playerName.toLowerCase()) {
            showError('Ein Spieler mit diesem Namen existiert bereits!');
            return;
        }
    }

    const playerId = Date.now().toString();

    players[playerId] = {
        name: playerName,
        elo: STARTING_ELO,
        matches: 0,
        wins: 0,
        losses: 0,
        doublesElo: STARTING_ELO,
        doublesMatches: 0,
        doublesWins: 0,
        doublesLosses: 0
    };

    localStorage.setItem('eloPlayers', JSON.stringify(players));
    toggleLoading(true);

    try {
        const response = await fetch(`${GOOGLE_SHEETS_API_URL}?action=addPlayer&id=${playerId}&name=${encodeURIComponent(playerName)}&elo=${STARTING_ELO}&matches=0&wins=0&losses=0&doublesElo=${STARTING_ELO}&doublesMatches=0&doublesWins=0&doublesLosses=0`);
        const data = await response.json();

        if (data.success) {
            showSuccess(`Spieler "${playerName}" wurde hinzugefügt!`);
            document.getElementById('playerName').value = '';
            showConfetti();
        } else {
            showError(`Fehler beim Speichern des Spielers: ${data.message}`);
        }
    } catch (error) {
        console.error("Netzwerkfehler:", error);
        showError("Der Spieler wurde lokal gespeichert, konnte aber nicht mit Google Sheets synchronisiert werden.");
    } finally {
        toggleLoading(false);
        updatePlayerDropdowns();
        updatePlayerList();
        updateDoublesPlayerGrid();
        updateRankings();
    }
}

// ================= MATCH EINTRAGEN =================

async function recordMatch() {
    const winnerId = document.getElementById('winner').value;
    const loserId  = document.getElementById('loser').value;

    if (!winnerId || !loserId) {
        showError('Bitte wähle Gewinner und Verlierer aus!');
        return;
    }

    if (winnerId === loserId) {
        showError('Gewinner und Verlierer können nicht derselbe Spieler sein!');
        return;
    }

    const winner = players[winnerId];
    const loser  = players[loserId];

    const expectedScoreWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
    const expectedScoreLoser  = 1 / (1 + Math.pow(10, (winner.elo - loser.elo) / 400));

    const newEloWinner = Math.round(winner.elo + K_FACTOR * (1 - expectedScoreWinner));
    const newEloLoser  = Math.round(loser.elo  + K_FACTOR * (0 - expectedScoreLoser));
    const eloDiff = newEloWinner - winner.elo;

    winner.elo = newEloWinner;
    winner.matches++;
    winner.wins++;

    loser.elo = newEloLoser;
    loser.matches++;
    loser.losses++;

    const match = {
        date: new Date().toISOString(),
        type: 'singles',
        winnerId,
        loserId,
        winnerName: winner.name,
        loserName: loser.name,
        eloChange: eloDiff
    };

    await saveMatch(match, [winner, loser]);
}

async function recordDoublesMatch() {
    if (selectedPlayers.length !== 4) {
        showError('Bitte wähle genau 4 Spieler für das Doppel aus!');
        return;
    }

    const winningTeam = document.getElementById('winning-team').value;
    if (!winningTeam) {
        showError('Bitte wähle das gewinnende Team aus!');
        return;
    }

    const team1 = [selectedPlayers[0], selectedPlayers[1]];
    const team2 = [selectedPlayers[2], selectedPlayers[3]];

    const winners = winningTeam === 'team1' ? team1 : team2;
    const losers  = winningTeam === 'team1' ? team2 : team1;

    const teamWinnerElo = (players[winners[0]].doublesElo + players[winners[1]].doublesElo) / 2;
    const teamLoserElo  = (players[losers[0]].doublesElo  + players[losers[1]].doublesElo)  / 2;

    const expectedScoreWinner = 1 / (1 + Math.pow(10, (teamLoserElo - teamWinnerElo) / 400));
    const eloChange = Math.round(K_FACTOR * (1 - expectedScoreWinner));

    winners.forEach(playerId => {
        players[playerId].doublesElo += eloChange;
        players[playerId].doublesMatches++;
        players[playerId].doublesWins++;
    });

    losers.forEach(playerId => {
        players[playerId].doublesElo -= eloChange;
        players[playerId].doublesMatches++;
        players[playerId].doublesLosses++;
    });

    const match = {
        date: new Date().toISOString(),
        type: 'doubles',
        winnerId: winners.join(','),
        loserId: losers.join(','),
        winnerName: `${players[winners[0]].name} & ${players[winners[1]].name}`,
        loserName:  `${players[losers[0]].name} & ${players[losers[1]].name}`,
        eloChange
    };

    const updatedPlayers = [...winners, ...losers].map(id => players[id]);
    await saveMatch(match, updatedPlayers);
    clearTeams();
}

async function saveMatch(match, updatedPlayers) {
    matches.push(match);
    localStorage.setItem('eloPlayers', JSON.stringify(players));
    localStorage.setItem('eloMatches', JSON.stringify(matches));

    toggleLoading(true);

    try {
        for (const player of updatedPlayers) {
            const playerId = Object.keys(players).find(id => players[id] === player);
            await fetch(`${GOOGLE_SHEETS_API_URL}?action=updatePlayer&id=${playerId}&elo=${player.elo}&matches=${player.matches}&wins=${player.wins}&losses=${player.losses}&doublesElo=${player.doublesElo}&doublesMatches=${player.doublesMatches}&doublesWins=${player.doublesWins}&doublesLosses=${player.doublesLosses}`);
        }

        const matchResponse = await fetch(`${GOOGLE_SHEETS_API_URL}?action=addMatch&date=${match.date}&type=${match.type}&winnerId=${match.winnerId}&loserId=${match.loserId}&winnerName=${encodeURIComponent(match.winnerName)}&loserName=${encodeURIComponent(match.loserName)}&eloChange=${match.eloChange}`);
        const matchData = await matchResponse.json();

        if (matchData.success) {
            const gameType = match.type === 'singles' ? 'Einzel' : 'Doppel';
            showSuccess(`🎉 ${gameType}-Match gespeichert! ${match.winnerName} gewinnt gegen ${match.loserName} (+${match.eloChange} Elo)`);
            showConfetti();
        } else {
            showError(`Match lokal gespeichert, aber Fehler beim Speichern in Google Sheets: ${matchData.message}`);
        }
    } catch (error) {
        console.error("Netzwerkfehler:", error);
        showError("Das Match wurde lokal gespeichert, konnte aber nicht mit Google Sheets synchronisiert werden.");
    } finally {
        toggleLoading(false);
        updateRankings();
        updateHistory();
        clearSelections();
    }
}

// ================= UI-UPDATES =================

function updatePlayerDropdowns() {
    const winnerSelect = document.getElementById('winner');
    const loserSelect  = document.getElementById('loser');

    winnerSelect.innerHTML = '<option value="">-- Spieler auswählen --</option>';
    loserSelect.innerHTML  = '<option value="">-- Spieler auswählen --</option>';

    const sortedPlayers = Object.entries(players).sort((a, b) =>
        a[1].name.localeCompare(b[1].name)
    );

    for (const [id, player] of sortedPlayers) {
        const winnerOption = document.createElement('option');
        winnerOption.value = id;
        winnerOption.textContent = player.name;
        winnerSelect.appendChild(winnerOption);

        const loserOption = document.createElement('option');
        loserOption.value = id;
        loserOption.textContent = player.name;
        loserSelect.appendChild(loserOption);
    }
}

function updatePlayerList() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';

    const sortedPlayers = Object.entries(players).sort((a, b) =>
        a[1].name.localeCompare(b[1].name)
    );

    for (const [id, player] of sortedPlayers) {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.setAttribute('data-id', id);

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = getAvatarEmoji(id);

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = player.name;

        playerCard.appendChild(avatar);
        playerCard.appendChild(name);
        playerCard.addEventListener('click', () => selectPlayer(id));
        playerList.appendChild(playerCard);
    }
}

function updateDoublesPlayerGrid() {
    const playerGrid = document.getElementById('doublesPlayerGrid');
    playerGrid.innerHTML = '';

    const sortedPlayers = Object.entries(players).sort((a, b) =>
        a[1].name.localeCompare(b[1].name)
    );

    for (const [id, player] of sortedPlayers) {
        const playerCard = document.createElement('div');
        playerCard.className = 'doubles-player-card';
        playerCard.setAttribute('data-id', id);

        const avatar = document.createElement('div');
        avatar.style.fontSize = '20px';
        avatar.textContent = getAvatarEmoji(id);

        const name = document.createElement('div');
        name.style.marginTop = '5px';
        name.style.fontSize = '14px';
        name.textContent = player.name;

        const eloInfo = document.createElement('div');
        eloInfo.style.fontSize = '12px';
        eloInfo.style.color = '#666';
        eloInfo.textContent = `Doppel: ${player.doublesElo}`;

        playerCard.appendChild(avatar);
        playerCard.appendChild(name);
        playerCard.appendChild(eloInfo);
        playerCard.addEventListener('click', () => selectPlayerForDoubles(id));
        playerGrid.appendChild(playerCard);
    }
}

function filterPlayers() {
    const searchText = document.getElementById('player-search').value.toLowerCase();
    document.querySelectorAll('.player-card').forEach(card => {
        const playerName = card.querySelector('.name').textContent.toLowerCase();
        card.style.display = playerName.includes(searchText) ? 'block' : 'none';
    });
}

function selectPlayer(id) {
    const selectedCards = document.querySelectorAll('.player-card.selected');
    const card = document.querySelector(`.player-card[data-id="${id}"]`);

    if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        return;
    }

    if (selectedCards.length >= 2) {
        selectedCards[0].classList.remove('selected');
    }

    card.classList.add('selected');

    const selectedCards2 = document.querySelectorAll('.player-card.selected');
    if (selectedCards2.length === 1) {
        document.getElementById('winner').value = selectedCards2[0].getAttribute('data-id');
    } else if (selectedCards2.length === 2) {
        document.getElementById('winner').value = selectedCards2[0].getAttribute('data-id');
        document.getElementById('loser').value  = selectedCards2[1].getAttribute('data-id');
    }
}

function selectPlayerForDoubles(id) {
    const card = document.querySelector(`.doubles-player-card[data-id="${id}"]`);

    if (selectedPlayers.includes(id)) {
        selectedPlayers = selectedPlayers.filter(playerId => playerId !== id);
        card.classList.remove('selected-team1', 'selected-team2');
    } else {
        if (selectedPlayers.length >= 4) {
            showError('Es können maximal 4 Spieler ausgewählt werden!');
            return;
        }

        selectedPlayers.push(id);
        card.classList.add(selectedPlayers.length <= 2 ? 'selected-team1' : 'selected-team2');
    }

    updateTeamDisplay();
}

function updateTeamDisplay() {
    document.getElementById('team1-player1').textContent = '-';
    document.getElementById('team1-player2').textContent = '-';
    document.getElementById('team2-player1').textContent = '-';
    document.getElementById('team2-player2').textContent = '-';

    if (selectedPlayers.length >= 1) document.getElementById('team1-player1').textContent = players[selectedPlayers[0]].name;
    if (selectedPlayers.length >= 2) document.getElementById('team1-player2').textContent = players[selectedPlayers[1]].name;
    if (selectedPlayers.length >= 3) document.getElementById('team2-player1').textContent = players[selectedPlayers[2]].name;
    if (selectedPlayers.length >= 4) document.getElementById('team2-player2').textContent = players[selectedPlayers[3]].name;

    const winningTeam = document.getElementById('winning-team').value;
    const team1El = document.getElementById('team1');
    const team2El = document.getElementById('team2');

    team1El.classList.remove('team-winner', 'team-loser');
    team2El.classList.remove('team-winner', 'team-loser');

    if (winningTeam === 'team1') {
        team1El.classList.add('team-winner');
        team2El.classList.add('team-loser');
    } else if (winningTeam === 'team2') {
        team2El.classList.add('team-winner');
        team1El.classList.add('team-loser');
    }
}

document.getElementById('winning-team').addEventListener('change', updateTeamDisplay);

function showRanking(type) {
    document.querySelectorAll('.ranking-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    if (type === 'singles') {
        document.getElementById('singles-ranking').style.display = 'block';
        document.getElementById('doubles-ranking').style.display = 'none';
    } else {
        document.getElementById('singles-ranking').style.display = 'none';
        document.getElementById('doubles-ranking').style.display = 'block';
    }

    updateRankings();
}

function updateRankings() {
    updateSinglesRanking();
    updateDoublesRanking();
}

function buildRankingRow(index, id, player, eloKey, matchesKey, winsKey, lossesKey) {
    const row = document.createElement('tr');

    const rankCell = document.createElement('td');
    const rankSpan = document.createElement('span');
    rankSpan.className = 'rank-badge';

    if (index === 0)      rankSpan.classList.add('rank-1');
    else if (index === 1) rankSpan.classList.add('rank-2');
    else if (index === 2) rankSpan.classList.add('rank-3');
    else                  rankSpan.style.backgroundColor = '#c51216';

    rankSpan.textContent = index + 1;
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

    return row;
}

function updateSinglesRanking() {
    const body = document.getElementById('singlesRankingsBody');
    body.innerHTML = '';

    Object.entries(players)
        .sort((a, b) => b[1].elo - a[1].elo)
        .forEach(([id, player], index) => {
            body.appendChild(buildRankingRow(index, id, player, 'elo', 'matches', 'wins', 'losses'));
        });
}

function updateDoublesRanking() {
    const body = document.getElementById('doublesRankingsBody');
    body.innerHTML = '';

    Object.entries(players)
        .sort((a, b) => b[1].doublesElo - a[1].doublesElo)
        .forEach(([id, player], index) => {
            body.appendChild(buildRankingRow(index, id, player, 'doublesElo', 'doublesMatches', 'doublesWins', 'doublesLosses'));
        });
}

function updateHistory() {
    const historyBody = document.getElementById('historyBody');
    historyBody.innerHTML = '';

    const sortedMatches = [...matches].sort((a, b) =>
        new Date(b.date || 0) - new Date(a.date || 0)
    );

    const getPlayerDisplay = (idString) => {
        const ids = String(idString || "").split(',').map(s => s.trim());
        const parts = ids.map(id => {
            const player = players[id];
            return `${getAvatarEmoji(id)} ${player ? player.name : 'Unbekannt'}`;
        });
        return parts.length > 1
            ? `<div class="team-display">${parts.join(' & ')}</div>`
            : parts[0];
    };

    sortedMatches.forEach(match => {
        const row = document.createElement('tr');

        let displayDate     = match.date;
        let displayType     = match.type;
        let displayWinnerId = match.winnerId;
        let displayLoserId  = match.loserId;
        let displayElo      = match.eloChange;

        const winnerIsType = String(match.winnerId).toLowerCase().includes('singles') ||
                             String(match.winnerId).toLowerCase().includes('doubles');

        if (winnerIsType) {
            displayType     = match.winnerId;
            displayWinnerId = match.loserId;
            displayLoserId  = match.winnerName;
            if (!displayElo) displayElo = 0;
        }

        const dateCell = document.createElement('td');
        const matchDate = new Date(displayDate);
        dateCell.textContent = isNaN(matchDate.getTime())
            ? '-'
            : matchDate.toLocaleDateString() + ' ' + matchDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        row.appendChild(dateCell);

        const typeCell = document.createElement('td');
        const isSingles = String(displayType).toLowerCase().includes('singles');
        const typeSpan = document.createElement('span');
        typeSpan.className = `match-type-indicator match-${isSingles ? 'singles' : 'doubles'}`;
        typeSpan.textContent = isSingles ? 'Einzel' : 'Doppel';
        typeCell.appendChild(typeSpan);
        row.appendChild(typeCell);

        const winnerCell = document.createElement('td');
        winnerCell.innerHTML = getPlayerDisplay(displayWinnerId);
        row.appendChild(winnerCell);

        const loserCell = document.createElement('td');
        loserCell.innerHTML = getPlayerDisplay(displayLoserId);
        row.appendChild(loserCell);

        const eloChangeCell = document.createElement('td');
        eloChangeCell.className = 'elo-positive';
        eloChangeCell.textContent = '+' + (displayElo ?? 0);
        row.appendChild(eloChangeCell);

        historyBody.appendChild(row);
    });
}

// ================= KONFETTI =================

function showConfetti() {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#c51216'];

    document.querySelectorAll('.confetti').forEach(c => c.remove());

    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 5000);
    }
}
