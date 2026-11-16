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

test('settings: sound switch and luck slider work and are remembered', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
  const problems = watchForProblems(page);
  await ready(page);
  let i = await info(page);
  expect(i.settingsOpen).toBe(false);
  expect(i.settings).toEqual({ soundOn: true, luck: 0 });

  await page.mouse.click(i.ui.settingsButton.x, i.ui.settingsButton.y);
  await expect.poll(async () => (await info(page)).settingsOpen).toBe(true);

  // The handle is out of reach while the panel is open.
  await page.mouse.move(i.handle.x, i.handle.y);
  await page.mouse.down();
  await page.mouse.move(i.handle.x, i.handle.y + i.fullPull * 0.7);
  await page.mouse.up();
  await expect.poll(async () => (await info(page)).settingsOpen).toBe(false);
  expect((await info(page)).ballsRemaining).toBe(250);
  await page.mouse.click(i.ui.settingsButton.x, i.ui.settingsButton.y);
  await expect.poll(async () => (await info(page)).settingsOpen).toBe(true);

  await page.mouse.click(i.ui.soundSwitch.x, i.ui.soundSwitch.y);
  await expect.poll(async () => (await info(page)).settings.soundOn).toBe(false);

  // Drag the luck knob from the middle three quarters of the way to Easier.
  const { luckLeft: l, luckRight: r } = i.ui;
  const mid = (l.x + r.x) / 2;
  await page.mouse.move(mid, l.y);
  await page.mouse.down();
  await page.mouse.move(mid + (r.x - mid) * 0.75, l.y, { steps: 5 });
  await page.mouse.up();
  i = await info(page);
  expect(i.settings.luck).toBeGreaterThan(0.7);
  expect(i.settings.luck).toBeLessThan(0.8);
  await page.waitForTimeout(200);
  await page.screenshot({ path: testInfo.outputPath('settings.png') });

  await page.mouse.click(i.ui.done.x, i.ui.done.y);
  await expect.poll(async () => (await info(page)).settingsOpen).toBe(false);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  const saved = (await info(page)).settings;
  expect(saved.soundOn).toBe(false);
  expect(saved.luck).toBeCloseTo(i.settings.luck, 5);

  // Letting go near the middle settles back on Normal; far left is fully Harder.
  i = await info(page);
  await page.mouse.click(i.ui.settingsButton.x, i.ui.settingsButton.y);
  await page.mouse.click(mid + (r.x - mid) * 0.04, l.y);
  await expect.poll(async () => (await info(page)).settings.luck).toBe(0);
  await page.mouse.click(l.x - 20, l.y);
  await expect.poll(async () => (await info(page)).settings.luck).toBe(-1);
  expect(problems).toEqual([]);
});
