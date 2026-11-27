/**
 * @nzila/tool-fabric — SKILL.md ingestion
 *
 * External skill text (CLI-Anything generates one per harness) is parsed
 * strictly as DATA. The output carries a content hash, a source reference,
 * a few bounded metadata fields, and advisory flags. It never carries
 * instructions an agent should follow, and it has no field that can express
 * trust, approval, or a grant.
 */
import { createHash } from 'node:crypto'

export const MAX_SKILL_BYTES = 256 * 1024

export type SkillFlagCode =
  | 'INSTRUCTION_OVERRIDE'
  | 'SELF_GRANT_ATTEMPT'
  | 'SECRET_DISCLOSURE'
  | 'APPROVAL_BYPASS'
  | 'REMOTE_CODE_EXECUTION'
  | 'CONCEALMENT'
  | 'DESTRUCTIVE_COMMAND'

export interface SkillFlag {
  readonly code: SkillFlagCode
  readonly excerpt: string
}

export interface SkillDescriptor {
  readonly instructionTrust: 'UNTRUSTED_DATA'
  readonly authority: 'NONE'
  readonly source: { readonly ref: string; readonly fetchedAt: string }
  readonly contentSha256: string
  readonly name: string | null
  readonly version: string | null
  /** Truncated, control-character-stripped summary. Display only. */
  readonly summary: string | null
  /** Level-3 headings under a "Command Groups" section. Claims, not grants. */
  readonly claimedCommandGroups: readonly string[]
  /** Frontmatter keys that tried to express trust or permissions; ignored. */
  readonly ignoredAuthorityKeys: readonly string[]
  readonly flags: readonly SkillFlag[]
}

const AUTHORITY_KEYS = new Set([
  'approved',
  'trusted',
  'trust',
  'trust_status',
  'grant',
  'grants',
  'permissions',
  'allowed-tools',
  'allowed_tools',
  'capabilities_granted',
  'authority',
  'auto_approve',
])

const FLAG_RULES: ReadonlyArray<readonly [SkillFlagCode, RegExp]> = [
  ['INSTRUCTION_OVERRIDE', /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|system|earlier)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?|polic(y|ies))\b/i],
  ['INSTRUCTION_OVERRIDE', /\byou are now\b|\bnew system prompt\b|\boverride (the )?(system|governance|policy)\b/i],
  ['SELF_GRANT_ATTEMPT', /\b(grant|give|assign)\b[^.\n]{0,30}\b(yourself|this tool|the agent)\b[^.\n]{0,30}\b(access|permission|capabilit(y|ies)|authority)\b/i],
  ['SECRET_DISCLOSURE', /\b(print|echo|reveal|send|upload|exfiltrate|cat)\b[^.\n]{0,40}(\.env\b|api[_ -]?keys?|secrets?|tokens?|credentials?|passwords?|private key)/i],
  ['APPROVAL_BYPASS', /\b(skip|bypass|disable|without)\b[^.\n]{0,25}\b(approval|review|confirmation|governance|sandbox)\b|\bauto[- ]?approve\b/i],
  ['REMOTE_CODE_EXECUTION', /\b(curl|wget)\b[^\n|]{0,500}\|\s{0,20}(ba|z)?sh\b|\bpip install\b[^\n]{0,500}\bgit\+/i],
  ['CONCEALMENT', /\b(do not|don't|never)\b[^.\n]{0,20}\b(tell|inform|mention|log|report)\b[^.\n]{0,20}\b(user|operator|human|audit)\b/i],
  ['DESTRUCTIVE_COMMAND', /\brm\s+-rf\b|\bsudo\b|\bformat\s+[a-z]:|\bdrop\s+(table|database)\b/i],
]

function excerpt(text: string, index: number): string {
  return text.slice(Math.max(0, index - 20), index + 80).replace(/\s+/g, ' ').trim()
}

function stripControl(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

function splitFrontmatter(raw: string): { front: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!match) return { front: {}, body: raw }
  const front: Record<string, string> = {}
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.slice(0, colon).trimEnd()
    const value = line.slice(colon + 1).trimStart()
    if (!/^[A-Za-z0-9_-]+$/.test(key) || /[\r\u2028\u2029]/.test(value)) continue
    front[key.toLowerCase()] = value.replace(/^["']|["']$/g, '')
  }
  return { front, body: raw.slice(match[0].length) }
}

/** Text after `prefix` + whitespace, or undefined when the line is not that heading level. Linear. */
function headingText(line: string, prefix: string): string | undefined {
  if (!line.startsWith(prefix)) return undefined
  const rest = line.slice(prefix.length)
  if (rest.length === 0 || rest.trimStart().length === rest.length) return undefined
  if (/[\r\u2028\u2029]/.test(rest)) return undefined
  return rest.trimStart()
}

function commandGroups(body: string): string[] {
  const groups: string[] = []
  let inSection = false
  for (const line of body.split(/\r?\n/)) {
    const h2 = headingText(line, '##')
    if (h2 !== undefined) {
      inSection = /command groups?/i.test(h2)
      continue
    }
    const h3 = headingText(line, '###')
    if (inSection && h3) groups.push(stripControl(h3).slice(0, 80))
  }
  return groups.slice(0, 50)
}

export function parseSkillDocument(
  raw: string,
  source: { ref: string; fetchedAt: string },
): SkillDescriptor {
  if (Buffer.byteLength(raw, 'utf8') > MAX_SKILL_BYTES) {
    throw new Error(`Skill document exceeds ${MAX_SKILL_BYTES} bytes`)
  }
  const { front, body } = splitFrontmatter(raw)

  const flags: SkillFlag[] = []
  const ignoredAuthorityKeys: string[] = []
  for (const key of Object.keys(front)) {
    if (AUTHORITY_KEYS.has(key)) {
      ignoredAuthorityKeys.push(key)
      flags.push({ code: 'SELF_GRANT_ATTEMPT', excerpt: `frontmatter key "${key}"` })
    }
  }
  for (const [code, rule] of FLAG_RULES) {
    const m = rule.exec(raw)
    if (m) flags.push({ code, excerpt: excerpt(raw, m.index) })
  }

  return {
    instructionTrust: 'UNTRUSTED_DATA',
    authority: 'NONE',
    source,
    contentSha256: createHash('sha256').update(raw, 'utf8').digest('hex'),
    name: front['name'] ? stripControl(front['name']).slice(0, 80) : null,
    version: front['version'] ? stripControl(front['version']).slice(0, 40) : null,
    summary: front['description'] ? stripControl(front['description']).slice(0, 280) : null,
    claimedCommandGroups: commandGroups(body),
    ignoredAuthorityKeys,
    flags,
  }
}

/** A flagged skill may still be reviewed, but must never be auto-ingested. */
export function requiresHumanReview(skill: SkillDescriptor): boolean {
  return skill.flags.length > 0
}
