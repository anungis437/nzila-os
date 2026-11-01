const fs = require('fs'), crypto = require('crypto'), path = require('path')
// Registers a scoped (cache) migration in its journal and the approved lineage. Idempotent.
const [, , tag, note] = process.argv
if (!tag || !note) throw new Error('usage: register-cache-migration.cjs <tag> <lineage-note>')
const root = path.resolve(__dirname, '../../../..')
const dir = path.join(root, 'apps/union-eyes/db/migrations-cache')
const jp = path.join(dir, 'meta/_journal.json')
const journal = JSON.parse(fs.readFileSync(jp, 'utf8'))
if (!journal.entries.some((e) => e.tag === tag)) {
  const last = journal.entries[journal.entries.length - 1]
  journal.entries.push({ idx: last.idx + 1, version: '7', when: last.when + 10_000_000, tag, breakpoints: true })
  fs.writeFileSync(jp, JSON.stringify(journal, null, 2) + '\n')
}
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, tag + '.sql'), 'utf8').replace(/\r\n/g, '\n')).digest('hex')
const lp = path.join(root, 'tooling/scripts/lib/ue-approved-migration-lineage.json')
const lin = JSON.parse(fs.readFileSync(lp, 'utf8'))
const list = lin.registeredAdditions.scoped
const entry = list.find((e) => e.tag === tag)
if (entry) entry.sha256 = sha256
else list.push({ tag, sha256, status: 'UNQUALIFIED', introducedBy: 'agents/ue-cursor-final-closure', note })
fs.writeFileSync(lp, JSON.stringify(lin, null, 2) + '\n')
console.log('registered', tag, sha256)
