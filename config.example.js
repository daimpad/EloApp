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
};
