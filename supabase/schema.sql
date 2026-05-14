-- EloApp – Supabase Schema
-- Dieses Script im Supabase SQL-Editor ausführen (einmalig beim Setup).

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
-- Öffentliches Lesen erlauben; Schreiben nur mit dem Anon-Key.
-- Passe die Policies an deine Sicherheitsanforderungen an.

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spieler lesen" ON players FOR SELECT USING (true);
CREATE POLICY "Spieler schreiben" ON players FOR ALL USING (true);

CREATE POLICY "Matches lesen" ON matches FOR SELECT USING (true);
CREATE POLICY "Matches schreiben" ON matches FOR ALL USING (true);
