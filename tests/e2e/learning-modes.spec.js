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
  test('짝맞추기: 12장·짝 맞추기 + 퀴즈 난이도/연속', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    // 짝맞추기: 12장, 같은 pid 두 장 → matched
    await page.locator('button.mode-card[data-mode="match"]').click();
    await expect(page.locator('#match-mode')).toHaveClass(/active/);
    await expect(page.locator('#match-grid .match-card')).toHaveCount(12);
    const matchedOk = await page.evaluate(() => {
      const m = window.matchMode;
      let a = -1, b = -1;
      for (let i = 0; i < m.cards.length && a < 0; i++) {
        for (let j = i + 1; j < m.cards.length; j++) {
          if (m.cards[i].pid === m.cards[j].pid) { a = i; b = j; break; }
        }
      }
      m._onCard(a); m._onCard(b);
      return m.matched.has(a) && m.matched.has(b);
    });
    expect(matchedOk).toBe(true);
    await page.locator('#match-back-btn').click();

    // 퀴즈: 3지 난이도 → 보기 3개, 정답 클릭 → 연속 1
    await page.locator('button.mode-card[data-mode="quiz"]').click();
    await page.locator('.quiz-diff-btn[data-opt="3"]').click();
    await expect(page.locator('#quiz-options .quiz-option')).toHaveCount(3);
    const ans = await page.evaluate(() => window.quizMode.current.answer.word);
    await page.locator(`.quiz-option[data-word="${ans}"]`).click();
    await expect(page.locator('#quiz-score')).toContainText('연속 1');
    await page.locator('#quiz-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('카테고리 필터(단어카드·퀴즈·받아쓰기) + 받아쓰기 첫 글자 힌트', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    // 단어 카드: 칩 9개(전체+8), 동물 선택 시 동물만
    await page.locator('button.mode-card[data-mode="wordcard"]').click();
    await expect(page.locator('#wc-cats .cat-chip')).toHaveCount(9);
    const before = await page.evaluate(() => window.wordCardMode.cards.length);
    await page.locator('#wc-cats .cat-chip').filter({ hasText: '동물' }).click();
    const wc = await page.evaluate(() => ({
      cat: window.wordCardMode.category,
      len: window.wordCardMode.cards.length,
      allAnimal: window.wordCardMode.cards.every((c) => c.category === '동물')
    }));
    expect(wc.cat).toBe('동물');
    expect(wc.allAnimal).toBe(true);
    expect(wc.len).toBeLessThan(before);
    await page.locator('#wc-back-btn').click();

    // 퀴즈: 칩 렌더 + 카테고리 선택 시 풀 필터
    await page.locator('button.mode-card[data-mode="quiz"]').click();
    await expect(page.locator('#quiz-cats .cat-chip')).toHaveCount(9);
    await page.locator('#quiz-cats .cat-chip').filter({ hasText: '과일' }).click();
    const quizPool = await page.evaluate(() => window.quizMode._pool().every((v) => v.category === '과일'));
    expect(quizPool).toBe(true);
    await page.locator('#quiz-back-btn').click();

    // 받아쓰기: 칩 + 첫 글자 힌트
    await page.locator('button.mode-card[data-mode="dictation"]').click();
    await expect(page.locator('#dt-cats .cat-chip')).toHaveCount(9);
    await page.locator('#dt-hint-btn').click();
    await expect(page.locator('#dt-answer')).toContainText('첫 글자');
    expect(await page.evaluate(() => window.dictationMode.hinted)).toBe(true);
    await page.locator('#dt-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

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
    await expect(page.locator('#quiz-score')).toContainText('맞은 개수 1');

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
    expect(res.score).toBeGreaterThanOrEqual(100); // 50+50(+콤보 보너스)
    expect(res.level).toBeGreaterThanOrEqual(2); // 100점에서 Lv.2
    expect(res.badgeText).toContain('Lv.');
    expect(res.badgeText).toContain('점');

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('문장: 문장 카드·글자별 따라쓰기·네비게이션', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);
    await page.locator('button.mode-card[data-mode="sentence"]').click();
    await expect(page.locator('#sentence-mode')).toHaveClass(/active/);
    // 문장 텍스트·이모지·현재 글자
    await expect(page.locator('#sn-emoji')).not.toBeEmpty();
    await expect(page.locator('#sn-text .sn-syl.current')).toHaveCount(1);
    const ch1 = (await page.locator('#sn-label').textContent()) || '';
    expect(ch1.length).toBe(1);
    expect(ch1.trim().length).toBe(1); // 공백 글자는 건너뜀
    const dw = await page.locator('#sn-draw-canvas').evaluate((c) => /** @type {HTMLCanvasElement} */ (c).width);
    expect(dw).toBeGreaterThan(80);
    // 다음 글자
    await page.locator('#sn-next-btn').click();
    const ch2 = (await page.locator('#sn-label').textContent()) || '';
    expect(ch2.trim().length).toBe(1);
    await page.locator('#sn-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('설정 심화: 판정 난이도·배경음/효과음 + 메뉴 섹션 + 온보딩', async ({ page }) => {
    const errors = collectClientErrors(page);
    // 온보딩: 첫 로드 시 안내가 떠야 함(localStorage 비어 있음)
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const intro = page.locator('#intro-screen');
    if (await intro.isVisible().catch(() => false)) await intro.click({ force: true });
    await expect(page.locator('#onboard-screen')).toBeVisible();
    await page.locator('#onboard-start-btn').click();
    await expect(page.locator('#onboard-screen')).toBeHidden();
    await page.waitForSelector('#main-menu', { state: 'visible' });

    // 메뉴 섹션 헤더 5개
    await expect(page.locator('#mode-cards .mode-section')).toHaveCount(5);

    // 설정: 난이도 '쉽게' → traceJudgeLevel 반영
    await page.locator('button.mode-card[data-mode="settings"]').click();
    await expect(page.locator('#settings-judge .pen-width-btn')).toHaveCount(3);
    await page.locator('#settings-judge .pen-width-btn').filter({ hasText: '쉽게' }).click();
    const judge = await page.evaluate(() => ({ id: traceJudgeLevel(), r: _traceJudge().recall }));
    expect(judge.id).toBe('easy');
    expect(judge.r).toBeLessThan(0.85);
    // 효과음 토글
    const sfxOn0 = await page.evaluate(() => TraceSound.isSfxEnabled());
    await page.locator('#settings-sfx-btn').click();
    const sfxOn1 = await page.evaluate(() => TraceSound.isSfxEnabled());
    expect(sfxOn1).toBe(!sfxOn0);
    await page.locator('#settings-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('설정: 펜 색·굵기 변경이 TracePen에 반영되고 잉크 색이 바뀐다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);
    await page.locator('button.mode-card[data-mode="settings"]').click();
    await expect(page.locator('#settings-mode')).toHaveClass(/active/);
    // 색 스와치·굵기 버튼 렌더
    await expect(page.locator('#settings-colors .pen-swatch')).toHaveCount(7);
    await expect(page.locator('#settings-widths .pen-width-btn')).toHaveCount(3);
    // 파란색 + 굵게 선택 → TracePen 반영
    const res = await page.evaluate(() => {
      TracePen.setColor('#2f7fd1');
      TracePen.setWidth('thick');
      return { color: TracePen.color(), scale: TracePen.widthScale() };
    });
    expect(res.color).toBe('#2f7fd1');
    expect(res.scale).toBeGreaterThan(1);
    // 실제 잉크 색이 펜 색을 따르는지(char 모드 draw → 파란 픽셀)
    await page.locator('#settings-back-btn').click();
    await page.locator('button.mode-card[data-mode="char"]').click();
    const bluePixels = await page.evaluate(() => {
      const d = document.getElementById('draw-canvas');
      const ctx = d.getContext('2d');
      window.charMode.canvas.drawLine(d.width * 0.3, d.height * 0.3, d.width * 0.7, d.height * 0.7);
      const data = ctx.getImageData(0, 0, d.width, d.height).data;
      let blue = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 120 && data[i + 1] > 90 && data[i + 1] < 180 && data[i + 2] > 160 && data[i + 3] > 40) blue++;
      }
      return blue;
    });
    expect(bluePixels, '펜 색(파랑) 잉크 픽셀').toBeGreaterThan(0);
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('복습: 미완료 항목 큐·따라쓰기·완성 시 진도 반영·빈 상태', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    // 진도 일부 미리 채워, 복습 큐가 '미완료만' 모으는지 확인(자모 24 중 일부 완료)
    await page.evaluate(() => {
      // 자모 0~21 완료로 표시(2개 미완료), 숫자/영어는 전부 완료 → 자모 2개만 큐에
      localStorage.setItem('tracing.done.char.v1', JSON.stringify(Array.from({ length: 22 }, (_, i) => i)));
      localStorage.setItem('tracing.done.number.v1', JSON.stringify(Array.from({ length: 10 }, (_, i) => i)));
      localStorage.setItem('tracing.done.english.upper.v1', JSON.stringify(Array.from({ length: 26 }, (_, i) => i)));
      localStorage.setItem('tracing.done.english.lower.v1', JSON.stringify(Array.from({ length: 26 }, (_, i) => i)));
    });

    await page.locator('button.mode-card[data-mode="review"]').click();
    await expect(page.locator('#review-mode')).toHaveClass(/active/);

    // 큐 길이 = 미완료 자모 2개
    const qlen = await page.evaluate(() => window.reviewMode.queue.length);
    expect(qlen, '복습 큐 길이(미완료 자모 2)').toBe(2);
    await expect(page.locator('#rv-sub')).toContainText('복습 1 / 2');

    const dw = await page.locator('#rv-draw-canvas').evaluate((c) => /** @type {HTMLCanvasElement} */ (c).width);
    expect(dw, 'rv-draw-canvas width').toBeGreaterThan(80);

    // 가이드 글자를 그대로 덮어 완성 → 진도 반영 + 큐 감소
    await page.evaluate(async () => {
      const g = document.getElementById('rv-guide-canvas');
      const d = document.getElementById('rv-draw-canvas');
      d.getContext('2d').drawImage(g, 0, 0);
      window.reviewMode.updateFeedback();
      // onPointerUp 경로의 완성 처리 직접 호출
      const cov = window.reviewMode.updateFeedback();
      if (cov && cov.done) window.reviewMode._onComplete();
    });
    // 900ms 자동 넘김 후 큐 1개로
    await page.waitForFunction(() => window.reviewMode.queue.length === 1, null, { timeout: 3000 });

    await page.locator('#rv-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
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

    // 경로 데이터 존재 + STROKE_ORDER 와 획수 일치(헤더·카드·애니메이션 동기)
    const pathCheck = await page.evaluate(() => {
      if (typeof STROKE_PATHS === 'undefined' || typeof STROKE_ORDER === 'undefined') return { ok: false, mismatches: ['no data'] };
      const mismatches = [];
      let count = 0;
      for (const ch in STROKE_PATHS) {
        count++;
        const so = STROKE_ORDER[ch];
        if (so && so.steps && so.steps.length !== STROKE_PATHS[ch].length) {
          mismatches.push(`${ch}: paths ${STROKE_PATHS[ch].length} vs order ${so.steps.length}`);
        }
      }
      return { ok: count === 34, count, mismatches };
    });
    expect(pathCheck.count, '경로 데이터 글자 수(자모24+숫자10)').toBe(34);
    expect(pathCheck.mismatches, '획수 불일치 글자').toEqual([]);

    // 재생 클릭 시 글자 위 획순 애니메이션이 시작되고 오류가 없어야 함
    await page.locator('#so-play-btn').click();
    const animStarted = await page.evaluate(() => !!(window.strokeOrderMode && window.strokeOrderMode.guideLayer && window.strokeOrderMode.guideLayer.__soAnim));
    expect(animStarted, '획순 애니메이션 시작').toBe(true);
    await page.waitForTimeout(300);

    // 다음 글자(ㄴ)로 이동, 라벨 변경
    await page.locator('#so-next-btn').click();
    await expect(page.locator('#so-label')).toContainText('ㄴ');

    await page.locator('#so-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('보상 심화: 활동일 기록·콤보·스티커18 + 주간 달력 렌더', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);
    const res = await page.evaluate(() => {
      for (let i = 0; i < 12; i++) TraceRewards.award(10); // 빠른 연속 → 콤보 + 활동일 + 오늘목표
      const g = TraceRewards.get();
      const stk = TraceRewards.stickers();
      const days = TraceRewards.activeDays();
      return { total: stk.length, today: g.todayCount, daysHasToday: days.length >= 1 };
    });
    expect(res.total).toBe(18);            // 스티커 12→18
    expect(res.today).toBeGreaterThanOrEqual(10);
    expect(res.daysHasToday).toBe(true);

    // 나의 기록 화면에 주간 달력 7칸
    await page.locator('button.mode-card[data-mode="progress"]').click();
    await expect(page.locator('#progress-weekly .pg-day')).toHaveCount(7);
    await expect(page.locator('#progress-weekly .pg-day.today')).toHaveCount(1);
    await expect(page.locator('#progress-weekly .pg-day.on').first()).toBeVisible();
    await page.locator('#progress-back-btn').click();
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
    await expect(page.locator('#progress-stickers .pg-sticker')).toHaveCount(18);
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
    expect(res.total).toBe(18);
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

  test('숫자(1·4·7): 세리프 있어도 자연스러운 따라쓰기로 완성된다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);
    const res = await page.evaluate(() => {
      const W = 320, H = 320, PEN = W * 0.035;
      function trace(ch) {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const f = (Math.min(W, H) * 0.72) + 'px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
        const x = W / 2, y = H / 2 + Math.min(W, H) * 0.035;
        ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = f; ctx.fillText(ch, x, y);
        ctx.strokeStyle = '#000'; ctx.lineWidth = PEN; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.font = f; ctx.strokeText(ch, x, y);
        return c;
      }
      // 기본 '보통' 난이도(recall 0.85)에서 숫자 1·4·7 완전 따라쓰기가 완성돼야
      let done = 0, total = 0;
      for (const g of ['1', '4', '7']) { total++; if (traceEvaluateTracing(trace(g), g, { row: false }).done) done++; }
      return { done, total };
    });
    expect(res.done, '숫자 완성 개수').toBe(res.total);
    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('얇은 글자(ㅣ·ㅡ): 좌우로 살짝 빗나가게 따라 써도 완성된다', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    const res = await page.evaluate(() => {
      const W = 320, H = 320, PEN = W * 0.035;
      function thick(ch, dx) {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const f = (Math.min(W, H) * 0.72) + 'px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
        const x = W / 2 + (dx || 0), y = H / 2 + Math.min(W, H) * 0.035;
        ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = f; ctx.fillText(ch, x, y);
        ctx.strokeStyle = '#000'; ctx.lineWidth = PEN; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.font = f; ctx.strokeText(ch, x, y);
        return c;
      }
      let pass = 0, total = 0;
      // ㅣ는 가로 오프셋, ㅡ는 세로 오프셋(각자 얇은 축으로 빗나감)
      for (const off of [0, W * 0.025, W * 0.04]) {
        total++; if (traceEvaluateTracing(thick('ㅣ', off), 'ㅣ', { row: false }).done) pass++;
      }
      return { pass, total };
    });
    expect(res.pass, '얇은 글자가 빗나가도 완성된 횟수').toBe(res.total);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('낙서 차단: 막 긋기·상자 채우기는 미완성, 실제 따라쓰기는 완성', async ({ page }) => {
    const errors = collectClientErrors(page);
    await gotoApp(page);

    const res = await page.evaluate(() => {
      const W = 320, H = 320;
      function base() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
      function fontGlyph(ch) {
        const c = base(); const ctx = c.getContext('2d');
        ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = (Math.min(W, H) * 0.72) + 'px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
        ctx.fillText(ch, W / 2, H / 2 + Math.min(W, H) * 0.035);
        return c;
      }
      function boxFill() { const c = base(); const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(W * 0.22, H * 0.22, W * 0.56, H * 0.56); return c; }
      function zigzag() {
        const c = base(); const ctx = c.getContext('2d');
        ctx.strokeStyle = '#000'; ctx.lineWidth = W * 0.03; ctx.lineCap = 'round'; ctx.beginPath();
        let x = 0.2 * W; ctx.moveTo(x, 0.25 * H);
        for (let i = 0; i < 8; i++) { x += 0.075 * W; ctx.lineTo(x, (i % 2 ? 0.25 : 0.78) * H); }
        ctx.stroke(); return c;
      }
      const glyphs = ['ㅁ', 'ㅎ', 'ㅂ', '8'];
      let scribbleDone = 0, realDone = 0;
      for (const g of glyphs) {
        if (traceEvaluateTracing(boxFill(), g, { row: false }).done) scribbleDone++;
        if (traceEvaluateTracing(zigzag(), g, { row: false }).done) scribbleDone++;
        if (traceEvaluateTracing(fontGlyph(g), g, { row: false }).done) realDone++;
      }
      return { scribbleDone, realDone, n: glyphs.length };
    });

    expect(res.scribbleDone, '낙서인데 완성된 횟수').toBe(0);
    expect(res.realDone, '실제 글자인데 완성된 글자 수').toBe(res.n);

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
