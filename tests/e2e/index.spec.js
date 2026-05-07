// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * @param {import('@playwright/test').Page} page
 */
function collectClientErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test.describe('index.html', () => {
  test('main menu and char mode: no JS errors, guide canvas has size', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-menu')).toBeVisible();
    await expect(page.locator('#char-mode')).not.toHaveClass(/active/);

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#main-menu')).toBeHidden();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    const g = page.locator('#guide-canvas');
    const d = page.locator('#draw-canvas');
    await expect(g).toBeVisible();
    await expect(d).toBeVisible();

    const gw = await g.evaluate((c) => /** @type {HTMLCanvasElement} */ (c).width);
    const gh = await g.evaluate((c) => /** @type {HTMLCanvasElement} */ (c).height);
    const dw = await d.evaluate((c) => /** @type {HTMLCanvasElement} */ (c).width);
    const dh = await d.evaluate((c) => /** @type {HTMLCanvasElement} */ (c).height);

    expect(gw, 'guide-canvas width').toBeGreaterThan(80);
    expect(gh, 'guide-canvas height').toBeGreaterThan(80);
    expect(dw, 'draw-canvas width').toBeGreaterThan(80);
    expect(dh, 'draw-canvas height').toBeGreaterThan(80);

    const nonEmpty = await g.evaluate((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 0) n++;
        if (n > 20) return n;
      }
      return n;
    });
    expect(nonEmpty, 'guide canvas should have some non-transparent pixels').toBeGreaterThan(20);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('char mode: 메뉴로 returns to main menu', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);
    await page.locator('#back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
    await expect(page.locator('#char-mode')).not.toHaveClass(/active/);
  });

  test('char mode: prev/next advances ㄱ → ㄴ and wraps to ㄱ', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-label')).toContainText('ㄱ');
    await page.locator('#next-btn').click();
    await expect(page.locator('#char-label')).toContainText('ㄴ');
    await page.locator('#prev-btn').click();
    await expect(page.locator('#char-label')).toContainText('ㄱ');
    await page.locator('#prev-btn').click();
    await expect(page.locator('#char-label')).toContainText('ㅣ');
    expect(errors, errors.join(' | ')).toEqual([]);
  });

  test('number and english modes: canvas sized', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html');

    await page.locator('button.mode-card[data-mode="number"]').click();
    await expect(page.locator('#number-mode')).toHaveClass(/active/);
    const nw = await page.locator('#num-guide-canvas').evaluate((c) => c.width);
    expect(nw, 'num-guide-canvas width').toBeGreaterThan(40);

    await page.locator('#num-back-btn').click();
    await page.locator('button.mode-card[data-mode="english"]').click();
    await expect(page.locator('#english-mode')).toHaveClass(/active/);
    const ew = await page.locator('#eng-guide-canvas').evaluate((c) => c.width);
    expect(ew, 'eng-guide-canvas width').toBeGreaterThan(40);
    expect(errors, errors.join(' | ')).toEqual([]);
  });

  test('myword-add: register word then myword mode shows first syllable (portrait)', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.setViewportSize({ width: 400, height: 720 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="myword-add"]').click();
    await expect(page.locator('#myword-add-mode')).toHaveClass(/active/);
    await page.locator('#myword-add-input').fill('토끼');
    await page.locator('#myword-add-submit').click();
    await expect(page.locator('.myword-add-row')).toHaveCount(1);

    await page.locator('#myword-add-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();

    await page.locator('button.mode-card[data-mode="myword"]').click();
    await expect(page.locator('#myword-mode')).toHaveClass(/active/);
    await expect(page.locator('#myword-label')).toHaveText('토');

    const gw = await page.locator('#myword-guide-canvas').evaluate((c) => /** @type {HTMLCanvasElement} */ (c).width);
    expect(gw, 'myword-guide-canvas width').toBeGreaterThan(80);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
