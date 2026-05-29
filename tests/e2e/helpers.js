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
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 */
async function gotoApp(page, url = '/index.html') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await dismissIntro(page);
  await page.waitForSelector('#main-menu', { state: 'visible' });
}

module.exports = {
  dismissIntro,
  gotoApp,
};
