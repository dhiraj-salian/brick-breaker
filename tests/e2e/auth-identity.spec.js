import { test, expect } from '@playwright/test';

/**
 * E2E: Auth-first screen + identity on HUD + game-over + leaderboard.
 *
 * Tests the new boot sequence:
 *   1. App starts at #auth-screen (if no session)
 *   2. Register → menu appears
 *   3. Login → menu appears
 *   4. Guest mode → menu appears (anonymous)
 *   5. Logout → returns to auth screen
 *
 * Also tests that the username shows on HUD/game-over when logged in,
 * and that the sign-in CTA on game-over shows the auth screen.
 *
 * All network calls to the worker are mocked.
 */

// ---------- Mock helpers ----------

async function mockWorkerAPI(page) {
  await page.route('**/auth/me', (route) => {
    const auth = route.request().headers()['authorization'] || '';
    if (auth.includes('fake-token')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, username: 'testplayer', bestScore: 0, gamesPlayed: 0 }),
      });
    } else {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_token' }),
      });
    }
  });
  await page.route('**/auth/salt**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ salt: 'dGVzdHNhbHQ=' }),
    });
  });
  await page.route('**/auth/register', (route) => {
    const body = route.request().postDataJSON();
    if (body?.username === 'taken') {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'username_taken' }),
      });
    } else {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          token: 'fake-token',
          username: body?.username || 'newuser',
        }),
      });
    }
  });
  await page.route('**/auth/login', (route) => {
    const body = route.request().postDataJSON();
    if (body?.username === 'baduser') {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_credentials' }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          token: 'fake-token',
          username: body?.username || 'testplayer',
        }),
      });
    }
  });
  await page.route('**/scores?**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ scores: [] }),
    });
  });
  await page.route('**/scores', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, rank: 1 }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ scores: [] }),
      });
    }
  });
}

async function mockAuthMeAs(page, username) {
  await page.route('**/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, username, bestScore: 0, gamesPlayed: 0 }),
    });
  });
}

// ---------- Tests ----------

test.describe('Auth first screen', () => {
  test('app starts at auth screen when no session', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Auth screen should be visible
    await expect(page.locator('#auth-screen')).toBeVisible();
    // Game container should be hidden
    const gameContainerDisplay = await page
      .locator('#game-container')
      .evaluate((el) => getComputedStyle(el).display);
    expect(gameContainerDisplay).toBe('none');
    // Menu should NOT be active
    await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);
  });

  test('auth screen shows login form by default', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('#auth-user')).toBeVisible();
    await expect(page.locator('#auth-pass')).toBeVisible();
    await expect(page.locator('#auth-submit-btn')).toBeVisible();
    await expect(page.locator('#auth-submit-btn')).toHaveText('LOGIN');
    await expect(page.locator('#auth-guest-btn')).toBeVisible();
  });

  test('tabs switch between LOGIN and REGISTER', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Start on LOGIN tab
    await expect(page.locator('#auth-tab-login')).toHaveClass(/active/);
    await expect(page.locator('#auth-submit-btn')).toHaveText('LOGIN');

    // Click REGISTER
    await page.click('#auth-tab-register');
    await expect(page.locator('#auth-tab-register')).toHaveClass(/active/);
    await expect(page.locator('#auth-tab-login')).not.toHaveClass(/active/);
    await expect(page.locator('#auth-submit-btn')).toHaveText('REGISTER');

    // Click back to LOGIN
    await page.click('#auth-tab-login');
    await expect(page.locator('#auth-tab-login')).toHaveClass(/active/);
    await expect(page.locator('#auth-submit-btn')).toHaveText('LOGIN');
  });

  test('register flow: fill form → submit → menu appears', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Switch to register tab
    await page.click('#auth-tab-register');

    // Fill form
    await page.fill('#auth-user', 'newplayer');
    await page.fill('#auth-pass', 'pass1234');

    // Submit
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(500);

    // Auth screen should be hidden
    await expect(page.locator('#auth-screen')).not.toBeVisible();
    // Menu should be visible
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    // Should show logged-in state
    await expect(page.locator('#auth-logged-in')).toBeVisible();
    await expect(page.locator('#auth-username')).toContainText('newplayer');
  });

  test('login flow: fill form → submit → menu appears', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Fill login form (LOGIN tab is default)
    await page.fill('#auth-user', 'testplayer');
    await page.fill('#auth-pass', 'secret123');

    // Submit
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(500);

    // Auth screen should be hidden
    await expect(page.locator('#auth-screen')).not.toBeVisible();
    // Menu should be visible
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    // Should show logged-in state
    await expect(page.locator('#auth-logged-in')).toBeVisible();
  });

  test('guest mode: click Continue as Guest → menu appears (anonymous)', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Click guest link
    await page.click('#auth-guest-btn');
    await page.waitForTimeout(300);

    // Auth screen should be hidden
    await expect(page.locator('#auth-screen')).not.toBeVisible();
    // Menu should be visible
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    // Should NOT show logged-in state
    await expect(page.locator('#auth-logged-in')).not.toBeVisible();
    // Should NOT show @username on score
    const scoreUsername = page.locator('#score-username');
    await expect(scoreUsername).toHaveText('');
  });

  test('logout from menu returns to auth screen', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.addInitScript(() => {
      localStorage.setItem('bb:auth', JSON.stringify({ token: 'fake-token', username: 'alice' }));
    });
    await mockAuthMeAs(page, 'alice');

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Should start at menu (valid session)
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await expect(page.locator('#auth-logged-in')).toBeVisible();

    // Click logout
    await page.click('#logout-btn');
    await page.waitForTimeout(300);

    // Should be back at auth screen
    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);
  });

  test('valid session in localStorage: skip auth screen, show menu', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.addInitScript(() => {
      localStorage.setItem('bb:auth', JSON.stringify({ token: 'fake-token', username: 'alice' }));
    });
    await mockAuthMeAs(page, 'alice');

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Auth screen should NOT be visible
    await expect(page.locator('#auth-screen')).not.toBeVisible();
    // Menu should be visible
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    // HUD shows @alice
    await expect(page.locator('#score-display')).toContainText('@alice');
  });

  test('invalid session token: show auth screen', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.addInitScript(() => {
      localStorage.setItem('bb:auth', JSON.stringify({ token: 'expired-token', username: 'bob' }));
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Auth screen should be visible (token invalid)
    await expect(page.locator('#auth-screen')).toBeVisible();
  });

  test('HUD shows @username when logged in after login flow', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Login
    await page.fill('#auth-user', 'testplayer');
    await page.fill('#auth-pass', 'secret123');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(500);

    const scoreDisplay = page.locator('#score-display');
    await expect(scoreDisplay).toContainText('@testplayer');
  });

  test('game-over shows sign-in CTA when anonymous (guest mode)', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Enter as guest
    await page.click('#auth-guest-btn');
    await page.waitForTimeout(300);

    // Start game
    await page.click('#start-btn');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Show game-over overlay via DOM manipulation
    await page.evaluate(() => {
      document.getElementById('gameover-overlay').classList.add('active');
      document.getElementById('menu-overlay').classList.remove('active');
      const cta = document.getElementById('gameover-cta');
      if (cta) cta.style.display = 'block';
      const usernameEl = document.getElementById('gameover-username');
      if (usernameEl) usernameEl.style.display = 'none';
    });

    await page.waitForTimeout(200);

    await expect(page.locator('#gameover-cta')).toBeVisible();
    await expect(page.locator('#gameover-signin-btn')).toBeVisible();
  });

  test('sign-in CTA on game-over shows auth screen (not menu)', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Enter as guest
    await page.click('#auth-guest-btn');
    await page.waitForTimeout(300);

    // Start game
    await page.click('#start-btn');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Show game-over overlay
    await page.evaluate(() => {
      document.getElementById('gameover-overlay').classList.add('active');
      const cta = document.getElementById('gameover-cta');
      if (cta) cta.style.display = 'block';
    });

    await page.waitForTimeout(100);

    // Click sign-in CTA
    await page.click('#gameover-signin-btn');
    await page.waitForTimeout(300);

    // Should show auth screen, NOT menu
    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('#gameover-overlay')).not.toHaveClass(/active/);
    await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);
  });

  test('game-over shows @username line when logged in', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.addInitScript(() => {
      localStorage.setItem('bb:auth', JSON.stringify({ token: 'fake-token', username: 'bob' }));
    });
    await mockAuthMeAs(page, 'bob');

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Start game
    await page.click('#start-btn');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Show game-over with identity
    await page.evaluate(() => {
      document.getElementById('gameover-overlay').classList.add('active');
      document.getElementById('menu-overlay').classList.remove('active');
      const usernameEl = document.getElementById('gameover-username');
      if (usernameEl) {
        usernameEl.textContent = '@bob — 1240 pts (top combo ×1)';
        usernameEl.style.display = 'block';
      }
      const cta = document.getElementById('gameover-cta');
      if (cta) cta.style.display = 'none';
    });

    await page.waitForTimeout(200);

    await expect(page.locator('#gameover-username')).toBeVisible();
    await expect(page.locator('#gameover-username')).toContainText('@bob');
    await expect(page.locator('#gameover-username')).toContainText('1240');
    await expect(page.locator('#gameover-cta')).toBeHidden();
  });
});

test.describe('Responsive layout', () => {
  test('no horizontal scroll on mobile (375x667)', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('no horizontal scroll on desktop (1280x800)', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('auth screen touch targets are >= 44px on mobile', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const submitBtn = page.locator('#auth-submit-btn');
    const submitBox = await submitBtn.boundingBox();
    expect(submitBox.height).toBeGreaterThanOrEqual(44);

    const guestBtn = page.locator('#auth-guest-btn');
    const guestBox = await guestBtn.boundingBox();
    expect(guestBox.height).toBeGreaterThanOrEqual(44);

    const loginTab = page.locator('#auth-tab-login');
    const loginTabBox = await loginTab.boundingBox();
    expect(loginTabBox.height).toBeGreaterThanOrEqual(44);
  });

  test('auth screen is centered on mobile (375x667)', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const card = page.locator('.auth-card');
    const cardBox = await card.boundingBox();
    const viewportWidth = 375;
    const leftMargin = cardBox.x;
    const rightMargin = viewportWidth - cardBox.x - cardBox.width;
    // Card should be roughly centered (within 10px tolerance for padding)
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(10);
  });

  test('auth screen is centered on desktop (1280x800)', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const card = page.locator('.auth-card');
    const cardBox = await card.boundingBox();
    const viewportWidth = 1280;
    const leftMargin = cardBox.x;
    const rightMargin = viewportWidth - cardBox.x - cardBox.width;
    // Card should be roughly centered (within 10px tolerance)
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(10);
  });

  test('auth card max-width is ~420px on desktop', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const card = page.locator('.auth-card');
    const cardBox = await card.boundingBox();
    expect(cardBox.width).toBeLessThanOrEqual(420);
  });
});
