import { test } from '@playwright/test';

/**
 * Screenshot tests — capture visual state for manual review.
 *
 * As of v0.5.1, the app boots to #auth-screen. Screenshots capture
 * both the auth screen and gameplay (via guest flow).
 */

// Mock worker API
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

test('screenshot auth screen', async ({ page }) => {
  await mockWorkerAPI(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/bb-auth-screen.png' });
});

test('screenshot menu', async ({ page }) => {
  await mockWorkerAPI(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);

  // Skip auth via guest
  await page.click('#auth-guest-btn');
  await page.waitForTimeout(300);

  await page.screenshot({ path: '/tmp/bb-menu.png' });
});

test('screenshot gameplay', async ({ page }) => {
  await mockWorkerAPI(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);

  // Skip auth via guest
  await page.click('#auth-guest-btn');
  await page.waitForTimeout(300);

  await page.click('#start-btn');
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/bb-gameplay.png' });
});

test('screenshot mobile', async ({ page }) => {
  await mockWorkerAPI(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);

  // Skip auth via guest
  await page.click('#auth-guest-btn');
  await page.waitForTimeout(300);

  await page.click('#start-btn');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/bb-mobile.png' });
});
