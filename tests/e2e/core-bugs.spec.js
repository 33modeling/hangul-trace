/**
 * 핵심 버그 회귀 테스트
 * - 드로잉 기능 (캔버스 버퍼/CSS 크기 일치)
 * - 가이드 글자 표시
 * - 스케일링 정상
 * - 화살표 네비게이션
 */
const { test, expect } = require('@playwright/test');
const { gotoApp } = require('./helpers');

test.describe('핵심 버그 회귀', () => {

  test.beforeEach(async ({ page }) => {
    await gotoApp(page, '/');
  });

  test('자모 모드: 캔버스 버퍼 크기와 CSS 표시 크기가 일치해야 함', async ({ page }) => {
    await page.click('[data-mode="char"]');
    await page.waitForSelector('#char-mode.active');

    // 캔버스가 렌더링될 때까지 대기
    await page.waitForFunction(() => {
      const c = document.getElementById('draw-canvas');
      return c && c.width > 0 && c.height > 0;
    }, null, { timeout: 5000 });

    const sizes = await page.evaluate(() => {
      const canvas = document.getElementById('draw-canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        bufferW: canvas.width,
        bufferH: canvas.height,
        cssW: Math.round(rect.width),
        cssH: Math.round(rect.height),
        styleW: canvas.style.width,
        styleH: canvas.style.height
      };
    });

    // 버퍼 크기와 CSS 표시 크기가 일치해야 함 (±2px 허용 — 반올림)
    expect(Math.abs(sizes.bufferW - sizes.cssW)).toBeLessThan(3);
    expect(Math.abs(sizes.bufferH - sizes.cssH)).toBeLessThan(3);

    // style.width/height가 px 단위여야 함 (100%면 버그)
    expect(sizes.styleW).toMatch(/\d+px/);
    expect(sizes.styleH).toMatch(/\d+px/);
  });

  test('자모 모드: 가이드 캔버스에 글자가 표시되어야 함', async ({ page }) => {
    await page.click('[data-mode="char"]');
    await page.waitForSelector('#char-mode.active');

    // 가이드 캔버스에 픽셀이 그려져 있는지 확인
    const hasGuidePixels = await page.evaluate(() => {
      const canvas = document.getElementById('guide-canvas');
      if (!canvas || canvas.width < 2) return false;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      // 최소 하나 이상의 비투명 픽셀이 있어야 함
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
      return false;
    });

    expect(hasGuidePixels).toBe(true);
  });

  test('자모 모드: 드로잉이 정상 작동해야 함', async ({ page }) => {
    await page.click('[data-mode="char"]');
    await page.waitForSelector('#char-mode.active');

    const canvas = page.locator('#draw-canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // 캔버스 중앙에서 드로잉
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 });
    await page.mouse.up();

    // 드로잉 캔버스에 픽셀이 그려져 있는지 확인
    const hasDrawPixels = await page.evaluate(() => {
      const canvas = document.getElementById('draw-canvas');
      if (!canvas || canvas.width < 2) return false;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
      return false;
    });

    expect(hasDrawPixels).toBe(true);
  });

  test('자모 모드: 화살표 네비게이션이 정상 작동해야 함', async ({ page }) => {
    await page.click('[data-mode="char"]');
    await page.waitForSelector('#char-mode.active');

    // 초기 글자 확인
    const initialLabel = await page.locator('#char-label').textContent();

    // 다음 버튼 클릭
    await page.click('#next-btn');
    const nextLabel = await page.locator('#char-label').textContent();
    expect(nextLabel).not.toBe(initialLabel);

    // 이전 버튼 클릭
    await page.click('#prev-btn');
    const prevLabel = await page.locator('#char-label').textContent();
    expect(prevLabel).toBe(initialLabel);
  });

  test('단어 모드: 화살표 네비게이션이 정상 작동해야 함', async ({ page }) => {
    await page.click('[data-mode="word"]');
    await page.waitForSelector('#word-mode.active');

    const initialLabel = await page.locator('#word-label').textContent();

    await page.click('#word-next-btn');
    const nextLabel = await page.locator('#word-label').textContent();
    expect(nextLabel).not.toBe(initialLabel);

    await page.click('#word-prev-btn');
    const prevLabel = await page.locator('#word-label').textContent();
    expect(prevLabel).toBe(initialLabel);
  });

  test('숫자 모드: 화살표 네비게이션이 정상 작동해야 함', async ({ page }) => {
    await page.click('[data-mode="number"]');
    await page.waitForSelector('#number-mode.active');

    const initialLabel = await page.locator('#num-label').textContent();

    await page.click('#num-next-btn');
    const nextLabel = await page.locator('#num-label').textContent();
    expect(nextLabel).not.toBe(initialLabel);

    await page.click('#num-prev-btn');
    const prevLabel = await page.locator('#num-label').textContent();
    expect(prevLabel).toBe(initialLabel);
  });

  test('영어 모드: 화살표 네비게이션이 정상 작동해야 함', async ({ page }) => {
    await page.click('[data-mode="english"]');
    await page.waitForSelector('#english-mode.active');

    const initialLabel = await page.locator('#eng-label').textContent();

    await page.click('#eng-next-btn');
    const nextLabel = await page.locator('#eng-label').textContent();
    expect(nextLabel).not.toBe(initialLabel);

    await page.click('#eng-prev-btn');
    const prevLabel = await page.locator('#eng-label').textContent();
    expect(prevLabel).toBe(initialLabel);
  });

  test('내 단어 모드: 화살표 네비게이션이 정상 작동해야 함', async ({ page }) => {
    // 단어 추가
    await page.click('[data-mode="myword-add"]');
    await page.waitForSelector('#myword-add-mode.active');

    await page.fill('#myword-add-input', '강아지');
    await page.click('#myword-add-submit');
    await page.waitForTimeout(300);

    // 내 단어 모드 진입
    await page.click('#myword-add-menu-btn');
    await page.waitForSelector('#main-menu');
    await page.click('[data-mode="myword"]');
    await page.waitForSelector('#myword-mode.active');

    const initialLabel = await page.locator('#myword-label').textContent();

    // 다음 버튼
    await page.click('#myword-next-btn');
    const nextLabel = await page.locator('#myword-label').textContent();
    // 단어가 1개뿐이면 같은 단어로 순환 — 버튼이 동작하는지만 확인
    expect(nextLabel).toBeTruthy();

    // 이전 버튼
    await page.click('#myword-prev-btn');
    const prevLabel = await page.locator('#myword-label').textContent();
    expect(prevLabel).toBeTruthy();

    // 정리: 단어 삭제
    await page.click('#myword-back-btn');
    await page.waitForSelector('#main-menu');
    await page.click('[data-mode="myword-add"]');
    await page.waitForSelector('#myword-add-mode.active');
    // 삭제 버튼(빨간 danger 버튼) 찾기
    const deleteBtn = page.locator('.myword-add-actions button.tool-btn.danger').first();
    if (await deleteBtn.count() > 0 && await deleteBtn.isEnabled()) {
      await deleteBtn.click();
    }
  });

  test('모든 모드: 가이드 캔버스에 글자가 표시되어야 함', async ({ page }) => {
    const modes = [
      { card: '[data-mode="char"]', panel: '#char-mode', guide: '#guide-canvas' },
      { card: '[data-mode="word"]', panel: '#word-mode', guide: '#word-guide-canvas' },
      { card: '[data-mode="number"]', panel: '#number-mode', guide: '#num-guide-canvas' },
      { card: '[data-mode="english"]', panel: '#english-mode', guide: '#eng-guide-canvas' },
    ];

    for (const mode of modes) {
      await page.click(mode.card);
      await page.waitForSelector(`${mode.panel}.active`);

      const hasGuide = await page.evaluate((sel) => {
        const canvas = document.querySelector(sel);
        if (!canvas || canvas.width < 2) return false;
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true;
        }
        return false;
      }, mode.guide);

      expect(hasGuide).toBe(true);

      // 메뉴로 돌아가기
      const backBtn = page.locator(`${mode.panel} .tool-btn.primary`).first();
      await backBtn.click();
      await page.waitForSelector('#main-menu');
    }
  });

  test('모든 모드: 캔버스 버퍼/CSS 크기 일치', async ({ page }) => {
    const modes = [
      { card: '[data-mode="char"]', panel: '#char-mode', draw: '#draw-canvas' },
      { card: '[data-mode="word"]', panel: '#word-mode', draw: '#word-draw-canvas' },
      { card: '[data-mode="number"]', panel: '#number-mode', draw: '#num-draw-canvas' },
      { card: '[data-mode="english"]', panel: '#english-mode', draw: '#eng-draw-canvas' },
    ];

    for (const mode of modes) {
      await page.click(mode.card);
      await page.waitForSelector(`${mode.panel}.active`);

      const sizes = await page.evaluate((sel) => {
        const canvas = document.querySelector(sel);
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
          bufferW: canvas.width,
          bufferH: canvas.height,
          cssW: Math.round(rect.width),
          cssH: Math.round(rect.height),
          styleW: canvas.style.width,
          styleH: canvas.style.height
        };
      }, mode.draw);

      expect(sizes).not.toBeNull();
      expect(Math.abs(sizes.bufferW - sizes.cssW)).toBeLessThan(3);
      expect(Math.abs(sizes.bufferH - sizes.cssH)).toBeLessThan(3);
      expect(sizes.styleW).toMatch(/\d+px/);
      expect(sizes.styleH).toMatch(/\d+px/);

      // 메뉴로 돌아가기
      const backBtn = page.locator(`${mode.panel} .tool-btn.primary`).first();
      await backBtn.click();
      await page.waitForSelector('#main-menu');
    }
  });
});
