import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import { folder, root, type V2Plan } from '../bootstrap-v2/source'

/**
 * One static semantic census of UUID-typed, identity-looking columns in the canonical V2 plan.
 * Classification is never by column name alone: it uses foreign keys, the current Drizzle
 * declaration, and how live (non-test) application code reads/writes the column.
 */
export type IdentityClass =
  | 'APPLICATION_USER_ID'
  | 'DOMAIN_ENTITY_UUID'
  | 'EXTERNAL_IDENTIFIER'
  | 'DEAD_OR_UNREACHABLE'

export interface Candidate {
  table: string
  column: string
  v2Type: string
  fk: string | null
}

const IDENTITY_NAME =
  /(^|_)(user|member|steward|officer|actor|author|owner|assignee|reviewer|approver|creator|sender|recipient|grievor|representative|worker|employee|person|staff|admin|principal)(_id)?$|^(created_by|updated_by|granted_by|revoked_by|uploaded_by|reviewed_by|approved_by|assigned_to|performed_by|deleted_by|modified_by|submitted_by|verified_by|resolved_by|closed_by|requested_by|processed_by|signed_by|acknowledged_by|completed_by|authored_by|invited_by|added_by|removed_by|owner_id|actor_id|author_id)$|_(by|user_id|member_id|steward_id|officer_id)$/

// Expressions that carry the authenticated application user identifier.
const APP_USER_VALUE =
  /\b(userId|user\??\.id|actorUserId|actorId|currentUserId|sessionUserId|callerId|requesterId|ctx\.userId|context\.userId|createdBy|performedBy|session\??\.user\??\.id|auth\.userId)\b/
const ENTITY_VALUE = /\b(randomUUID|uuid|\.id\b|Id\s*:\s*z\.string\(\)\.uuid)/i

const SOURCE_ROOTS = [
  'app',
  'lib',
  'services',
  'actions',
  'db/queries',
  'components',
  'hooks',
  'contexts',
]
const SKIP =
  /(examples|__tests__|\.test\.|\.spec\.|node_modules|[\\/]\.next[\\/]|services[\\/]financial-service|[\\/]e2e[\\/])/

function walk(dir: string, out: string[] = []) {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry)
    if (SKIP.test(full)) continue
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

export interface CensusEntry {
  table: string
  column: string
  currentType: 'uuid'
  classification: IdentityClass
  targetType: 'text' | 'uuid'
  evidence: string[]
  rationale: string
}

// Reviewed dispositions for columns where code evidence alone cannot decide. Each carries its basis.
const REVIEWED: Record<string, { classification: IdentityClass; rationale: string }> = {
  'stewards.user_id': {
    classification: 'DOMAIN_ENTITY_UUID',
    rationale:
      'The steward dashboard documents this uuid as matching organization_members.id (member entity key), not the text application user id.',
  },
  'pension_members.user_id': {
    classification: 'DOMAIN_ENTITY_UUID',
    rationale:
      'app/api/pension/members documents that it stores the organization_members.id uuid primary key.',
  },
  'pension_trustees.user_id': {
    classification: 'DOMAIN_ENTITY_UUID',
    rationale:
      'Pension trustee rows reference pension entities by uuid; no application user id is written.',
  },
  'cookie_consents.user_id': {
    classification: 'DOMAIN_ENTITY_UUID',
    rationale: 'Foreign key to profiles.id (uuid entity key). Non-launch GDPR cookie capability.',
  },
  'collective_agreements.superseded_by': {
    classification: 'DOMAIN_ENTITY_UUID',
    rationale: 'Identifies the superseding collective agreement (an entity), not a user.',
  },
  'dues_assignments.member_id': {
    classification: 'DOMAIN_ENTITY_UUID',
    rationale:
      'db/schema/domains/finance/dues-assignments.ts declares member_id as uuid NOT NULL with no foreign key. The finance authority treats the table as an organization-scoped dues obligation, not the text application user id stored in dues_transactions.member_id.',
  },
}

export function identityCandidates(plan: V2Plan): Candidate[] {
  const candidates: Candidate[] = []
  for (const table of plan.tables)
    for (const column of table.columns)
      if (column.type === 'uuid' && IDENTITY_NAME.test(column.name)) {
        const fk = table.foreignKeys.find((entry) => entry.column === column.name)
        candidates.push({
          table: table.name,
          column: column.name,
          v2Type: column.type,
          fk: fk ? `${fk.table}.${fk.referencedColumn}` : null,
        })
      }
  return candidates
}
export function buildIdentityCensus(plan: V2Plan) {
  const appRoot = path.join(root, 'apps', 'union-eyes')
  const files = SOURCE_ROOTS.flatMap((dir) => walk(path.join(appRoot, dir)))
  const texts = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))
  const load = createRequire(import.meta.url)
  const declarations: Record<string, unknown> = load(path.join(appRoot, 'db', 'schema', 'index.ts'))
  const symbols = new Map<string, { symbol: string; props: Map<string, string> }>()
  for (const [symbol, value] of Object.entries(declarations)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    if (symbols.has(config.name)) continue
    const props = new Map<string, string>()
    for (const [prop, column] of Object.entries(
      value as unknown as Record<string, { name?: string }>,
    ))
      if (column && typeof column === 'object' && typeof column.name === 'string')
        props.set(column.name, prop)
    symbols.set(config.name, { symbol, props })
  }

  const candidates = identityCandidates(plan)

  const entries: CensusEntry[] = []
  for (const candidate of candidates) {
    const key = `${candidate.table}.${candidate.column}`
    const declared = symbols.get(candidate.table)
    const prop = declared?.props.get(candidate.column)
    const userEvidence: string[] = []
    const entityEvidence: string[] = []
    let referenced = false
    for (const [file, text] of texts) {
      const rel = path.relative(appRoot, file).replaceAll('\\', '/')
      if (declared && prop && text.includes(declared.symbol)) {
        const usage = new RegExp(`\\b${declared.symbol}\\.${prop}\\b([^\\n]{0,160})`, 'g')
        for (const match of text.matchAll(usage)) {
          referenced = true
          const window = match[0]
          if (APP_USER_VALUE.test(window) && !/uuid\(|randomUUID/.test(window))
            userEvidence.push(`${rel} :: ${window.trim().slice(0, 110)}`)
          else if (ENTITY_VALUE.test(window))
            entityEvidence.push(`${rel} :: ${window.trim().slice(0, 110)}`)
        }
        const assign = new RegExp(`\\b${prop}\\s*:\\s*([^,}\\n]{1,90})`, 'g')
        for (const match of text.matchAll(assign)) {
          referenced = true
          if (APP_USER_VALUE.test(match[1]))
            userEvidence.push(`${rel} :: ${prop}: ${match[1].trim()}`)
        }
      }
      const raw = new RegExp(
        `\\b${candidate.column}\\b\\s*(=|IN)\\s*\\$\\{\\s*([^}]{1,60})\\}`,
        'gi',
      )
      if (text.includes(candidate.table))
        for (const match of text.matchAll(raw)) {
          referenced = true
          if (APP_USER_VALUE.test(match[2]))
            userEvidence.push(`${rel} :: raw SQL ${candidate.column} = \${${match[2].trim()}}`)
        }
    }
    let classification: IdentityClass
    let rationale: string
    const reviewed = REVIEWED[key]
    if (reviewed) {
      classification = reviewed.classification
      rationale = reviewed.rationale
    } else if (candidate.fk) {
      classification = 'DOMAIN_ENTITY_UUID'
      rationale = `Foreign key to ${candidate.fk}, a uuid entity key; not the authenticated user identifier.`
    } else if (/_by$/.test(candidate.column) && !candidate.fk) {
      classification = 'APPLICATION_USER_ID'
      rationale =
        'Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity.'
    } else if (userEvidence.length) {
      classification = 'APPLICATION_USER_ID'
      rationale =
        'Live application code reads or writes the authenticated application user id into this column.'
    } else if (referenced || entityEvidence.length) {
      classification = 'DOMAIN_ENTITY_UUID'
      rationale =
        'Live code references the column without the authenticated user id; treated as an entity reference.'
    } else {
      classification = 'DEAD_OR_UNREACHABLE'
      rationale =
        'No live (non-test) application source references this column; no launch mutation required.'
    }
    entries.push({
      table: candidate.table,
      column: candidate.column,
      currentType: 'uuid',
      classification,
      targetType: classification === 'APPLICATION_USER_ID' ? 'text' : 'uuid',
      evidence: [...new Set(userEvidence.length ? userEvidence : entityEvidence)].slice(0, 4),
      rationale,
    })
  }
  entries.sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`))
  const counts: Record<string, number> = {}
  for (const entry of entries)
    counts[entry.classification] = (counts[entry.classification] ?? 0) + 1
  return {
    contract: 'APPLICATION_USER_ID=TEXT',
    candidateColumns: entries.length,
    classificationCounts: counts,
    unclassifiedCurrentIdentityColumns: entries.filter((entry) => !entry.classification).length,
    applicationUserIdColumns: entries
      .filter((entry) => entry.classification === 'APPLICATION_USER_ID')
      .map((entry) => `${entry.table}.${entry.column}`),
    entries,
  }
}

type BaselineCensus = ReturnType<typeof buildIdentityCensus>

/**
 * The classification baseline was produced by buildIdentityCensus on the plan that still carried
 * the uuid-typed identity columns. The contract records that classification and verifies it
 * against the current plan: every APPLICATION_USER_ID column must now be non-uuid, every other
 * classified column must keep its type, and no new uuid identity-looking column may exist unclassified.
 */
export function finalizeIdentityContract(plan: V2Plan, baseline: BaselineCensus) {
  const columnType = (table: string, column: string) =>
    plan.tables
      .find((entry) => entry.name === table)
      ?.columns.find((entry) => entry.name === column)?.type
  const classified = new Set(baseline.entries.map((entry) => `${entry.table}.${entry.column}`))
  const unclassified = identityCandidates(plan).filter(
    (entry) => !classified.has(`${entry.table}.${entry.column}`),
  )
  const violations: string[] = []
  const entries = baseline.entries.map((entry) => {
    const type = columnType(entry.table, entry.column) ?? 'MISSING'
    if (entry.classification === 'APPLICATION_USER_ID' && (type === 'uuid' || type === 'MISSING'))
      violations.push(`${entry.table}.${entry.column} is ${type}; APPLICATION_USER_ID must be text`)
    if (entry.classification !== 'APPLICATION_USER_ID' && type !== 'uuid')
      violations.push(
        `${entry.table}.${entry.column} changed to ${type}; ${entry.classification} must stay uuid`,
      )
    return { ...entry, previousType: 'uuid', currentType: type }
  })
  const counts: Record<string, number> = {}
  for (const entry of entries)
    counts[entry.classification] = (counts[entry.classification] ?? 0) + 1
  return {
    contract: 'APPLICATION_USER_ID=TEXT',
    candidateColumns: entries.length,
    classificationCounts: counts,
    unclassifiedCurrentIdentityColumns: unclassified.length,
    unclassifiedColumns: unclassified.map((entry) => `${entry.table}.${entry.column}`),
    contractViolations: violations,
    applicationUserIdColumns: entries
      .filter((entry) => entry.classification === 'APPLICATION_USER_ID')
      .map((entry) => `${entry.table}.${entry.column}`),
    entries,
  }
}

export function renderIdentityContractMarkdown(
  census: ReturnType<typeof finalizeIdentityContract>,
  planDigest: string,
) {
  const rows = (kind: IdentityClass) =>
    census.entries
      .filter((entry) => entry.classification === kind)
      .map(
        (entry) =>
          `| \`${entry.table}.${entry.column}\` | ${entry.previousType} -> ${entry.currentType} | ${entry.rationale} |`,
      )
      .join('\n')
  return `# Union Eyes application identity contract

\`APPLICATION_USER_ID = TEXT\` is a UE-wide semantic contract: any column that stores the authenticated
application user identifier (the \`user_management.users.user_id\` value carried by the session) is TEXT.
Genuine entity UUID references stay UUID. Classification uses foreign keys, the current declarations
and how live application code reads and writes each column; it is never decided by column name alone.

- Source plan: \`${planDigest}\`
- Identity-looking UUID candidates classified: **${census.candidateColumns}**
- Unclassified current identity columns: **${census.unclassifiedCurrentIdentityColumns}**
- Contract violations: **${census.contractViolations.length}**
- Classification counts: ${JSON.stringify(census.classificationCounts)}

## APPLICATION_USER_ID (converted to TEXT)

| Column | Type | Basis |
| --- | --- | --- |
${rows('APPLICATION_USER_ID')}

## DOMAIN_ENTITY_UUID (remain UUID)

| Column | Type | Basis |
| --- | --- | --- |
${rows('DOMAIN_ENTITY_UUID')}

## EXTERNAL_IDENTIFIER

| Column | Type | Basis |
| --- | --- | --- |
${rows('EXTERNAL_IDENTIFIER')}

## DEAD_OR_UNREACHABLE (no live source reference; no launch mutation)

| Column | Type | Basis |
| --- | --- | --- |
${rows('DEAD_OR_UNREACHABLE')}
`
}

const BASELINE = path.join(folder, 'UE_APPLICATION_IDENTITY_CENSUS_BASELINE.json')

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  const planDigest = createHash('sha256').update(JSON.stringify(plan)).digest('hex')
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as BaselineCensus
  const contract = finalizeIdentityContract(plan, baseline)
  const body = `${JSON.stringify({ ...contract, sourcePlanDigest: planDigest }, null, 2)}\n`
  if (process.argv.includes('--write')) {
    writeFileSync(path.join(folder, 'UE_APPLICATION_IDENTITY_CONTRACT.json'), body)
    writeFileSync(
      path.join(folder, 'UE_APPLICATION_IDENTITY_CONTRACT.md'),
      renderIdentityContractMarkdown(contract, planDigest),
    )
  }
  process.stdout.write(
    `${JSON.stringify({ candidateColumns: contract.candidateColumns, counts: contract.classificationCounts, unclassified: contract.unclassifiedCurrentIdentityColumns, violations: contract.contractViolations.length, digest: createHash('sha256').update(body).digest('hex') })}\n`,
  )
}
