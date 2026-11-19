// ECS injects the password from Secrets Manager; never log the connection URL.
const { spawnSync, spawn } = require('node:child_process');

if (!process.env.DATABASE_URL && process.env.DB_HOST && process.env.DB_PASSWORD) {
  const url = new URL(`postgresql://${process.env.DB_HOST}:5432/${process.env.DB_NAME || 'socialmedia'}`);
  url.username = encodeURIComponent(process.env.DB_USER || 'appuser');
  url.password = encodeURIComponent(process.env.DB_PASSWORD);
  url.searchParams.set('sslmode', 'require');
  process.env.DATABASE_URL = url.toString();
}

const migration = spawnSync('./node_modules/.bin/prisma', ['migrate', 'deploy'], {
  stdio: 'inherit', env: process.env,
});
if (migration.error || migration.status !== 0) {
  console.error('Database migration failed; API will not start.');
  process.exit(1);
}
const server = spawn(process.execPath, ['dist/index.js'], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.kill(signal));
}
server.on('error', () => process.exit(1));
server.on('exit', (code) => process.exit(code ?? 1));
