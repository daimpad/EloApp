import { STARTING_ELO, calculateSinglesMatch, calculateDoublesMatch } from './src/elo.js';
import { initApi, fetchPlayers, fetchMatches, createPlayer, updatePlayer, createMatch } from './src/api.js';
import { state, persistPlayers, persistMatches, loadLocalPlayers, loadLocalMatches, recalculateStatsFromHistory } from './src/state.js';
import {
    showError, showSuccess, toggleLoading,
    openTab, renderGameModeSwitch,
    clearTeamDisplay, clearPlayerCardSelection,
    renderPlayerDropdowns, renderPlayerList, filterPlayerList, highlightSinglesSelection,
    renderDoublesGrid, updateTeamDisplay,
    showRankingTab, renderRankings,
    renderHistory,
    showConfetti,
} from './src/ui.js';

// ================= KONFIGURATION =================

// Werte kommen aus config.js (nicht im Repository).
// Kopiere config.example.js → config.js und trage deine Supabase-Daten ein.
const _cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
initApi(_cfg.SUPABASE_URL || '', _cfg.SUPABASE_ANON_KEY || '');

// ================= GLOBAL (HTML onclick-Attribute) =================

// Tab-Navigation und Spielmodus werden direkt aus dem HTML aufgerufen.
window.openTab      = openTab;
window.showRanking  = showRankingTab;

window.selectGameMode = (mode) => {
    state.currentGameMode = mode;
    renderGameModeSwitch(mode);
    clearSelections();
    if (mode === 'doubles') renderDoublesGrid(selectPlayerForDoubles);
};

window.clearTeams = clearSelections;

window.filterPlayers = filterPlayerList;

window.recordMatch        = recordMatch;
window.recordDoublesMatch = recordDoublesMatch;
window.addPlayer          = addPlayer;

// ================= INITIALISIERUNG =================

window.onload = async function() {
    if (!_cfg.SUPABASE_URL || !_cfg.SUPABASE_ANON_KEY) {
        showError('Supabase nicht konfiguriert. Bitte config.js anlegen (siehe config.example.js).');
    }

    document.getElementById('winning-team').addEventListener('change', updateTeamDisplay);

    await loadPlayers();
    await loadMatches();
};

// ================= DATEN LADEN =================

async function loadPlayers() {
    toggleLoading(true);
    state.isDataLoading = true;

    try {
        if (loadLocalPlayers()) renderAll();

        state.players = await fetchPlayers();

        Object.keys(state.players).forEach(id => {
            if (!state.players[id].doublesElo) {
                state.players[id].doublesElo     = STARTING_ELO;
                state.players[id].doublesMatches = 0;
                state.players[id].doublesWins    = 0;
                state.players[id].doublesLosses  = 0;
            }
        });

        persistPlayers();
        renderAll();
        showSuccess('Spieler erfolgreich geladen!');
    } catch (err) {
        console.error(err);
        showError('Netzwerkfehler beim Laden der Spieler. Lokale Daten werden verwendet.');
    } finally {
        state.isDataLoading = false;
        toggleLoading(false);
    }
}

async function loadMatches() {
    toggleLoading(true);
    state.isDataLoading = true;

    try {
        if (loadLocalMatches()) {
            recalculateStatsFromHistory();
            renderHistory();
        }

        state.matches = await fetchMatches();
        persistMatches();
        recalculateStatsFromHistory();
        renderHistory();
        renderRankings();
        showSuccess('Spielverlauf erfolgreich geladen!');
    } catch (err) {
        console.error(err);
        showError('Netzwerkfehler beim Laden des Spielverlaufs. Lokale Daten werden verwendet.');
    } finally {
        state.isDataLoading = false;
        toggleLoading(false);
    }
}

// ================= SPIELER HINZUFÜGEN =================

async function addPlayer() {
    const playerName = document.getElementById('playerName').value.trim();

    if (!playerName) {
        showError('Bitte gib einen Namen ein!');
        return;
    }

    if (Object.values(state.players).some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
        showError('Ein Spieler mit diesem Namen existiert bereits!');
        return;
    }

    const playerId = Date.now().toString();
    state.players[playerId] = {
        name:          playerName,
        elo:           STARTING_ELO,
        matches:       0, wins: 0, losses: 0,
        doublesElo:    STARTING_ELO,
        doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
    };
    persistPlayers();
    toggleLoading(true);

    try {
        await createPlayer(playerId, state.players[playerId]);
        showSuccess(`Spieler "${playerName}" wurde hinzugefügt!`);
        document.getElementById('playerName').value = '';
        showConfetti();
    } catch (err) {
        console.error(err);
        showError('Spieler lokal gespeichert, aber nicht mit Google Sheets synchronisiert.');
    } finally {
        toggleLoading(false);
        renderAll();
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

    const winner = state.players[winnerId];
    const loser  = state.players[loserId];
    const result = calculateSinglesMatch(winner.elo, loser.elo);

    winner.elo = result.winnerElo; winner.matches++; winner.wins++;
    loser.elo  = result.loserElo;  loser.matches++;  loser.losses++;

    const match = {
        date: new Date().toISOString(), type: 'singles',
        winnerId, loserId,
        winnerName: winner.name, loserName: loser.name,
        eloChange: result.eloChange,
    };

    await saveMatch(match, [
        { id: winnerId, player: winner },
        { id: loserId,  player: loser  },
    ]);
}

async function recordDoublesMatch() {
    if (state.selectedPlayers.length !== 4) {
        showError('Bitte wähle genau 4 Spieler für das Doppel aus!');
        return;
    }

    const winningTeam = document.getElementById('winning-team').value;
    if (!winningTeam) {
        showError('Bitte wähle das gewinnende Team aus!');
        return;
    }

    const [a, b, c, d] = state.selectedPlayers;
    const team1 = [a, b];
    const team2 = [c, d];
    const winners = winningTeam === 'team1' ? team1 : team2;
    const losers  = winningTeam === 'team1' ? team2 : team1;

    const { eloChange } = calculateDoublesMatch(
        winners.map(id => state.players[id].doublesElo),
        losers.map(id  => state.players[id].doublesElo),
    );

    winners.forEach(id => {
        state.players[id].doublesElo += eloChange;
        state.players[id].doublesMatches++;
        state.players[id].doublesWins++;
    });
    losers.forEach(id => {
        state.players[id].doublesElo -= eloChange;
        state.players[id].doublesMatches++;
        state.players[id].doublesLosses++;
    });

    const match = {
        date: new Date().toISOString(), type: 'doubles',
        winnerId:   winners.join(','),
        loserId:    losers.join(','),
        winnerName: `${state.players[winners[0]].name} & ${state.players[winners[1]].name}`,
        loserName:  `${state.players[losers[0]].name} & ${state.players[losers[1]].name}`,
        eloChange,
    };

    await saveMatch(match, [...winners, ...losers].map(id => ({ id, player: state.players[id] })));
    clearSelections();
}

async function saveMatch(match, playerEntries) {
    state.matches.push(match);
    persistPlayers();
    persistMatches();
    toggleLoading(true);

    try {
        for (const { id, player } of playerEntries) {
            await updatePlayer(id, player);
        }
        await createMatch(match);

        const gameType = match.type === 'singles' ? 'Einzel' : 'Doppel';
        showSuccess(`🎉 ${gameType}-Match gespeichert! ${match.winnerName} gewinnt gegen ${match.loserName} (+${match.eloChange} Elo)`);
        showConfetti();
    } catch (err) {
        console.error(err);
        showError('Match lokal gespeichert, aber nicht mit Google Sheets synchronisiert.');
    } finally {
        toggleLoading(false);
        renderRankings();
        renderHistory();
        clearSelections();
    }
}

// ================= HILFSFUNKTIONEN =================

function clearSelections() {
    state.selectedPlayers = [];
    clearPlayerCardSelection();
    clearTeamDisplay();
}

function selectPlayerForDoubles(id) {
    const card = document.querySelector(`.doubles-player-card[data-id="${id}"]`);

    if (state.selectedPlayers.includes(id)) {
        state.selectedPlayers = state.selectedPlayers.filter(p => p !== id);
        card.classList.remove('selected-team1', 'selected-team2');
    } else {
        if (state.selectedPlayers.length >= 4) {
            showError('Es können maximal 4 Spieler ausgewählt werden!');
            return;
        }
        state.selectedPlayers.push(id);
        card.classList.add(state.selectedPlayers.length <= 2 ? 'selected-team1' : 'selected-team2');
    }

    updateTeamDisplay();
}

function selectPlayer(id) {
    const card     = document.querySelector(`.player-card[data-id="${id}"]`);
    const selected = [...document.querySelectorAll('.player-card.selected')];

    if (card.classList.contains('selected')) {
        card.classList.remove('selected');
    } else {
        if (selected.length >= 2) selected[0].classList.remove('selected');
        card.classList.add('selected');
    }

    highlightSinglesSelection();
}

function renderAll() {
    renderPlayerDropdowns();
    renderPlayerList(selectPlayer);
    renderDoublesGrid(selectPlayerForDoubles);
    renderRankings();
}
