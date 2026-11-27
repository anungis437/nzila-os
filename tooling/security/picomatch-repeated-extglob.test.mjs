import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const modulePath = process.env.PICOMATCH_TEST_MODULE || require.resolve('picomatch')

// Each candidate is evaluated in a killable process: an unpatched dependency
// must fail this test, rather than hang the security runner's event loop.
for (const pattern of ['+(*)', '+(*a)', '*(*a)', '+(*?a)', '+(ab|abab)']) {
  for (const options of [{}, { maxExtglobRecursion: false }, { nocase: true }, { flags: 'giu' }, { bash: true }, { windows: true }, { capture: true }]) {
    test(`bounded repeated extglob ${pattern} ${JSON.stringify(options)}`, () => {
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          `
        const assert = require('node:assert/strict');
        const picomatch = require(${JSON.stringify(modulePath)});
        const pattern = ${JSON.stringify(pattern)};
        const match = picomatch(pattern, ${JSON.stringify(options)});
        assert.equal(match('a'.repeat(64) + '!'), false);
        assert.equal(match('ab'.repeat(64) + '!'), false);
        assert.equal(match(pattern), true);
      `,
        ],
        { encoding: 'utf8', timeout: 1500 },
      )
      assert.equal(result.error, undefined, result.error?.message)
      assert.equal(result.status, 0, result.stderr)
    })
  }
}

for (const [pattern, options, character] of [
  ['+(a|A)', { nocase: true }, 'a'],
  ['+(ab|ABAB)', { flags: 'i' }, 'ab'],
  ['+(k|K)', { flags: 'iu' }, 'k'],
  ['+(σ|ς)', { flags: 'iu' }, 'σ'],
]) {
  test(`bounded case-folded overlap ${pattern} ${JSON.stringify(options)}`, () => {
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const p = require(${JSON.stringify(modulePath)});
      const pattern = ${JSON.stringify(pattern)};
      const match = p(pattern, ${JSON.stringify(options)});
      assert.equal(match(${JSON.stringify(character)}.repeat(64) + '!'), false);
      assert.equal(match(pattern), true);
    `], { encoding: 'utf8', timeout: 1500 })
    assert.equal(result.error, undefined, result.error?.message)
    assert.equal(result.status, 0, result.stderr)
  })
}

test('ordinary workspace globs and safe extglobs keep their matching behavior', () => {
  const picomatch = require(modulePath)
  for (const [pattern, yes, no] of [
    [
      'apps/**/lib/*.{ts,tsx}',
      'apps/union-eyes/lib/example.ts',
      'apps/union-eyes/lib/example.json',
    ],
    ['+(foo|bar|baz)', 'foobarbazfoo', 'foobarquux'],
    ['@(read|write)', 'write', 'delete'],
    ['**/!(*.test).ts', 'lib/feature.ts', 'lib/feature.test.ts'],
    ['+(*(a)|*(b))', 'aaabbbb', 'aaac'],
    ['+(\\*)', '***', 'anything'],
  ]) {
    assert.equal(picomatch.isMatch(yes, pattern), true, pattern)
    assert.equal(picomatch.isMatch(no, pattern), false, pattern)
  }
  assert.equal(picomatch.scan('apps/**/lib/*.ts').isGlob, true)
  assert.ok(picomatch.makeRe('**/*.ts') instanceof RegExp)
  assert.equal(typeof picomatch.parse('**/*.ts').output, 'string')
})

// Negated extglobs generate their wildcard in emitted regex, without a star
// in the written branch. Repeating them must use the same literal fallback.
for (const pattern of ['+(!(a))', '*(!(a))', '+(@(!(a)))']) {
  for (const options of [{}, { maxExtglobRecursion: false }, { nocase: true }, { flags: 'giu' }, { bash: true }, { windows: true }, { capture: true }, { regex: false }, { fastpaths: false }, { dot: true }]) {
    test(`bounded generated-wildcard repeated extglob ${pattern} ${JSON.stringify(options)}`, () => {
      const result = spawnSync(process.execPath, ['--max-old-space-size=128', '-e', `
        const assert = require('node:assert/strict');
        const picomatch = require(${JSON.stringify(modulePath)});
        const pattern = ${JSON.stringify(pattern)};
        const match = picomatch(pattern, ${JSON.stringify(options)});
        assert.equal(match('b'.repeat(64) + '/'), false);
        assert.equal(match('ab'.repeat(64) + '/'), false);
        assert.equal(match('bbb'), false);
        assert.equal(match(pattern), true);
      `], { encoding: 'utf8', timeout: 1500 });
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.status, 0, result.stderr);
    });
  }
}

test('nonrepeated negation, literal bang openers and regex-group discrimination preserve matching', () => {
  const picomatch = require(modulePath);
  for (const [pattern, yes, no] of [
    ['!(a)', 'bbb', 'a'],
    ['@(!(a))', 'bbb', 'a'],
    ['**/!(*.test).ts', 'lib/feature.ts', 'lib/feature.test.ts'],
    ['+(\\!\\(a\\))', '!(a)!(a)', 'bbb'],
    ['+("!(a)")', '!(a)!(a)', 'bbb'],
    ['+([!(])', '!(!(', 'bbb'],
    ['+(!(?:a))', '!a!a', 'bbb'],
  ]) {
    assert.equal(picomatch.isMatch(yes, pattern), true, pattern);
    assert.equal(picomatch.isMatch(no, pattern), false, pattern);
  }
});
