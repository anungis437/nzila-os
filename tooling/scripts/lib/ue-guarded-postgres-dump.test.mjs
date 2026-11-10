import test from 'node:test'
import assert from 'node:assert/strict'
import { sqlFromGuardedDump } from './ue-guarded-postgres-dump.mjs'
const wrap = sql => `-- header\n\\restrict nonce123\n${sql}\n\\unrestrict nonce123\n-- footer\n`
test('removes only matched client guards and preserves SQL and function bodies', () => {
  const sql = "CREATE FUNCTION f() RETURNS text LANGUAGE sql AS $$ SELECT '\\d' $$;"
  const result = sqlFromGuardedDump(wrap(sql))
  assert.ok(result.includes(sql))
  assert.ok(!result.includes('\\restrict'))
  assert.ok(!result.includes('\\unrestrict'))
})
test('refuses client commands, mismatched/missing guards, CRLF and SQL outside the closing guard', () => {
  for (const sql of ['\\! curl attacker', '\\copy t FROM PROGRAM x', '\\connect other', '  \\i other.sql', '\\restrict nested']) {
    assert.throws(() => sqlFromGuardedDump(wrap(sql)), /CLIENT_COMMAND_DENIED/)
  }
  assert.throws(() => sqlFromGuardedDump(wrap('SELECT 1;').replace('unrestrict nonce123', 'unrestrict other')), /CLIENT_COMMAND_DENIED/)
  assert.throws(() => sqlFromGuardedDump('-- no guard\n'), /GUARD_PAIR_REQUIRED/)
  assert.throws(() => sqlFromGuardedDump('SELECT 0;\n' + wrap('SELECT 1;')), /SQL_BEFORE_GUARD_DENIED/)
  assert.throws(() => sqlFromGuardedDump(wrap('SELECT 1;').replaceAll('\n', '\r\n')), /LF_REQUIRED/)
  assert.throws(() => sqlFromGuardedDump(wrap('SELECT 1;') + 'SELECT 2;'), /SQL_AFTER_GUARD_DENIED/)
})
