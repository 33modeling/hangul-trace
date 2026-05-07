// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * 반응형 레이아웃 테스트
 * 화면 회전, 다양한 크기에서 UI가 깨지지 않는지 확인
 */

function collectClientErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test.describe('화면 회전 대응', () => {
  test('세로 → 가로 회전 시 캔버스가 리사이즈됨', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    // 세로 캔버스 크기
    const portraitW = await page.locator('#guide-canvas').evaluate((c) => c.width);
    const portraitH = await page.locator('#guide-canvas').evaluate((c) => c.height);

    // 가로로 회전
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);

    const landscapeW = await page.locator('#guide-canvas').evaluate((c) => c.width);
    const landscapeH = await page.locator('#guide-canvas').evaluate((c) => c.height);

    // 캔버스가 리사이즈되었는지 (둘 중 하나는 달라야 함)
    const resized = (landscapeW !== portraitW) || (landscapeH !== portraitH);
    expect(resized, 'canvas should resize on orientation change').toBeTruthy();

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('가로 → 세로 회전 시 캔버스가 리사이즈됨', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="number"]').click();
    await expect(page.locator('#number-mode')).toHaveClass(/active/);

    const landscapeW = await page.locator('#num-guide-canvas').evaluate((c) => c.width);

    // 세로로 회전
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const portraitW = await page.locator('#num-guide-canvas').evaluate((c) => c.width);
    expect(portraitW, 'canvas width should change on rotation').not.toEqual(landscapeW);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('캔버스 최대 높이 제한', () => {
  test('모바일 세로에서 캔버스 높이가 viewport 55% 이하', async ({ page }) => {
    const vp = { width: 390, height: 844 };
    await page.setViewportSize(vp);
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const modes = [
      { card: 'char', canvas: '#guide-canvas', backBtn: 'back-btn' },
      { card: 'word', canvas: '#word-guide-canvas', backBtn: 'word-back-btn' },
      { card: 'number', canvas: '#num-guide-canvas', backBtn: 'num-back-btn' },
      { card: 'english', canvas: '#eng-guide-canvas', backBtn: 'eng-back-btn' },
    ];

    for (const mode of modes) {
      await page.locator(`button.mode-card[data-mode="${mode.card}"]`).click();
      await page.waitForTimeout(200);

      const h = await page.locator(mode.canvas).evaluate((c) => c.height);
      const maxH = Math.floor(vp.height * 0.55);
      expect(h, `${mode.card} canvas height ${h} should be <= ${maxH}`).toBeLessThanOrEqual(maxH + 10);

      // 메뉴로 돌아가기
      await page.locator(`#${mode.backBtn}`).click();
      await expect(page.locator('#main-menu')).toBeVisible();
    }

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('가로 모드 레이아웃', () => {
  test('태블릿 가로에서 모든 UI 요소가 보임', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    // 캔버스, 네비게이션, 툴바 모두 보이는지
    await expect(page.locator('#canvas-wrap')).toBeVisible();
    await expect(page.locator('#prev-btn')).toBeVisible();
    await expect(page.locator('#next-btn')).toBeVisible();
    await expect(page.locator('#clear-btn')).toBeVisible();
    await expect(page.locator('#back-btn')).toBeVisible();

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('스크롤 동작', () => {
  test('모바일에서 모드 UI가 스크롤 가능', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    // mode-ui의 overflow-y가 auto인지 확인
    const overflow = await page.locator('#char-mode').evaluate((el) => {
      return window.getComputedStyle(el).overflowY;
    });
    expect(overflow).toBe('auto');

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
