import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Catalog = {
  products: Array<{ id: string; tier: number }>
}

type PullRequestLabel = { name?: string }
type PullRequestPayload = {
  pull_request?: {
    number?: number
    labels?: PullRequestLabel[]
    base?: { ref?: string }
  }
}

type IssueLabelResponse = Array<{ name?: string }>

const ROOT = process.cwd()
const CATALOG_PATH = resolve(ROOT, 'governance/portfolio/product-catalog.json')

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function readCatalog(): Catalog {
  if (!existsSync(CATALOG_PATH)) {
    throw new Error(`Missing catalog: ${CATALOG_PATH}`)
  }
  return JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as Catalog
}

function getChangedFilesFromPrContext(): string[] {
  const eventName = process.env.GITHUB_EVENT_NAME
  const eventPath = process.env.GITHUB_EVENT_PATH

  if (eventName !== 'pull_request' || !eventPath || !existsSync(eventPath)) {
    return []
  }

  const payload = JSON.parse(readFileSync(eventPath, 'utf8')) as PullRequestPayload
  const baseRef = payload.pull_request?.base?.ref
  if (!baseRef) return []

  git(`fetch --no-tags --prune --depth=200 origin ${baseRef}`)
  const out = git(`diff --name-only origin/${baseRef}...HEAD`)
  return out.split('\n').map((v) => v.trim()).filter(Boolean)
}

function getLabelsFromPrContext(): string[] {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) return []
  const payload = JSON.parse(readFileSync(eventPath, 'utf8')) as PullRequestPayload
  const labels = payload.pull_request?.labels ?? []
  return labels.map((l) => (l.name ?? '').trim().toLowerCase()).filter(Boolean)
}

async function getLiveLabelsFromPrApi(): Promise<string[] | null> {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) return null

  const payload = JSON.parse(readFileSync(eventPath, 'utf8')) as PullRequestPayload
  const prNumber = payload.pull_request?.number
  const repo = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN

  if (!prNumber || !repo || !token) return null

  const response = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/labels`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) return null

  const labels = (await response.json()) as IssueLabelResponse
  return labels.map((l) => (l.name ?? '').trim().toLowerCase()).filter(Boolean)
}

function appIdFromPath(filePath: string): string | null {
  const m = filePath.match(/^apps\/([^/]+)\//)
  if (!m) return null
  return m[1]
}

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME
  if (eventName !== 'pull_request') {
    console.log('[validate-tier-focus] Non-PR event; skipping label gate.')
    return
  }

  const catalog = readCatalog()
  const tierById = new Map(catalog.products.map((p) => [p.id, p.tier]))

  const changedFiles = getChangedFilesFromPrContext()
  const touchedApps = new Set<string>()
  for (const file of changedFiles) {
    const appId = appIdFromPath(file)
    if (appId) touchedApps.add(appId)
  }

  if (touchedApps.size === 0) {
    console.log('[validate-tier-focus] No app files changed; gate passes.')
    return
  }

  const labelsFromPayload = getLabelsFromPrContext()
  const liveLabels = await getLiveLabelsFromPrApi()
  const labels = new Set((liveLabels && liveLabels.length > 0 ? liveLabels : labelsFromPayload))

  const touchedTier2: string[] = []
  const touchedTier34: string[] = []

  for (const app of touchedApps) {
    const tier = tierById.get(app)
    if (tier === 2) touchedTier2.push(app)
    if (tier === 3 || tier === 4) touchedTier34.push(app)
  }

  const failures: string[] = []
  if (touchedTier2.length > 0 && !labels.has('owner-approved')) {
    failures.push(
      `Tier 2 apps touched (${touchedTier2.sort().join(', ')}) but label 'owner-approved' is missing.`,
    )
  }

  if (touchedTier34.length > 0 && !labels.has('approved-experiment')) {
    failures.push(
      `Tier 3/4 apps touched (${touchedTier34.sort().join(', ')}) but label 'approved-experiment' is missing.`,
    )
  }

  console.log('[validate-tier-focus] Changed apps:', Array.from(touchedApps).sort().join(', '))
  console.log('[validate-tier-focus] Labels:', Array.from(labels).sort().join(', ') || '(none)')

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`ERROR: ${failure}`)
    }
    process.exit(1)
  }

  console.log('[validate-tier-focus] PASS')
}

void main()
