# Project State — brickbreaker

> **Single source of truth** for where this project is right now. Read this first in any session.

Last updated: 2026-07-15 12:22 IST
Current checkpoint: 010-auth-deployed
Current branch: main (tracking origin/main)
CI status: ✅ passing on commit 9288c84
Live URLs: https://brick-breaker.dhirajsalian.com (custom domain)
GitHub: https://github.com/dhiraj-salian/brick-breaker

## Done

- [x] **000-bootstrap** (2026-07-04) — Vite + Three.js + Vitest + Playwright scaffold.
- [x] **001-core** (2026-07-04) — Game state, paddle, ball, bricks, collision, physics (TDD).
- [x] **002-render** (2026-07-04) — Three.js scene, camera, lighting, materials.
- [x] **003-ux** (2026-07-04) — HUD, input (mouse + touch + keyboard), pause, restart, fullscreen.
- [x] **004-juice** (2026-07-04) — Particles, screen shake, sound, haptics.
- [x] **005-depth** (2026-07-04) — Power-ups, brick types, levels, combo.
- [x] **006-leaderboard** (2026-07-04) — Cloudflare Worker leaderboard, HMAC signing, KV store.
- [x] **007-deploy** (2026-07-05) — GH Actions deploy to Cloudflare Pages + Workers.
- [x] **008-gameplay-bugs** (2026-07-05) — Fixed world width, finish freeze, score autosave (commit `8b6d281`).
- [x] **009-auth** (2026-07-15 12:05) — Username/password auth on top of leaderboard (commit `9288c84`).
- [x] **010-auth-deployed** (2026-07-15 12:22) — Created Cloudflare USERS KV namespace, fixed wrangler.toml placeholder, redeployed as `v0.4.1` (commit `c809b5c`). Live at `https://brickbreaker-leaderboard.admin-dbldr.workers.dev`.

## In Progress

- (none)

## Next

- [ ] **010-e2e-tests** — Playwright e2e coverage for auth flow (register → login → submit score)
- [ ] **011-migrate-existing-scores** — Decide whether to migrate the pre-auth leaderboard (anonymous names) to authenticated users or leave both APIs running
- [ ] **012-password-reset** — Add /auth/forgot + /auth/reset endpoints (currently no recovery path)
- [ ] **013-session-refresh** — Tokens expire silently today; add refresh-token rotation

## Blocked / Open Questions

- (none)

## Key paths (for resume)

| What | Where |
|---|---|
| Plan (this checkpoint) | `~/.openclaw/workspace/plans/brickbreaker-auth-2026-07-15.md` |
| Plan (Three.js rebuild) | `~/.openclaw/workspace/plans/brickbreaker-threejs-cloudflare-2026-07-04.md` |
| Plan (Unity, superseded) | `~/.openclaw/workspace/plans/brick-breaker-responsive-features-2026-06-29.md` |
| Architecture doc | `~/.openclaw/workspace/brickbreaker/docs/ARCHITECTURE.md` |
| State (this file) | `~/.openclaw/workspace/brickbreaker/PROJECT_STATE.md` |
| Implementation checklist | `~/.openclaw/workspace/brickbreaker/IMPLEMENTATION.md` |
| Game source | `~/.openclaw/workspace/brickbreaker/src/` |
| Worker source | `~/.openclaw/workspace/brickbreaker/worker/` |
| CI/CD workflows | `~/.openclaw/workspace/brickbreaker/.github/workflows/` |
| Git hooks | `~/.openclaw/workspace/brickbreaker/.githooks/` |
| GitHub remote | `git@github.com:dhiraj-salian/brick-breaker.git` |

## GitHub repo secrets (already configured)

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CORS_ALLOW_ORIGIN` = `https://brick-breaker.dhirajsalian.com`
- `HMAC_SECRET` (shared with worker via `wrangler secret put`)
- `VITE_HMAC_SECRET` (build-time, same value)
- `VITE_LEADERBOARD_URL` = worker URL
- KV namespace IDs wired into deploy workflow
  - `SCORES`: prod `317dc0d4062845c99dfdc36589099ca4` / preview `9c51a11ec0eb4d1280eef3b6de3a9e00`
  - `USERS`: prod `180cccc80e5b49cb8c28ff971192f59e` / preview `9401a393b8f74f518369fb7562bf8c2e` (added 2026-07-15)
  - Worker URL: `brickbreaker-leaderboard.admin-dbldr.workers.dev`

## Auth endpoints (added in checkpoint 009)

| Endpoint | Method | Purpose |
|---|---|---|
| `/auth/register` | POST | username + password → 201, stores salt+hash in KV `USERS` |
| `/auth/login` | POST | username + password → 200 + signed session token |
| `/auth/logout` | POST | invalidates token (client-side; no server blacklist yet) |
| `/auth/me` | GET | returns username from valid token |
| `/auth/scores` | POST | authenticated score submission (username from token, not body) |
| `/leaderboard/scores` | POST | **legacy** anonymous score submission (still active for backwards compat) |

## Recent commits

```
c809b5c fix(worker): use real USERS KV namespace IDs (v0.4.1)
9288c84 feat(auth): username/password auth for leaderboard (v0.4.0)
8b6d281 fix: 3 gameplay bugs — world width, finish freeze, score autosave
6fee1b2 feat: leaderboard panel + mute + better SFX + ball-stuck fix
ba2d87e ci: switch deploy workflow to wrangler pages deploy (production routing)
2576d74 fix(mobile): crash bug, viewport fit, enhanced graphics
be25953 feat(worker): multi-origin CORS support
```
