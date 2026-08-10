/**
 * Einheitliche Formatierung von Datum und Uhrzeit.
 *
 * Vorher riefen vier Stellen `toLocaleDateString()` ohne Locale auf — auf einem
 * englisch eingestellten Handy stand dort dann "8/10/2026" statt "10.08.2026".
 */

const DATE_TIME = new Intl.DateTimeFormat('de-DE', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
});

const DATE_ONLY = new Intl.DateTimeFormat('de-DE', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
});

function toDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** "10.08.2026, 19:42" — oder "—" wenn das Datum unbrauchbar ist. */
export function formatDateTime(value) {
    const date = toDate(value);
    return date ? DATE_TIME.format(date) : '—';
}

/** "10.08.2026" — oder "—" wenn das Datum unbrauchbar ist. */
export function formatDate(value) {
    const date = toDate(value);
    return date ? DATE_ONLY.format(date) : '—';
}

/**
 * Grobe, gut lesbare Altersangabe für den "Stand:"-Hinweis im Kopf.
 * @param {string|number|Date} value
 * @returns {string} z. B. "gerade eben", "vor 5 Min.", "vor 3 Std."
 */
export function formatRelative(value) {
    const date = toDate(value);
    if (!date) return '—';

    const seconds = Math.round((Date.now() - date.getTime()) / 1000);

    if (seconds < 45)    return 'gerade eben';
    if (seconds < 5400)  return `vor ${Math.round(seconds / 60)} Min.`;
    if (seconds < 86400) return `vor ${Math.round(seconds / 3600)} Std.`;

    return formatDateTime(value);
}

/**
 * Wandelt einen ISO-Zeitstempel in den Wert, den ein
 * `<input type="datetime-local">` erwartet (lokale Zeit, ohne Zone).
 */
export function toDateTimeLocal(value = Date.now()) {
    const date = toDate(value) ?? new Date();
    const pad  = (n) => String(n).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
         + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Deutscher Plural ohne "(es)"-Klammerform. */
export function pluralise(count, singular, plural) {
    return count === 1 ? singular : plural;
}
