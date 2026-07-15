# Checkpoint 012 — Auth First Screen

**Date:** 2026-07-15 18:20 IST
**Branch:** `feat/auth-first-screen` (off `main`, v0.5.0)
**Status:** ✅ Complete (local, not pushed)

## What changed

Moved login/register UI from a sub-section of `#menu-overlay` to a new full-screen `#auth-screen` overlay that gates all game access. Canvas, menu, leaderboard panel, and HUD are hidden until the user authenticates or chooses "Continue as Guest".

## Files changed

| File | Change |
|---|---|
| `src/ui/auth-screen.js` | **NEW** — Auth screen state machine: show/hide, tab switcher (LOGIN ↔ REGISTER), form submit, error display, guest link, loading state |
| `index.html` | Added `#auth-screen` overlay markup + CSS before `#game-container`. Removed auth form (inputs, login/register buttons) from `#menu-overlay` — kept logged-in state (username + logout). Menu no longer starts with `active` class. |
| `src/main.js` | Wired `createAuthScreen()` into boot. Added `authReady` gate so HUD overlays don't render during auth. `initAuth()` now shows auth screen when no session, or shows menu when session valid. Logout returns to auth screen. `onSignIn` CTA shows auth screen instead of menu. Removed `onLogin`/`onRegister` from `setupButtons` (handled by auth-screen). |
| `src/ui/hud.js` | Removed login/register/enter-key wiring from `setupButtons`. `updateAuthUI` no longer references `#auth-form` (only toggles logged-in state). `showAuthError` now writes to `#auth-error` on auth screen. |
| `tests/unit/auth-screen.test.js` | **NEW** — 25 unit tests for auth-screen module (show/hide, tab switching, login submit, register submit, guest mode, error display, loading state, network errors) |
| `tests/unit/hud-identity.test.js` | Updated DOM stub to match new structure (no `#auth-form` in menu). Added 4 `updateAuthUI` tests. Total: 13 tests. |
| `tests/e2e/auth-identity.spec.js` | Rewritten for new flow: app starts at auth screen, register/login/guest/logout flows, sign-in CTA shows auth screen, responsive centering + touch target tests. 19 tests. |
| `tests/e2e/reachability.spec.js` | Updated to use guest flow before interacting with game. |
| `tests/e2e/smoke.spec.js` | Updated to use guest flow. Tests auth screen → guest → menu → start. |
| `tests/e2e/screenshot.spec.js` | Updated to use guest flow. Added auth screen screenshot. |

## Test counts

- **Unit:** 201 tests (22 files) — ✅ all pass
  - New: 25 (auth-screen.test.js) + 4 (updateAuthUI tests in hud-identity.test.js) = 29 new
  - Existing: 172 unchanged
- **E2E (Playwright):** 27 tests (4 files) — ✅ all pass
  - New: 19 (auth-identity.spec.js rewritten) + 8 (reachability/smoke/screenshot updated)
- **Total: 228 tests, all green**

## Boot sequence (new)

1. App boots → `authReady = false`, HUD render gated off
2. Check `localStorage` for session token:
   - **No token** → show `#auth-screen` (game-container hidden)
   - **Valid token** → `GET /auth/me` → success: `authReady = true`, show menu; failure: show auth screen
   - **Network error** → keep session, `authReady = true`, show menu (graceful degradation)
3. User logs in / registers → `authScreen.hide()` + `authReady = true` + `hud.showMenu()`
4. User clicks "Continue as Guest" → same as above but no identity
5. User clicks logout → `authReady = false` + menu hidden + `authScreen.show()`

## UX decisions & tradeoffs

1. **Full-screen overlay vs inline form:** Chose full-screen `position: fixed; z-index: 100` to completely cover canvas + menu. Prevents visual bleed and makes the auth moment feel intentional.
2. **`display: none` vs `opacity: 0` for game-container:** Used `display: none` — canvas and menu are fully removed from layout, not just invisible. This prevents any interaction with game elements during auth.
3. **`authReady` gate on HUD render:** The HUD's `render()` function calls `showOverlay()` which toggles `active` class on `#menu-overlay`. Without the gate, the first frame would activate the menu behind the auth screen. The gate prevents this.
4. **Menu no longer starts with `active` class in HTML:** Menu activation is now driven by `hud.showMenu()` which is called after auth resolves. This avoids a flash of menu before auth screen covers it.
5. **Tabbed LOGIN/REGISTER vs separate forms:** Tabs save vertical space on mobile and reduce form fatigue. Single submit button changes text based on active tab.
6. **`Continue as Guest` link:** Styled as understated text link (not a primary button) — visually communicates "this is the secondary option" while still being ≥44px touch target.
7. **No focus trap implementation:** The auth screen uses `role="dialog"` and `aria-modal="true"` but a full focus trap (capturing Tab key to cycle within the dialog) is not implemented. This is a minor accessibility gap — the dialog has only 5 focusable elements, so Tab cycling is less critical. Can be added later if needed.
8. **Sign-in CTA from gameover/win now shows auth screen (not menu):** Previously these CTAs jumped to the menu where the auth form lived. Now they show the full-screen auth overlay, which is more consistent and lets the user log in without menu clutter.

## Playwright viewport coverage

Tests cover these viewports:
- **Mobile:** 375×667 (iPhone SE / small Android) — centering, no horizontal scroll, touch targets ≥44px
- **Desktop:** 1280×800 — centering, card max-width ~420px, no horizontal scroll
- **Mobile screenshot:** 390×844 (iPhone 14)

Not covered (deferred):
- Tablet (768×1024) — likely fine due to clamp() fluid sizing, but no explicit test
- Landscape mobile — CSS uses `@media (max-height: 600px)` for leaderboard panel but auth screen isn't affected
- Ultra-wide (>1920px) — auth card max-width caps at 420px, should be fine

## Local verification steps

```bash
cd ~/.openclaw/workspace/brickbreaker
npm run lint        # ✅ clean
npm run build      # ✅ clean
npx vitest run     # ✅ 201 tests pass
npx playwright test # ✅ 27 tests pass (needs Chromium)

# Dev server (manual UX check):
npm run dev
# Desktop: open http://localhost:5173 — should see centered auth card
# Mobile: use DevTools device toolbar (375px) — card should be fluid, touch targets ≥44px
# Test: login → menu appears → start game → play → game over
# Test: guest mode → menu appears (anonymous) → play
# Test: logout → returns to auth screen
```

## No worker changes

All `/auth/*` endpoints stay the same. No new endpoints. No data migration. The legacy `/leaderboard/scores` path still works for guest mode.
