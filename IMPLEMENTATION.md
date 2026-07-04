# Brick-Breaker — Implementation Checklist

Numbered task list grouped by phase. Each task is one PR-sized chunk with file paths.

---

## Phase P1 — Scaffold (PR 1)

- [ ] **1.1** Init repo at `brickbreaker/`, `npm init`, install: `three`, `vite`, `vitest`, `@playwright/test`, `eslint`, `prettier`, `wrangler`, `@cloudflare/workers-types`
- [ ] **1.2** `package.json` scripts: `dev`, `build`, `preview`, `test`, `test:e2e`, `lint`, `format`, `deploy:worker`
- [ ] **1.3** `vite.config.js` — base `/`, server port 5173
- [ ] **1.4** `index.html` — canvas#game + HUD container + script tag `src/main.js`
- [ ] **1.5** First failing test: `tests/unit/score-calculator.test.js` (test: `addPoints(100) → 100`)
- [ ] **1.6** `.eslintrc.cjs` + `.prettierrc`
- [ ] **1.7** `.github/workflows/ci.yml` — lint + test + build on push/PR
- [ ] **1.8** `.gitignore` — node_modules, dist, .env*, .wrangler/
- [ ] **1.9** Create GH repo `dhiraj-salian/brickbreaker`, push initial commit
- [ ] **1.10** Cloudflare Pages project `brickbreaker` (via dashboard OR `wrangler pages project create brickbreaker`)

## Phase P2 — Core (TDD, one PR per module)

- [ ] **2.1** `src/core/game-state.js` + `tests/unit/game-state.test.js` — `createInitialState()`, `startGame()`, `pause()`, `resume()`, `loseLife()`, `winLevel()`. Pure functions.
- [ ] **2.2** `src/core/physics-stepper.js` + tests — `stepPhysics(state, dt)`: ball moves, walls bounce, paddle lerps, shake/flash decay.
- [ ] **2.3** `src/core/collision-detector.js` + tests — `detectCollisions(state) → events[]`: ball-brick (swept circle-AABB), ball-paddle (with spin), ball-wall.
- [ ] **2.4** `src/core/brick-grid.js` + `src/levels/level-1.json` + tests — `parseLayout(rows) → bricks[]`, `createGrid(layout)`.
- [ ] **2.5** `src/core/paddle-controller.js` + tests — `updatePaddle(state, targetX, dt)`: lerp toward target, clamp to bounds.
- [ ] **2.6** `src/core/ball-controller.js` + tests — `attachToPaddle()`, `launch()`, `splitBall(ball)`.
- [ ] **2.7** `src/core/score-calculator.js` (already covered by 1.5 first failing test — now make it pass with combo logic)
- [ ] **2.8** `src/core/combo-system.js` + tests — `registerHit(state)` increments combo if within 1.5s window, else resets.

## Phase P3 — Render (PR 8)

- [ ] **3.1** `src/render/scene.js` — `createScene()` returns `{ scene, camera, renderer }`. Orthographic camera, aspect-aware.
- [ ] **3.2** `src/render/paddle-mesh.js` — factory returns mesh from paddle state.
- [ ] **3.3** `src/render/ball-mesh.js` — factory returns mesh (or `InstancedMesh` for multi-ball).
- [ ] **3.4** `src/render/brick-mesh.js` — `InstancedMesh` with vertex colors per brick type.
- [ ] **3.5** `src/render/camera-controller.js` — follow ball Y with deadzone, shake offset.
- [ ] **3.6** `src/main.js` — bootstrap: create scene, load level 1, wire game loop with fixed-step accumulator.

## Phase P4 — UX (PR 9)

- [ ] **4.1** `src/ui/hud.js` — DOM overlay (score, lives, level, combo, pause button). Subscribes to state changes.
- [ ] **4.2** `src/ui/input.js` — `InputManager` unifying keyboard + touch + mouse.
- [ ] **4.3** Pause on tab `visibilitychange` (HTML) + `Escape`/`P` key.
- [ ] **4.4** Restart on `R` key.
- [ ] **4.5** Fullscreen button (browser Fullscreen API).
- [ ] **4.6** `src/ui/menus.js` — main menu (start), game-over screen (restart), win screen (leaderboard form).

## Phase P5 — Juice (PR 10)

- [ ] **5.1** `src/render/particles.js` — pool of 200 particles, `emit(position, count, color)`, `update(dt)`.
- [ ] **5.2** Particle emit on brick break (6 particles, random outward velocity).
- [ ] **5.3** Camera shake on life loss + brick break.
- [ ] **5.4** Screen flash on life loss (white overlay div, fade out).
- [ ] **5.5** `src/audio/sfx.js` — WebAudio oscillator beeps: paddle-hit, brick-break, wall-bounce, life-loss, power-up.
- [ ] **5.6** Haptics: `navigator.vibrate(50)` on brick break (mobile only).

## Phase P6 — Depth (PR 11)

- [ ] **6.1** `src/core/power-up-system.js` + `src/core/interfaces/power-up.js` — 10% drop chance, falling power-ups, paddle catch.
- [ ] **6.2** `src/core/power-ups/multi-ball.js`, `expand-paddle.js`, `slow-ball.js`, `laser.js` (laser is stretch).
- [ ] **6.3** ARMORED brick type (2-3 HP, color shift on hit).
- [ ] **6.4** UNBREAKABLE brick type (gray, bounces).
- [ ] **6.5** `src/levels/level-2.json`, `level-3.json` — varied layouts.
- [ ] **6.6** Combo display in HUD (`x2 COMBO!` flash).

## Phase P7 — Worker (PR 12)

- [ ] **7.1** `worker/src/index.js` — POST /scores (HMAC verify), GET /scores (top 10), CORS, rate limit.
- [ ] **7.2** `worker/wrangler.toml` — name `brickbreaker-leaderboard`, KV binding `SCORES`.
- [ ] **7.3** Create KV namespace: `wrangler kv:namespace create SCORES`.
- [ ] **7.4** `worker/test/index.test.js` — Vitest with `@cloudflare/vitest-pool-workers` for worker unit tests.
- [ ] **7.5** `src/net/leaderboard.js` — `submitScore(name, score)`, `fetchTopScores(limit)`. HMAC sign.
- [ ] **7.6** UI: name prompt on win, top-10 display on main menu + game over.

## Phase P8 — Ship (PR 13)

- [ ] **8.1** `.github/workflows/deploy.yml` — Pages deploy + Worker deploy on tag `v*`.
- [ ] **8.2** Document GH secrets in README: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `VITE_HMAC_SECRET`.
- [ ] **8.3** `wrangler secret put HMAC_SECRET` (manually by Dhiraj).
- [ ] **8.4** `README.md` — controls, features, screenshot, live URL, dev setup, deploy.
- [ ] **8.5** Add screenshot to `docs/screenshot.png`.
- [ ] **8.6** Tag `v0.1.0` → trigger deploy.

## Phase P9 — Verify (atlas)

- [ ] **9.1** Confirm Pages deploy at `https://brickbreaker.pages.dev`.
- [ ] **9.2** Confirm Worker at `https://brickbreaker-leaderboard.<account>.workers.dev` responds.
- [ ] **9.3** Playwright smoke test against live URL (game loads, paddle moves, ball breaks brick, score submits).
- [ ] **9.4** Take screenshot, attach to final message.
- [ ] **9.5** Send live URL + screenshot to Dhiraj via WhatsApp + save to self-growth.

---

## Progress Tracking

Update this file as tasks complete. Add commit hashes where applicable.

| Task | Status | Commit |
|---|---|---|
| 1.1–1.10 (scaffold) | pending | — |
| 2.1–2.8 (core) | pending | — |
| 3.1–3.6 (render) | pending | — |
| 4.1–4.6 (ux) | pending | — |
| 5.1–5.6 (juice) | pending | — |
| 6.1–6.6 (depth) | pending | — |
| 7.1–7.6 (worker) | pending | — |
| 8.1–8.6 (ship) | pending | — |
| 9.1–9.5 (verify) | pending | — |
