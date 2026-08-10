# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies (chart.js + vitest/jsdom)
npm start          # serve on http://localhost:3000
npm test           # run all tests once
npm run test:watch # run tests in watch mode

# run a single test file
npx vitest run src/elo.test.js

npm run vendor:chart      # re-copy chart.umd.js from node_modules after a version bump
node scripts/make-icons.mjs   # regenerate the PNG icons
```

No build step. **Do not open `index.html` via `file://`** — the app loads as an ES module and browsers block module imports over that scheme. Always serve it.

## Architecture

No-bundler ES-module SPA. Modules load via `<script type="module">` in `index.html`. Chart.js ships locally in `vendor/` and is injected as a classic script on first chart render.

**Layer order (strict dependency direction):**

```
elo.js → match.js → replay.js → state.js → ui.js → app.js
                                    ↑
              api.js  branding.js  streaks.js  chart.js  format.js
```

- **`src/elo.js`** — pure ELO math, no side effects. K=32, start ELO=1000. Doubles use average team ELO.
- **`src/match.js`** — the single place that decides what a match *means*: type, winner/loser IDs, doubles detection, and the legacy column-shift correction from old Google Sheets exports. Also owns `compareMatches` (date, then id as tie-break). Dependency-free.
- **`src/replay.js`** — the single chronological replay of match history. Owns the iteration and the ELO bookkeeping and emits one event per valid match. Both `state.js` (stats) and `chart.js` (curves) consume it, which is what guarantees the chart's endpoint equals the ranking's value.
- **`src/api.js`** — all Supabase REST calls. Call `initApi(url, key, secret)` first. Owns camelCase↔snake_case mapping. Appends `x-app-secret` on every request when a secret is set.
- **`src/state.js`** — the mutable `state` object plus localStorage. `recalculateStatsFromHistory()` replays everything; `applyMatch` / `revertMatch` / `removeMatchById` wrap it.
- **`src/format.js`** — de-DE date/time formatting and German pluralisation.
- **`src/ui.js`** — pure DOM rendering. Never calls the API or mutates state; callbacks are registered once via `initUi()`.
- **`src/chart.js`** — Chart.js wrappers. Both render functions are **async** because the library is loaded on demand — always `.catch()` them.
- **`src/streaks.js`** — current/longest streaks, via `match.js` so it agrees with the ranking.
- **`src/branding.js`** — `applyBranding()` sets CSS custom properties, title, meta tags and a runtime manifest. `brandColor()` is the shared accessor for JS that needs the accent colour.
- **`src/demo.js`** — sample players and matches for `?demo=true`. Deliberately carries no precomputed stats and no `eloChange`.
- **`app.js`** — orchestration only. Wires delegated listeners, calls the API, updates state, then renders.

## Configuration

`config.js` is **gitignored** — never commit it. Copy `config.example.js` → `config.js`:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — from Supabase project settings
- `APP_SECRET` — write-protection password, sent as the `x-app-secret` header
- `BRANDING` — optional white-label overrides

`CONFIG` is declared with `var` (not `const`) so it is a global before ES modules load.

For GitHub Pages, `config.js` is generated in `deploy.yml` from repository secrets.

## Key Invariants

- **Match history is the source of truth for ELO**, never the stored player values. Call `recalculateStatsFromHistory()` after any load, add, or delete, then push only the players whose stats actually changed.
- **Never interpret a match inline.** Use `normaliseMatch()` from `match.js`. Hand-rolled `winnerId.includes(',')` checks are how the views drifted apart before.
- **Never sort matches by date alone.** Use `compareMatches` / `sortMatchesAsc` — ELO is not commutative, so a missing tie-break makes the ranking non-deterministic across reloads.
- **In `request()`, destructure `headers` out of `options` before spreading.** Putting `...options` after `headers:` silently drops apikey, Authorization and `x-app-secret` on every mutation.
- **Check for an empty response body, not for status 204.** PostgREST answers POST with 201.
- **Take the match `id` from the server.** `matches.id` is BIGSERIAL; a locally invented id makes a later DELETE match zero rows, which PostgREST reports as success.
- **Player names are untrusted text.** Render them with `textContent` or DOM nodes — never `innerHTML`. `src/ui.test.js` guards this.
- **No inline event handlers in HTML.** The CSP sets `script-src 'self'` without `'unsafe-inline'`; adding an `onclick` attribute breaks the page.
- **Doubles** store `winnerId`/`loserId` as comma-separated ID strings (`"id1,id2"`).
- The service worker (`sw.js`, cache key `eloapp-v2`) serves same-origin files stale-while-revalidate. Add new static files to `CORE_ASSETS` and bump the cache key. Third-party URLs belong in `OPTIONAL_ASSETS` — a failure there must not abort the install.
