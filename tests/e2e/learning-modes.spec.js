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

  test('첫걸음 파닉스: 조합(자음+모음=글자) 표시, 캔버스, 네비게이션', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    await page.locator('button.mode-card[data-mode="phonics"]').click();
    await expect(page.locator('#phonics-mode')).toHaveClass(/active/);

    // 조합 타일이 채워짐 (자음·모음·결과 글자)
    await expect(page.locator('#ph-cons-ch')).not.toBeEmpty();
    await expect(page.locator('#ph-vow-ch')).not.toBeEmpty();
    const syl1 = (await page.locator('#ph-syl-ch').textContent()) || '';
    expect(syl1.length).toBeGreaterThan(0);
    // 라벨 = 결과 음절
    await expect(page.locator('#ph-label')).toHaveText(syl1);

    // 따라쓰기 캔버스 크기
    const dw = await page.locator('#ph-draw-canvas').evaluate(
      (c) => /** @type {HTMLCanvasElement} */ (c).width
    );
    expect(dw, 'ph-draw-canvas width').toBeGreaterThan(80);

    // 다음 → 결과 음절 변경
    await page.locator('#ph-next-btn').click();
    const syl2 = (await page.locator('#ph-syl-ch').textContent()) || '';
    expect(syl2).not.toEqual(syl1);

    // 메뉴 복귀
    await page.locator('#ph-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('받침: 조합(자음+모음+받침=글자) 표시, 캔버스, 네비게이션', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    await page.locator('button.mode-card[data-mode="batchim"]').click();
    await expect(page.locator('#batchim-mode')).toHaveClass(/active/);

    await expect(page.locator('#bt-cons-ch')).not.toBeEmpty();
    await expect(page.locator('#bt-vow-ch')).not.toBeEmpty();
    await expect(page.locator('#bt-jong-ch')).not.toBeEmpty();
    const syl1 = (await page.locator('#bt-syl-ch').textContent()) || '';
    expect(syl1.length).toBeGreaterThan(0);
    await expect(page.locator('#bt-label')).toHaveText(syl1);

    const dw = await page.locator('#bt-draw-canvas').evaluate(
      (c) => /** @type {HTMLCanvasElement} */ (c).width
    );
    expect(dw, 'bt-draw-canvas width').toBeGreaterThan(80);

    await page.locator('#bt-next-btn').click();
    const syl2 = (await page.locator('#bt-syl-ch').textContent()) || '';
    expect(syl2).not.toEqual(syl1);

    await page.locator('#bt-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('그림 받아쓰기: 그림·뜻 표시, 정답 숨김→정답 보기, 네비게이션', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    await page.locator('button.mode-card[data-mode="dictation"]').click();
    await expect(page.locator('#dictation-mode')).toHaveClass(/active/);

    // 그림·뜻 보이고, 정답은 숨겨져 있어야 함
    await expect(page.locator('#dt-emoji')).not.toBeEmpty();
    await expect(page.locator('#dt-meaning')).not.toBeEmpty();
    await expect(page.locator('#dt-answer')).toBeHidden();

    // 정답 보기 → 정답 노출
    await page.locator('#dt-reveal-btn').click();
    await expect(page.locator('#dt-answer')).toBeVisible();
    await expect(page.locator('#dt-answer')).toContainText('정답');

    // 다음 문제 → 정답 다시 숨김
    await page.locator('#dt-next-btn').click();
    await expect(page.locator('#dt-answer')).toBeHidden();

    await page.locator('#dt-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('보상: award 시 점수·레벨 배지가 갱신된다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    const res = await page.evaluate(() => {
      const a = TraceRewards.award(50);
      const b = TraceRewards.award(50);
      const g = TraceRewards.get();
      const badge = document.getElementById('menu-reward-badge');
      return { score: g.score, level: g.level, badgeText: badge ? badge.textContent : '' };
    });
    expect(res.score).toBe(100);
    expect(res.level).toBeGreaterThanOrEqual(2); // 50점에서 Lv.2
    expect(res.badgeText).toContain('Lv.');
    expect(res.badgeText).toContain('점');

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('획순 익히기: 획순 카드·재생·캔버스·네비게이션', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    await page.locator('button.mode-card[data-mode="strokeorder"]').click();
    await expect(page.locator('#strokeorder-mode')).toHaveClass(/active/);

    // 첫 글자 'ㄱ'은 2획 → 획순 카드 2개가 정적으로 표시됨
    await expect(page.locator('#so-label')).toContainText('ㄱ');
    await expect(page.locator('#so-strip .stroke-step')).toHaveCount(2);

    // 캔버스 크기
    const dw = await page.locator('#so-draw-canvas').evaluate(
      (c) => /** @type {HTMLCanvasElement} */ (c).width
    );
    expect(dw, 'so-draw-canvas width').toBeGreaterThan(80);

    // 재생 버튼 클릭 시 오류 없이 동작(첫 카드 강조)
    await page.locator('#so-play-btn').click();
    await page.waitForTimeout(300);

    // 다음 글자(ㄴ)로 이동, 라벨 변경
    await page.locator('#so-next-btn').click();
    await expect(page.locator('#so-label')).toContainText('ㄴ');

    await page.locator('#so-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('나의 기록: 스티커 도감·모드별 통계·헤더가 렌더된다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    // 점수를 좀 쌓아 스티커가 해금되게 한 뒤 진입
    await page.evaluate(() => { for (let i = 0; i < 3; i++) TraceRewards.award(20); });

    await page.locator('button.mode-card[data-mode="progress"]').click();
    await expect(page.locator('#progress-mode')).toHaveClass(/active/);

    // 헤더(레벨/오늘목표 링), 스티커 그리드, 통계가 채워짐
    await expect(page.locator('#progress-head')).toContainText('Lv.');
    await expect(page.locator('#progress-stickers .pg-sticker')).toHaveCount(12);
    await expect(page.locator('#progress-stickers .pg-sticker.earned').first()).toBeVisible();
    await expect(page.locator('#progress-stats .pg-stat-row').first()).toBeVisible();

    await page.locator('#progress-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('보상: 데일리 카운트·스티커가 award로 갱신된다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    const res = await page.evaluate(() => {
      const r1 = TraceRewards.award(10); // 첫 글자 → 'first' 스티커
      const g = TraceRewards.get();
      const stk = TraceRewards.stickers();
      return {
        today: g.todayCount, goal: g.goal,
        firstEarned: stk.find((s) => s.id === 'first').earned,
        newStickerId: r1.newSticker ? r1.newSticker.id : null,
        total: stk.length
      };
    });
    expect(res.today).toBeGreaterThanOrEqual(1);
    expect(res.goal).toBe(10);
    expect(res.total).toBe(12);
    expect(res.firstEarned).toBe(true);
    expect(res.newStickerId).toBe('first');

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('"놓친 곳" 피드백: 부분 필기 시 가이드에 미작성 하이라이트가 칠해진다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    const res = await page.evaluate(() => {
      const draw = /** @type {HTMLCanvasElement} */ (document.getElementById('draw-canvas'));
      const dctx = draw.getContext('2d');
      // 글자 일부만 덮는 작은 획(완성 안 됨, 잉크는 있음)
      dctx.fillStyle = '#000';
      dctx.fillRect(draw.width * 0.45, draw.height * 0.1, draw.width * 0.1, draw.height * 0.3);
      const cov = window.charMode.updateFeedback();
      // 가이드 캔버스에 핑크(미작성) 픽셀이 칠해졌는지
      const g = /** @type {HTMLCanvasElement} */ (document.getElementById('guide-canvas'));
      const gctx = g.getContext('2d');
      const data = gctx.getImageData(0, 0, g.width, g.height).data;
      let pink = 0;
      for (let i = 0; i < data.length; i += 4) {
        // rgba(236,72,153,*) 계열: R 높고 G 낮고 B 중간
        if (data[i] > 180 && data[i + 1] < 130 && data[i + 2] > 110 && data[i + 3] > 30) pink++;
      }
      return { hasInk: cov.hasInk, done: cov.done, pink };
    });
    expect(res.hasInk).toBe(true);
    expect(res.done).toBe(false);
    expect(res.pink, 'guide should have missed-spot pink pixels').toBeGreaterThan(0);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('완성 판정: 글자를 절반만 그리면 미완성, 거의 다 그리면 완성', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    const res = await page.evaluate(() => {
      function glyphCanvas(ch, fracW) {
        const W = 320, H = 320;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = (Math.min(W, H) * 0.72) + 'px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
        ctx.fillText(ch, W / 2, H / 2 + Math.min(W, H) * 0.035);
        if (fracW < 1) ctx.clearRect(W * fracW, 0, W, H); // 오른쪽 일부 미작성
        return c;
      }
      const glyphs = ['ㅁ', 'ㅂ', 'ㄹ', 'ㅅ', 'A', '8'];
      let halfDone = 0, fullDone = 0;
      for (const g of glyphs) {
        if (traceEvaluateTracing(glyphCanvas(g, 0.5), g, { row: false }).done) halfDone++;
        if (traceEvaluateTracing(glyphCanvas(g, 1.0), g, { row: false }).done) fullDone++;
      }
      return { halfDone, fullDone, n: glyphs.length };
    });

    // 절반만 그린 경우 어떤 글자도 완성되면 안 됨(부분 작성 → 정답 버그 회귀 방지)
    expect(res.halfDone, '절반만 그렸는데 완성된 글자 수').toBe(0);
    // 전체를 그린 경우 모두 완성되어야 함
    expect(res.fullDone, '전체를 그렸는데 완성된 글자 수').toBe(res.n);

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
