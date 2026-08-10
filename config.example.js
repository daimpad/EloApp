// Kopiere diese Datei nach config.js und trage deine Werte ein.
// config.js steht in .gitignore und wird NIE ins Repository hochgeladen.

// var statt const, damit CONFIG als globale Variable für app.js (ES-Modul) sichtbar ist
var CONFIG = {
    // Supabase-Projekteinstellungen (Dashboard → Settings → API)
    SUPABASE_URL:      'https://YOUR_PROJECT_ID.supabase.co',
    SUPABASE_ANON_KEY: 'YOUR_ANON_KEY_HERE',

    // Schreib-Passwort. Muss mit dem Wert in app_write_allowed() übereinstimmen
    // (siehe supabase/schema.sql).
    //
    // Achtung: Dieser Wert wird an den Browser ausgeliefert und ist dort für
    // jeden Besucher lesbar. Er bremst zufällige Fremdzugriffe, ersetzt aber
    // keine echte Zugriffskontrolle.
    APP_SECRET: 'YOUR_WRITE_SECRET_HERE',

    // White-Label-Branding — alle Felder optional, weglassen = Standard-Design.
    // Sobald hier etwas gesetzt ist, erzeugt die App auch das PWA-Manifest zur
    // Laufzeit, damit der eigene Name auf dem Homescreen steht.
    BRANDING: {
        name:         'EloApp 🏸',            // Titel, Überschrift, Homescreen
        shortName:    'EloApp',               // Kurzname für den Homescreen
        description:  'ELO-Ranking für Einzel und Doppel',

        primaryColor: '#c51216',              // Hauptfarbe (Hex)
        // primaryColorDark: '#a30f12',       // optional, wird sonst berechnet

        fontHeading:  'Fredoka One',          // Überschriften (Google Fonts)
        fontBody:     'Quicksand',            // Fließtext (Google Fonts)

        // Google-Fonts-URL — anpassen, wenn andere Schriften gewählt werden:
        googleFonts:  'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Quicksand:wght@400;700&display=swap',
    },
};
