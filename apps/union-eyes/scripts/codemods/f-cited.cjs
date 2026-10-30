// For a family, list which defect ids are cited by a test or source comment outside the ledger/register docs (a signal that the source
// was already corrected, usually with a test). Usage: node f-cited.cjs <familyKeyPrefix>
const { execSync } = require('child_process')
const path = require('path')
const fam = require('../../../../docs/union-eyes/convergence/remediation/families.json')
const key = Object.keys(fam.members).find((k) => k.startsWith(process.argv[2]))
const ids = fam.members[key].map((m) => m.id)
const root = path.resolve(__dirname, '../../..')
const out = { cited: [], uncited: [] }
for (const id of ids) {
  // longest stable prefix that git grep can match literally (ids may be truncated in comments)
  const needle = id.length > 70 ? id.slice(0, 70) : id
  let hits = ''
  try {
    hits = execSync(`git grep -l -F "${needle}" -- apps/union-eyes ":!apps/union-eyes/scripts/codemods"`, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    hits = ''
  }
  const files = hits.split('\n').filter(Boolean)
  ;(files.length ? out.cited : out.uncited).push({ id, files: files.slice(0, 2) })
}
console.log('CITED', out.cited.length)
for (const c of out.cited) console.log(' ', c.id.slice(0, 90), '=>', c.files.join(', '))
console.log('UNCITED', out.uncited.length)
for (const u of out.uncited) console.log(' ', u.id.slice(0, 110))
