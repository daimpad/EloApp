-- Migration: Schreibschutz in eine Funktion kapseln
--
-- Vorher stand das Passwort in fünf Policies. Eine Rotation musste alle fünf
-- treffen; eine vergessene Policy blieb still offen.
--
-- WICHTIG: 'DEIN_GEHEIMES_PASSWORT' unten durch den Wert ersetzen, der in
-- config.js als APP_SECRET steht.
--
-- Im Supabase SQL-Editor ausführen.

CREATE OR REPLACE FUNCTION app_write_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        (current_setting('request.headers', true)::json ->> 'x-app-secret'),
        ''
    ) = 'DEIN_GEHEIMES_PASSWORT';
$$;

DROP POLICY IF EXISTS "secret_insert_players" ON players;
DROP POLICY IF EXISTS "secret_update_players" ON players;
DROP POLICY IF EXISTS "secret_delete_players" ON players;
DROP POLICY IF EXISTS "secret_insert_matches" ON matches;
DROP POLICY IF EXISTS "secret_delete_matches" ON matches;

CREATE POLICY "secret_insert_players" ON players FOR INSERT WITH CHECK (app_write_allowed());
CREATE POLICY "secret_update_players" ON players FOR UPDATE USING (app_write_allowed());
CREATE POLICY "secret_delete_players" ON players FOR DELETE USING (app_write_allowed());

CREATE POLICY "secret_insert_matches" ON matches FOR INSERT WITH CHECK (app_write_allowed());
CREATE POLICY "secret_delete_matches" ON matches FOR DELETE USING (app_write_allowed());

-- Index für die chronologische Abfrage der App
CREATE INDEX IF NOT EXISTS matches_date_id_idx ON matches (date ASC, id ASC);
