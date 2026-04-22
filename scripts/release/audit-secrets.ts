import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WORKFLOWS = path.join(ROOT, '.github', 'workflows')
const OUTPUT = path.join(ROOT, 'reports', 'release-secret-audit.json')
const DOCKERFILE = path.join(ROOT, 'Dockerfile')

const SENSITIVE_NAME = /(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET)/i

type Violation = {
  file: string
  line: number
  rule: string
  text: string
}

function scanDockerfile(violations: Violation[]) {
  if (!fs.existsSync(DOCKERFILE)) {
    return
  }

  const rel = path.relative(ROOT, DOCKERFILE)
  const lines = fs.readFileSync(DOCKERFILE, 'utf8').split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const argMatch = line.match(/^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)/)
    if (argMatch && SENSITIVE_NAME.test(argMatch[1])) {
      violations.push({
        file: rel,
        line: i + 1,
        rule: 'docker-arg-sensitive-name',
        text: line.trim(),
      })
    }

    const envMatch = line.match(/^\s*ENV\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (envMatch && SENSITIVE_NAME.test(envMatch[1])) {
      violations.push({
        file: rel,
        line: i + 1,
        rule: 'docker-env-sensitive-name',
        text: line.trim(),
      })
    }
  }
}

function scanWorkflowBuildArgs(filePath: string, content: string, violations: Violation[]) {
  const rel = path.join('.github', 'workflows', path.basename(filePath))
  const lines = content.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('--build-arg')) {
      continue
    }

    const match = line.match(/--build-arg\s+([A-Za-z_][A-Za-z0-9_]*)/)
    const argName = match?.[1]

    if (argName && SENSITIVE_NAME.test(argName)) {
      violations.push({
        file: rel,
        line: i + 1,
        rule: 'workflow-build-arg-sensitive-name',
        text: line.trim(),
      })
    }
  }
}

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
  const policyViolations: Violation[] = []

  scanDockerfile(policyViolations)

  for (const fileName of files) {
    const rel = path.join('.github', 'workflows', fileName)
    const content = fs.readFileSync(fileName, 'utf8')
    scanWorkflowBuildArgs(fileName, content, policyViolations)
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
    dockerSecretPolicy: {
      passed: policyViolations.length === 0,
      violationCount: policyViolations.length,
      violations: policyViolations,
    },
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

  if (policyViolations.length > 0) {
    console.error(`Docker secret policy failed with ${policyViolations.length} violation(s).`)
    process.exit(1)
  }
}

main()
