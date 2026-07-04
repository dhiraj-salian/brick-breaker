import { test } from '@playwright/test';

test('screenshot menu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/bb-menu.png' });
});

test('screenshot gameplay', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);
  await page.click('#start-btn');
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/bb-gameplay.png' });
});

test('screenshot mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);
  await page.click('#start-btn');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/bb-mobile.png' });
});
