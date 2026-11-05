const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
// Registers a platform migration in the journal, the approved lineage and the README table. Idempotent.
const [, , tag, note, purpose] = process.argv
if (!tag || !note || !purpose) throw new Error('usage: register-platform-migration.cjs <tag> <lineage-note> <readme-purpose>')
const root = path.resolve(__dirname, '../../../..')
const dir = path.join(root, 'apps/union-eyes/db/migrations-platform')

const journalPath = path.join(dir, 'meta/_journal.json')
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
if (!journal.entries.some((e) => e.tag === tag)) {
  const last = journal.entries[journal.entries.length - 1]
  journal.entries.push({ idx: last.idx + 1, version: '7', when: last.when + 10_000_000, tag, breakpoints: true })
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n')
}

const sql = fs.readFileSync(path.join(dir, tag + '.sql'), 'utf8').replace(/\r\n/g, '\n')
const sha256 = crypto.createHash('sha256').update(sql).digest('hex')
const linPath = path.join(root, 'tooling/scripts/lib/ue-approved-migration-lineage.json')
const lin = JSON.parse(fs.readFileSync(linPath, 'utf8'))
const existing = lin.registeredAdditions.platform
  ? lin.registeredAdditions.platform
  : null
const list = Array.isArray(lin.registeredAdditions) ? lin.registeredAdditions : existing
if (!list) throw new Error('registeredAdditions shape: ' + JSON.stringify(Object.keys(lin.registeredAdditions)))
const entry = list.find((e) => e.tag === tag)
if (entry) entry.sha256 = sha256
else list.push({ tag, sha256, status: 'UNQUALIFIED', introducedBy: 'agents/ue-cursor-final-closure', note })
fs.writeFileSync(linPath, JSON.stringify(lin, null, 2) + '\n')

const readmePath = path.join(dir, 'README.md')
let readme = fs.readFileSync(readmePath, 'utf8')
if (!readme.includes('`' + tag + '`')) {
  const rows = readme.split('\n')
  const lastRow = rows.map((r, i) => (r.startsWith('| `00') ? i : -1)).filter((i) => i >= 0).pop()
  rows.splice(lastRow + 1, 0, `| \`${tag}\` | ${purpose} Registered as an UNQUALIFIED addition in \`tooling/scripts/lib/ue-approved-migration-lineage.json\`. |`)
  fs.writeFileSync(readmePath, rows.join('\n'))
}
console.log('registered', tag, sha256)
