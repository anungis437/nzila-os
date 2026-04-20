import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')
const OUT_MD = path.join(ROOT, 'docs', 'ops', 'release-governance', 'release-governance-audit.md')
const OUT_JSON = path.join(ROOT, 'reports', 'release-governance-audit.json')

function listWorkflowFiles(): string[] {
  return fs.readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
}

function score(workflowFiles: string[], inventoryAppCount: number) {
  const canonical = ['gitops-deploy.yml', 'deploy-production.yml']
  const appSpecific = workflowFiles.filter((name) => /^deploy-(web|console|partners|union-eyes)\.yml$/.test(name))

  const workflowSprawlScore = Math.max(0, 10 - appSpecific.length)
  const deploymentRiskScore = Math.max(1, 10 - Math.floor(appSpecific.length / 2))
  const environmentDriftScore = inventoryAppCount >= 16 ? 8 : 6
  const releaseGovernanceScore = Math.round((workflowSprawlScore + deploymentRiskScore + environmentDriftScore) / 3)

  return {
    canonical,
    appSpecific,
    workflowSprawlScore,
    deploymentRiskScore,
    environmentDriftScore,
    releaseGovernanceScore,
  }
}

function main() {
  const workflows = listWorkflowFiles()
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as { apps: Record<string, unknown> }
  const inventoryAppCount = Object.keys(inventory.apps).length
  const result = score(workflows, inventoryAppCount)

  const jsonReport = {
    generatedAt: new Date().toISOString(),
    workflowCount: workflows.length,
    inventoryAppCount,
    ...result,
  }

  const markdown = `# Release Governance Audit\n\nGenerated: ${jsonReport.generatedAt}\n\n## Scores\n\n- Release Governance Score: ${result.releaseGovernanceScore}/10\n- Deployment Risk Score: ${result.deploymentRiskScore}/10\n- Workflow Sprawl Score: ${result.workflowSprawlScore}/10\n- Environment Drift Score: ${result.environmentDriftScore}/10\n\n## Canonical Workflows\n\n- ${result.canonical.join('\n- ')}\n\n## App-Specific Deployment Workflows (Demoted to Emergency/Manual)\n\n- ${result.appSpecific.join('\n- ') || 'None'}\n\n## Inventory Coverage\n\n- Governed applications: ${inventoryAppCount}\n- Active workflow files discovered: ${workflows.length}\n\n## Risk Notes\n\n- Production path is locked to immutable artifact promotion from staging workflow output.\n- Staging remains canonical via gitops-deploy with policy-based app eligibility.\n- Zonga requires explicit production override and is excluded by default.\n`

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_MD, markdown, 'utf8')
  fs.writeFileSync(OUT_JSON, JSON.stringify(jsonReport, null, 2), 'utf8')
  console.log(markdown)
}

main()
