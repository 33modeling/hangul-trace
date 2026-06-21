/**
 * @param {import('@playwright/test').Page} page
 */
async function dismissIntro(page) {
  const intro = page.locator('#intro-screen');
  if (await intro.isVisible().catch(() => false)) {
    await intro.click({ force: true });
    await expectHiddenOrDetached(intro);
  }
}

/**
 * @param {import('@playwright/test').Locator} locator
 */
async function expectHiddenOrDetached(locator) {
  await locator.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
}

/**
 * 첫 실행 온보딩 안내 닫기(처음 한 번만 뜸).
 * @param {import('@playwright/test').Page} page
 */
async function dismissOnboard(page) {
  const ob = page.locator('#onboard-screen');
  if (await ob.isVisible().catch(() => false)) {
    await page.locator('#onboard-start-btn').click({ force: true });
    await expectHiddenOrDetached(ob);
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 */
async function gotoApp(page, url = '/index.html') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await dismissIntro(page);
  await dismissOnboard(page);
  await page.waitForSelector('#main-menu', { state: 'visible' });
}

module.exports = {
  dismissIntro,
  dismissOnboard,
  gotoApp,
};
