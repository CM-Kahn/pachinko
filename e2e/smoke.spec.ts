import { expect, test } from '@playwright/test';

test('cabinet loads, fills the screen, and reports no errors', async ({ page }, testInfo) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });

  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });

  const canvas = page.locator('#stage canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width).toBe(viewport?.width);
  expect(box?.height).toBe(viewport?.height);
  await expect(page.locator('#error')).toBeHidden();

  // Let a few frames render, then check the cabinet is really drawn: the middle of the
  // screen should be the teal playfield, not the dark room behind it.
  await page.waitForTimeout(300);
  const shot = await page.screenshot({ path: testInfo.outputPath('cabinet.png') });
  await testInfo.attach('cabinet', { body: shot, contentType: 'image/png' });
  const distinct = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, 48, 48);
    const d = ctx.getImageData(0, 0, 48, 48).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4) seen.add(((d[i]! >> 4) << 8) | ((d[i + 1]! >> 4) << 4) | (d[i + 2]! >> 4));
    return seen.size;
  }, `data:image/png;base64,${shot.toString('base64')}`);
  expect(distinct).toBeGreaterThan(40);

  expect(problems).toEqual([]);
});
