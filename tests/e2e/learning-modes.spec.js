// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp } = require('./helpers');

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

test.describe('소중한글 학습 기능 — 단어 카드 / 퀴즈 / 커버리지', () => {
  test('단어 카드: 그림·뜻 표시, 캔버스, 아는 단어 토글, 네비게이션', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    await page.locator('button.mode-card[data-mode="wordcard"]').click();
    await expect(page.locator('#wordcard-mode')).toHaveClass(/active/);

    // 그림·뜻·라벨이 채워짐
    await expect(page.locator('#wc-emoji')).not.toBeEmpty();
    await expect(page.locator('#wc-meaning')).not.toBeEmpty();
    const label1 = (await page.locator('#wc-label').textContent()) || '';
    expect(label1.length).toBeGreaterThan(0);

    // 따라쓰기 캔버스 크기
    const dw = await page.locator('#wc-draw-canvas').evaluate(
      (c) => /** @type {HTMLCanvasElement} */ (c).width
    );
    expect(dw, 'wc-draw-canvas width').toBeGreaterThan(80);

    // 아는 단어 토글 → aria-pressed 전환
    const known = page.locator('#wc-known-btn');
    await known.click();
    await expect(known).toHaveAttribute('aria-pressed', 'true');
    await known.click();
    await expect(known).toHaveAttribute('aria-pressed', 'false');

    // 다음 카드로 라벨 변경
    await page.locator('#wc-next-btn').click();
    const label2 = (await page.locator('#wc-label').textContent()) || '';
    expect(label2).not.toEqual(label1);

    // 메뉴 복귀
    await page.locator('#wc-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('단어 퀴즈: 보기 4개, 유형 토글, 다음 문제, 정답 선택', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    await page.locator('button.mode-card[data-mode="quiz"]').click();
    await expect(page.locator('#quiz-mode')).toHaveClass(/active/);

    // 보기 4개
    await expect(page.locator('#quiz-options .quiz-option')).toHaveCount(4);

    // 유형 토글: 단어 맞히기 → 여전히 보기 4개 + 단일 컬럼 클래스
    await page.locator('.quiz-type-btn[data-qtype="word"]').click();
    await expect(page.locator('.quiz-type-btn[data-qtype="word"]')).toHaveClass(/active/);
    await expect(page.locator('#quiz-options')).toHaveClass(/quiz-options-single/);
    await expect(page.locator('#quiz-options .quiz-option')).toHaveCount(4);

    // 다음 문제
    await page.locator('#quiz-next-btn').click();
    await expect(page.locator('#quiz-options .quiz-option')).toHaveCount(4);

    // 정답 클릭 → 점수 1 증가 (정답 단어를 DOM dataset 으로 찾아 클릭)
    await page.locator('.quiz-type-btn[data-qtype="meaning"]').click();
    const answerWord = await page.evaluate(() => window.quizMode.current.answer.word);
    await page.locator(`.quiz-option[data-word="${answerWord}"]`).click();
    await expect(page.locator('#quiz-score')).toHaveText('맞은 개수 1');

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('커버리지 엔진: 가이드 글자를 그대로 덮으면 완성(done) 판정', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    const result = await page.evaluate(() => {
      const guide = /** @type {HTMLCanvasElement} */ (document.getElementById('guide-canvas'));
      const draw = /** @type {HTMLCanvasElement} */ (document.getElementById('draw-canvas'));
      const dctx = draw.getContext('2d');
      // 가이드(글자)를 필기 레이어에 그대로 복사 → 완벽 커버리지.
      dctx.drawImage(guide, 0, 0);
      const idx = window.charMode.currentIdx;
      const target = COMMON.CHARS[idx].ch;
      const covered = traceEvaluateTracing(draw, target, { row: false });
      // 빈 캔버스는 미완성
      dctx.clearRect(0, 0, draw.width, draw.height);
      const empty = traceEvaluateTracing(draw, target, { row: false });
      return { covered, empty };
    });

    expect(result.covered.done, 'traced glyph should complete').toBe(true);
    expect(result.covered.recall).toBeGreaterThan(0.6);
    expect(result.empty.done, 'empty canvas should not complete').toBe(false);
    expect(result.empty.progress).toBe(0);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
