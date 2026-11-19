// HTTP-level tests that don't need a database: routing, auth guard, CORS and error handling.
process.env.JWT_SECRET ||= 'test-secret-for-node-test-runner';

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { createCorsOptions, isOriginAllowed } from '../lib/cors';

const FRONTEND = 'https://messenger.example.com';
let server: Server;
let baseUrl: string;

before(async () => {
  const app = createApp(createCorsOptions(['http://localhost:3000', FRONTEND]));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

test('isOriginAllowed matches exact origins only', () => {
  const allowed = [FRONTEND];
  assert.equal(isOriginAllowed(undefined, allowed), true);
  assert.equal(isOriginAllowed(FRONTEND, allowed), true);
  assert.equal(isOriginAllowed('https://evil.vercel.app', allowed), false);
  assert.equal(isOriginAllowed(`${FRONTEND}.evil.com`, allowed), false);
});

test('GET /api/health responds ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('protected routes reject missing and forged tokens', async () => {
  const missing = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(missing.status, 401);

  const forged = jwt.sign({ userId: 'someone' }, 'wrong-secret');
  const res = await fetch(`${baseUrl}/api/conversations`, {
    headers: { Authorization: `Bearer ${forged}` },
  });
  assert.equal(res.status, 401);
});

test('CORS allows the configured frontend with credentials', async () => {
  const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: FRONTEND } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), FRONTEND);
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
});

test('CORS rejects unknown origins with 403', async () => {
  const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://attacker.vercel.app' } });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('unknown API routes return JSON 404', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });
});

test('malformed JSON body returns 400 instead of crashing', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email":',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Malformed JSON body' });
});

test('login validates input before touching the database', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.co' }),
  });
  assert.equal(res.status, 400);
});
