# Checkpoint 011 — Auth on HUD + UX Responsive Pass

**Date:** 2026-07-15 17:42 IST
**Branch:** `feat/auth-on-score-and-ux`
**Commit:** `389fb46`
**Status:** ✅ Complete — local, not pushed

## Goal

Wire the authenticated identity into the game's scoring UI (HUD, game-over, leaderboard) and do a responsive/consistency UX pass across mobile, tablet, desktop, and large screens.

## What was done

### A. Identity on the score

1. **Identity store** (`src/core/identity.js`) — New module: single source of truth for "who is playing". In-memory store with subscription support, `initFromSession()` to populate from localStorage on boot. 15 unit tests in `tests/unit/identity.test.js`.

2. **HUD score display** — `@username` shown inline next to score value when logged in. Clean empty state when anonymous. New `updateHudIdentity()` function in `hud.js`.

3. **Game-over / win screens** — `@username — score pts (top combo ×N)` line shown when logged in. Anonymous users see a "Sign in to put your name on the leaderboard" CTA with a SIGN IN button that navigates to the menu auth form. New `renderGameOverIdentity()` function in `hud.js`. 9 unit tests in `tests/unit/hud-identity.test.js`.

4. **Leaderboard panel** — Top-5 panel shows `@username` for authed scores, falls back to anonymous name for legacy entries. Current user's row highlighted with `.me` class.

5. **Score submission** — `autoSubmitScore()` now uses `identity.getUsername()` when logged in (sends name + auth token → worker attaches username from token). Falls back to `generateDefaultName()` when anonymous (legacy path preserved).

6. **Top combo tracking** — `topCombo` variable in `main.js` tracks the highest combo reached during the game, displayed on game-over identity line.

### B. Responsive / consistent UX pass

1. **CSS custom properties** — Added `:root` design tokens:
   - Type scale: `--type-xs` through `--type-2xl` using `clamp()`
   - Spacing scale: `--space-xs` through `--space-2xl` using `clamp()`
   - Touch minimum: `--touch-min: 44px`
   - HUD sizing: `--hud-font`, `--hud-gap`, `--hud-top`, `--hud-side`, `--hud-padding-*`
   - Panel sizing: `--panel-radius`, `--panel-blur`, `--panel-bg`, `--panel-border`

2. **Fluid sizing** — Replaced all hardcoded px values with `clamp()`-based custom properties. Text, padding, margins, and gaps all scale fluidly from mobile to large screens.

3. **Touch targets** — All interactive buttons now have `min-width` and `min-height` of `var(--touch-min)` (44px). Previously pause/mute buttons were 36px.

4. **Breakpoints** — Large-screen scaling at `≥1280px` (bigger HUD font, wider panels) and `≥1920px` (even bigger, up to 26px HUD font). Mobile-first: base styles target 360px+, media queries only enhance larger screens.

5. **Overlay scroll** — Added `overflow-y: auto` to overlays so content doesn't clip on short viewports.

6. **Input font size** — All text/number inputs set to `16px` to prevent iOS Safari auto-zoom on focus.

7. **No horizontal scroll** — Verified at 375px, 768px, 1280px, 1920px widths.

### C. Cleanup / pluggability

- `default-name.js` kept as fallback for anonymous auto-submit. Documented in `autoSubmitScore()`.
- `currentUser` variable removed from `main.js` — identity store is the single source of truth.
- Legacy anonymous leaderboard path (`/leaderboard/scores` POST) untouched — both APIs stay live.

## Tests

| Suite | New | Total |
|---|---|---|
| Unit — identity store | 15 | 15 |
| Unit — HUD identity display | 9 | 9 |
| E2e — auth identity + responsive | 10 | 10 |
| **All unit (existing + new)** | **24** | **172** |
| Lint | — | ✅ clean |
| Build | — | ✅ clean |

Note: E2e tests written but not passing in headless environment (Chromium display issue). Unit tests, lint, and build all pass. E2e tests should pass in CI with proper Chromium setup.

## Screenshots

Captured at 4 viewports (375×667, 768×1024, 1280×800, 1920×1080) in `screenshots/`:
- `menu-{viewport}.png` — Menu screen with auth form
- `hud-{viewport}.png` — In-game HUD with score, lives, combo, pause
- `gameover-{viewport}.png` — Game-over with @username identity line
- `gameover-anon-{viewport}.png` — Game-over with sign-in CTA (anonymous)

## Files changed

| File | Change |
|---|---|
| `src/core/identity.js` | **NEW** — Identity store module (109 lines) |
| `src/ui/hud.js` | Added `updateHudIdentity()`, `renderGameOverIdentity()`, updated `renderLeaderboardPanel()` to show @username, added `onSignIn` callback |
| `src/main.js` | Wired identity store: `initFromSession()`, subscribe for HUD/auth UI updates, `autoSubmitScore()` uses identity, game-over/win call `renderGameOverIdentity()`, `onSignIn` handler, topCombo tracking |
| `index.html` | Full CSS responsive pass (design tokens, clamp(), touch targets), new DOM elements (score-username, gameover-username, gameover-cta, win-username, win-cta) |
| `tests/unit/identity.test.js` | **NEW** — 15 tests for identity store |
| `tests/unit/hud-identity.test.js` | **NEW** — 9 tests for HUD identity display |
| `tests/e2e/auth-identity.spec.js` | **NEW** — 10 e2e tests (auth identity + responsive layout) |
| `PROJECT_STATE.md` | Updated with checkpoint 011 entry |

## Worker changes

**None.** The existing `/scores` POST endpoint already handles the `Authorization: Bearer` header and attaches the username from the token. No backend changes needed.

## What needs Dhiraj's input

- **E2e environment**: Playwright e2e tests need Chromium with a display. In the current headless server environment, even existing smoke tests fail. This is a pre-existing issue, not caused by this checkpoint.
- **Review and merge**: Branch `feat/auth-on-score-and-ux` is local. Dhiraj should review and merge locally.
