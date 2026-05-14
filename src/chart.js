import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4/+esm';
import { state } from './state.js';
import { STARTING_ELO, calculateSinglesMatch, calculateDoublesMatch } from './elo.js';

// ── Farbpalette ────────────────────────────────────────────────────────────

const COLORS = [
    '#c51216', '#4ECDC4', '#6A67CE', '#FFB347',
    '#45B7D1', '#96CEB4', '#FF6B9D', '#A8E6CF',
    '#FF8B94', '#88D8B0', '#FFCC5C', '#B8B8FF',
];

function colorFor(index) {
    return COLORS[index % COLORS.length];
}

// ── ELO-Verlauf berechnen ──────────────────────────────────────────────────

/**
 * Berechnet den ELO-Verlauf jedes Spielers aus der Match-History.
 * @param {'singles'|'doubles'} type
 * @returns {{ [playerId]: Array<{ matchIndex: number, date: string, elo: number }> }}
 */
export function buildEloHistory(type = 'singles') {
    const currentElo = {};
    Object.keys(state.players).forEach(id => { currentElo[id] = STARTING_ELO; });

    const history = {};
    Object.keys(state.players).forEach(id => { history[id] = []; });

    const getIds = (val) => String(val || '').split(',').map(s => s.trim()).filter(Boolean);

    const sorted = [...state.matches]
        .filter(m => String(m.type || '').toLowerCase() === type)
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    let matchIndex = 1;

    sorted.forEach(match => {
        if (type === 'singles') {
            const wId = String(match.winnerId || '').trim();
            const lId = String(match.loserId  || '').trim();
            if (currentElo[wId] === undefined || currentElo[lId] === undefined) return;

            const result = calculateSinglesMatch(currentElo[wId], currentElo[lId]);
            currentElo[wId] = result.winnerElo;
            currentElo[lId] = result.loserElo;

            history[wId].push({ matchIndex, date: match.date, elo: result.winnerElo });
            history[lId].push({ matchIndex, date: match.date, elo: result.loserElo });
        } else {
            const winners = getIds(match.winnerId);
            const losers  = getIds(match.loserId);
            if (winners.some(id => currentElo[id] === undefined) ||
                losers.some(id  => currentElo[id] === undefined)) return;

            const { eloChange } = calculateDoublesMatch(
                winners.map(id => currentElo[id]),
                losers.map(id  => currentElo[id]),
            );

            winners.forEach(id => {
                currentElo[id] = (currentElo[id] || STARTING_ELO) + eloChange;
                history[id].push({ matchIndex, date: match.date, elo: currentElo[id] });
            });
            losers.forEach(id => {
                currentElo[id] = (currentElo[id] || STARTING_ELO) - eloChange;
                history[id].push({ matchIndex, date: match.date, elo: currentElo[id] });
            });
        }

        matchIndex++;
    });

    return history;
}

// ── Chart rendern ──────────────────────────────────────────────────────────

let chartInstance = null;
let profileChartInstance = null;

/**
 * Renders a single-player ELO trend chart inside the profile modal.
 * @param {string} playerId
 * @param {'singles'|'doubles'} type
 */
export function renderPlayerChart(playerId, type = 'singles') {
    const canvas = document.getElementById('profileChart');
    if (!canvas) return;

    if (profileChartInstance) {
        profileChartInstance.destroy();
        profileChartInstance = null;
    }

    const history = buildEloHistory(type);
    const points  = history[playerId] || [];

    if (points.length === 0) {
        canvas.parentElement.innerHTML =
            '<p style="text-align:center;color:#999;padding:20px">Noch keine Spiele in diesem Modus.</p>';
        return;
    }

    const color = '#c51216';
    const data  = [
        { x: 0, y: STARTING_ELO, date: null },
        ...points.map(p => ({ x: p.matchIndex, y: p.elo, date: p.date })),
    ];

    profileChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            datasets: [{
                label: 'ELO',
                data,
                borderColor:      color,
                backgroundColor:  color + '22',
                borderWidth:      2,
                pointRadius:      4,
                pointHoverRadius: 6,
                tension:          0.3,
                fill:             true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title(items) {
                            const raw = items[0]?.raw;
                            if (!raw?.date) return 'Start';
                            const d = new Date(raw.date);
                            return isNaN(d.getTime()) ? 'Start' :
                                d.toLocaleDateString() + ' ' +
                                d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        },
                        label(item) { return ` ${item.raw.y} ELO`; },
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Match' },
                    ticks: { stepSize: 1, precision: 0 },
                },
                y: {
                    title: { display: true, text: 'ELO' },
                    suggestedMin: STARTING_ELO - 100,
                },
            },
        },
    });
}

export function renderEloChart(type = 'singles') {
    const canvas = document.getElementById('eloChart');
    if (!canvas) return;

    const history = buildEloHistory(type);

    // Nur Spieler mit mindestens einem Match anzeigen
    const activePlayers = Object.entries(state.players)
        .filter(([id]) => history[id] && history[id].length > 0)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (activePlayers.length === 0) {
        canvas.parentElement.innerHTML =
            '<p style="text-align:center;color:#999;padding:40px">Noch keine Matches eingetragen.</p>';
        return;
    }

    const datasets = activePlayers.map(([id, player], index) => {
        const color = colorFor(index);
        const points = history[id];

        // Startpunkt bei ELO 1000 vor dem ersten Match des Spielers
        const data = [
            { x: 0, y: STARTING_ELO, date: null },
            ...points.map(p => ({ x: p.matchIndex, y: p.elo, date: p.date })),
        ];

        return {
            label:           player.name,
            data,
            borderColor:     color,
            backgroundColor: color + '22',
            borderWidth:     2,
            pointRadius:     4,
            pointHoverRadius: 6,
            tension:         0.3,
            fill:            false,
        };
    });

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    chartInstance = new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, padding: 16 },
                },
                tooltip: {
                    callbacks: {
                        title(items) {
                            const raw = items[0]?.raw;
                            if (!raw?.date) return 'Start';
                            const d = new Date(raw.date);
                            return isNaN(d.getTime()) ? 'Start' :
                                d.toLocaleDateString() + ' ' +
                                d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        },
                        label(item) {
                            return ` ${item.dataset.label}: ${item.raw.y} ELO`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Match' },
                    ticks: { stepSize: 1, precision: 0 },
                },
                y: {
                    title: { display: true, text: 'ELO' },
                    suggestedMin: STARTING_ELO - 100,
                },
            },
        },
    });
}
