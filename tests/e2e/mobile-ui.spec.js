// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp } = require('./helpers');

/**
 * 모바일 UI 테스트 — 폰, 태블릿 세로/가로 모드
 * PC는 대상이 아님
 */

function collectClientErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'Galaxy S21', width: 360, height: 800 },
];

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`모바일 세로 — ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('메인 메뉴가 화면 안에 다 보임', async ({ page }) => {
      const errors = collectClientErrors(page);
      await gotoApp(page);

      const menu = page.locator('#main-menu');
      await expect(menu).toBeVisible();

      // 모든 모드 카드가 보이는지 (자모·첫걸음·받침·획순·단어·상급·내단어·내단어추가·숫자·영어·단어카드·퀴즈·그림받아쓰기·나의기록 = 14)
      const cards = page.locator('.mode-card');
      const count = await cards.count();
      expect(count).toBe(14);

      for (let i = 0; i < count; i++) {
        await expect(cards.nth(i)).toBeVisible();
      }

      expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('자음/모음 모드: 캔버스가 화면을 넘지 않음', async ({ page }) => {
      const errors = collectClientErrors(page);
      await gotoApp(page);

      await page.locator('button.mode-card[data-mode="char"]').click();
      await expect(page.locator('#char-mode')).toHaveClass(/active/);

      // 캔버스 래퍼가 뷰포트 안에 있는지
      const wrapBox = await page.locator('#canvas-wrap').boundingBox();
      expect(wrapBox).not.toBeNull();
      if (wrapBox) {
        expect(wrapBox.y + wrapBox.height).toBeLessThanOrEqual(vp.height + 50);
      }

      // 가이드 캔버스 버퍼가 0이 아닌지(버퍼는 DPR 배율이라 크기 자체만 확인)
      const gw = await page.locator('#guide-canvas').evaluate((c) => c.width);
      const gh = await page.locator('#guide-canvas').evaluate((c) => c.height);
      expect(gw).toBeGreaterThan(40);
      expect(gh).toBeGreaterThan(40);

      // 캔버스 "표시" 높이가 viewport 55% 이하인지 — 버퍼(DPR 배율) 대신 CSS px 로 검사
      const guideBox = await page.locator('#guide-canvas').boundingBox();
      expect(guideBox).not.toBeNull();
      expect(guideBox.height).toBeLessThanOrEqual(Math.floor(vp.height * 0.55) + 10);

      expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('단어 모드: 캔버스가 화면을 넘지 않음', async ({ page }) => {
      const errors = collectClientErrors(page);
      await gotoApp(page);

      await page.locator('button.mode-card[data-mode="word"]').click();
      await expect(page.locator('#word-mode')).toHaveClass(/active/);

      const wrapBox = await page.locator('#word-canvas-wrap').boundingBox();
      expect(wrapBox).not.toBeNull();
      if (wrapBox) {
        expect(wrapBox.y + wrapBox.height).toBeLessThanOrEqual(vp.height + 50);
      }

      expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('숫자 모드: 캔버스가 화면을 넘지 않음', async ({ page }) => {
      const errors = collectClientErrors(page);
      await gotoApp(page);

      await page.locator('button.mode-card[data-mode="number"]').click();
      await expect(page.locator('#number-mode')).toHaveClass(/active/);

      const wrapBox = await page.locator('#num-canvas-wrap').boundingBox();
      expect(wrapBox).not.toBeNull();
      if (wrapBox) {
        expect(wrapBox.y + wrapBox.height).toBeLessThanOrEqual(vp.height + 50);
      }

      expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('영어 모드: 캔버스가 화면을 넘지 않음', async ({ page }) => {
      const errors = collectClientErrors(page);
      await gotoApp(page);

      await page.locator('button.mode-card[data-mode="english"]').click();
      await expect(page.locator('#english-mode')).toHaveClass(/active/);

      const wrapBox = await page.locator('#eng-canvas-wrap').boundingBox();
      expect(wrapBox).not.toBeNull();
      if (wrapBox) {
        expect(wrapBox.y + wrapBox.height).toBeLessThanOrEqual(vp.height + 50);
      }

      expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('모든 버튼이 최소 44px 터치 타겟', async ({ page }) => {
      await gotoApp(page);

      await page.locator('button.mode-card[data-mode="char"]').click();
      await expect(page.locator('#char-mode')).toHaveClass(/active/);

      // 이전/다음 버튼
      const prevBtn = page.locator('#prev-btn');
      const nextBtn = page.locator('#next-btn');
      for (const btn of [prevBtn, nextBtn]) {
        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }

      // 툴바 버튼
      const toolBtns = page.locator('.tool-btn');
      const count = await toolBtns.count();
      for (let i = 0; i < count; i++) {
        const box = await toolBtns.nth(i).boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    });

    test('메뉴로 버튼이 모든 모드에서 작동', async ({ page }) => {
      const errors = collectClientErrors(page);
      await gotoApp(page);

      const modeBackBtnMap = {
        char: 'back-btn',
        word: 'word-back-btn',
        number: 'num-back-btn',
        english: 'eng-back-btn',
      };
      for (const [mode, btnId] of Object.entries(modeBackBtnMap)) {
        await page.locator(`button.mode-card[data-mode="${mode}"]`).click();
        await expect(page.locator(`#${mode}-mode`)).toHaveClass(/active/);

        const backBtn = page.locator(`#${btnId}`);
        await backBtn.click();
        await expect(page.locator('#main-menu')).toBeVisible();
      }

      expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
    });
  });
}

// 가로 모드 테스트
const LANDSCAPE_VIEWPORTS = [
  { name: 'iPhone SE 가로', width: 667, height: 375 },
  { name: 'iPhone 14 가로', width: 844, height: 390 },
  { name: 'iPad Mini 가로', width: 1024, height: 768 },
];

for (const vp of LANDSCAPE_VIEWPORTS) {
  test.describe(`모바일 가로 — ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('자음/모음 모드: 캔버스가 화면 안에 있음', async ({ page }) => {
      const errors = collectClientErrors(page);
      await gotoApp(page);

      await page.locator('button.mode-card[data-mode="char"]').click();
      await expect(page.locator('#char-mode')).toHaveClass(/active/);

      const wrapBox = await page.locator('#canvas-wrap').boundingBox();
      expect(wrapBox).not.toBeNull();
      if (wrapBox) {
        expect(wrapBox.y + wrapBox.height).toBeLessThanOrEqual(vp.height + 50);
      }

      expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('영어 모드 대소문자 토글이 정상 작동', async ({ page }) => {
      const errors = collectClientErrors(page);
      await gotoApp(page);

      await page.locator('button.mode-card[data-mode="english"]').click();
      await expect(page.locator('#english-mode')).toHaveClass(/active/);

      // 대문자가 기본
      await expect(page.locator('#eng-label')).toContainText('A');

      // 소문자로 전환
      await page.locator('.alpha-type-btn[data-type="lower"]').click();
      await expect(page.locator('#eng-label')).toContainText('a');

      // 다시 대문자로
      await page.locator('.alpha-type-btn[data-type="upper"]').click();
      await expect(page.locator('#eng-label')).toContainText('A');

      expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
    });
  });
}
