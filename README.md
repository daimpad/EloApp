# ELO-App 🏸

ELO-Ranking-App für Einzel- und Doppelspiele — läuft im Browser, Daten in [Supabase](https://supabase.com). Vollständig white-label-fähig über `config.js`.

## Features

- **Einzel- & Doppel-ELO** — separate Ratings, K-Faktor 32, Startwert 1000
- **Spiel eintragen** — Einzel per Klickreihenfolge (erster Klick = Gewinner), Doppel per Zuweisung zu Teams
- **Nacherfassung** — Zeitpunkt frei wählbar; die ELO wird chronologisch neu berechnet
- **Satzergebnis** — optional, ohne Einfluss auf die ELO (benötigt `supabase/migrate_scores.sql`)
- **Spiel löschen** — ELO aller Spieler wird anschließend vollständig neu berechnet
- **Rangliste** — sortierbar, durchsuchbar, umschaltbar zwischen Einzel und Doppel
- **Siegesserie** — ⚡ / 🔥 / 🔥🔥 für Siege, 💔 für Niederlagenserien
- **ELO-Verlauf** — Liniendiagramm über die Zeit, Chart.js lokal ausgeliefert
- **Spieler-Profil** — Statistik, ELO-Trend, Serie, letzte 15 Spiele, Umbenennen
- **Backup & Import** — JSON-Export/-Import, CSV-Export, Massenanlage von Spielern
- **Schreib-Schutz** — Änderungen nur mit `APP_SECRET`, Lesen bleibt öffentlich
- **Demo-Modus** — `?demo=true` lädt Beispieldaten ohne Datenbankverbindung
- **PWA** — installierbar auf Android & iOS, vollständig offline lauffähig
- **Barrierefrei** — Tastaturbedienung, Screenreader-Beschriftungen, `prefers-reduced-motion`
- **White-Label** — Name, Farben, Schriften und Homescreen-Icon per `config.js`

---

## Schnellstart

### 1. Supabase-Projekt anlegen

1. Kostenloses Projekt auf [supabase.com](https://supabase.com) erstellen
2. `supabase/schema.sql` im SQL-Editor ausführen — **Passwort im Script ersetzen!**
3. **Project URL** und **anon public key** aus den Projekteinstellungen kopieren

### 2. Konfiguration anlegen

```bash
cp config.example.js config.js
```

`config.js` öffnen und die Werte eintragen:

```js
var CONFIG = {
    SUPABASE_URL:      'https://DEIN_PROJEKT.supabase.co',
    SUPABASE_ANON_KEY: 'DEIN_ANON_KEY',
    APP_SECRET:        'DEIN_SCHREIB_PASSWORT',

    // Optional: Branding anpassen
    BRANDING: {
        name:         'Mein Verein 🏸',
        primaryColor: '#1a73e8',
    },
};
```

> `config.js` steht in `.gitignore` und wird **nie** ins Repository hochgeladen.

### 3. App starten

```bash
npm start          # startet einen lokalen Server auf http://localhost:3000
```

Alternativ `python3 -m http.server 8000` und `http://localhost:8000` öffnen.

> **Nicht per Doppelklick öffnen.** Die App lädt als ES-Modul, und Browser blockieren Modul-Importe über `file://`. Über einen Webserver — auch einen ganz simplen — läuft alles.

---

## White-Label-Branding

Alle Markenwerte kommen aus dem `BRANDING`-Objekt in `config.js`. Alle Felder sind optional.

| Feld | Beschreibung | Standard |
|------|-------------|---------|
| `name` | App-Name (Titel, H1, Homescreen) | `'EloApp 🏸'` |
| `shortName` | Kurzname für den Homescreen | `'EloApp'` |
| `primaryColor` | Hauptfarbe (Hex) | `'#c51216'` |
| `primaryColorDark` | Hover-Farbe (wird sonst berechnet) | auto |
| `fontHeading` | Überschriften-Schrift (Google Fonts) | `'Fredoka One'` |
| `fontBody` | Fließtext-Schrift (Google Fonts) | `'Quicksand'` |
| `googleFonts` | Google-Fonts-URL für die gewählten Schriften | Fredoka + Quicksand |
| `description` | Beschreibung im Homescreen-Manifest | ELO-Ranking … |

Sobald eines dieser Felder gesetzt ist, erzeugt die App das PWA-Manifest zur Laufzeit — der Vereinsname steht dann auch auf dem Homescreen. Das mitgelieferte Icon (Federball auf Markenfarbe) lässt sich mit `node scripts/make-icons.mjs` neu erzeugen; die Farbe steht oben in der Datei.

---

## Schreib-Schutz — und was er wirklich leistet

| Aktion | Berechtigung |
|--------|-------------|
| Rangliste / Verlauf lesen | ✅ jeder |
| Spiel eintragen / löschen | 🔒 nur mit `APP_SECRET` |
| Spieler anlegen / umbenennen | 🔒 nur mit `APP_SECRET` |

Die App sendet `APP_SECRET` als `x-app-secret`-Header bei jedem Schreibzugriff, Supabase prüft ihn per RLS-Policy.

> **Wichtig einzuordnen:** `APP_SECRET` wird zwingend an den Browser ausgeliefert und ist dort für jeden Besucher lesbar. Es ist eine **Vandalismus-Bremse gegen zufällige Fremdzugriffe, kein Sicherheitsmechanismus**. Wer die Seite aufrufen kann, kann grundsätzlich auch schreiben. Für einen Vereins-Account unter Bekannten ist das angemessen; für echten Zugriffsschutz bräuchte es Supabase Auth.

### Migrationen für bestehende Datenbanken

| Datei | Zweck |
|-------|-------|
| `supabase/migrate_write_allowed.sql` | Bündelt das Secret in einer Funktion `app_write_allowed()`, sodass eine Rotation nur eine Stelle betrifft. Legt außerdem den Index für die chronologische Abfrage an. |
| `supabase/migrate_scores.sql` | Fügt die optionalen Spalten `winner_score` / `loser_score` hinzu. |
| `supabase/migrate_write_secret.sql` | Älter: rüstet den Schreibschutz auf Datenbanken ohne RLS nach. |

---

## Demo-Modus

```
index.html?demo=true
```

Lädt 6 Beispielspieler und 14 Beispielspiele. Alle Funktionen arbeiten lokal, es wird nichts gespeichert — auch der Offline-Zwischenspeicher der echten Instanz bleibt unangetastet.

---

## Deployment auf GitHub Pages

`.github/workflows/deploy.yml` baut die Seite bei jedem Push auf `main`. Da `config.js` gitignored ist, wird sie im Workflow aus Repository-Secrets erzeugt.

Unter **Settings → Secrets and variables → Actions** anlegen:

| Secret | Pflicht | Inhalt |
|--------|---------|--------|
| `SUPABASE_URL` | ja | `https://DEIN_PROJEKT.supabase.co` |
| `SUPABASE_ANON_KEY` | ja | anon public key |
| `APP_SECRET` | nein | Schreib-Passwort |
| `BRANDING_JSON` | nein | Branding als JSON, z. B. `{"name":"TC Musterstadt 🏸"}` |

Ausgeliefert werden nur die tatsächlich benötigten Dateien — SQL-Skripte, Tests und `node_modules` bleiben außen vor.

---

## Projektstruktur

```
├── index.html            # Markup, keine Inline-Handler (CSP-tauglich)
├── app.js                # Orchestrierung: Events, Laden, API-Aufrufe
├── style.css             # Styles mit CSS Custom Properties
├── manifest.json         # PWA-Manifest (Standard; Branding erzeugt es zur Laufzeit)
├── sw.js                 # Service Worker (Stale-While-Revalidate)
├── config.example.js     # Konfigurationsvorlage (ohne Secrets)
├── config.js             # Lokale Konfiguration (gitignored)
├── icons/                # PWA-Icons als PNG (180/192/512)
├── vendor/
│   └── chart.umd.js      # Chart.js 4.4.7, lokal für Offline-Betrieb
├── scripts/
│   └── make-icons.mjs    # Erzeugt die Icons neu
├── src/
│   ├── elo.js            # Reine ELO-Mathematik
│   ├── match.js          # Match-Interpretation: Typ, IDs, Sortierung
│   ├── replay.js         # Der eine Replay der Historie
│   ├── api.js            # Supabase REST (camelCase ↔ snake_case)
│   ├── state.js          # App-State + localStorage
│   ├── format.js         # Datum, Uhrzeit, Plural (de-DE)
│   ├── ui.js             # DOM-Rendering
│   ├── chart.js          # Diagramme, lädt Chart.js bei Bedarf
│   ├── streaks.js        # Siegesserien
│   ├── branding.js       # White-Label: CSS-Vars, Titel, Manifest
│   ├── demo.js           # Beispieldaten
│   └── *.test.js         # Unit-Tests
├── supabase/             # Schema und Migrationen
└── .github/workflows/    # CI (Tests) und Deploy (Pages)
```

### Schichtenmodell

```
elo.js  →  match.js  →  replay.js  →  state.js  →  ui.js  →  app.js
(Mathe)    (Deutung)    (Historie)    (Zustand)    (DOM)     (Orchestrierung)
                                          ↑
                          api.js  branding.js  streaks.js  chart.js  format.js
```

---

## Datenbankschema

| Tabelle | Wichtige Spalten |
|---------|-----------------|
| `players` | `id TEXT`, `name`, `elo`, `matches`, `wins`, `losses`, `doubles_elo`, `doubles_matches`, `doubles_wins`, `doubles_losses` |
| `matches` | `id BIGSERIAL`, `date`, `type` (`singles`/`doubles`), `winner_id`, `loser_id`, `winner_name`, `loser_name`, `elo_change`, `winner_score?`, `loser_score?` |

Bei Doppeln stehen in `winner_id` / `loser_id` zwei durch Komma getrennte Spieler-IDs.

---

## ELO-System

```
Erwarteter Score:  E = 1 / (1 + 10^((ELO_Gegner - ELO_Spieler) / 400))
Neues ELO:         ELO_neu = ELO_alt + K × (Ergebnis - E)
K-Faktor:          32
Startwert:         1000
```

Bei **Doppeln** wird der Durchschnitts-ELO jedes Teams für die Erwartung verwendet.

**Die Historie ist die Wahrheitsquelle.** Nach jedem Laden, Eintragen und Löschen werden alle Werte aus der vollständigen Historie neu berechnet und nur die tatsächlich geänderten Spieler zurückgeschrieben. Die Sortierung nutzt das Datum mit der ID als Tie-Break — ohne den wäre das Ergebnis bei gleichen Zeitstempeln nicht deterministisch.

---

## Entwicklung

```bash
npm install
npm start           # lokaler Server
npm test            # alle Tests einmalig
npm run test:watch  # Watch-Modus
```

136 Unit-Tests (Vitest, jsdom): ELO-Mathematik, API-Mapping inklusive Auth-Header, Match-Interpretation, Replay-Konsistenz zwischen Rangliste und Diagramm, Persistenz sowie XSS-Regression im Rendering. CI prüft jeden Push und PR gegen `main`.

### Neues Feature

```bash
git checkout -b feature/mein-feature
# … entwickeln …
npm test
git push -u origin feature/mein-feature
# Pull Request gegen main öffnen
```
