// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp } = require('./helpers');

/**
 * #6 — 캔버스 크기가 실제로 바뀌는 resize(회전·가로 주소창 등)에서 사용자가
 * 그리던 필기 잉크가 보존되는지 검증. 동시에 네비게이션은 여전히 캔버스를
 * 비우는지(회귀 방지) 확인.
 */

function collectClientErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

/** 캔버스 백킹스토어에서 불투명(alpha>0) 픽셀 수 — 잉크 유무 측정. */
async function inkPixels(page, sel) {
  return page.evaluate((s) => {
    const c = document.querySelector(s);
    if (!c) return -1;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    if (!w || !h) return 0;
    const data = ctx.getImageData(0, 0, w, h).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
    return n;
  }, sel);
}

async function bufferSize(page, sel) {
  return page.evaluate((s) => {
    const c = document.querySelector(s);
    return c ? { w: c.width, h: c.height } : null;
  }, sel);
}

/** 캔버스 중앙에 일정 길이의 획을 긋는다(잉크 생성). */
async function drawStroke(page, sel) {
  const box = await page.locator(sel).boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - box.width * 0.25, cy - box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(cx + box.width * 0.25, cy + box.height * 0.2, { steps: 8 });
  await page.mouse.up();
}

test.describe('필기 잉크 보존 (#6)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('자모 모드: 크기 바뀌는 resize 후에도 그린 획이 남는다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);
    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);
    await page.waitForTimeout(200);

    await drawStroke(page, '#draw-canvas');
    const before = await inkPixels(page, '#draw-canvas');
    expect(before, '그린 직후 잉크가 있어야 함').toBeGreaterThan(0);
    const sizeBefore = await bufferSize(page, '#draw-canvas');

    // 캔버스 정사각 크기를 실제로 바꾸는 뷰포트 변경(회전 유사)
    await page.setViewportSize({ width: 680, height: 520 });
    await page.waitForTimeout(400);

    const sizeAfter = await bufferSize(page, '#draw-canvas');
    expect(
      sizeAfter.w !== sizeBefore.w || sizeAfter.h !== sizeBefore.h,
      `버퍼 크기가 실제로 바뀌어야 테스트가 유효함 (before=${JSON.stringify(sizeBefore)} after=${JSON.stringify(sizeAfter)})`
    ).toBeTruthy();

    const after = await inkPixels(page, '#draw-canvas');
    expect(after, 'resize 후에도 잉크가 보존돼야 함').toBeGreaterThan(0);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('자모 모드: 다음 글자로 이동하면 캔버스가 비워진다(회귀 방지)', async ({ page }) => {
    await gotoApp(page);
    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);
    await page.waitForTimeout(200);

    await drawStroke(page, '#draw-canvas');
    expect(await inkPixels(page, '#draw-canvas')).toBeGreaterThan(0);

    await page.locator('#next-btn').click();
    await page.waitForTimeout(150);
    expect(
      await inkPixels(page, '#draw-canvas'),
      '네비게이션 후에는 새 글자를 위해 비워져야 함'
    ).toBe(0);
  });

  test('단어 모드: 크기 바뀌는 resize 후에도 그린 획이 남는다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);
    await page.locator('button.mode-card[data-mode="word"]').click();
    await expect(page.locator('#word-mode')).toHaveClass(/active/);
    await page.waitForTimeout(200);

    await drawStroke(page, '#word-draw-canvas');
    expect(await inkPixels(page, '#word-draw-canvas')).toBeGreaterThan(0);
    const sizeBefore = await bufferSize(page, '#word-draw-canvas');

    await page.setViewportSize({ width: 680, height: 520 });
    await page.waitForTimeout(400);

    const sizeAfter = await bufferSize(page, '#word-draw-canvas');
    expect(
      sizeAfter.w !== sizeBefore.w || sizeAfter.h !== sizeBefore.h,
      'word 캔버스 버퍼 크기가 실제로 바뀌어야 함'
    ).toBeTruthy();

    expect(
      await inkPixels(page, '#word-draw-canvas'),
      'word resize 후에도 잉크 보존'
    ).toBeGreaterThan(0);

    // 이동하면 비워지는지(회귀 방지)
    await page.locator('#word-next-btn').click();
    await page.waitForTimeout(150);
    expect(await inkPixels(page, '#word-draw-canvas'), 'word 이동 후 비워짐').toBe(0);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
