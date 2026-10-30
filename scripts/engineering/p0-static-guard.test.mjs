import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateMcpConfig, validateFirstPartySkill, checkRepository } from './p0-static-guard.mjs'

test('deny local executable MCP configuration', () => {
  assert.equal(validateMcpConfig('{"mcpServers":{}}'), true)
  assert.throws(() => validateMcpConfig('{"mcpServers":{"danger":{"command":"sh"}}}'), /closed/)
  assert.throws(() => validateMcpConfig('not json'), /malformed/)
})
test('skills never grant execution authority', () => {
  const good = '---\nname: sample\ndescription: sample\nlicense: proprietary\nversion: 1\n---\n'
  assert.equal(validateFirstPartySkill(good), true)
  assert.throws(() => validateFirstPartySkill(good.replace('version: 1', 'allowed-tools: Bash\\nversion: 1')), /authority/)
})
test('the actual checkout conforms to mandatory structural controls', () => {
  assert.equal(checkRepository(), true)
})
