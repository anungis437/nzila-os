import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyClientScriptManifest } from './ue-v2-client-assets.mjs'

const good = () => ({ rootMainFiles: ['static/chunks/webpack-a.js', 'static/chunks/main-app-b.js'],
  rootMainFilesTree: {}, polyfillFiles: ['static/chunks/polyfills-c.js'],
  pages: { '/_app': ['static/css/valid-page-styles.css'] } })

test('permits page styles while requiring real App Router JavaScript roots', () => {
  assert.equal(verifyClientScriptManifest(good()).checkedScriptCount, 3)
})
test('rejects the actual staging stylesheet-as-script regression', () => {
  const manifest = good()
  manifest.rootMainFiles.splice(1, 0, 'static/css/1a2f07b5e81ac0f7.css')
  assert.throws(() => verifyClientScriptManifest(manifest), /Non-JavaScript asset/)
})
test('checks segment roots and polyfills too', () => {
  for (const change of [m => { m.rootMainFilesTree = { '/dashboard': ['static/css/wrong.css'] } },
    m => { m.polyfillFiles = ['static/css/wrong.css'] }]) {
    const manifest = good(); change(manifest)
    assert.throws(() => verifyClientScriptManifest(manifest), /Non-JavaScript asset/)
  }
})
test('fails closed on absent, empty and invalid script manifests', () => {
  for (const manifest of [{}, { rootMainFiles: [] }, { rootMainFiles: ['../outside.js'] },
    { rootMainFiles: ['static/chunks/runtime.js?not-an-immutable-asset'] }]) {
    assert.throws(() => verifyClientScriptManifest(manifest))
  }
})
