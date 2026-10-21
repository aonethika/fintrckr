import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('production serves the SPA, preserves API errors and validates the deployed frontend origin', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'finsight-static-'));
  let server;
  const previous = process.env.FRONTEND_URL;
  try {
    await writeFile(path.join(directory, 'index.html'), '<!doctype html><html><title>Finsight production test</title></html>');
    await writeFile(path.join(directory, 'app.js'), 'console.log("test asset");');
    process.env.FRONTEND_URL = 'https://fintrckr.netlify.app';
    server = createApp({ staticDirectory: directory }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/login`);
    assert.equal(login.status, 200); assert.match(await login.text(), /Finsight production test/);
    assert.equal(login.headers.get('x-content-type-options'), 'nosniff');
    const asset = await fetch(`${base}/app.js`); assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(`${base}/missing.js`)).status, 404);
    const missing = await fetch(`${base}/api/missing`);
    assert.equal(missing.status, 404); assert.equal((await missing.json()).message, 'API route not found.');
    const allowed = await fetch(`${base}/api/workspace`, { headers: { Origin: 'https://fintrckr.netlify.app' } });
    assert.equal(allowed.status, 401);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://fintrckr.netlify.app');
    assert.equal(allowed.headers.get('cache-control'), 'no-store');
    const blocked = await fetch(`${base}/api/workspace`, { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(blocked.status, 403); assert.match((await blocked.json()).message, /not allowed/);
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 503, 'Disconnected database must not report ready');
    const invalid = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid-json' });
    assert.equal(invalid.status, 400); assert.ok((await invalid.json()).message);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
