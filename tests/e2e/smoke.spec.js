import { test, expect } from '@playwright/test';

test.describe('Brick Breaker smoke', () => {
  test('page loads with menu and canvas', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/');

    // Canvas exists
    await expect(page.locator('#game-canvas')).toBeVisible();

    // Menu overlay is shown by default
    await expect(page.locator('#menu-overlay')).toBeVisible();
    await expect(page.locator('h1')).toContainText('BRICK BREAKER');

    // Click start
    await page.click('#start-btn');

    // Menu should hide
    await expect(page.locator('#menu-overlay')).not.toBeVisible();

    // Press space to launch ball
    await page.keyboard.press('Space');

    // Wait a bit, ball should be moving
    await page.waitForTimeout(500);

    // Press right arrow, paddle should move (indirectly — we can't easily inspect 3D state)
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    // No console errors
    expect(consoleErrors).toEqual([]);
  });

  test('pause works', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Pause via the top-right button.
    await page.click('#pause-btn');
    await expect(page.locator('#pause-overlay')).toBeVisible();

    // Resume via the resume button on the overlay (the overlay covers
    // the pause button by design — see index.html CSS z-index).
    await page.click('#resume-btn');
    await expect(page.locator('#pause-overlay')).not.toBeVisible();
  });
});
