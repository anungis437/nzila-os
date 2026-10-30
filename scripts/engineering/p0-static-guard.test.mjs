import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateMcpConfig, validateFirstPartySkill, validateProtectedReleaseWorkflow, checkRepository } from './p0-static-guard.mjs'

test('deny local executable MCP configuration', () => {
  assert.equal(validateMcpConfig('{"mcpServers":{}}'), true)
  assert.throws(() => validateMcpConfig('{"mcpServers":{"danger":{"command":"sh"}}}'), /closed/)
  assert.throws(() => validateMcpConfig('not json'), /malformed/)
  assert.throws(() => validateMcpConfig('{"mcpServers":{},"servers":{"x":{"command":"sh"}}}'), /top-level/)
  assert.throws(() => validateMcpConfig('{"mcpServers":{},"inputs":[{"type":"promptString"}]}'), /top-level/)
})
test('skills never grant execution authority', () => {
  const good = '---\nname: sample\ndescription: sample\nlicense: proprietary\nversion: 1\n---\n'
  assert.equal(validateFirstPartySkill(good), true)
  assert.throws(() => validateFirstPartySkill(good.replace('version: 1', 'allowed-tools: Bash\\nversion: 1')), /authority/)
  assert.throws(() => validateFirstPartySkill(good.replace('version: 1', '  permissions: shell\\nversion: 1')), /authority/)
  assert.throws(() => validateFirstPartySkill(good.replace('version: 1', 'capabilities: [exec]\\nversion: 1')), /authority/)
  assert.throws(() => validateFirstPartySkill(good.replace('version: 1', 'auto-approve: true\\nversion: 1')), /authority/)
})
test('production housekeeping cannot silently bypass protected branch review', () => {
  const safe = 'name: Deploy Production\\n  post-deploy:\\n    permissions:\\n      contents: read\\n    steps:\\n      - uses: actions/upload-artifact@v4\\n'
  assert.equal(validateProtectedReleaseWorkflow(safe), true)
  assert.throws(() => validateProtectedReleaseWorkflow(safe.replace('contents: read','contents: write')), /must not push/)
  assert.throws(() => validateProtectedReleaseWorkflow(safe + '      - run: git push origin HEAD:main\\n'), /must not push/)
  assert.throws(() => validateProtectedReleaseWorkflow(safe.replace('actions/upload-artifact@v4','actions/checkout@v5')), /retain outputs/)
})
test('the actual checkout conforms to mandatory structural controls', () => {
  assert.equal(checkRepository(), true)
})
