// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * 터치/클릭 안정성 테스트
 * 모바일에서 터치 이벤트가 정상 처리되는지 확인
 */

function collectClientErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test.describe('터치 이벤트 안정성', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('자음/모음 모드: 캔버스 터치로 그리기가 정상 작동', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    // 캔버스에 터치 드로잉 시뮬레이션
    const canvas = page.locator('#draw-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // 터치 다운 → 무브 → 업
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30, { steps: 5 });
    await page.mouse.up();

    // 피드백이 업데이트되었는지 확인 (획수 증가)
    const feedback = page.locator('#feedback');
    await expect(feedback).not.toBeEmpty();

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('지우기 버튼이 캔버스를 초기화', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    // 그리기
    const canvas = page.locator('#draw-canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30, { steps: 5 });
      await page.mouse.up();
    }

    // 지우기
    await page.locator('#clear-btn').click();

    // 피드백이 초기화되었는지
    const feedback = page.locator('#feedback');
    const text = await feedback.textContent();
    expect(text).toContain('0');

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('획순 보기 버튼이 정상 작동', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="char"]').click();
    await expect(page.locator('#char-mode')).toHaveClass(/active/);

    // 획순 보기 클릭
    await page.locator('#hint-btn').click();

    // 1초 대기 후 가이드가 원래 색으로 복원되는지
    await page.waitForTimeout(1200);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('숫자 모드: 이전/다음 네비게이션이 정상', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="number"]').click();
    await expect(page.locator('#number-mode')).toHaveClass(/active/);

    // 0 → 1
    await expect(page.locator('#num-label')).toContainText('0');
    await page.locator('#num-next-btn').click();
    await expect(page.locator('#num-label')).toContainText('1');

    // 1 → 0
    await page.locator('#num-prev-btn').click();
    await expect(page.locator('#num-label')).toContainText('0');

    // 0 → 9 (wrap)
    await page.locator('#num-prev-btn').click();
    await expect(page.locator('#num-label')).toContainText('9');

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('영어 모드: 대소문자 토글 후 캔버스가 정상', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    await page.locator('button.mode-card[data-mode="english"]').click();
    await expect(page.locator('#english-mode')).toHaveClass(/active/);

    // 대문자 A
    await expect(page.locator('#eng-label')).toContainText('A');

    // 소문자로 전환
    await page.locator('.alpha-type-btn[data-type="lower"]').click();
    await expect(page.locator('#eng-label')).toContainText('a');

    // 캔버스 크기가 정상인지
    const gw = await page.locator('#eng-guide-canvas').evaluate((c) => c.width);
    expect(gw).toBeGreaterThan(40);

    // 다시 대문자로
    await page.locator('.alpha-type-btn[data-type="upper"]').click();
    await expect(page.locator('#eng-label')).toContainText('A');

    // 캔버스 크기가 여전히 정상인지
    const gw2 = await page.locator('#eng-guide-canvas').evaluate((c) => c.width);
    expect(gw2).toBeGreaterThan(40);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('내 단어 모드 터치', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('단어 추가 → 내 단어 모드에서 연습 가능', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // 단어 추가
    await page.locator('button.mode-card[data-mode="myword-add"]').click();
    await expect(page.locator('#myword-add-mode')).toHaveClass(/active/);
    await page.locator('#myword-add-input').fill('사과');
    await page.locator('#myword-add-submit').click();
    await expect(page.locator('.myword-add-row')).toHaveCount(1);

    // 메뉴로
    await page.locator('#myword-add-back-btn').click();
    await expect(page.locator('#main-menu')).toBeVisible();

    // 내 단어 모드
    await page.locator('button.mode-card[data-mode="myword"]').click();
    await expect(page.locator('#myword-mode')).toHaveClass(/active/);
    await expect(page.locator('#myword-label')).toHaveText('사');

    // 캔버스 크기 정상
    const gw = await page.locator('#myword-guide-canvas').evaluate((c) => c.width);
    expect(gw).toBeGreaterThan(40);

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('단어 삭제가 정상 작동', async ({ page }) => {
    const errors = collectClientErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // 단어 추가
    await page.locator('button.mode-card[data-mode="myword-add"]').click();
    await page.locator('#myword-add-input').fill('포도');
    await page.locator('#myword-add-submit').click();
    await expect(page.locator('.myword-add-row')).toHaveCount(1);

    // 삭제
    await page.locator('button[data-action="del"]').click();
    await expect(page.locator('.myword-add-empty')).toBeVisible();

    expect(errors, `JS errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
