const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const source = readFileSync(join(__dirname, '../docker-entrypoint.cjs'), 'utf8');
function run(env, migrationStatus = 0) {
  const events = new EventEmitter();
  const child = new EventEmitter();
  const signals = [];
  let started = false;
  let migrationEnvironment;
  const exit = new Error('process exited');
  let exitCode;
  child.kill = signal => signals.push(signal);
  try {
    vm.runInNewContext(source, {
      URL,
      console: { error() {} },
      process: {
        env: { ...env }, execPath: 'node',
        on: events.on.bind(events),
        exit(code) { exitCode = code; throw exit; },
      },
      require(name) {
        assert.equal(name, 'node:child_process');
        return {
          spawnSync(command, args, options) {
            assert.equal(command, './node_modules/.bin/prisma');
            assert.equal(args.join(' '), 'migrate deploy');
            migrationEnvironment = options.env;
            return { status: migrationStatus };
          },
          spawn() { started = true; return child; },
        };
      },
    });
  } catch (error) {
    if (error !== exit) throw error;
  }
  return { started, migrationEnvironment, events, signals, exitCode };
}

test('encodes database credentials and requires TLS before migrations', () => {
  const result = run({ DB_HOST: 'database.internal', DB_PASSWORD: 'p@ss:/?#%', DB_USER: 'appuser' });
  const url = new URL(result.migrationEnvironment.DATABASE_URL);
  assert.equal(decodeURIComponent(url.password), 'p@ss:/?#%');
  assert.equal(url.hostname, 'database.internal');
  assert.equal(url.pathname, '/socialmedia');
  assert.equal(url.searchParams.get('sslmode'), 'require');
  assert.equal(result.started, true);
});

test('preserves DATABASE_URL for existing Docker Compose deployments', () => {
  const existing = 'postgresql://local:password@localhost:5432/localdb';
  const result = run({ DATABASE_URL: existing, DB_HOST: 'ignored', DB_PASSWORD: 'ignored' });
  assert.equal(result.migrationEnvironment.DATABASE_URL, existing);
});

test('does not start API after failed migrations', () => {
  const result = run({ DATABASE_URL: 'postgresql://test' }, 1);
  assert.equal(result.started, false);
  assert.equal(result.exitCode, 1);
});

test('forwards ECS shutdown signal to the API process', () => {
  const result = run({ DATABASE_URL: 'postgresql://test' });
  result.events.emit('SIGTERM');
  assert.deepEqual(result.signals, ['SIGTERM']);
});
