const { chromium } = require('C:/Users/avanthika/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5173/login');
    await page.getByRole('heading', { name: 'Make yourself at home.' }).waitFor();
    await page.screenshot({ path: 'finsight-premium-login.png', fullPage: true });
    await page.getByLabel('Email address').fill('alex@finsight.test');
    await page.getByLabel('Password', { exact: true }).fill('FinsightDemo!2026');
    await page.getByRole('button', { name: 'Sign in to Finsight' }).click();
    await page.waitForURL('**/insights');
    await page.locator('.analysis-metrics').waitFor();
    await page.locator('.analysis-start, .ai-report-summary').first().waitFor();
    await page.screenshot({ path: 'finsight-premium-analysis.png', fullPage: true });
    const semantic = await page.locator('.metric-symbol').evaluateAll(elements => elements.map(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor })));
    assert.equal(new Set(semantic.map(item => item.color)).size, 4, 'Summary icons should have distinct semantic accents');
    assert.equal(await page.locator('.analysis-metric').first().evaluate(el => getComputedStyle(el).backgroundImage), 'none', 'Surfaces must remain matte');
    const contrast = await page.locator('.button.primary').first().evaluate(el => {
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = color => rgb(color).map(n => { const s = n / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
      const style = getComputedStyle(el), a = luminance(style.color), b = luminance(style.backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(contrast >= 4.5, `Primary button text contrast must be readable: ${contrast}`);
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ['insights', 'dashboard', 'transactions', 'accounts', 'budgets', 'groups', 'statements', 'settings']) {
        await page.goto(`http://127.0.0.1:5173/${route}`);
        await page.locator('h1').waitFor();
        await page.locator('.loading-state').waitFor({ state: 'hidden' });
        if (route === 'insights') await page.locator('.analysis-start, .ai-report-summary').first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route} overflows at ${width}px`);
        if (width === 1440 && route === 'dashboard') await page.screenshot({ path: 'finsight-premium-overview.png', fullPage: true });
        if (width === 390 && route === 'insights') await page.screenshot({ path: 'finsight-premium-mobile.png', fullPage: true });
      }
    }
    await page.goto('http://127.0.0.1:5173/transactions');
    await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByLabel('Description', { exact: true }).evaluate(el => getComputedStyle(el).minHeight), '44px');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log(`PASS: premium accent palette; matte surfaces; primary contrast ${contrast.toFixed(2)}:1; all 8 pages at 5 widths; readable form controls and keyboard dismissal. No records changed or AI requests made.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
