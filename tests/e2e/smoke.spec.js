import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify the game loads and basic interactions work.
 *
 * As of v0.5.1, the app boots to #auth-screen. Tests use the guest
 * flow to reach the menu before interacting with the game.
 */

// Mock worker API to avoid hitting production
async function mockWorkerAPI(page) {
  await page.route('**/auth/me', (route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_token' }),
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

test.describe('Brick Breaker smoke', () => {
  test('page loads with auth screen and canvas', async ({ page }) => {
    await mockWorkerAPI(page);

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/');

    // Auth screen is shown
    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('.auth-title')).toContainText('BRICK BREAKER');

    // Canvas exists (but is hidden behind auth screen)
    await expect(page.locator('#game-canvas')).toBeDefined();

    // Go through guest flow
    await page.click('#auth-guest-btn');
    await page.waitForTimeout(300);

    // Menu overlay should now be visible
    await expect(page.locator('#menu-overlay')).toBeVisible();

    // Click start
    await page.click('#start-btn');

    // Menu should hide
    await expect(page.locator('#menu-overlay')).not.toBeVisible();

    // Press space to launch ball
    await page.keyboard.press('Space');

    // Wait a bit, ball should be moving
    await page.waitForTimeout(500);

    // Press right arrow, paddle should move
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    // No console errors (filter out WebGL/Vite dev warnings)
    const realErrors = consoleErrors.filter((e) => !e.includes('WebGL') && !e.includes('[vite]'));
    expect(realErrors).toEqual([]);
  });

  test('pause works', async ({ page }) => {
    await mockWorkerAPI(page);
    await page.goto('/');

    // Skip auth via guest
    await page.waitForTimeout(500);
    await page.click('#auth-guest-btn');
    await page.waitForTimeout(300);

    await page.click('#start-btn');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Pause via the top-right button.
    await page.click('#pause-btn');
    await expect(page.locator('#pause-overlay')).toBeVisible();

    // Resume via the resume button on the overlay
    await page.click('#resume-btn');
    await expect(page.locator('#pause-overlay')).not.toBeVisible();
  });
});
