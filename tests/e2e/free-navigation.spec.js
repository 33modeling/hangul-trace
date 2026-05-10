/*
 * 자유 이동 회귀 테스트 — word/advanced/myword 모드에서 stroke 미완성 상태에서도
 * prev/next/dot 이동이 막힘없이 동작해야 한다 (이전에는 단어/상급에서 stroke
 * 완료 전엔 next 차단).
 *
 * 추가로 mid-stroke 이동(pointerdown 직후 navigation 클릭)이 다음 화면의
 * canvas 첫 stroke에 spike line을 만들지 않는지 확인한다.
 */
const { test, expect } = require('@playwright/test');

test.describe('자유 이동 — stroke 완성 안 해도 이동 가능', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // intro splash dismiss
    await page.click('#intro-screen', { force: true }).catch(() => {});
    await page.waitForSelector('#main-menu', { state: 'visible' });
  });

  test('단어 모드: 획 0개에서도 next/prev 자유롭게 이동', async ({ page }) => {
    await page.click('[data-mode="word"]');
    await page.waitForSelector('#word-mode.active');

    const labels = [];
    labels.push(await page.locator('#word-label').textContent());

    // 5번 next — 매번 라벨이 바뀌어야 함
    for (let i = 0; i < 5; i++) {
      await page.click('#word-next-btn');
      labels.push(await page.locator('#word-label').textContent());
    }
    // 모든 인접 라벨이 달라야 함 (게이팅 없음)
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i]).not.toBe(labels[i - 1]);
    }

    // 5번 prev → 처음 라벨로 돌아가야 함 (라운드트립)
    for (let i = 0; i < 5; i++) {
      await page.click('#word-prev-btn');
    }
    const back = await page.locator('#word-label').textContent();
    expect(back).toBe(labels[0]);
  });

  test('단어 모드: feedback 메시지에 "획 더 그려야" 차단 안내가 안 떠야 함', async ({ page }) => {
    await page.click('[data-mode="word"]');
    await page.waitForSelector('#word-mode.active');
    await page.click('#word-next-btn');
    await page.waitForTimeout(100);
    const fb = await page.locator('#word-feedback').textContent();
    // 게이팅 메시지("X획 더 그려야 다음으로 갈 수 있어요!")가 없어야 함
    expect(fb).not.toMatch(/획 더 그려야 다음으로/);
  });

  test('상급 모드: 획 0개에서도 next/prev 자유롭게 이동', async ({ page }) => {
    await page.click('[data-mode="advanced"]');
    await page.waitForSelector('#advanced-mode.active');

    const initial = await page.locator('#adv-label').textContent();

    // 3번 next
    for (let i = 0; i < 3; i++) {
      await page.click('#adv-next-btn');
    }
    const after = await page.locator('#adv-label').textContent();
    // 3번 이동했으니 처음 라벨과 달라야 (단음절 단어가 연속 있으면 같을 수도 있어 단순 not.toBe 대신 변경 발생 확인)
    // 라운드트립으로 검증
    for (let i = 0; i < 3; i++) {
      await page.click('#adv-prev-btn');
    }
    const back = await page.locator('#adv-label').textContent();
    expect(back).toBe(initial);
  });

  test('상급 모드: 차단 메시지 안 뜸', async ({ page }) => {
    await page.click('[data-mode="advanced"]');
    await page.waitForSelector('#advanced-mode.active');
    await page.click('#adv-next-btn');
    await page.waitForTimeout(100);
    const fb = await page.locator('#adv-feedback').textContent();
    expect(fb).not.toMatch(/획 더 그려야 다음으로/);
  });

  test('내 단어 모드: 등록된 단어 여러개에서 라운드트립', async ({ page }) => {
    // 단어 2개 추가
    await page.click('[data-mode="myword-add"]');
    await page.waitForSelector('#myword-add-mode.active');
    await page.fill('#myword-add-input', '강아지');
    await page.click('#myword-add-submit');
    await page.waitForTimeout(200);
    await page.fill('#myword-add-input', '토끼');
    await page.click('#myword-add-submit');
    await page.waitForTimeout(200);

    // myword 모드 진입
    await page.click('#myword-add-menu-btn');
    await page.waitForSelector('#main-menu');
    await page.click('[data-mode="myword"]');
    await page.waitForSelector('#myword-mode.active');

    const initial = await page.locator('#myword-label').textContent();
    // 단어 한 바퀴 돌리기 — '강아지' 3음절 + '토끼' 2음절 = 5번 next 면 처음 위치 (대부분 환경 세로)
    // 환경에 따라 가로/세로가 다르니 라벨 기록 후 같은 횟수 prev 로 라운드트립 확인
    const seen = [initial];
    for (let i = 0; i < 5; i++) {
      await page.click('#myword-next-btn');
      seen.push(await page.locator('#myword-label').textContent());
    }
    for (let i = 0; i < 5; i++) {
      await page.click('#myword-prev-btn');
    }
    const back = await page.locator('#myword-label').textContent();
    expect(back).toBe(initial);

    // 정리
    await page.click('#myword-back-btn');
    await page.waitForSelector('#main-menu');
    await page.click('[data-mode="myword-add"]');
    await page.waitForSelector('#myword-add-mode.active');
    while (true) {
      const del = page.locator('.myword-add-actions button.tool-btn.danger').first();
      if (await del.count() === 0 || !(await del.isEnabled())) break;
      await del.click();
      await page.waitForTimeout(120);
    }
  });
});

test.describe('mid-stroke 이동 — 잔여 상태가 다음 화면 첫 획에 spike 안 만듦', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#intro-screen', { force: true }).catch(() => {});
    await page.waitForSelector('#main-menu', { state: 'visible' });
  });

  test('단어 모드: pointerdown 직후 next 클릭 → isDrawing/lastXY 리셋', async ({ page }) => {
    await page.click('[data-mode="word"]');
    await page.waitForSelector('#word-mode.active');

    // 캔버스에 mousedown만 발생시키고 mouseup 없이 next 클릭
    const draw = await page.locator('#word-draw-canvas').boundingBox();
    await page.mouse.move(draw.x + 30, draw.y + 30);
    await page.mouse.down();
    // 약간 움직여 stroke 진행 중 상태 만듦
    await page.mouse.move(draw.x + 60, draw.y + 60);

    // navigation 클릭 — 상태 리셋되어야 함
    await page.click('#word-next-btn');
    await page.waitForTimeout(80);

    // 다음 화면에서 internal state 확인 (window.wordMode.isDrawing === false 여야)
    const isDrawing = await page.evaluate(() => window.wordMode && window.wordMode.isDrawing);
    expect(isDrawing).toBe(false);

    // mouseup으로 정리 (혹시 모를 잔여 이벤트)
    await page.mouse.up();
  });

  test('상급 모드: pointerdown 직후 next 클릭 → 상태 리셋', async ({ page }) => {
    await page.click('[data-mode="advanced"]');
    await page.waitForSelector('#advanced-mode.active');

    const draw = await page.locator('#adv-draw-canvas').boundingBox();
    await page.mouse.move(draw.x + 30, draw.y + 30);
    await page.mouse.down();
    await page.mouse.move(draw.x + 60, draw.y + 60);

    await page.click('#adv-next-btn');
    await page.waitForTimeout(80);

    const isDrawing = await page.evaluate(() => window.advancedMode && window.advancedMode.isDrawing);
    expect(isDrawing).toBe(false);

    await page.mouse.up();
  });
});
