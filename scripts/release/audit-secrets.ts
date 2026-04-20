import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WORKFLOWS = path.join(ROOT, '.github', 'workflows')
const OUTPUT = path.join(ROOT, 'reports', 'release-secret-audit.json')

function main() {
  const files = fs.readdirSync(WORKFLOWS, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')))
    .map((entry) => entry.name)

  for (const fileName of files) {
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
      throw new Error(`Invalid workflow file name: ${fileName}`)
    }
  }

  process.chdir(WORKFLOWS)
  const usage = new Map<string, Set<string>>()

  for (const fileName of files) {
    const rel = path.join('.github', 'workflows', fileName)
    const content = fs.readFileSync(fileName, 'utf8')
    const matches = [...content.matchAll(/secrets\.([A-Z0-9_]+)/g)]
    for (const match of matches) {
      const secret = match[1]
      if (!usage.has(secret)) {
        usage.set(secret, new Set())
      }
      usage.get(secret)!.add(rel)
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    workflowCount: files.length,
    secretCount: usage.size,
    secrets: [...usage.entries()].map(([name, refs]) => ({
      name,
      workflows: [...refs],
      usageCount: refs.size,
    })).sort((a, b) => b.usageCount - a.usageCount),
    remediation: [
      'Move duplicated deploy secrets to environment-scoped secrets for staging and production.',
      'Remove legacy deploy-web/deploy-console/deploy-partners/deploy-union-eyes push-triggered secret dependencies.',
      'Require required_reviewers on production environment for high-risk secret usage.'
    ]
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
}

main()
