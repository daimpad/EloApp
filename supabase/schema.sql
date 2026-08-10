-- EloApp – Supabase Schema
-- Dieses Script im Supabase SQL-Editor ausführen (einmalig beim Setup).
--
-- WICHTIG: Ersetze 'DEIN_GEHEIMES_PASSWORT' unten durch ein eigenes Passwort.
-- Dasselbe Passwort muss in config.js als APP_SECRET eingetragen werden.
--
-- Zum Charakter dieses Schutzes: APP_SECRET wird zwingend an den Browser
-- ausgeliefert und ist dort für jeden Besucher lesbar. Es ist eine
-- Vandalismus-Bremse gegen zufällige Fremdzugriffe, kein Sicherheitsmechanismus.
-- Wer die Seite aufrufen kann, kann grundsätzlich auch schreiben.

-- ── Spieler ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
    id              TEXT        PRIMARY KEY,
    name            TEXT        NOT NULL UNIQUE,
    elo             INTEGER     NOT NULL DEFAULT 1000,
    matches         INTEGER     NOT NULL DEFAULT 0,
    wins            INTEGER     NOT NULL DEFAULT 0,
    losses          INTEGER     NOT NULL DEFAULT 0,
    doubles_elo     INTEGER     NOT NULL DEFAULT 1000,
    doubles_matches INTEGER     NOT NULL DEFAULT 0,
    doubles_wins    INTEGER     NOT NULL DEFAULT 0,
    doubles_losses  INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Matches ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
    id           BIGSERIAL   PRIMARY KEY,
    date         TIMESTAMPTZ NOT NULL,
    type         TEXT        NOT NULL CHECK (type IN ('singles', 'doubles')),
    winner_id    TEXT        NOT NULL,
    loser_id     TEXT        NOT NULL,
    winner_name  TEXT        NOT NULL,
    loser_name   TEXT        NOT NULL,
    elo_change   INTEGER     NOT NULL,
    -- Optionales Satzergebnis. NULL bedeutet: nicht erfasst.
    winner_score INTEGER,
    loser_score  INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Die App liest ausschließlich chronologisch mit der ID als Tie-Break.
CREATE INDEX IF NOT EXISTS matches_date_id_idx ON matches (date ASC, id ASC);

-- ── Schreibschutz ─────────────────────────────────────────────────────────
--
-- Das Secret steht an genau einer Stelle. Vorher war es in fünf Policies
-- dupliziert, sodass eine Rotation fünf Stellen betraf und eine vergessene
-- Policy still offen blieb.

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

-- ── Row Level Security (RLS) ──────────────────────────────────────────────

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Lesen: jeder darf (Rangliste, Demo-Modus)
DROP POLICY IF EXISTS "public_read_players" ON players;
DROP POLICY IF EXISTS "public_read_matches" ON matches;

CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);
CREATE POLICY "public_read_matches" ON matches FOR SELECT USING (true);

-- Schreiben: nur mit gültigem x-app-secret Header
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
