import type {
  SeedApp,
  SeedAppReport,
  SeedProfile,
  SeedReporter,
  SeedStepRecord,
} from './types'

interface CreateReporterArgs {
  app: SeedApp
  profile: SeedProfile
  dryRun: boolean
  now?: () => Date
}

export function createReporter(args: CreateReporterArgs): SeedReporter {
  const now = args.now ?? (() => new Date())
  const startedAt = now().toISOString()
  const startMs = now().getTime()
  const records: SeedStepRecord[] = []

  return {
    step(record: SeedStepRecord) {
      records.push(record)
    },
    steps() {
      return records.slice()
    },
    finish(): SeedAppReport {
      const finishedAtDate = now()
      const totalRecords = records
        .filter((r) => !r.skipped)
        .reduce((sum, r) => sum + r.count, 0)
      return {
        app: args.app,
        profile: args.profile,
        dryRun: args.dryRun,
        startedAt,
        finishedAt: finishedAtDate.toISOString(),
        durationMs: finishedAtDate.getTime() - startMs,
        steps: records.slice(),
        totalRecords,
      }
    },
  }
}
