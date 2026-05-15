# SpeedHennen 🏸🐔

Badminton ELO-Ranking-App für Einzel- und Doppelspiele — gehostet im Browser, Daten in [Supabase](https://supabase.com).

## Features

- **Einzel- & Doppel-ELO** — separate Ratings, K-Faktor 32, Startwert 1000
- **Match eintragen** — Einzel per Spieler-Auswahl, Doppel per Klick-Zuweisung zu Teams
- **Match löschen** — ELO aller Spieler wird anschließend vollständig neu berechnet
- **Rangliste** — getrennte Tabellen für Einzel und Doppel
- **ELO-Verlauf** — interaktives Liniendiagramm (Chart.js) für alle Spieler
- **Spieler-Profil** — Modal mit persönlicher Statistik, ELO-Trend und letzten 15 Spielen
- **Spielverlauf** — chronologische Match-History
- **Schreib-Schutz** — Änderungen nur mit `APP_SECRET`, Lesen bleibt öffentlich
- **Demo-Modus** — `?demo=true` lädt Beispieldaten ohne Datenbankverbindung
- **Offline-Fallback** — Daten werden im `localStorage` gecacht
- **Mobile-optimiert** — scrollbare Tab-Leiste, Bottom-Sheet-Modal, 44 px Touch-Targets

---

## Schnellstart

### 1. Supabase-Projekt anlegen

1. Kostenloses Projekt auf [supabase.com](https://supabase.com) erstellen
2. SQL-Schema einspielen (`supabase/schema.sql` im SQL-Editor ausführen — Passwort ersetzen!)
3. **Project URL** und **anon public key** aus den Projekteinstellungen kopieren

### 2. Konfiguration anlegen

```bash
cp config.example.js config.js
```

`config.js` öffnen und alle drei Werte eintragen:

```js
var CONFIG = {
    SUPABASE_URL:      'https://DEIN_PROJEKT.supabase.co',
    SUPABASE_ANON_KEY: 'DEIN_ANON_KEY',
    APP_SECRET:        'DEIN_GEHEIMES_PASSWORT',   // muss mit dem Wert in schema.sql übereinstimmen
};
```

> `config.js` ist in `.gitignore` eingetragen und wird **nie** ins Repository hochgeladen.

### 3. App starten

`index.html` direkt im Browser öffnen oder auf einem beliebigen Webserver hosten — kein Build-Schritt nötig.

---

## Schreib-Schutz

Die Supabase-RLS-Policies unterscheiden zwischen Lesen und Schreiben:

| Aktion | Berechtigung |
|--------|-------------|
| Rangliste / History lesen | ✅ jeder |
| Match eintragen / löschen | 🔒 nur mit `APP_SECRET` |
| Spieler anlegen | 🔒 nur mit `APP_SECRET` |

Die App sendet `APP_SECRET` als `x-app-secret` HTTP-Header bei jedem Schreibzugriff. Wer keine `config.js` hat, kann nur lesen.

**Bestehende Datenbank nachrüsten:** `supabase/migrate_write_secret.sql` im Supabase SQL-Editor ausführen.

---

## Demo-Modus

Zum Testen der UI ohne Datenbankverbindung:

```
index.html?demo=true
```

Lädt 6 Beispielspieler und 12 Beispiel-Matches. Alle Features funktionieren lokal — nichts wird gespeichert. Ein gelbes Banner signalisiert den Demo-Modus.

---

## Projektstruktur

```
├── index.html            # Haupt-HTML (ES-Module, kein Bundler)
├── app.js                # Orchestrierung: Events, Datenladen, API-Aufrufe
├── style.css             # Styles (responsiv, mobile-first)
├── config.example.js     # Konfigurationsvorlage (ohne Secrets)
├── config.js             # Lokale Konfiguration (gitignored)
├── src/
│   ├── elo.js            # Reine ELO-Berechnungen (keine DOM-Abhängigkeiten)
│   ├── api.js            # Supabase REST-API (camelCase ↔ snake_case Mapping)
│   ├── state.js          # Globaler App-State + localStorage-Persistenz
│   ├── ui.js             # DOM-Rendering (Rangliste, History, Profil, …)
│   ├── chart.js          # Chart.js-Diagramme (ELO-Verlauf, Profil-Chart)
│   └── demo.js           # Beispieldaten für den Demo-Modus
├── supabase/
│   ├── schema.sql                # Datenbankschema inkl. RLS-Policies (Neu-Setup)
│   └── migrate_write_secret.sql  # Migration für bestehende DBs
├── src/
│   ├── elo.test.js       # Unit-Tests für ELO-Logik (Vitest)
│   └── api.test.js       # Unit-Tests für API-Mapping (Vitest)
├── .github/
│   └── workflows/
│       ├── ci.yml        # GitHub Actions: npm test bei jedem Push/PR
│       └── deploy.yml    # GitHub Actions: Deploy auf GitHub Pages
└── .gitignore
```

### Schichtenmodell

```
elo.js  →  api.js  →  state.js  →  ui.js  →  app.js
(Logik)    (HTTP)     (State)      (DOM)      (Orchestrierung)
```

Jede Schicht kennt nur die Schicht darunter. `app.js` verbindet alles und exportiert globale Funktionen für HTML-`onclick`-Attribute.

---

## Datenbankschema

| Tabelle | Wichtige Spalten |
|---------|-----------------|
| `players` | `id TEXT`, `name`, `elo`, `matches`, `wins`, `losses`, `doubles_elo`, `doubles_matches`, `doubles_wins`, `doubles_losses` |
| `matches` | `id BIGSERIAL`, `date`, `type` (`singles`/`doubles`), `winner_id`, `loser_id`, `winner_name`, `loser_name`, `elo_change` |

---

## ELO-System

```
Erwarteter Score:  E = 1 / (1 + 10^((ELO_Gegner - ELO_Spieler) / 400))
Neues ELO:         ELO_neu = ELO_alt + K × (Ergebnis - E)
K-Faktor:          32
Startwert:         1000
```

Bei **Doppel** wird der Durchschnitts-ELO jedes Teams für die Erwartungsberechnung verwendet. Nach jedem **Match-Löschvorgang** werden alle ELO-Werte aus der kompletten History neu berechnet, um Datendrift zu vermeiden.

---

## Entwicklung

### Tests ausführen

```bash
npm install
npm test            # einmalig
npm run test:watch  # im Watch-Modus
```

48 Unit-Tests (21 ELO-Logik + 27 API-Mapping) via **Vitest**. CI prüft jeden Push und PR gegen `main`.

### Neues Feature

```bash
git checkout -b feature/mein-feature
# … entwickeln …
git push -u origin feature/mein-feature
# Pull Request gegen main öffnen
```
