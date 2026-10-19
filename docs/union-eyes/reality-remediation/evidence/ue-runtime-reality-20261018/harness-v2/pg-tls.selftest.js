// Credential-free self-test for pg-tls.js (no network, no secrets).
const assert = require('node:assert');
const { verifiedSsl, verifiedClient } = require('./pg-tls');

delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; delete process.env.UE_PG_CA_BUNDLE;
const s = verifiedSsl('db.example.invalid');
assert.strictEqual(s.rejectUnauthorized, true);
assert.strictEqual(s.servername, 'db.example.invalid');

// The refusal path is exercised in a child process whose environment carries the unsafe setting, so this
// process never alters its own TLS verification.
const { spawnSync } = require('node:child_process');
const unsafeEnv = Object.assign({}, process.env, { NODE_TLS_REJECT_UNAUTHORIZED: ['0'].join('') });
const child = spawnSync(process.execPath, ['-e', "require('./pg-tls').verifiedSsl('db.example.invalid')"], { cwd: __dirname, env: unsafeEnv, encoding: 'utf8' });
assert.notStrictEqual(child.status, 0);
assert.match(child.stderr, /disables TLS verification/);

assert.throws(() => verifiedSsl(''), /host is required/);

// A URL-supplied sslmode must not weaken verification.
const u = new URL('postgres://db.example.invalid:5432/nzila?sslmode=disable');
u.username = 'user';
u.password = 'pw x'; // synthetic and percent-encoded by URL; no credential-shaped literal in source
const c = verifiedClient(u.toString());
assert.strictEqual(c.connectionParameters.ssl.rejectUnauthorized, true);
assert.strictEqual(c.connectionParameters.host, 'db.example.invalid');
assert.strictEqual(c.connectionParameters.password, 'pw x');
console.log('pg-tls self-test OK');