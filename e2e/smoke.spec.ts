import { expect, test, type Page } from '@playwright/test';

function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  return problems;
}

async function ready(page: Page, url = './'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

const info = (page: Page) => page.evaluate(() => window.__pachinko!());

test('cabinet loads, fills the screen, and reports no errors', async ({ page }, testInfo) => {
  const problems = watchForProblems(page);
  await ready(page);

  const canvas = page.locator('#stage canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width).toBe(viewport?.width);
  expect(box?.height).toBe(viewport?.height);
  await expect(page.locator('#error')).toBeHidden();

  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('cabinet.png') });
  expect((await info(page)).ballsRemaining).toBe(250);
  expect(problems).toEqual([]);
});

test('pulling the handle fires a stream of balls that drain', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'software rendering makes big screens too slow to play in a test');
  test.setTimeout(180_000);
  const problems = watchForProblems(page);
  await ready(page);
  const { handle, fullPull } = await info(page);

  // Pull the handle back to a medium-strong shot and hold it.
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y + fullPull * 0.6, { steps: 6 });
  await expect.poll(async () => (await info(page)).ballsOnBoard, { timeout: 20_000 }).toBeGreaterThan(3);
  await page.screenshot({ path: testInfo.outputPath('playing.png') });
  await page.mouse.up();

  const after = await info(page);
  expect(after.ballsRemaining).toBeLessThan(250);

  // Let go: no more balls fire, and the ones in play all find the out hole.
  await expect.poll(async () => (await info(page)).ballsOnBoard, { timeout: 120_000 }).toBe(0);
  expect((await info(page)).ballsRemaining).toBe(after.ballsRemaining);
  expect(problems).toEqual([]);
});

test('a quick flick fires exactly one ball', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
  await ready(page);
  const { handle, fullPull } = await info(page);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y + fullPull * 0.7);
  await page.mouse.up();
  await expect.poll(async () => (await info(page)).ballsRemaining).toBe(249);
  await page.waitForTimeout(700);
  expect((await info(page)).ballsRemaining).toBe(249);
});

test('keeps up with 60 balls on the board', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'one screen size is enough for the stress run');
  const problems = watchForProblems(page);
  await ready(page, './?stress=60');
  await expect.poll(async () => (await info(page)).ballsOnBoard, { timeout: 20_000 }).toBeGreaterThanOrEqual(50);
  await page.waitForTimeout(3000);
  const stats = await info(page);
  await page.screenshot({ path: testInfo.outputPath('stress.png') });
  testInfo.annotations.push({ type: 'stats', description: JSON.stringify(stats) });
  console.log(`stress: ${stats.ballsOnBoard} balls, ${stats.fps.toFixed(0)} fps (software rendering), physics ${stats.physicsMsPerFrame.toFixed(2)} ms/frame`);
  expect(stats.ballsOnBoard).toBeGreaterThanOrEqual(50);
  // Rendering speed in a headless test browser says little about a real phone, but the
  // physics cost per frame must stay a small slice of the 16.7 ms budget.
  expect(stats.physicsMsPerFrame).toBeLessThan(6);
  expect(problems).toEqual([]);
});
