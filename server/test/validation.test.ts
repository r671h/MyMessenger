import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpError,
  isSafeFileUrl,
  MAX_MESSAGE_LENGTH,
  normalizeMessageContent,
  parseMemberIds,
  validateRegistration,
} from '../lib/validation';

test('validateRegistration normalizes email and username', () => {
  const { data, error } = validateRegistration({
    email: '  Alice@Example.COM ',
    username: ' alice_01 ',
    password: 'secret123',
  });
  assert.equal(error, undefined);
  assert.deepEqual(data, { email: 'alice@example.com', username: 'alice_01', password: 'secret123' });
});

test('validateRegistration rejects bad input', () => {
  assert.ok(validateRegistration({}).error);
  assert.ok(validateRegistration({ email: 'nope', username: 'alice', password: 'secret123' }).error);
  assert.ok(validateRegistration({ email: 'a@b.co', username: 'a', password: 'secret123' }).error);
  assert.ok(validateRegistration({ email: 'a@b.co', username: 'has space', password: 'secret123' }).error);
  assert.ok(validateRegistration({ email: 'a@b.co', username: 'alice', password: '123' }).error);
  assert.ok(validateRegistration({ email: 'a@b.co', username: 'alice', password: 42 }).error);
});

test('normalizeMessageContent trims and enforces limits', () => {
  assert.equal(normalizeMessageContent('  hi  '), 'hi');
  assert.equal(normalizeMessageContent('   '), null);
  assert.equal(normalizeMessageContent(undefined), null);
  assert.equal(normalizeMessageContent({ text: 'x' }), null);
  assert.equal(normalizeMessageContent('x'.repeat(MAX_MESSAGE_LENGTH + 1)), null);
});

test('isSafeFileUrl only allows http(s) links', () => {
  assert.equal(isSafeFileUrl('https://res.cloudinary.com/demo/image/upload/a.png'), true);
  assert.equal(isSafeFileUrl('http://localhost:4000/uploads/chat-files/a.pdf'), true);
  assert.equal(isSafeFileUrl('javascript:alert(1)'), false);
  assert.equal(isSafeFileUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeFileUrl('not a url'), false);
  assert.equal(isSafeFileUrl(undefined), false);
});

test('parseMemberIds accepts JSON arrays of strings only', () => {
  assert.deepEqual(parseMemberIds(undefined), []);
  assert.deepEqual(parseMemberIds('["a","b"]'), ['a', 'b']);
  assert.throws(() => parseMemberIds('{oops'), HttpError);
  assert.throws(() => parseMemberIds('[1,2]'), HttpError);
  assert.throws(() => parseMemberIds('"a"'), HttpError);
});
