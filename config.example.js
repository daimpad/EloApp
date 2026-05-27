// Kopiere diese Datei nach config.js und trage deine Werte ein.
// config.js ist in .gitignore eingetragen und wird NIE ins Repository hochgeladen.

// var statt const, damit CONFIG als globale Variable für app.js (ES-Modul) sichtbar ist
var CONFIG = {
    // Supabase-Projekteinstellungen (unter Settings → API im Supabase-Dashboard)
    SUPABASE_URL:      'https://YOUR_PROJECT_ID.supabase.co',
    SUPABASE_ANON_KEY: 'YOUR_ANON_KEY_HERE',

    // Schreib-Secret: muss mit dem Wert in der Supabase-RLS-Policy übereinstimmen.
    // Wähle ein beliebiges Passwort und trage es auch in der Policy ein (siehe supabase/schema.sql).
    APP_SECRET: 'YOUR_WRITE_SECRET_HERE',

    // White-Label-Branding (alle Felder optional — weglassen = Standard-Design)
    BRANDING: {
        name:         'EloApp 🏸',            // App-Name (Titel + H1)
        shortName:    'EloApp',               // Kurzname für iOS Homescreen

        primaryColor: '#c51216',              // Hauptfarbe (Hex)
        // primaryColorDark: '#a30f12',       // optional: Hover-Farbe (wird sonst automatisch berechnet)

        fontHeading:  'Fredoka One',          // Überschriften-Schrift (Google Fonts Name)
        fontBody:     'Quicksand',            // Fließtext-Schrift (Google Fonts Name)

        // Google Fonts URL — anpassen wenn andere Schriften gewählt werden:
        googleFonts:  'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Quicksand:wght@400;700&display=swap',
    },
};
