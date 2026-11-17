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

async function pullAndRelease(page: Page, amount: number, holdMs = 0): Promise<void> {
  const { handle, fullPull } = await info(page);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y + fullPull * amount, { steps: 3 });
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

test('each pull of the handle shoots one ball, and the balls drain', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'software rendering makes big screens too slow to play in a test');
  const problems = watchForProblems(page);
  await ready(page);

  for (let shot = 1; shot <= 5; shot++) {
    await pullAndRelease(page, 0.45 + shot * 0.08);
    await expect.poll(async () => (await info(page)).ballsRemaining).toBe(250 - shot);
  }
  expect((await info(page)).ballsOnBoard).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('playing.png') });

  // Every ball finds the out hole, and nothing more is shot meanwhile.
  await expect.poll(async () => (await info(page)).ballsOnBoard, { timeout: 120_000 }).toBe(0);
  // Every ball either drained or was caught and paid; once winnings have arrived the tray holds
  // the 245 left plus whatever was won.
  await expect.poll(async () => (await info(page)).ballsOwed, { timeout: 30_000 }).toBe(0);
  const end = await info(page);
  expect(end.ballsRemaining).toBe(245 + end.ballsAwarded);
  expect(problems).toEqual([]);
});

test('holding the handle back does not shoot until it is let go, then shoots just one', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
  await ready(page);
  const { handle, fullPull } = await info(page);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y + fullPull * 0.7);
  await page.waitForTimeout(2500);
  expect((await info(page)).ballsRemaining).toBe(250);
  await page.mouse.up();
  await expect.poll(async () => (await info(page)).ballsRemaining).toBe(249);
  await page.waitForTimeout(1500);
  expect((await info(page)).ballsRemaining).toBe(249);

  // A bare tap wastes nothing.
  await pullAndRelease(page, 0);
  await page.waitForTimeout(500);
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
  console.log(`stress: ${stats.ballsOnBoard} balls, ${stats.fps.toFixed(0)} fps (software rendering), physics ${stats.physicsMsPerStep.toFixed(2)} ms/step`);
  expect(stats.ballsOnBoard).toBeGreaterThanOrEqual(50);
  // Rendering speed in a headless test browser says little about a real phone, and the
  // software renderer competes with the physics for the processor. This only guards
  // against the physics becoming grossly slow: two steps must fit well inside a frame.
  expect(stats.physicsMsPerStep).toBeLessThan(4);
  expect(problems).toEqual([]);
});

test('settings: sound switch and luck slider work and are remembered', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
  const problems = watchForProblems(page);
  await ready(page);
  let i = await info(page);
  expect(i.settingsOpen).toBe(false);
  expect(i.settings).toEqual({ soundOn: true, luck: 0, payout: 5 });

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
  await page.mouse.click(i.ui.payout['25']!.x, i.ui.payout['25']!.y);
  await expect.poll(async () => (await info(page)).settings.payout).toBe(25);
  await page.waitForTimeout(200);
  await page.screenshot({ path: testInfo.outputPath('settings.png') });

  await page.mouse.click(i.ui.done.x, i.ui.done.y);
  await expect.poll(async () => (await info(page)).settingsOpen).toBe(false);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  const saved = (await info(page)).settings;
  expect(saved.soundOn).toBe(false);
  expect(saved.luck).toBeCloseTo(i.settings.luck, 5);
  expect(saved.payout).toBe(25);

  // Letting go near the middle settles back on Normal; far left is fully Harder.
  i = await info(page);
  await page.mouse.click(i.ui.settingsButton.x, i.ui.settingsButton.y);
  await page.mouse.click(mid + (r.x - mid) * 0.04, l.y);
  await expect.poll(async () => (await info(page)).settings.luck).toBe(0);
  await page.mouse.click(l.x - 20, l.y);
  await expect.poll(async () => (await info(page)).settings.luck).toBe(-1);
  expect(problems).toEqual([]);
});

test('a catch pays, flips its tulip and is remembered', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
  const problems = watchForProblems(page);
  await ready(page);
  await page.evaluate(() => window.__pachinkoCatch!('tulip-upper-left'));
  await expect.poll(async () => (await info(page)).ballsAwarded).toBe(5);
  let i = await info(page);
  expect(i.ballsRemaining).toBe(255);
  expect(i.tulipsOpen['tulip-upper-left']).toBe(true);
  expect(i.tulipsOpen['tulip-lower-left']).toBe(false);
  expect(i.lights).toBe(1);

  await page.evaluate(() => window.__pachinkoCatch!('tulip-upper-left'));
  await expect.poll(async () => (await info(page)).ballsAwarded).toBe(10);
  i = await info(page);
  expect(i.tulipsOpen['tulip-upper-left']).toBe(false);

  // Balls Awarded carries over to the next visit; the tray starts fresh.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  i = await info(page);
  expect(i.ballsAwarded).toBe(10);
  expect(i.ballsRemaining).toBe(250);
  expect(problems).toEqual([]);
});

test('the tiger opens two tulips for a paw and all four for his head or chin', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
  const problems = watchForProblems(page);
  await ready(page);
  expect((await info(page)).tigerHappy).toBe(false);

  await page.evaluate(() => window.__pachinkoCatch!('paw-right'));
  let i = await info(page);
  expect(i.tigerHappy).toBe(true);
  expect(i.tulipsOpen).toEqual({ 'tulip-upper-left': false, 'tulip-upper-right': true, 'tulip-lower-left': false, 'tulip-lower-right': true });

  await page.evaluate(() => window.__pachinkoCatch!('crown'));
  i = await info(page);
  expect(Object.values(i.tulipsOpen)).toEqual([true, true, true, true]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('all-open.png') });

  // An open tulip closes again when it catches a ball; the chin pocket reopens it.
  await page.evaluate(() => window.__pachinkoCatch!('tulip-lower-left'));
  expect((await info(page)).tulipsOpen['tulip-lower-left']).toBe(false);
  await page.evaluate(() => window.__pachinkoCatch!('chin'));
  expect((await info(page)).tulipsOpen['tulip-lower-left']).toBe(true);
  await expect.poll(async () => (await info(page)).ballsAwarded).toBe(20);
  expect(problems).toEqual([]);
});

test('running out of balls offers a free refill', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'software rendering makes big screens too slow to play in a test');
  const problems = watchForProblems(page);
  await ready(page, './?balls=1');
  expect((await info(page)).refillShown).toBe(false);
  // Shoot until the tray is empty and stays empty (a lucky catch pays a few more balls).
  await expect
    .poll(
      async () => {
        const now = await info(page);
        if (now.ballsRemaining > 0 && now.ballsOnBoard === 0) await pullAndRelease(page, 0.6);
        return now.refillShown;
      },
      { timeout: 150_000, intervals: [500] },
    )
    .toBe(true);
  let i = await info(page);
  expect(i.ballsRemaining).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('refill.png') });
  await page.mouse.click(i.ui.refill.x, i.ui.refill.y);
  await expect.poll(async () => (await info(page)).ballsRemaining).toBe(250);
  i = await info(page);
  expect(i.refillShown).toBe(false);
  expect(problems).toEqual([]);
});
