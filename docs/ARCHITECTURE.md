# Brick-Breaker — Architecture (Three.js + Cloudflare)

Status: draft | Last updated: 2026-07-04

---

## Decision Log

- **Repo:** NEW repo `dhiraj-salian/brickbreaker` (clean slate; the old Unity code in `brick-breaker` repo is from 2022 and not referenced anywhere — user said "from scratch").
- **Live URL:** `https://brickbreaker.pages.dev` (Cloudflare default — zero DNS config). Custom domain deferred to v2.
- **Stack:** Three.js (vanilla), Vite, Cloudflare Pages (static), Cloudflare Workers + KV (leaderboard), GitHub Actions (CI/CD), Vitest + Playwright (tests).

---

## 1. Tech Stack Rationale

**Renderer: Three.js (vanilla, no R3F)**

- Game ships as a static bundle. R3F adds ~150KB gzipped for zero runtime benefit on a small physics game.
- Three.js alone gives us scene graph, camera, meshes, lights, render loop.
- Single dep: `three`. Build output under ~500KB.

**Build: Vite**

- Dev server with HMR, production build with Rollup, zero config.
- `vite.config.js` sets `base: "/"` (Cloudflare Pages serves from root).

**Hosting: Cloudflare Pages**

- Free tier: unlimited static requests, 500 builds/month.
- Auto-detects Vite. Deploys from GH via `cloudflare/pages-action`.

**Backend: Cloudflare Workers + KV**

- Free tier: 100K req/day, 100K KV reads, 1K writes — way more than needed.
- Leaderboard needs persistence (top-10 scores) and HMAC verification.

**CI/CD: GitHub Actions**

- Lint + unit + build on every push/PR.
- Deploy Pages + Worker on tag `v*` or manual dispatch.

**Testing: Vitest + Playwright**

- Vitest for unit (pure logic in `core/`).
- Playwright for e2e (game loads, controls respond, brick breaks).

---

## 2. Directory Layout

```
brickbreaker/
  src/
    core/                # pure logic, NO three.js imports
      game-state.js      # state shape + transitions
      physics-stepper.js # fixed-step ball/paddle motion
      collision-detector.js
      brick-grid.js      # level → brick array
      paddle-controller.js
      ball-controller.js # multi-ball, paddle-attach on life loss
      power-up-system.js
      combo-system.js
      score-calculator.js
      interfaces/
        power-up.js      # PowerUp interface contract
    render/              # three.js, NO game logic
      scene.js           # Scene + camera + lights
      paddle-mesh.js
      ball-mesh.js
      brick-mesh.js      # InstancedMesh for bricks
      particles.js       # particle pool
      camera-controller.js # follow + shake
    ui/                  # DOM overlays
      hud.js
      menus.js
      input.js           # keyboard + touch + mouse unified
    net/
      leaderboard.js     # fetch wrapper + HMAC sign
    main.js              # bootstrap
    levels/
      level-1.json
      level-2.json
      level-3.json
  worker/
    src/index.js
    wrangler.toml
  public/
    sounds/              # CC0 SFX (freesound.org)
  tests/
    unit/                # Vitest
    e2e/                 # Playwright
  index.html
  vite.config.js
  package.json
  .eslintrc.cjs
  .prettierrc
  .github/workflows/
    ci.yml
    deploy.yml
  docs/
    ARCHITECTURE.md
  IMPLEMENTATION.md
  README.md
```

**Boundaries**

- `src/core/` never imports from `render/`, `ui/`, or `net/`.
- `src/render/` is a pure consumer of `core/` state. It reads state each frame and updates meshes. No game logic.
- `src/ui/` reads state via a tiny subscription API and writes to DOM. No three.js.
- `src/net/` is the only module that calls `fetch`.
- `worker/` is a standalone deployable. Zero code sharing with `src/`.

---

## 3. GameState Shape

```js
// src/core/game-state.js
export const STATUS = Object.freeze({
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost',
});

export const BRICK_TYPE = Object.freeze({
  NORMAL: 'normal',
  ARMORED: 'armored', // 2-3 hits
  UNBREAKABLE: 'unbreakable',
});

export const POWER_UP_TYPE = Object.freeze({
  MULTI_BALL: 'multi_ball',
  EXPAND_PADDLE: 'expand_paddle',
  SLOW_BALL: 'slow_ball',
  LASER: 'laser', // stretch
});

export function createInitialState(level = 1) {
  return {
    status: STATUS.MENU,
    level,
    score: 0,
    lives: 3,
    combo: 0,
    comboTimer: 0, // seconds remaining in combo window
    paddle: { x: 0, y: -8, width: 2.4, targetWidth: 2.4 },
    balls: [], // populated on launch
    bricks: [], // populated from level config
    powerUps: [], // falling power-ups
    activeEffects: [], // { type, remaining }
    shake: { intensity: 0, decay: 0 },
    flash: 0, // 0..1 white overlay alpha
  };
}
```

State transitions are pure functions:

- `startGame(state)` — MENU → PLAYING, attach ball to paddle
- `pause(state)`, `resume(state)`
- `loseLife(state)` — decrement lives, if 0 → LOST, else reset ball
- `winLevel(state)` — if no levels left → WON, else load next

---

## 4. Game Loop

**Timestep**

- Fixed 60Hz (16.67ms per tick).
- `requestAnimationFrame` drives the render loop.
- Accumulator pattern: `accumulator += dt; while (accumulator >= STEP) { step(state, STEP); accumulator -= STEP; }`
- Max 5 steps per frame to avoid spiral-of-death after tab-switch lag.

**Frame order**

1. Read input → update paddle target X + launch intent
2. Fixed-step physics + collisions (one or more times)
3. Update particles, camera shake, combo timer
4. Render: scene + HUD

---

## 5. Physics + Collision

**Constants**

- World coords: y ∈ [-10, 10], x ∈ [-aspect*10, aspect*10].
- Ball radius: 0.3.
- Paddle y: -8, height: 0.4.
- Ball base speed: 12 units/sec, +5% per level.

**Pure functions**

```js
// src/core/physics-stepper.js
export function stepPhysics(state, dt) {
  // Move paddle toward targetX with lerp
  // Move each ball: pos += vel * dt
  // Bounce off walls (left/right/top)
  // Apply active effects (e.g. SLOW_BALL → vel *= 0.7)
  // Despawn balls that fell below y=-12
  // Apply shake + flash decay
  return newState;
}

// src/core/collision-detector.js
export function detectCollisions(state) {
  const events = [];
  for (const ball of state.balls) {
    for (const brick of state.bricks) {
      if (brick.broken) continue;
      if (circleAABBIntersect(ball, brick)) {
        events.push({ type: 'BRICK_HIT', ball, brick });
      }
    }
    if (aabbIntersect(ball, state.paddle)) {
      events.push({ type: 'PADDLE_HIT', ball, paddle: state.paddle });
    }
  }
  return events;
}
```

**Ball-paddle bounce with spin**

- Compute contact offset: `(ball.x - paddle.x) / (paddle.width / 2)` → ∈ [-1, 1].
- Reflect Y velocity: `vy = -|vy|`.
- Adjust X velocity: `vx += contactOffset * 6`. Clamp total speed.

**Ball-brick bounce**

- Compute penetration on each axis, reflect on axis with smaller penetration (standard swept circle-AABB).
- For ARMORED: decrement HP; emit BROKEN only at HP=0.
- For UNBREAKABLE: no event, just bounce.
- For NORMAL: mark broken, emit BROKEN.

---

## 6. Bricks

**Layout**

- Grid: 10 cols × 5 rows, centered at origin, y ∈ [2, 8].
- Brick width = world_width / 10 * 0.95 (gap).
- Brick height = 0.6.

**Level config** (`src/levels/level-1.json`)

```json
{
  "name": "Level 1",
  "ballSpeed": 12,
  "layout": ["RRRRRRRRRR", "RRRRRRRRRR", "BBBBBBBBBB", "BBBBBBBBBB", "UUUUUUUUUU"]
}
```

Letters: R=red NORMAL, B=blue ARMORED (2 HP), U=gray UNBREAKABLE. Pure function `parseLayout(rows)` → bricks[].

---

## 7. Power-ups

**Drop chance:** 10% per brick broken. Only NORMAL and ARMORED bricks drop.

**Types**

- `MULTI_BALL` — spawn 2 extra balls from current ball.
- `EXPAND_PADDLE` — paddle.width × 1.5 for 10s.
- `SLOW_BALL` — ball speed × 0.7 for 8s.
- `LASER` — paddle fires lasers on Space (stretch goal, ship without if time tight).

**Interface** (`src/core/interfaces/power-up.js`)

```js
// Pure data; effect applied by powerUpSystem
export const PowerUp = {
  type: POWER_UP_TYPE.MULTI_BALL,
  duration: 0, // 0 = instant
  icon: '🔴',
  apply(state) {
    return state;
  },
  remove(state) {
    return state;
  },
};
```

Adding a new power-up = one file in `src/core/power-ups/`.

---

## 8. Camera

`src/render/camera-controller.js`

- Orthographic camera, frustum height = 20 units.
- Aspect-clamped: on portrait, frustum width = 20 × aspect.
- Follows ball Y with deadzone ±1 unit (camera only moves if ball.y is outside deadzone).
- Screen shake: `camera.position.x = Math.sin(t*60) * shake.intensity; camera.position.y = Math.cos(t*53) * shake.intensity;` with `shake.intensity *= 0.9` per frame.

---

## 9. Input

`src/ui/input.js` — single `InputManager` class. Returns `{ paddleTargetX, launchIntent, pauseIntent }`.

**Sources**

- **Keyboard:** `ArrowLeft/A` → -1, `ArrowRight/D` → +1, `Space` → launch, `P`/`Escape` → pause, `R` → restart.
- **Touch:** `touchmove` → paddle x = touch worldX; `touchstart` (if ball attached) → launch.
- **Mouse:** `mousemove` → paddle x = mouse worldX; `mousedown` → launch.

World X conversion: `worldX = (clientX / canvas.width) * frustumWidth - frustumWidth/2`.

The manager doesn't mutate state. Main loop reads its output each frame.

---

## 10. HUD

`src/ui/hud.js` — DOM overlay, CSS-only.

- Top-left: `SCORE: 12345`
- Top-center: `LEVEL 1`
- Top-right: `❤️❤️❤️` + pause button
- Center (when paused): `PAUSED — press P`
- Center (when won): `YOU WIN! Enter name for leaderboard`
- Center (when lost): `GAME OVER — press R`

Subscribe to state changes via simple event emitter (no framework).

---

## 11. Render Layer

**Scene** — one `THREE.Scene`, white background, ambient + directional light.

**Meshes**

- Paddle: `BoxGeometry(paddle.width, 0.4, 1)` + `MeshStandardMaterial` (cyan).
- Ball: `SphereGeometry(0.3)` + `MeshStandardMaterial` (white, slight emissive).
- Bricks: `InstancedMesh` of `BoxGeometry(0.9, 0.5, 0.5)` + vertex color attribute. One draw call for all bricks.
- Particles: `InstancedMesh` of tiny boxes for debris, or `Points` for sparks.

**Render loop**

```js
// src/main.js
const loop = (now) => {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;
  const input = inputManager.read();
  while (accumulator >= STEP) {
    state = applyInput(state, input);
    state = stepPhysics(state, STEP);
    state = handleCollisions(state);
    state = updateEffects(state, STEP);
    accumulator -= STEP;
  }
  render(scene, state, camera);
  hud.render(state);
  requestAnimationFrame(loop);
};
```

---

## 12. Juice

**Particles** (`src/render/particles.js`)

- Pool of 200 `InstancedMesh` particles.
- On brick break: emit 6 particles from brick position with random outward velocity + gravity.
- Each particle has lifetime, fades out.

**Camera shake**

- On life loss: `shake.intensity = 0.8`.
- On brick break: `shake.intensity = 0.15`.
- Decay: `intensity *= 0.9` per frame.

**Screen flash**

- On life loss: `flash = 1.0` (full white overlay), decay to 0 in 0.3s.

---

## 13. Sound

**WebAudio API** — lazy-init on first user gesture (autoplay policy).

**SFX** (CC0 from freesound.org or generated with WebAudio oscillators for v1):

- `paddle-hit.wav`
- `brick-break.wav`
- `wall-bounce.wav`
- `life-loss.wav`
- `power-up.wav`
- `win.wav`
- `lose.wav`

**v1 ship strategy:** generate SFX with WebAudio oscillators (short beeps) — zero asset deps, instant. Replace with real samples later.

---

## 14. Worker (Leaderboard)

`worker/src/index.js`

**Endpoints**

- `POST /scores` body `{ name, score, ts, sig }`
  - Validate `ts` within ±5 min of now.
  - Verify `sig === hmacSHA256(secret, name + score + ts)`.
  - Read `scores` KV (sorted set or array), append `{ name, score, ts }`, keep top 100, write back.
  - Rate limit: 5 requests per IP per minute (KV counter or in-memory Map).
  - CORS: allow `https://brickbreaker.pages.dev` + localhost.
  - Return `{ ok: true }` or 4xx with reason.

- `GET /scores?limit=10`
  - Read KV, sort by score desc, return top N.
  - CORS same as above.

**CORS handling**

```js
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
```

---

## 15. HMAC Signing (Client)

`src/net/leaderboard.js`

```js
async function signPayload(name, score, ts) {
  const data = `${name}${score}${ts}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(import.meta.env.VITE_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Honest disclaimer:** client-side HMAC is anti-casual-cheat only. A determined attacker can read the secret from the bundle. For a small game this is fine. Real fix would be server-authoritative (player reports gameplay events, server scores them). Ship the simple version.

---

## 16. Testing

**Vitest unit tests** (`tests/unit/`)

- `game-state.test.js` — initial state, transitions.
- `physics-stepper.test.js` — ball moves at velocity, wall bounce.
- `collision-detector.test.js` — brick hit, paddle bounce with spin.
- `brick-grid.test.js` — parseLayout → correct bricks.
- `score-calculator.test.js` — combo multipliers, power-up bonuses.

**Playwright e2e** (`tests/e2e/`)

- `game-loads.spec.js` — page loads, canvas exists, no console errors.
- `paddle-responds.spec.js` — press ArrowRight, paddle moves.
- `brick-breaks.spec.js` — wait for ball to hit brick, score increments.

**TDD discipline**

- Every `src/core/` module starts with a failing test.
- Test → red → impl → green → refactor.

---

## 17. CI/CD

**`.github/workflows/ci.yml`** (on every push/PR):

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**`.github/workflows/deploy.yml`** (on tag `v*` or manual dispatch):

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: brickbreaker
          directory: dist
      - run: cd worker && npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

**Required GH secrets**

- `CF_API_TOKEN` — Cloudflare API token, Workers + Pages edit scope.
- `CF_ACCOUNT_ID` — Cloudflare account id.
- `VITE_HMAC_SECRET` — dev/leaderboard HMAC secret (committed to repo is OK for v1).
- `HMAC_SECRET` — worker-side secret (set via `wrangler secret put HMAC_SECRET`).

---

## 18. Phasing

| Phase | Owner         | Output                                                           | PR     |
| ----- | ------------- | ---------------------------------------------------------------- | ------ |
| P0    | scribe (done) | This doc + IMPLEMENTATION.md                                     | —      |
| P1    | forge         | Scaffold + first failing test + CI                               | PR 1   |
| P2    | forge         | Core modules TDD (state, physics, collision, grid, paddle, ball) | PR 2–7 |
| P3    | forge         | Render layer                                                     | PR 8   |
| P4    | forge         | UX (HUD, input, pause)                                           | PR 9   |
| P5    | forge         | Juice (particles, shake, sound)                                  | PR 10  |
| P6    | forge         | Depth (power-ups, brick types, levels, combo)                    | PR 11  |
| P7    | forge         | Worker leaderboard                                               | PR 12  |
| P8    | forge         | Deploy workflow + README                                         | PR 13  |
| P9    | atlas         | Verify, screenshot, send to Dhiraj                               | —      |

---

## Open Questions for Dhiraj

1. **Sound:** ship silent (v1) with WebAudio oscillator beeps, or spend 30 min finding CC0 samples? **Recommend:** oscillator beeps for v1, replace later.
2. **Levels:** ship with 3 hand-crafted levels (varied brick types), or just 1 with infinite replay? **Recommend:** 3 levels.
3. **Domain:** use `brickbreaker.pages.dev` (zero config) or set up `brick-breaker.dhirajsalian.com`? **Recommend:** `pages.dev` for v1, add custom domain in v2.
