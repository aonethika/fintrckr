import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import workspaceRoutes from '../routes/workspaceRoutes.js';
import authRoutes from '../routes/authRoutes.js';
import Statement from '../models/Statement.js';
import { categorize, validateRows, parseStatement } from '../services/statementParser.js';

function samplePdf() {
  const stream = 'BT /F1 12 Tf 50 700 Td (2026-10-20 Cafe 120.00 DR) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test('statement parsing validates complete files and suggests transparent categories', async () => {
  const parsed = await parseStatement(Buffer.from('date,description,amount,type\n2026-10-20,"Cafe, coffee",120,EXPENSE\n2026-10-20,Salary,85000,INCOME\n'), 'bank.csv');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].title, 'Cafe, coffee');
  assert.equal(parsed.rows[0].category, 'Food & drinks');
  assert.equal(categorize('Metro recharge'), 'Transport');
  assert.throws(() => validateRows([{ date: '2026-02-30', description: 'Invalid', amount: 1, type: 'EXPENSE' }]));
  assert.throws(() => validateRows([{ date: '2026-10-01', description: 'Invalid', amount: Infinity, type: 'EXPENSE' }]));
  assert.throws(() => validateRows([]));
  await assert.rejects(parseStatement(Buffer.from('date,description,amount,type\n2026-10-01,Good,1,EXPENSE\n2026-02-30,Bad,5,EXPENSE'), 'bad.csv'));
  const pdf = await parseStatement(samplePdf(), 'sample.pdf');
  assert.equal(pdf.fileType, 'PDF');
  assert.equal(pdf.rows[0].amount, 120);
  assert.equal(pdf.rows[0].transactionType, 'expense');
});

test('unified workspace: ownership, atomic imports, exact splits and two-stage settlements', { timeout: 600000 }, async () => {
  process.env.JWT_SECRET = 'finsight-isolated-test-secret-only';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Statement.init();
    const app = express();
    app.use(express.json({ limit: '4mb' }));
    app.use('/api/auth', authRoutes);
    app.use('/api/workspace', workspaceRoutes);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (path, token, method = 'GET', body, expected = 200) => {
      const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
      const result = await response.json();
      assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
      return result;
    };
    const register = async (name, i) => call('/auth/signup', null, 'POST', { name, email: `${name.toLowerCase()}@test.example`, phone_number: `999999999${i}`, password: 'only-for-testing-123' }, 201);
    const a = await register('Alice', 1), b = await register('Bob', 2), outsider = await register('Outside', 3);
    await call('/workspace', null, 'GET', null, 401);
    const account = await call('/workspace/accounts', a.token, 'POST', { name: 'Alice bank', institution: 'Sample', type: 'Bank', openingBalance: 1000, lastFour: '1234' }, 201);
    const transaction = { title: 'Lunch', date: '2026-10-20', amount: 100, transactionType: 'expense', category: 'Food & drinks', account: account._id };
    await call('/workspace/transactions', b.token, 'POST', transaction, 404);
    const created = await call('/workspace/transactions', a.token, 'POST', transaction, 201);
    await call(`/workspace/transactions/${created._id}`, b.token, 'PUT', { ...transaction, account: '' }, 404);
    await call(`/workspace/transactions/${created._id}`, a.token, 'PUT', { ...transaction, amount: 150 });
    const receiptForm = new FormData();
    Object.entries({ ...transaction, amount: '150' }).forEach(([key, value]) => receiptForm.append(key, value));
    receiptForm.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'receipt.png');
    const receipted = await call(`/workspace/transactions/${created._id}`, a.token, 'PUT', receiptForm);
    assert.match(receipted.image, /^data:image\/png;base64,/);
    await call('/workspace/budget', a.token, 'PUT', { month: '2026-10', amount: 5000 });
    await call('/workspace/budget', a.token, 'PUT', { month: '2026-10', amount: 1000, category: 'Food & drinks' });
    await call('/workspace/budget', a.token, 'PUT', { month: '2026-15', amount: 1000 }, 400);
    const form = new FormData(); form.append('file', new Blob(['date,description,amount,type\n2026-10-20,Spotify,119,EXPENSE\n2026-10-01,Salary,10000,INCOME']), 'bank.csv');
    const preview = await call('/workspace/statements/preview', a.token, 'POST', form);
    assert.equal(preview.rows.length, 2);
    const imported = { ...preview, account: account._id };
    await call('/workspace/statements/import', a.token, 'POST', imported, 201);
    await call('/workspace/statements/import', a.token, 'POST', imported, 409);
    await call('/workspace/statements/import', a.token, 'POST', { ...imported, rows: imported.rows.map(r => ({ ...r, category: 'Other' })) }, 409);
    await call('/workspace/statements/import', b.token, 'POST', imported, 400);
    const g = await call('/workspace/groups', a.token, 'POST', { name: 'Together', emails: ['bob@test.example'] }, 201);
    const split = { title: 'Dinner together', amount: 100.01, payer: a.user.id, splits: [{ user: a.user.id, amount: 50.01 }, { user: b.user.id, amount: 50 }] };
    await call(`/workspace/groups/${g._id}/splits`, outsider.token, 'POST', split, 404);
    await call(`/workspace/groups/${g._id}/splits`, a.token, 'POST', { ...split, amount: 200 }, 400);
    await call(`/workspace/groups/${g._id}/splits`, a.token, 'POST', split, 201);
    let state = await call('/workspace', a.token);
    assert.equal(state.transactions.filter(t => t.sourceSplit).length, 1);
    assert.equal(state.transactions.find(t => t.sourceSplit).amount, 50.01);
    const expense = state.groups[0].expenses[0];
    await call(`/workspace/splits/${expense._id}`, outsider.token, 'PUT', { member: b.user.id }, 404);
    await call(`/workspace/splits/${expense._id}`, a.token, 'PUT', { member: b.user.id }, 400);
    await call(`/workspace/splits/${expense._id}`, b.token, 'PUT', { member: b.user.id });
    await call(`/workspace/splits/${expense._id}`, a.token, 'PUT', { member: b.user.id });
    await call(`/workspace/splits/${expense._id}`, a.token, 'PUT', { member: b.user.id }, 400);
    state = await call('/workspace', a.token);
    assert.equal(state.transactions.find(t => t.sourceSplit).amount, 50.01, 'Reimbursement must never reduce the payer’s own expense');
    assert.equal(state.groups[0].expenses[0].splits.find(s => s.user === b.user.id).status, 'paid');
    const bob = await call('/workspace', b.token);
    assert.equal(bob.transactions.filter(t => t.sourceSplit).length, 1);
    assert.equal(bob.transactions.find(t => t.sourceSplit).amount, 50);
    assert.equal(state.budgets['2026-10'], 5000);
    assert.equal(state.categoryBudgets['2026-10']['Food & drinks'], 1000);
    assert.equal(state.statements.length, 1);
    await call(`/workspace/groups/${g._id}/messages`, outsider.token, 'POST', { text: 'Should not be allowed' }, 404);
    await call(`/workspace/groups/${g._id}/messages`, b.token, 'POST', { text: 'All accounted for.' });
    await call(`/workspace/transactions/${created._id}`, a.token, 'DELETE');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
