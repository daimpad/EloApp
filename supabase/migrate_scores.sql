-- Migration: optionale Satzergebnisse
--
-- Nur nötig, wenn ihr im Formular "Satzergebnis" nutzen wollt.
-- Ohne diese Migration funktioniert die App vollständig — die App schickt die
-- Felder nur mit, wenn beide ausgefüllt sind.
--
-- Im Supabase SQL-Editor ausführen.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_score  INTEGER;
