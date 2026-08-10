import { state } from './state.js';
import { STARTING_ELO } from './elo.js';
import { replayMatches } from './replay.js';
import { brandColor } from './branding.js';
import { formatDate, formatDateTime } from './format.js';

// ── Chart.js laden ─────────────────────────────────────────────────────────
//
// Die Bibliothek liegt als eigenständiges UMD-Bundle unter vendor/ und wird
// erst geladen, wenn wirklich ein Diagramm gezeichnet wird. Vorher kam sie per
// statischem Import vom CDN: der Service Worker legte sie nie ab, sodass die
// App offline gar nicht startete — und die 200 KB gingen auch zulasten aller,
// die den Verlauf nie öffnen.

let chartLib = null;
let chartLibPromise = null;

function loadChartLib() {
    if (chartLib) return Promise.resolve(chartLib);
    if (chartLibPromise) return chartLibPromise;

    chartLibPromise = new Promise((resolve, reject) => {
        if (globalThis.Chart) {
            chartLib = globalThis.Chart;
            return resolve(chartLib);
        }

        const script = document.createElement('script');
        script.src = new URL('../vendor/chart.umd.js', import.meta.url).href;
        script.onload = () => {
            chartLib = globalThis.Chart;
            if (chartLib) resolve(chartLib);
            else reject(new Error('Diagramm-Bibliothek konnte nicht initialisiert werden.'));
        };
        script.onerror = () => {
            chartLibPromise = null;
            reject(new Error('Diagramm-Bibliothek konnte nicht geladen werden.'));
        };
        document.head.appendChild(script);
    });

    return chartLibPromise;
}

// ── Farbpalette ────────────────────────────────────────────────────────────

const COLORS = [
    '#c51216', '#1f77b4', '#2ca02c', '#ff7f0e',
    '#9467bd', '#17becf', '#d62728', '#8c564b',
    '#e377c2', '#7f7f7f', '#bcbd22', '#0d5c4a',
];

// Ab dem 13. Spieler wiederholen sich die Farben — die Strichart macht die
// Linien dann trotzdem unterscheidbar.
const DASHES = [[], [6, 4], [2, 3], [10, 4, 2, 4]];

function styleFor(index) {
    return {
        color: index === 0 ? brandColor() : COLORS[index % COLORS.length],
        dash:  DASHES[Math.floor(index / COLORS.length) % DASHES.length],
    };
}

/** Wie viele Linien standardmäßig sichtbar sind, bevor die Legende überläuft. */
const VISIBLE_BY_DEFAULT = 8;

// ── ELO-Verlauf berechnen ──────────────────────────────────────────────────

/**
 * Berechnet den ELO-Verlauf jedes Spielers aus der Match-History.
 *
 * Nutzt denselben Replay wie recalculateStatsFromHistory() — der Endwert jeder
 * Kurve ist damit garantiert identisch mit dem Wert in der Rangliste. Vorher
 * waren das zwei unabhängige Implementierungen, die bereits auseinanderdrifteten.
 *
 * @param {'singles'|'doubles'} type
 * @returns {{ [playerId: string]: Array<{ x: number, y: number, date: string }> }}
 */
export function buildEloHistory(type = 'singles') {
    const wantDoubles = type === 'doubles';
    const history = {};

    for (const id of Object.keys(state.players)) {
        history[id] = [];
    }

    replayMatches(state.matches, Object.keys(state.players), ({ match, isDoubles, updated }) => {
        if (isDoubles !== wantDoubles) return;

        const time = new Date(match.date ?? 0).getTime();

        for (const { id, elo } of updated) {
            history[id].push({
                x: Number.isNaN(time) ? 0 : time,
                y: elo,
                date: match.date,
            });
        }
    });

    return history;
}

// ── Gemeinsame Chart-Optionen ──────────────────────────────────────────────

function baseOptions({ showLegend }) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        animation: prefersReducedMotion() ? false : undefined,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
            legend: showLegend
                ? { position: 'bottom', labels: { usePointStyle: true, padding: 16 } }
                : { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => formatDateTime(items[0]?.raw?.date),
                    label: (item) => showLegend
                        ? ` ${item.dataset.label}: ${item.raw.y} ELO`
                        : ` ${item.raw.y} ELO`,
                },
            },
        },
        scales: {
            x: {
                type: 'linear',
                title: { display: true, text: 'Datum' },
                ticks: {
                    maxTicksLimit: 6,
                    autoSkip: true,
                    callback: (value) => formatDate(value),
                },
            },
            y: {
                title: { display: true, text: 'ELO' },
                suggestedMin: STARTING_ELO - 100,
                suggestedMax: STARTING_ELO + 100,
            },
        },
    };
}

function prefersReducedMotion() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function datasetFor(label, points, index, { fill = false } = {}) {
    const { color, dash } = styleFor(index);
    return {
        label,
        data: points,
        borderColor:      color,
        backgroundColor:  color + '22',
        borderWidth:      2,
        borderDash:       dash,
        pointRadius:      3,
        pointHoverRadius: 6,
        tension:          0.25,
        fill,
    };
}

/**
 * Blendet die Leinwand aus und zeigt stattdessen eine Meldung.
 * Ersetzt nicht das innerHTML des Containers — sonst wäre die Leinwand weg.
 */
function showEmptyMessage(canvas, text) {
    let message = canvas.parentElement.querySelector('.chart-empty-msg');
    if (!message) {
        message = document.createElement('p');
        message.className = 'chart-empty-msg';
        canvas.parentElement.appendChild(message);
    }
    message.textContent = text;
    canvas.style.display = 'none';
}

function hideEmptyMessage(canvas) {
    canvas.style.display = '';
    canvas.parentElement.querySelector('.chart-empty-msg')?.remove();
}

function destroy(instance) {
    instance?.destroy();
    return null;
}

// ── Chart rendern ──────────────────────────────────────────────────────────

let chartInstance = null;
let profileChartInstance = null;

/**
 * Zeichnet den ELO-Verlauf eines einzelnen Spielers im Profil-Modal.
 * @param {string} playerId
 * @param {'singles'|'doubles'} type
 */
export async function renderPlayerChart(playerId, type = 'singles') {
    const canvas = document.getElementById('profileChart');
    if (!canvas) return;

    profileChartInstance = destroy(profileChartInstance);

    const points = buildEloHistory(type)[playerId] ?? [];

    if (points.length === 0) {
        showEmptyMessage(canvas, 'Noch keine Spiele in diesem Modus.');
        return;
    }

    const Chart = await loadChartLib();

    // Zwischen dem await und hier kann das Modal geschlossen oder der Tab
    // gewechselt worden sein.
    if (!canvas.isConnected) return;
    profileChartInstance = destroy(profileChartInstance);

    hideEmptyMessage(canvas);

    profileChartInstance = new Chart(canvas, {
        type: 'line',
        data: { datasets: [datasetFor('ELO', points, 0, { fill: true })] },
        options: baseOptions({ showLegend: false }),
    });
}

/**
 * Zeichnet den ELO-Verlauf aller aktiven Spieler.
 * @param {'singles'|'doubles'} type
 */
export async function renderEloChart(type = 'singles') {
    const canvas = document.getElementById('eloChart');
    if (!canvas) return;

    const history = buildEloHistory(type);

    // Nur Spieler mit mindestens einem Spiel anzeigen, stärkste zuerst — so
    // sind die standardmäßig sichtbaren Linien die interessanten.
    const activePlayers = Object.entries(state.players)
        .filter(([id]) => history[id]?.length > 0)
        .sort((a, b) => {
            const last = (id) => history[id][history[id].length - 1].y;
            return last(b[0]) - last(a[0]);
        });

    if (activePlayers.length === 0) {
        chartInstance = destroy(chartInstance);
        showEmptyMessage(canvas, 'Noch keine Spiele eingetragen.');
        return;
    }

    const Chart = await loadChartLib();
    if (!canvas.isConnected) return;

    chartInstance = destroy(chartInstance);
    hideEmptyMessage(canvas);

    const datasets = activePlayers.map(([id, player], index) => ({
        ...datasetFor(player.name, history[id], index),
        // Bei vielen Spielern würde die Legende den halben Bildschirm füllen.
        // Die übrigen Linien bleiben über die Legende zuschaltbar.
        hidden: index >= VISIBLE_BY_DEFAULT,
    }));

    const options = baseOptions({ showLegend: true });
    if (activePlayers.length > VISIBLE_BY_DEFAULT) {
        options.plugins.legend.title = {
            display: true,
            text: `Top ${VISIBLE_BY_DEFAULT} sichtbar — weitere Spieler antippen`,
        };
    }

    chartInstance = new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options,
    });
}
