import assert from 'node:assert/strict'

/** App Router emits rootMainFiles as scripts, even when a custom chunk is CSS. */
export function verifyClientScriptManifest(manifest) {
  assert(Array.isArray(manifest.rootMainFiles) && manifest.rootMainFiles.length > 0,
    'Built App Router script manifest is required')
  const scripts = [
    ...manifest.rootMainFiles,
    ...Object.values(manifest.rootMainFilesTree ?? {}).flat(),
    ...(manifest.polyfillFiles ?? []),
  ]
  for (const file of scripts) {
    assert(typeof file === 'string' && /^static\/.+\.js$/.test(file) &&
      !file.split('/').includes('..'), `Non-JavaScript asset in script manifest: ${file}`)
  }
  return { status: 'PASS', rootScriptCount: manifest.rootMainFiles.length,
    checkedScriptCount: scripts.length }
}
