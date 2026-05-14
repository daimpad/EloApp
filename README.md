# SpeedHennen 🏸🐔 – ELO-Ranking App

Badminton ELO-Tracking für Einzel- und Doppelspiele mit Google Sheets als Backend.

## Schnellstart

### 1. Konfiguration anlegen

```bash
cp config.example.js config.js
```

Öffne `config.js` und trage deine Backend-URL ein:

```js
const CONFIG = {
    GOOGLE_SHEETS_API_URL: 'https://YOUR_BACKEND_URL_HERE',
};
```

> **Wichtig:** `config.js` ist in `.gitignore` eingetragen und wird nie ins Repository hochgeladen.

### 2. App starten

Öffne `index.html` direkt im Browser oder hoste die Dateien auf einem Webserver.

---

## Projektstruktur

```
├── index.html          # Haupt-HTML
├── app.js              # Spiellogik & API-Aufrufe
├── style.css           # Styles
├── config.example.js   # Vorlage für die Konfiguration (ohne Secrets)
├── config.js           # Deine lokale Konfiguration (gitignored)
└── .gitignore
```

## Backend (Google Apps Script)

Das Backend ist ein Google Apps Script, das als Web-App veröffentlicht wird und Daten in Google Sheets liest/schreibt.

### Unterstützte API-Aktionen

| Action | Parameter | Beschreibung |
|---|---|---|
| `getPlayers` | – | Alle Spieler laden |
| `getMatches` | – | Alle Matches laden |
| `addPlayer` | `id, name, elo, matches, wins, losses, doublesElo, doublesMatches, doublesWins, doublesLosses` | Neuen Spieler anlegen |
| `updatePlayer` | `id, elo, matches, wins, losses, doublesElo, doublesMatches, doublesWins, doublesLosses` | Spieler aktualisieren |
| `addMatch` | `date, type, winnerId, loserId, winnerName, loserName, eloChange` | Match speichern |

## Features

- **Einzel-ELO:** Klassisches ELO-Rating (K-Faktor 32, Startwert 1000)
- **Doppel-ELO:** Separates ELO-Rating für Doppelspiele (Team-Durchschnitt)
- **Offline-Fallback:** Daten werden lokal im Browser (localStorage) gecacht
- **Rangliste:** Getrennte Ranglisten für Einzel und Doppel
- **Spielverlauf:** Chronologische Match-History
- **Konfetti:** Beim Eintragen eines Matches 🎉

## Entwicklung

Branches folgen dem Schema `feature/<beschreibung>`. Öffne einen Pull Request gegen `main`.
