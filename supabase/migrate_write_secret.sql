-- Migration: Schreib-Secret zu bestehender Datenbank hinzufügen
--
-- Im Supabase SQL-Editor ausführen.
-- Ersetze 'DEIN_GEHEIMES_PASSWORT' durch dein eigenes Passwort (überall gleich!).
-- Dasselbe Passwort in config.js als APP_SECRET eintragen.

-- Alte offene Schreib-Policies entfernen
DROP POLICY IF EXISTS "Spieler schreiben" ON players;
DROP POLICY IF EXISTS "Matches schreiben" ON matches;

-- Neue Policies: Schreiben nur mit x-app-secret Header
-- !! Ersetze 'DEIN_GEHEIMES_PASSWORT' mit deinem eigenen Wert !!
CREATE POLICY "secret_insert_players" ON players FOR INSERT
    WITH CHECK (
        (current_setting('request.headers', true)::json->>'x-app-secret') = 'DEIN_GEHEIMES_PASSWORT'
    );

CREATE POLICY "secret_update_players" ON players FOR UPDATE
    USING (
        (current_setting('request.headers', true)::json->>'x-app-secret') = 'DEIN_GEHEIMES_PASSWORT'
    );

CREATE POLICY "secret_delete_players" ON players FOR DELETE
    USING (
        (current_setting('request.headers', true)::json->>'x-app-secret') = 'DEIN_GEHEIMES_PASSWORT'
    );

CREATE POLICY "secret_insert_matches" ON matches FOR INSERT
    WITH CHECK (
        (current_setting('request.headers', true)::json->>'x-app-secret') = 'DEIN_GEHEIMES_PASSWORT'
    );

CREATE POLICY "secret_delete_matches" ON matches FOR DELETE
    USING (
        (current_setting('request.headers', true)::json->>'x-app-secret') = 'DEIN_GEHEIMES_PASSWORT'
    );
