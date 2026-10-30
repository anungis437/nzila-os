#!/usr/bin/env node
/**
 * Repository-wide structural P0 fail-closed checks. No dependencies/network.
 * This is a CI control, NOT a substitute for protected branch rules or runtime
 * broker sandbox enforcement.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = p => readFileSync(join(root, p), 'utf8')
const fail = msg => { throw new Error('P0 governance: ' + msg) }
const requireText = (path, fragment) => {
  if (!read(path).includes(fragment)) fail(path + ' missing mandatory invariant: ' + fragment)
}

export function validateMcpConfig(text) {
  let v
  try { v = JSON.parse(text) } catch { fail('malformed MCP configuration') }
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('MCP config must be an object')
  if (!v.mcpServers || typeof v.mcpServers !== 'object' || Array.isArray(v.mcpServers)) {
    fail('MCP config missing explicit mcpServers object')
  }
  if (Object.keys(v.mcpServers).length > 0) {
    fail('MCP servers are closed pending Tool Fabric broker readiness')
  }
  // Alternate top-level keys can be interpreted as executable providers by
  // other clients. A deny-only project config must not carry shadow settings.
  if (Object.keys(v).length !== 1) {
    fail('MCP configuration contains unapproved top-level keys')
  }
  return true
}

export function validateFirstPartySkill(raw) {
  if (!raw.startsWith('---\n')) fail('skill missing frontmatter')
  const end = raw.indexOf('\n---', 4)
  if (end < 0) fail('skill frontmatter not terminated')
  const front = raw.slice(4, end)
  for (const key of ['name:', 'description:', 'license:', 'version:']) {
    if (!front.includes(key)) fail('skill missing ' + key)
  }
  if (/^\s*(allowed[-_]?tools|permissions|approved|trust|grants?|auto[-_]?approve|capabilities|mcpServers|command|shell|execution)\s*:/mi.test(front)) {
    fail('skill attempts to encode authority')
  }
  if (raw.length > 256 * 1024) fail('skill exceeds size limit')
  return true
}

export function checkRepository() {
  const policy = JSON.parse(read('governance/engineering/authority-precedence.json'))
  const expected = [
    'LAW_SAFETY_PRIVACY', 'PLATFORM_SECURITY_AND_TOOL_FABRIC',
    'REPOSITORY_AGENTS_AND_REQUIRED_CHECKS',
    'PRODUCT_ACCEPTANCE_AND_DECISION_CONTRACTS',
    'CANONICAL_SKILL_PROCEDURES', 'AGENT_TASK_REQUEST',
  ]
  if (policy.schemaVersion !== 1 ||
      JSON.stringify(policy.authorityOrder) !== JSON.stringify(expected) ||
      policy.denyOnConflict !== true ||
      policy.skillMayGrantAuthority !== false ||
      policy.mcpMayGrantAuthority !== false ||
      policy.executionBrokerEnabled !== false ||
      policy.installerEnabled !== false) {
    fail('authority precedence or deny-only posture drifted')
  }

  // Reject shadow MCP configurations in the root and known project-local locations.
  for (const path of ['.cursor/mcp.json', '.mcp.json', '.agents/mcp.json', '.augment/mcp.json']) {
    if (existsSync(join(root, path))) validateMcpConfig(read(path))
  }
  if (!existsSync(join(root, '.cursor/mcp.json'))) fail('Cursor project MCP config missing')

  requireText('AGENTS.md', 'Canonical Engineering Governance')
  requireText('AGENTS.md', 'governance/engineering/authority-precedence.json')
  requireText('packages/tool-fabric/src/gate.ts', 'executionAuthorized: false')
  requireText('packages/tool-fabric/src/gate.ts', 'installAuthorized: false')
  requireText('packages/tool-fabric/src/gate.ts', 'allowed: false')
  requireText('packages/platform-agent-workflows/src/workflowRunner.ts', 'isVerifiedOutcomeFor')
  requireText('packages/platform-agent-workflows/src/workflowRunner.ts', 'isVerifiedPolicyPermitFor')
  requireText('packages/platform-agent-workflows/src/policy-permit.ts', 'TrustedPolicyAuthority')
  requireText('packages/platform-agent-workflows/src/workflowRunner.ts', "params.policyCheck?.result === 'allow'")
  requireText('packages/platform-agent-workflows/src/workflowRunner.ts', 'serializeOutcomeProof')
  requireText('packages/platform-agent-workflows/src/types.ts', 'outcomeEvidenceSchema')
  requireText('CODEOWNERS', '/governance/engineering/**')

  const firstParty = join(root, 'skills/nzila')
  const crawl = dir => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      if (statSync(abs).isDirectory()) crawl(abs)
      else if (name === 'SKILL.md') validateFirstPartySkill(readFileSync(abs, 'utf8'))
    }
  }
  crawl(firstParty)
  const a = read('.agents/skills/codespring/SKILL.md')
  const b = read('.augment/skills/codespring/SKILL.md')
  if (a !== b) fail('external skill copies have diverged')

  // Existing CI classifier is the mandatory entrypoint for this fast guard.
  requireText('.github/workflows/ci.yml', 'node scripts/engineering/p0-static-guard.mjs')
  console.log('P0 structural governance: PASS (not release authorization)')
  return true
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { checkRepository() } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
