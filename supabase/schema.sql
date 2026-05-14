-- EloApp – Supabase Schema
-- Dieses Script im Supabase SQL-Editor ausführen (einmalig beim Setup).
--
-- WICHTIG: Ersetze 'DEIN_GEHEIMES_PASSWORT' durch ein eigenes Passwort.
-- Dasselbe Passwort muss in config.js als APP_SECRET eingetragen werden.

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
    id          BIGSERIAL   PRIMARY KEY,
    date        TIMESTAMPTZ NOT NULL,
    type        TEXT        NOT NULL CHECK (type IN ('singles', 'doubles')),
    winner_id   TEXT        NOT NULL,
    loser_id    TEXT        NOT NULL,
    winner_name TEXT        NOT NULL,
    loser_name  TEXT        NOT NULL,
    elo_change  INTEGER     NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security (RLS) ──────────────────────────────────────────────

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Lesen: jeder darf (Rangliste, Demo-Modus)
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);
CREATE POLICY "public_read_matches" ON matches FOR SELECT USING (true);

-- Schreiben: nur mit x-app-secret Header
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
