import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function partitionTaskPlan(plan, index, total) {
  if (
    !Number.isInteger(total) ||
    total < 1 ||
    total > 16 ||
    !Number.isInteger(index) ||
    index < 1 ||
    index > total
  ) {
    throw new Error('Invalid task shard coordinates')
  }
  if (!['FULL', 'AFFECTED', 'NOT_APPLICABLE'].includes(plan.MODE)) {
    throw new Error('Task shard requires a proven executable plan')
  }
  if (
    !Array.isArray(plan.AFFECTED_PACKAGES) ||
    plan.AFFECTED_PACKAGES.some(
      (name) => typeof name !== 'string' || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name),
    )
  ) {
    throw new Error('Invalid task package universe')
  }
  const packages = [...new Set(plan.AFFECTED_PACKAGES)].sort()
  if (packages.length !== plan.AFFECTED_PACKAGES.length || packages.length !== plan.TASK_COUNT) {
    throw new Error('Task plan count or package uniqueness mismatch')
  }
  if (plan.MODE === 'NOT_APPLICABLE') {
    if (packages.length !== 0 || plan.FALLBACK_REASON !== 'proven-irrelevant') {
      throw new Error('Unproven task non-applicability')
    }
  } else if (!packages.length || (plan.MODE === 'FULL' && packages.length !== plan.FULL_UNIVERSE)) {
    throw new Error('Refusing an empty or incomplete task universe')
  }
  return {
    MODE: plan.MODE,
    BASE_SHA: plan.BASE_SHA,
    HEAD_SHA: plan.HEAD_SHA,
    SHARD_INDEX: index,
    SHARD_TOTAL: total,
    PLANNED_TASK_COUNT: packages.length,
    PLANNED_PACKAGES: packages,
    // Stable ownership keeps each runner's cache useful when the affected
    // closure changes or a new workspace package is added.
    ASSIGNED_PACKAGES: packages.filter((name) => {
      let hash = 0
      for (const character of name) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
      return hash % total === index - 1
    }),
  }
}

export const partitionTypecheckPlan = partitionTaskPlan

export function runTurboTask(receipt, task) {
  if (!['build', 'typecheck'].includes(task)) throw new Error('Unsupported shard task')
  if (!receipt.ASSIGNED_PACKAGES.length) return 0
  const pnpmCli = process.env.npm_execpath
  const command = pnpmCli ? process.execPath : 'pnpm'
  const args = [
    'exec',
    'turbo',
    'run',
    task,
    ...receipt.ASSIGNED_PACKAGES.map((name) => `--filter=${name}`),
  ]
  const result = spawnSync(command, pnpmCli ? [pnpmCli, ...args] : args, { stdio: 'inherit' })
  if (result.error) throw result.error
  return result.status ?? 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [file, index, total] = process.argv.slice(2)
    const plan = JSON.parse(readFileSync(file, 'utf8'))
    const receipt = partitionTypecheckPlan(plan, Number(index), Number(total))
    writeFileSync(
      `${file}.shard-${receipt.SHARD_INDEX}.json`,
      `${JSON.stringify(receipt, null, 2)}\n`,
    )
    console.log(JSON.stringify(receipt))
    process.exitCode = runTurboTask(receipt, 'typecheck')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
