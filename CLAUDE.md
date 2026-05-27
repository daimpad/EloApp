# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dev dependencies (vitest only)
npm test           # run all tests once
npm run test:watch # run tests in watch mode

# run a single test file
npx vitest run src/elo.test.js
```

No build step. Open `index.html` directly in a browser or serve it statically.

## Architecture

The app is a no-bundler ES-module SPA. Modules load via `<script type="module">` in `index.html`; Chart.js comes from CDN ESM.

**Layer order (strict dependency direction):**

```
elo.js → api.js → state.js → ui.js → app.js
                    ↑
         branding.js  streaks.js  chart.js  demo.js
```

- **`src/elo.js`** — pure ELO math, no side effects. K=32, start ELO=1000. Doubles use average team ELO.
- **`src/api.js`** — all Supabase REST calls. Must call `initApi(url, key, secret)` first. Owns camelCase↔snake_case mapping. Appends `x-app-secret` header on every request when secret is set.
- **`src/state.js`** — single mutable `state` object (`players`, `matches`, `selectedPlayers`, `currentGameMode`). `recalculateStatsFromHistory()` replays all matches chronologically to recompute every player stat — call this after any match add/delete to avoid drift. localStorage is the offline cache layer.
- **`src/ui.js`** — pure DOM rendering. Takes callbacks for interactive elements (e.g. `renderRankings(onRowClick)`). Never calls API or mutates state directly.
- **`src/chart.js`** — Chart.js 4 wrappers. `renderEloChart()` for global view, `renderPlayerChart()` for profile modal.
- **`src/streaks.js`** — calculates current/longest win-loss streaks from `state.matches` for a given player.
- **`src/branding.js`** — `applyBranding(branding)` sets CSS custom properties on `:root` and updates `<title>`, `<h1>`, meta tags. All brand values flow from `config.js`.
- **`src/demo.js`** — hardcoded sample players and matches for `?demo=true` mode.
- **`app.js`** — orchestration only. Wires up events, calls API, updates state, then calls render functions. Also exposes certain functions on `window.*` for HTML `onclick` attributes.

## Configuration

`config.js` is **gitignored** — never commit it. Copy `config.example.js` → `config.js` and fill in:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — from Supabase project settings
- `APP_SECRET` — write-protection password, sent as `x-app-secret` header
- `BRANDING` — optional white-label overrides (name, colors, fonts)

`CONFIG` is declared with `var` (not `const`) so it's available in global scope before ES modules load.

## Key Invariants

- **ELO source of truth is the match history**, not the stored player ELO values. Always call `recalculateStatsFromHistory()` after loading or deleting matches.
- **Doubles matches** store `winnerId`/`loserId` as comma-separated player ID strings (`"id1,id2"`). Check for commas before parsing.
- **Write operations** require `APP_SECRET`; reads are public. Supabase RLS enforces this via the `x-app-secret` header.
- The service worker (`sw.js`, cache key `eloapp-v1`) uses cache-first for static assets and network-first for Supabase/CDN. Bump the cache version string when adding new static files to `STATIC_ASSETS`.
