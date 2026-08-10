import { STARTING_ELO } from './src/elo.js';
import {
    initApi, fetchPlayers, fetchMatches,
    createPlayer, updatePlayer, renamePlayer, createMatch, deleteMatch,
} from './src/api.js';
import {
    state, initStorage, persistPlayers, persistMatches,
    loadLocalPlayers, loadLocalMatches,
    recalculateStatsFromHistory, applyMatch, revertMatch, removeMatchById,
} from './src/state.js';
import { normaliseMatch } from './src/match.js';
import { DEMO_PLAYERS, DEMO_MATCHES } from './src/demo.js';
import {
    initUi,
    showError, showSuccess, toggleLoading, showConfigPanel, setSyncStatus, setControlsEnabled,
    showTab, currentTab, renderGameModeSwitch,
    clearTeamDisplay, clearPlayerCardSelection,
    renderPlayerDropdowns, renderPlayerList, filterPlayerList, renderSinglesSelection,
    renderDoublesGrid, updateTeamDisplay,
    showRankingTab, renderRankings, setRankingSort, setRankingSearch, setHideInactive,
    renderHistory,
    openPlayerProfile, closePlayerProfile, currentProfileId, startRename, cancelRename,
    showImportPreview, hideImportPreview,
    showConfetti,
} from './src/ui.js';
import { renderEloChart, renderPlayerChart } from './src/chart.js';
import { applyBranding } from './src/branding.js';
import { toDateTimeLocal, formatDate, pluralise } from './src/format.js';

// ================= KONFIGURATION =================

// Werte kommen aus config.js (nicht im Repository).
// Kopiere config.example.js → config.js und trage deine Supabase-Daten ein.
const _cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};

// Strikte Prüfung: `has('demo')` hielt auch ?demo=false für den Demo-Modus.
const IS_DEMO = new URLSearchParams(location.search).get('demo') === 'true';

const IS_CONFIGURED = Boolean(_cfg.SUPABASE_URL && _cfg.SUPABASE_ANON_KEY);

initApi(_cfg.SUPABASE_URL || '', _cfg.SUPABASE_ANON_KEY || '', _cfg.APP_SECRET || '');
applyBranding(_cfg.BRANDING || {});

// Der Zwischenspeicher wird pro Instanz benannt und im Demo-Modus komplett
// abgeschaltet — sonst ersetzt ein einziger Aufruf von ?demo=true die
// gecachten Vereinsspieler durch Beispieldaten.
initStorage({
    namespace: _cfg.SUPABASE_URL || '',
    enabled:   !IS_DEMO,
});

// ================= SERVICE WORKER =================

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(err =>
        console.warn('Service Worker Registrierung fehlgeschlagen:', err)
    );
}

// ================= FEHLERBEHANDLUNG =================

/**
 * Gibt die konkrete Meldung der API weiter, statt sie durch ein pauschales
 * "Netzwerkfehler" zu ersetzen — sonst sucht man einen Konfigurationsfehler
 * im Netz.
 */
function reportError(err, context) {
    console.error(context, err);
    const detail = err?.message ? ` ${err.message}` : '';
    showError(`${context}.${detail}`);
}

// ================= START =================

function boot() {
    wireEvents();
    initUi({
        onOpenProfile:   openProfileModal,
        onDeleteMatch:   removeMatch,
        onToggleSingles: toggleSinglesSelection,
        onToggleDoubles: toggleDoublesSelection,
    });

    document.getElementById('match-date').value = toDateTimeLocal();
    restoreTabFromHash();

    if (IS_DEMO) {
        loadDemoData();
        return;
    }

    if (!IS_CONFIGURED) {
        // Dauerhaftes Panel statt eines Toasts, der nach Sekunden verschwindet.
        showConfigPanel(true);
        setControlsEnabled(false);
        renderAll();
        return;
    }

    // Zwei Render-Phasen: erst der Zwischenspeicher, dann die Serverdaten.
    if (loadLocalPlayers() | loadLocalMatches()) {
        recalculateStatsFromHistory();
        renderAll();
        setSyncStatus(state.lastSyncedAt, { offline: true });
    }

    loadAll({ silent: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}

function loadDemoData() {
    document.getElementById('demo-banner').hidden = false;

    state.players = structuredClone(DEMO_PLAYERS);
    state.matches = structuredClone(DEMO_MATCHES);
    recalculateStatsFromHistory();
    state.lastSyncedAt = new Date().toISOString();

    renderAll();
}

// ================= DATEN LADEN =================

/**
 * Holt Spieler und Matches gemeinsam und rendert genau einmal.
 *
 * Vorher liefen zwei getrennte Ladepfade mit je einer Cache- und einer
 * Server-Phase: pro Kaltstart zwei komplette Replays, drei Ranglisten-Renders
 * und zwei History-Renders.
 */
async function loadAll({ silent = false } = {}) {
    if (state.isDataLoading) return;

    state.isDataLoading = true;
    toggleLoading(true);

    try {
        const [players, matches] = await Promise.all([fetchPlayers(), fetchMatches()]);

        state.players = players;
        state.matches = matches;
        fillMissingDoublesFields();

        const skipped = recalculateStatsFromHistory();
        state.lastSyncedAt = new Date().toISOString();

        const stored = persistPlayers() && persistMatches();
        renderAll();

        if (skipped > 0) {
            showError(
                `${skipped} ${pluralise(skipped, 'Spiel konnte', 'Spiele konnten')} nicht berechnet werden `
                + '(unbekannte Spieler-IDs).'
            );
        }
        if (!stored) {
            showError('Offline-Zwischenspeicher nicht verfügbar — die Daten stehen nur in dieser Sitzung zur Verfügung.');
        }
        if (!silent) showSuccess('Daten aktualisiert.');
    } catch (err) {
        reportError(err, 'Daten konnten nicht geladen werden');
        setSyncStatus(state.lastSyncedAt, { offline: true });
    } finally {
        state.isDataLoading = false;
        toggleLoading(false);
    }
}

/** Ältere Datenbestände kennen die Doppel-Spalten noch nicht. */
function fillMissingDoublesFields() {
    for (const player of Object.values(state.players)) {
        if (typeof player.doublesElo !== 'number') {
            player.doublesElo     = STARTING_ELO;
            player.doublesMatches = 0;
            player.doublesWins    = 0;
            player.doublesLosses  = 0;
        }
    }
}

// ================= SYNCHRONISIERUNG =================

function statsKey(player) {
    return [
        player.elo, player.matches, player.wins, player.losses,
        player.doublesElo, player.doublesMatches, player.doublesWins, player.doublesLosses,
    ].join('|');
}

function statsSnapshot() {
    const snapshot = {};
    for (const [id, player] of Object.entries(state.players)) {
        snapshot[id] = statsKey(player);
    }
    return snapshot;
}

/**
 * Überträgt genau die Spieler, deren Werte sich durch den Replay geändert
 * haben. Beim Löschen oder beim Nachtragen eines alten Spiels sind das
 * potenziell alle, beim normalen Eintragen nur die Beteiligten.
 */
async function pushChangedPlayers(before) {
    const changed = Object.entries(state.players)
        .filter(([id, player]) => before[id] !== statsKey(player));

    await Promise.all(changed.map(([id, player]) => updatePlayer(id, player)));
    return changed.length;
}

// ================= SPIELER HINZUFÜGEN =================

async function addPlayer() {
    const input = document.getElementById('playerName');
    const name  = input.value.trim();

    if (!name) {
        showError('Bitte gib einen Namen ein.');
        input.focus();
        return;
    }
    if (nameExists(name)) {
        showError(`„${name}“ gibt es bereits. Bitte einen eindeutigen Namen wählen.`);
        input.focus();
        return;
    }

    const id = newPlayerId();
    state.players[id] = {
        name,
        elo:            STARTING_ELO,
        matches:        0, wins: 0, losses: 0,
        doublesElo:     STARTING_ELO,
        doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
    };

    if (IS_DEMO) {
        input.value = '';
        showSuccess(`Demo: „${name}“ hinzugefügt (nur lokal).`);
        showConfetti();
        renderAll();
        return;
    }

    toggleLoading(true);
    try {
        await createPlayer(id, state.players[id]);
        persistPlayers();
        input.value = '';
        showSuccess(`Spieler „${name}“ wurde hinzugefügt.`);
        showConfetti();
    } catch (err) {
        // Ohne Rücknahme bliebe ein Spieler zurück, den es serverseitig nicht
        // gibt — Spiele mit ihm werden beim nächsten Replay stumm übersprungen.
        delete state.players[id];
        reportError(err, 'Spieler konnte nicht angelegt werden');
    } finally {
        toggleLoading(false);
        renderAll();
    }
}

function nameExists(name) {
    return Object.values(state.players)
        .some(player => player.name.toLowerCase() === name.toLowerCase());
}

let idCounter = 0;
function newPlayerId() {
    // Date.now() allein kollidiert beim Massenanlegen innerhalb einer Millisekunde.
    idCounter += 1;
    return `${Date.now()}-${idCounter}`;
}

// ================= AUSWAHL =================

function toggleSinglesSelection(id) {
    const selected = state.selectedSingles;
    const index = selected.indexOf(id);

    if (index !== -1) {
        selected.splice(index, 1);
    } else {
        // Klickreihenfolge ist die Bedeutung: erster Klick Gewinner, zweiter
        // Verlierer. Ein dritter Klick ersetzt den ältesten Eintrag.
        if (selected.length >= 2) selected.shift();
        selected.push(id);
    }

    renderSinglesSelection();
}

function toggleDoublesSelection(id) {
    const selected = state.selectedPlayers;
    const index = selected.indexOf(id);

    if (index !== -1) {
        selected.splice(index, 1);
    } else {
        if (selected.length >= 4) {
            showError('Es können maximal 4 Spieler ausgewählt werden.');
            return;
        }
        selected.push(id);
    }

    updateTeamDisplay();
}

function clearSelections() {
    state.selectedPlayers = [];
    state.selectedSingles = [];
    clearPlayerCardSelection();
    clearTeamDisplay();
    clearScoreInputs();
}

// ================= MATCH EINTRAGEN =================

/**
 * Optionales Satzergebnis. Nur wenn beide Felder gefüllt sind, wird es
 * mitgeschickt — Datenbanken ohne die Spalten bleiben so nutzbar.
 */
function selectedScores() {
    const winner = document.getElementById('winner-score').value.trim();
    const loser  = document.getElementById('loser-score').value.trim();
    if (winner === '' || loser === '') return {};

    const winnerScore = Number(winner);
    const loserScore  = Number(loser);
    if (!Number.isFinite(winnerScore) || !Number.isFinite(loserScore)) return {};

    return { winnerScore, loserScore };
}

function clearScoreInputs() {
    document.getElementById('winner-score').value = '';
    document.getElementById('loser-score').value  = '';
}

function selectedMatchDate() {
    const value = document.getElementById('match-date').value;
    if (!value) return new Date().toISOString();

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function recordSinglesMatch() {
    const winnerId = document.getElementById('winner').value;
    const loserId  = document.getElementById('loser').value;

    if (!winnerId || !loserId) return showError('Bitte wähle Gewinner und Verlierer aus.');
    if (winnerId === loserId)  return showError('Gewinner und Verlierer können nicht derselbe Spieler sein.');

    const winner = state.players[winnerId];
    const loser  = state.players[loserId];
    if (!winner || !loser) return showError('Ein ausgewählter Spieler existiert nicht mehr. Bitte Seite aktualisieren.');

    await saveMatch({
        date: selectedMatchDate(),
        type: 'singles',
        winnerId, loserId,
        winnerName: winner.name,
        loserName:  loser.name,
        ...selectedScores(),
    });
}

async function recordDoublesMatch() {
    if (state.selectedPlayers.length !== 4) return showError('Bitte wähle genau 4 Spieler für das Doppel aus.');

    const winningTeam = document.getElementById('winning-team').value;
    if (!winningTeam) return showError('Bitte wähle das gewinnende Team aus.');

    const [a, b, c, d] = state.selectedPlayers;
    const winners = winningTeam === 'team1' ? [a, b] : [c, d];
    const losers  = winningTeam === 'team1' ? [c, d] : [a, b];

    if ([...winners, ...losers].some(id => !state.players[id])) {
        return showError('Ein ausgewählter Spieler existiert nicht mehr. Bitte Seite aktualisieren.');
    }

    const nameOf = (ids) => ids.map(id => state.players[id].name).join(' & ');

    await saveMatch({
        date: selectedMatchDate(),
        type: 'doubles',
        winnerId:   winners.join(','),
        loserId:    losers.join(','),
        winnerName: nameOf(winners),
        loserName:  nameOf(losers),
        ...selectedScores(),
    });
}

/**
 * Speichert ein Spiel.
 *
 * Die ELO-Werte kommen aus dem Replay über die gesamte Historie, nicht aus
 * einer optimistischen Einzelrechnung — nur so bleibt die players-Tabelle
 * deckungsgleich mit der Historie, auch wenn ein Spiel nachgetragen wird.
 */
async function saveMatch(match) {
    const before = statsSnapshot();
    applyMatch(match);

    if (IS_DEMO) {
        announceMatch(match, 'Demo: ');
        renderAll();
        clearSelections();
        return;
    }

    toggleLoading(true);
    try {
        const saved = await createMatch(match);
        // Die echte BIGSERIAL-ID übernehmen, sonst trifft ein späteres Löschen
        // null Zeilen — und PostgREST meldet das als Erfolg.
        match.id = saved.id;

        await pushChangedPlayers(before);

        persistPlayers();
        persistMatches();
        announceMatch(match);
    } catch (err) {
        revertMatch(match);
        try {
            await pushChangedPlayers(statsSnapshot());
        } catch (revertErr) {
            console.error('ELO-Rücknahme fehlgeschlagen:', revertErr);
            showError('Die ELO-Werte konnten nicht zurückgesetzt werden. Bitte Seite neu laden.');
        }
        reportError(err, 'Spiel konnte nicht gespeichert werden');
    } finally {
        toggleLoading(false);
        renderAll();
        clearSelections();
    }
}

function announceMatch(match, prefix = '') {
    const { isDoubles } = normaliseMatch(match);
    const kind = isDoubles ? 'Doppel' : 'Einzel';
    showSuccess(
        `${prefix}${kind}-Spiel gespeichert: ${match.winnerName} gewinnt gegen ${match.loserName} `
        + `(+${match.eloChange} ELO)`
    );
    showConfetti();
}

// ================= MATCH LÖSCHEN =================

async function removeMatch(id) {
    if (IS_DEMO) {
        removeMatchById(id);
        renderAll();
        showSuccess('Demo: Spiel gelöscht, ELO-Werte neu berechnet.');
        return;
    }

    toggleLoading(true);

    // Zwei Phasen mit getrennten Fehlerwegen: ist das Spiel gelöscht, aber die
    // Synchronisierung schlägt fehl, ist das eine andere Lage als ein
    // fehlgeschlagenes Löschen.
    try {
        await deleteMatch(id);
    } catch (err) {
        toggleLoading(false);
        reportError(err, 'Spiel konnte nicht gelöscht werden');
        return;
    }

    const before = statsSnapshot();
    removeMatchById(id);
    persistMatches();

    try {
        await pushChangedPlayers(before);
        persistPlayers();
        showSuccess('Spiel gelöscht, ELO-Werte neu berechnet.');
    } catch (err) {
        reportError(err, 'Spiel gelöscht, aber die ELO-Werte konnten nicht übertragen werden');
    } finally {
        toggleLoading(false);
        renderAll();
    }
}

// ================= SPIELER-PROFIL =================

function openProfileModal(playerId) {
    openPlayerProfile(playerId, (id, type) => {
        renderPlayerChart(id, type).catch(err => reportError(err, 'Diagramm konnte nicht geladen werden'));
    });
    renderPlayerChart(playerId, 'singles')
        .catch(err => reportError(err, 'Diagramm konnte nicht geladen werden'));
}

async function submitRename(event) {
    event.preventDefault();

    const playerId = currentProfileId();
    const name     = document.getElementById('profile-rename-input').value.trim();
    if (!playerId) return;

    const player = state.players[playerId];
    if (!name || name === player.name) return cancelRename();

    if (nameExists(name)) {
        showError(`„${name}“ gibt es bereits.`);
        return;
    }

    const previous = player.name;
    player.name = name;

    if (IS_DEMO) {
        cancelRename();
        renderAll();
        document.getElementById('profile-name').textContent = name;
        showSuccess('Demo: Spieler umbenannt (nur lokal).');
        return;
    }

    toggleLoading(true);
    try {
        await renamePlayer(playerId, name);
        persistPlayers();
        cancelRename();
        document.getElementById('profile-name').textContent = name;
        showSuccess(`Spieler heißt jetzt „${name}“.`);
    } catch (err) {
        player.name = previous;
        reportError(err, 'Spieler konnte nicht umbenannt werden');
    } finally {
        toggleLoading(false);
        renderAll();
    }
}

// ================= DATEN-EXPORT / -IMPORT =================

function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Erst freigeben, wenn der Download angestoßen wurde.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson() {
    const backup = {
        format:   'eloapp-backup',
        version:  1,
        exportedAt: new Date().toISOString(),
        players:  state.players,
        matches:  state.matches,
    };

    download(
        `eloapp-backup-${formatDate(Date.now()).replaceAll('.', '-')}.json`,
        JSON.stringify(backup, null, 2),
        'application/json',
    );
    showSuccess('Backup heruntergeladen.');
}

function exportCsv() {
    const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [
        ['Name', 'Einzel-ELO', 'Einzel-Spiele', 'Einzel-Siege', 'Einzel-Niederlagen',
         'Doppel-ELO', 'Doppel-Spiele', 'Doppel-Siege', 'Doppel-Niederlagen'].join(';'),
    ];

    Object.values(state.players)
        .sort((a, b) => b.elo - a.elo)
        .forEach(player => lines.push([
            escape(player.name),
            player.elo, player.matches, player.wins, player.losses,
            player.doublesElo, player.doublesMatches, player.doublesWins, player.doublesLosses,
        ].join(';')));

    // BOM, damit Excel die Umlaute richtig liest.
    download('eloapp-rangliste.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
    showSuccess('Rangliste als CSV heruntergeladen.');
}

function onImportFileChosen(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => showError('Datei konnte nicht gelesen werden.');
    reader.onload = () => {
        let backup;
        try {
            backup = JSON.parse(String(reader.result));
        } catch {
            showError('Die Datei ist kein gültiges JSON.');
            return;
        }

        const players = backup?.players && typeof backup.players === 'object' ? backup.players : null;
        const matches = Array.isArray(backup?.matches) ? backup.matches : null;

        if (!players || !matches) {
            showError('Die Datei enthält kein EloApp-Backup.');
            return;
        }

        const newPlayers = Object.entries(players).filter(([id]) => !state.players[id]);
        const newMatches = matches.filter(match => !state.matches.some(m => m.id === match.id));

        showImportPreview(
            `${newPlayers.length} neue ${pluralise(newPlayers.length, 'Spieler', 'Spieler')} und `
            + `${newMatches.length} neue ${pluralise(newMatches.length, 'Spiel', 'Spiele')} importieren?`,
            () => runImport(newPlayers, newMatches),
            () => { event.target.value = ''; },
        );
    };
    reader.readAsText(file);
}

async function runImport(newPlayers, newMatches) {
    hideImportPreview();
    document.getElementById('import-file').value = '';

    if (IS_DEMO) return showError('Im Demo-Modus ist kein Import möglich.');

    toggleLoading(true);
    try {
        for (const [id, player] of newPlayers) {
            await createPlayer(id, player);
            state.players[id] = { ...player };
        }

        for (const match of newMatches) {
            const saved = await createMatch(match);
            state.matches.push({ ...match, id: saved.id });
        }

        const before = statsSnapshot();
        recalculateStatsFromHistory();
        await pushChangedPlayers(before);

        persistPlayers();
        persistMatches();
        renderAll();
        showSuccess(`Import abgeschlossen: ${newPlayers.length} Spieler, ${newMatches.length} Spiele.`);
    } catch (err) {
        reportError(err, 'Import abgebrochen');
        await loadAll({ silent: true });
    } finally {
        toggleLoading(false);
    }
}

async function bulkAddPlayers() {
    const field = document.getElementById('bulk-players');
    const names = field.value
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    if (names.length === 0) return showError('Bitte mindestens einen Namen eingeben.');

    const accepted = [];
    const rejected = [];

    for (const name of names) {
        if (nameExists(name) || accepted.includes(name)) rejected.push(name);
        else accepted.push(name);
    }

    if (accepted.length === 0) {
        showError('Alle Namen existieren bereits.');
        return;
    }

    toggleLoading(true);
    let created = 0;
    try {
        for (const name of accepted) {
            const id = newPlayerId();
            const player = {
                name,
                elo:            STARTING_ELO,
                matches:        0, wins: 0, losses: 0,
                doublesElo:     STARTING_ELO,
                doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
            };

            if (!IS_DEMO) await createPlayer(id, player);
            state.players[id] = player;
            created++;
        }

        persistPlayers();
        field.value = '';
        showSuccess(
            `${created} ${pluralise(created, 'Spieler', 'Spieler')} angelegt.`
            + (rejected.length ? ` ${rejected.length} übersprungen (Name bereits vergeben).` : '')
        );
    } catch (err) {
        reportError(err, `Abgebrochen nach ${created} angelegten Spielern`);
    } finally {
        toggleLoading(false);
        renderAll();
    }
}

// ================= EVENTS =================

function wireEvents() {
    // ── Tabs ──
    document.querySelector('.tab-container').addEventListener('click', (event) => {
        const tab = event.target.closest('.tab');
        if (tab) selectTab(tab.dataset.tab);
    });

    // Pfeiltasten innerhalb der Tableiste, wie für role="tablist" erwartet.
    document.querySelector('.tab-container').addEventListener('keydown', (event) => {
        const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
        if (!(event.key in keys)) return;

        const tabs = [...document.querySelectorAll('.tab')];
        const index = tabs.indexOf(document.activeElement);
        if (index === -1) return;

        event.preventDefault();
        const step = keys[event.key];
        const next = step === 'first' ? 0
                   : step === 'last'  ? tabs.length - 1
                   : (index + step + tabs.length) % tabs.length;

        tabs[next].focus();
        selectTab(tabs[next].dataset.tab);
    });

    window.addEventListener('hashchange', restoreTabFromHash);

    // ── Spielmodus ──
    document.querySelector('.game-mode-selector').addEventListener('click', (event) => {
        const button = event.target.closest('.mode-button');
        if (!button) return;

        state.currentGameMode = button.dataset.mode;
        renderGameModeSwitch(state.currentGameMode);
        clearSelections();
    });

    // ── Einzel ──
    document.getElementById('player-search').addEventListener('input', filterPlayerList);
    document.getElementById('record-singles').addEventListener('click', () =>
        recordSinglesMatch().catch(err => reportError(err, 'Spiel konnte nicht gespeichert werden')));
    document.getElementById('clear-singles').addEventListener('click', clearSelections);

    // Auswahl über die Dropdowns muss dieselbe Reihenfolge erzeugen wie Klicks.
    document.getElementById('winner').addEventListener('change', (event) => {
        state.selectedSingles[0] = event.target.value;
        state.selectedSingles = state.selectedSingles.filter(Boolean);
        renderSinglesSelection();
    });
    document.getElementById('loser').addEventListener('change', (event) => {
        const [winnerId] = state.selectedSingles;
        state.selectedSingles = [winnerId, event.target.value].filter(Boolean);
        renderSinglesSelection();
    });

    // ── Doppel ──
    document.getElementById('winning-team').addEventListener('change', updateTeamDisplay);
    document.getElementById('record-doubles').addEventListener('click', () =>
        recordDoublesMatch().catch(err => reportError(err, 'Spiel konnte nicht gespeichert werden')));
    document.getElementById('clear-teams').addEventListener('click', clearSelections);
    document.getElementById('swap-teams').addEventListener('click', () => {
        const [a, b, c, d] = state.selectedPlayers;
        state.selectedPlayers = [c, d, a, b].filter(Boolean);
        updateTeamDisplay();
    });

    // ── Spieler ──
    document.getElementById('add-player-form').addEventListener('submit', (event) => {
        event.preventDefault();
        addPlayer().catch(err => reportError(err, 'Spieler konnte nicht angelegt werden'));
    });

    // ── Rangliste ──
    document.querySelector('.ranking-tabs').addEventListener('click', (event) => {
        const tab = event.target.closest('.ranking-tab');
        if (tab) showRankingTab(tab.dataset.type);
    });
    document.getElementById('rankingsTable').addEventListener('click', (event) => {
        const header = event.target.closest('.th-sort');
        if (header) setRankingSort(header.dataset.sort);
    });
    document.getElementById('ranking-search').addEventListener('input', (event) =>
        setRankingSearch(event.target.value));
    document.getElementById('hide-inactive').addEventListener('change', (event) =>
        setHideInactive(event.target.checked));

    // ── Diagramm ──
    document.querySelector('.chart-type-tabs').addEventListener('click', (event) => {
        const tab = event.target.closest('.chart-tab');
        if (!tab) return;

        document.querySelectorAll('.chart-tab').forEach(other => {
            const active = other === tab;
            other.classList.toggle('active', active);
            other.setAttribute('aria-pressed', String(active));
        });
        renderEloChart(tab.dataset.type)
            .catch(err => reportError(err, 'Diagramm konnte nicht geladen werden'));
    });

    // ── Profil ──
    document.getElementById('profile-close').addEventListener('click', closePlayerProfile);
    document.getElementById('player-profile-modal').addEventListener('mousedown', (event) => {
        // mousedown statt click: sonst schließt eine im Inneren begonnene
        // Textmarkierung das Modal, sobald die Maus außerhalb losgelassen wird.
        if (event.target.id === 'player-profile-modal') closePlayerProfile();
    });
    document.getElementById('profile-rename').addEventListener('click', () => {
        const player = state.players[currentProfileId()];
        if (player) startRename(player.name);
    });
    document.getElementById('profile-rename-cancel').addEventListener('click', cancelRename);
    document.getElementById('profile-rename-form').addEventListener('submit', (event) =>
        submitRename(event).catch(err => reportError(err, 'Umbenennen fehlgeschlagen')));

    // ── Daten ──
    document.getElementById('export-json').addEventListener('click', exportJson);
    document.getElementById('export-csv').addEventListener('click', exportCsv);
    document.getElementById('import-file').addEventListener('change', onImportFileChosen);
    document.getElementById('bulk-add').addEventListener('click', () =>
        bulkAddPlayers().catch(err => reportError(err, 'Anlegen fehlgeschlagen')));

    // ── Aktualisieren ──
    document.getElementById('refresh-btn').addEventListener('click', () => {
        if (IS_DEMO || !IS_CONFIGURED) return;
        loadAll();
    });

    // Beim Zurückkehren in den Tab still nachladen — eine installierte PWA
    // bleibt sonst stundenlang auf veralteten Werten stehen.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (IS_DEMO || !IS_CONFIGURED) return;

        setSyncStatus(state.lastSyncedAt);
        const age = Date.now() - new Date(state.lastSyncedAt ?? 0).getTime();
        if (age > 60_000) loadAll({ silent: true });
    });
}

function selectTab(name) {
    if (!name) return;
    showTab(name);

    // Tab-Zustand in der URL spiegeln, damit die Rangliste verlinkbar ist.
    if (location.hash !== `#${name}`) {
        history.replaceState(null, '', `#${name}`);
    }
    if (name === 'elo-chart') {
        const type = document.querySelector('.chart-tab.active')?.dataset.type ?? 'singles';
        renderEloChart(type).catch(err => reportError(err, 'Diagramm konnte nicht geladen werden'));
    }
}

function restoreTabFromHash() {
    const name = location.hash.replace('#', '');
    if (name && document.getElementById(name)?.classList.contains('tab-content')) {
        selectTab(name);
    } else {
        showTab(currentTab());
    }
}

// ================= RENDERN =================

function renderAll() {
    renderPlayerDropdowns();
    renderPlayerList();
    renderDoublesGrid();
    renderRankings();
    renderHistory({ allowDelete: IS_DEMO || IS_CONFIGURED });
    setSyncStatus(state.lastSyncedAt);

    if (currentTab() === 'elo-chart') {
        const type = document.querySelector('.chart-tab.active')?.dataset.type ?? 'singles';
        renderEloChart(type).catch(err => reportError(err, 'Diagramm konnte nicht geladen werden'));
    }
}
