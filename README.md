# ELO-App 🏸

ELO-Ranking-App für Einzel- und Doppelspiele — gehostet im Browser, Daten in [Supabase](https://supabase.com). Vollständig white-label-fähig über `config.js`.

## Features

- **Einzel- & Doppel-ELO** — separate Ratings, K-Faktor 32, Startwert 1000
- **Match eintragen** — Einzel per Spieler-Auswahl, Doppel per Klick-Zuweisung zu Teams
- **Match löschen** — ELO aller Spieler wird anschließend vollständig neu berechnet
- **Rangliste** — getrennte Tabellen für Einzel und Doppel inkl. Siegesserie
- **Siegesserie** — ⚡ / 🔥 / 🔥🔥 für aktuelle Wins, 💔 für Verlustserien
- **ELO-Verlauf** — interaktives Liniendiagramm (Chart.js) für alle Spieler
- **Spieler-Profil** — Modal mit Statistik, ELO-Trend, Streak und letzten 15 Spielen
- **Spielverlauf** — chronologische Match-History
- **Schreib-Schutz** — Änderungen nur mit `APP_SECRET`, Lesen bleibt öffentlich
- **Demo-Modus** — `?demo=true` lädt Beispieldaten ohne Datenbankverbindung
- **PWA** — installierbar auf Android & iOS, offline-fähig via Service Worker
- **White-Label** — Name, Farben und Schriften per `config.js` konfigurierbar
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

`config.js` öffnen und die Werte eintragen:

```js
var CONFIG = {
    SUPABASE_URL:      'https://DEIN_PROJEKT.supabase.co',
    SUPABASE_ANON_KEY: 'DEIN_ANON_KEY',
    APP_SECRET:        'DEIN_GEHEIMES_PASSWORT',

    // Optional: Branding anpassen
    BRANDING: {
        name:         'Mein Verein 🏸',
        primaryColor: '#1a73e8',
        fontHeading:  'Lobster',
        fontBody:     'Roboto',
        googleFonts:  'https://fonts.googleapis.com/css2?family=Lobster&family=Roboto&display=swap',
    },
};
```

> `config.js` ist in `.gitignore` eingetragen und wird **nie** ins Repository hochgeladen.

### 3. App starten

`index.html` direkt im Browser öffnen oder auf einem Webserver hosten — kein Build-Schritt nötig.

---

## White-Label-Branding

Alle visuellen Markenwerte werden aus dem `BRANDING`-Objekt in `config.js` gesetzt. Alle Felder sind optional — fehlende Werte behalten das Standard-Design.

| Feld | Beschreibung | Standard |
|------|-------------|---------|
| `name` | App-Name (Titel + H1) | `'EloApp 🏸'` |
| `shortName` | Kurzname für iOS-Homescreen | `'EloApp'` |
| `primaryColor` | Hauptfarbe (Hex) | `'#c51216'` |
| `primaryColorDark` | Hover-Farbe (optional, wird sonst berechnet) | auto |
| `fontHeading` | Überschriften-Schrift (Google Fonts Name) | `'Fredoka One'` |
| `fontBody` | Fließtext-Schrift (Google Fonts Name) | `'Quicksand'` |
| `googleFonts` | Google Fonts URL für gewählte Schriften | Fredoka+Quicksand |

---

## Schreib-Schutz

Die Supabase-RLS-Policies unterscheiden zwischen Lesen und Schreiben:

| Aktion | Berechtigung |
|--------|-------------|
| Rangliste / History lesen | ✅ jeder |
| Match eintragen / löschen | 🔒 nur mit `APP_SECRET` |
| Spieler anlegen | 🔒 nur mit `APP_SECRET` |

Die App sendet `APP_SECRET` als `x-app-secret` HTTP-Header bei jedem Schreibzugriff.

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
├── style.css             # Styles mit CSS Custom Properties für Branding
├── manifest.json         # PWA-Manifest
├── sw.js                 # Service Worker (Cache-First für Assets)
├── config.example.js     # Konfigurationsvorlage (ohne Secrets)
├── config.js             # Lokale Konfiguration (gitignored)
├── icons/
│   ├── icon-192.svg      # PWA-Icon
│   └── icon-512.svg      # PWA-Icon (groß)
├── src/
│   ├── elo.js            # Reine ELO-Berechnungen
│   ├── api.js            # Supabase REST-API (camelCase ↔ snake_case)
│   ├── state.js          # Globaler App-State + localStorage-Persistenz
│   ├── ui.js             # DOM-Rendering (Rangliste, History, Profil, …)
│   ├── chart.js          # Chart.js-Diagramme (ELO-Verlauf, Profil-Chart)
│   ├── streaks.js        # Siegesserie-Berechnung
│   ├── branding.js       # White-Label: CSS-Vars + Titel setzen
│   └── demo.js           # Beispieldaten für den Demo-Modus
├── supabase/
│   ├── schema.sql                # Datenbankschema inkl. RLS-Policies
│   └── migrate_write_secret.sql  # Migration für bestehende DBs
├── src/
│   ├── elo.test.js       # Unit-Tests ELO-Logik
│   ├── api.test.js       # Unit-Tests API-Mapping
│   └── streaks.test.js   # Unit-Tests Siegesserie
├── .github/
│   └── workflows/
│       ├── ci.yml        # Tests bei jedem Push/PR
│       └── deploy.yml    # Deploy auf GitHub Pages
└── .gitignore
```

### Schichtenmodell

```
elo.js  →  api.js  →  state.js  →  ui.js  →  app.js
(Logik)    (HTTP)     (State)      (DOM)      (Orchestrierung)
              ↑
         branding.js  streaks.js  chart.js  demo.js
```

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

56 Unit-Tests (21 ELO + 28 API + 7 Streaks) via **Vitest**. CI prüft jeden Push und PR gegen `main`.

### Neues Feature

```bash
git checkout -b feature/mein-feature
# … entwickeln …
git push -u origin feature/mein-feature
# Pull Request gegen main öffnen
```
