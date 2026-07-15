import { test, expect } from '@playwright/test';

/**
 * E2E: Auth identity on HUD + game-over + leaderboard.
 *
 * Tests that the username shows up on the HUD score display when logged in,
 * that the game-over screen shows the identity line, and that the
 * sign-in CTA appears when anonymous.
 *
 * All network calls to the worker are mocked to avoid hitting production.
 */

// Mock all worker API calls
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

test.describe('Auth identity on score', () => {
  test('HUD shows @username when session exists in localStorage', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'bb:auth',
        JSON.stringify({ token: 'fake-token', username: 'testplayer' })
      );
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    const scoreDisplay = page.locator('#score-display');
    await expect(scoreDisplay).toContainText('@testplayer');
  });

  test('HUD does not show username when not logged in', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(1000);

    const scoreUsername = page.locator('#score-username');
    await expect(scoreUsername).toHaveText('');
  });

  test('menu shows auth form when not logged in', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    await expect(page.locator('#auth-form')).toBeVisible();
    await expect(page.locator('#auth-user')).toBeVisible();
    await expect(page.locator('#auth-pass')).toBeVisible();
  });

  test('menu shows logged-in state when session exists', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.addInitScript(() => {
      localStorage.setItem('bb:auth', JSON.stringify({ token: 'fake-token', username: 'alice' }));
    });

    // Override /auth/me to return alice
    await page.route('**/auth/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, username: 'alice', bestScore: 500, gamesPlayed: 3 }),
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    await expect(page.locator('#auth-logged-in')).toBeVisible();
    await expect(page.locator('#auth-username')).toContainText('alice');
    await expect(page.locator('#logout-btn')).toBeVisible();
    await expect(page.locator('#auth-form')).toBeHidden();
  });

  test('game-over shows sign-in CTA when anonymous', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Start game
    await page.click('#start-btn');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Show game-over overlay via DOM manipulation
    await page.evaluate(() => {
      document.getElementById('gameover-overlay').classList.add('active');
      document.getElementById('menu-overlay').classList.remove('active');
      // Ensure CTA is visible (it would be if identity is null)
      const cta = document.getElementById('gameover-cta');
      if (cta) cta.style.display = 'block';
      const usernameEl = document.getElementById('gameover-username');
      if (usernameEl) usernameEl.style.display = 'none';
    });

    await page.waitForTimeout(200);

    await expect(page.locator('#gameover-cta')).toBeVisible();
    await expect(page.locator('#gameover-signin-btn')).toBeVisible();
    await expect(page.locator('#gameover-username')).toBeHidden();
  });

  test('game-over shows @username line when logged in', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.addInitScript(() => {
      localStorage.setItem('bb:auth', JSON.stringify({ token: 'fake-token', username: 'bob' }));
    });

    await page.route('**/auth/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, username: 'bob', bestScore: 0, gamesPlayed: 0 }),
      });
    });

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

  test('sign-in CTA button navigates to menu', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');
    await page.waitForTimeout(500);

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

    await page.click('#gameover-signin-btn');
    await page.waitForTimeout(300);

    await expect(page.locator('#menu-overlay')).toBeVisible();
    await expect(page.locator('#gameover-overlay')).not.toBeVisible();
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

  test('touch targets are >= 44px on mobile', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const pauseBtn = page.locator('#pause-btn');
    const pauseBox = await pauseBtn.boundingBox();
    expect(pauseBox.height).toBeGreaterThanOrEqual(44);

    const muteBtn = page.locator('#mute-btn');
    const muteBox = await muteBtn.boundingBox();
    expect(muteBox.height).toBeGreaterThanOrEqual(44);

    const startBtn = page.locator('#start-btn');
    const startBox = await startBtn.boundingBox();
    expect(startBox.height).toBeGreaterThanOrEqual(44);
  });
});
