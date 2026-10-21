const { chromium } = require('C:/Users/avanthika/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const assert = require('node:assert/strict');
const mongoose = require('./backend/node_modules/mongoose');
const { randomUUID } = require('node:crypto');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const email = `finsight-ai-check-${randomUUID()}@example.test`; let userId;
  try {
    const register = await fetch('http://127.0.0.1:5050/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'AI Browser QA', email, phone_number: `9${String(Date.now()).slice(-9)}`, password: randomUUID() }) }).then(r => r.json());
    assert.ok(register.token); userId = register.user.id;
    const headers = { Authorization: `Bearer ${register.token}`, 'Content-Type': 'application/json' };
    await page.goto('http://127.0.0.1:5173/login');
    await page.getByRole('heading', { name: 'Make yourself at home.' }).waitFor();
    await page.screenshot({ path: 'finsight-matte-login.png', fullPage: true });
    await page.evaluate(session => localStorage.setItem('finsight-session', JSON.stringify(session)), register);
    await page.goto('http://127.0.0.1:5173/insights');
    await page.getByRole('heading', { name: 'Every insight starts with your story.' }).waitFor();
    assert.equal(await page.getByText('A grounded review', { exact: true }).count(), 0);
    const style = await page.locator('.analysis-start').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage }));
    assert.equal(style.background, 'rgb(20, 20, 20)'); assert.equal(style.image, 'none');
    await page.screenshot({ path: 'finsight-matte-analysis.png', fullPage: true });
    const account = await fetch('http://127.0.0.1:5050/api/workspace/accounts', { method: 'POST', headers, body: JSON.stringify({ name: 'QA account', type: 'Bank', openingBalance: 10000 }) }).then(r => r.json());
    const month = new Date().toISOString().slice(0, 7);
    const expense = await fetch('http://127.0.0.1:5050/api/workspace/transactions', { method: 'POST', headers, body: JSON.stringify({ title: 'QA subscription', amount: 500, transactionType: 'expense', category: 'Subscriptions', date: `${month}-01`, account: account._id }) }).then(r => r.json());
    await page.reload();
    await page.getByRole('button', { name: 'Generate my analysis', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Generate my analysis', exact: true }).click();
    await page.getByRole('alert').getByText(/no available credits/).waitFor();
    assert.equal(await page.locator('.ai-report-summary').count(), 0, 'Quota failure must not produce a fabricated report');
    await page.screenshot({ path: 'finsight-ai-provider-status.png', fullPage: true });
    // Browser-only response fixtures exercise successful rendering without spending provider credits.
    // Backend tests separately verify the real HTTP integration and MongoDB persistence.
    const analysis = { report: { headline: 'UI test: a focused subscription review', summary: 'This is a browser-test report response, not a live model answer.', findings: [{ title: 'A subscription to review', detail: 'Check whether this subscription fits your monthly plan.', kind: 'watch', transactionIds: [expense._id] }], actions: [{ title: 'Review your spending target', detail: 'Set a realistic category budget for recorded subscriptions.' }], caveats: ['This test account contains only synthetic records.'] }, generatedAt: new Date().toISOString(), model: 'browser-test-fixture', provider: 'test-only', stale: false };
    let generated = false;
    await page.route('**/api/ai/analysis*', route => route.fulfill({ json: { analysis: route.request().method() === 'POST' ? (generated = true, analysis) : generated ? analysis : null, hasData: true } }));
    await page.getByRole('button', { name: 'Generate my analysis', exact: true }).click();
    await page.getByRole('heading', { name: analysis.report.headline }).waitFor();
    await page.getByText('1 supporting transaction', { exact: true }).click();
    await page.locator('.finding-evidence').filter({ hasText: 'QA subscription' }).waitFor();
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export review' }).click();
    assert.match((await download).suggestedFilename(), /^finsight-analysis-.*\.md$/);
    let chat = [];
    await page.route('**/api/ai/chat*', async route => {
      if (route.request().method() === 'POST') { const body = route.request().postDataJSON(); chat.push({ role: 'user', content: body.question }, { role: 'assistant', content: 'Browser test response: review the subscription against your recorded budget.' }); }
      if (route.request().method() === 'DELETE') chat = [];
      await route.fulfill({ json: { messages: chat } });
    });
    await page.getByRole('button', { name: 'Ask Finsight', exact: true }).click();
    await page.getByRole('textbox', { name: 'Ask Finsight AI' }).fill('Help me understand this subscription.');
    await page.getByRole('button', { name: 'Send question' }).click();
    await page.getByText('Browser test response: review the subscription against your recorded budget.', { exact: true }).waitFor();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('http://127.0.0.1:5173/insights');
      await page.getByRole('heading', { name: analysis.report.headline }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Analysis overflow at ${width}`);
      await page.getByRole('button', { name: /Ask Finsight/ }).first().click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Chat overflow at ${width}`);
    }
    await page.getByRole('button', { name: 'Clear conversation' }).click();
    await page.getByRole('heading', { name: 'A good question changes your perspective.' }).waitFor();
    await page.goto('http://127.0.0.1:5173/statements');
    await page.getByRole('button', { name: 'Import statement', exact: true }).click();
    await page.getByRole('checkbox', { name: 'AI extraction & category suggestions' }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'AI extraction & category suggestions' }).isChecked(), true);
    await page.route('**/api/workspace/statements/preview', async route => {
      assert.ok(route.request().postData().includes('name="useAI"'));
      await route.fulfill({ json: { name: 'test-ai.csv', fileType: 'CSV', analysisMethod: 'ai', rows: [{ title: 'Synthetic AI import', amount: 120, date: `${month}-02`, transactionType: 'expense', category: 'Groceries', categorySource: 'ai', aiConfidence: .91 }] } });
    });
    await page.locator('input[aria-label="Choose a bank statement"]').setInputFiles({ name: 'test-ai.csv', mimeType: 'text/csv', buffer: Buffer.from(`date,description,amount,type\n${month}-02,Synthetic AI import,120,EXPENSE`) });
    await page.getByText('AI confidence: 91%', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Import 1 transactions', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const saved = await fetch('http://127.0.0.1:5050/api/workspace', { headers }).then(r => r.json());
    assert.equal(saved.transactions.find(t => t.title === 'Synthetic AI import').categorySource, 'ai');
    assert.equal(saved.transactions.find(t => t.title === 'Synthetic AI import').aiConfidence, .91);
    assert.deepEqual(errors, []);
    console.log('PASS: matte-black surfaces, empty-data state, real provider quota error, report/chat rendering, evidence, export, responsive AI screens, AI import option and saved confidence metadata. Success fixtures were browser-test-only; no fake replies were saved.');
  } finally {
    await browser.close();
    await mongoose.connect('mongodb://127.0.0.1:27018/finsight?replicaSet=finsight-local');
    const db = mongoose.connection.db, user = await db.collection('users').findOne({ email });
    if (user && (!userId || user._id.toString() === userId)) {
      for (const collection of ['accounts', 'transactions', 'statements', 'aianalyses', 'aiconversations']) await db.collection(collection).deleteMany({ user: user._id });
      await db.collection('users').deleteOne({ _id: user._id, email });
    }
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error); process.exit(1); });
