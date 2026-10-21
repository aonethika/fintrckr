const { chromium } = require('C:/Users/avanthika/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const assert = require('node:assert/strict');
const mongoose = require('./backend/node_modules/mongoose');
const { randomUUID } = require('node:crypto');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const email = `finsight-check-${randomUUID()}@example.test`;
  const password = randomUUID();
  let userId;
  try {
    await page.goto('http://127.0.0.1:5173/dashboard');
    await page.waitForURL('**/login');
    assert.equal(await page.getByText('Demo mode', { exact: true }).count(), 0);
    await page.screenshot({ path: 'finsight-login.png', fullPage: true });
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByLabel('Your name').fill('Finsight QA');
    await page.getByLabel('Phone number').fill(`9${String(Date.now()).slice(-9)}`);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create your account', exact: true }).click();
    await page.waitForURL('**/insights');
    await page.getByRole('heading', { name: 'Every insight starts with your story.' }).waitFor();
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('finsight-session')));
    userId = session.user.id;
    const initial = await fetch('http://127.0.0.1:5050/api/workspace', { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json());
    assert.equal(initial.transactions.length, 0);
    assert.equal(initial.accounts.length, 0);
    assert.equal(initial.groups.length, 0);
    await page.goto('http://127.0.0.1:5173/accounts');
    await page.getByRole('button', { name: 'Add account', exact: true }).click();
    await page.getByLabel('Account name').fill('QA checking');
    await page.getByLabel('Opening balance (₹)').fill('1000');
    await page.getByRole('dialog').getByRole('button', { name: 'Add account', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('heading', { name: 'QA checking', exact: true }).waitFor();
    await page.goto('http://127.0.0.1:5173/transactions');
    await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
    await page.getByLabel('Description', { exact: true }).fill('Saved to MongoDB');
    await page.getByLabel('Amount (₹)', { exact: true }).fill('125.50');
    await page.getByRole('dialog').getByRole('button', { name: 'Add transaction', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.reload();
    await page.getByText('Saved to MongoDB', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL('**/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in to Finsight' }).click();
    await page.waitForURL('**/insights');
    await page.goto('http://127.0.0.1:5173/transactions');
    await page.getByText('Saved to MongoDB', { exact: true }).waitFor();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of ['dashboard', 'transactions', 'accounts', 'budgets', 'groups', 'statements', 'insights', 'settings']) {
        await page.goto(`http://127.0.0.1:5173/${path}`);
        await page.locator('h1').waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Overflow at ${width}px on ${path}`);
      }
    }
    await page.goto('http://127.0.0.1:5173/dashboard');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL('**/login');
    await page.screenshot({ path: 'finsight-login-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
    console.log('PASS: protected routes, real registration, empty new account, account/transaction saves, reload persistence, logout/login persistence, all workspace pages at 3 widths; no demo or browser errors.');
  } finally {
    await browser.close();
    // Remove only records belonging to the unique QA account created by this run.
    await mongoose.connect('mongodb://127.0.0.1:27018/finsight?replicaSet=finsight-local');
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email });
    if (user && (!userId || user._id.toString() === userId)) {
      for (const collection of ['accounts', 'transactions', 'statements']) await db.collection(collection).deleteMany({ user: user._id });
      await db.collection('users').deleteOne({ _id: user._id, email });
    }
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error); process.exit(1); });
