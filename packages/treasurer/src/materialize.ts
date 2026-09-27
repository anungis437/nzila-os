import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderRedTeamReport } from './red-team'
import { certificationFromGates, evaluateGates, renderCertificationMarkdown, repoRootFromHere } from './verifier'

function materialize(): void {
  const root = repoRootFromHere()
  const dir = join(root, 'governance/personal-capital/treasurer')
  mkdirSync(dir, { recursive: true })
  const gates = evaluateGates(root)
  const record = certificationFromGates(gates)
  writeFileSync(join(dir, 'RED_TEAM_REPORT.md'), renderRedTeamReport())
  writeFileSync(join(dir, 'certification-record.json'), `${JSON.stringify(record, null, 2)}\n`)
  writeFileSync(join(dir, 'TREASURER_CERTIFICATION_RECORD.md'), renderCertificationMarkdown(record))
  process.stdout.write(`${JSON.stringify({ certified: record.TREASURER_CERTIFIED, notes: record.notes }, null, 2)}\n`)
}

const entry = process.argv[1] ? resolve(process.argv[1]) : ''
if (entry && entry === fileURLToPath(import.meta.url)) {
  materialize()
}
