import { DurableCivic } from './store'
import { populate, proofOperations } from './scenario'
import type { Operation } from './model'

interface Job {
  mode:
    | 'populate'
    | 'read'
    | 'submit'
    | 'retry-batch'
    | 'benchmark'
    | 'crash-before'
    | 'crash-after'
  file: string
  institution: 'A' | 'B'
  operation?: Operation
  key?: string
  version?: number
}
const job: Job = JSON.parse(process.argv[2] ?? '{}')
if (
  ![
    'populate',
    'read',
    'submit',
    'retry-batch',
    'benchmark',
    'crash-before',
    'crash-after',
  ].includes(job.mode) ||
  !['A', 'B'].includes(job.institution)
)
  throw new Error('INVALID_PROOF_JOB')
const store = new DurableCivic(job.file)
try {
  const { s } = proofOperations(job.institution)
  if (job.mode === 'benchmark') {
    let version = store.create(s.seed, 'genesis').sequence
    version = store.submit(
      s.principal,
      { kind: 'authorize', resourceId: s.itemId, at: '2026-10-10T18:40:00Z' },
      'authorize',
      version,
    ).sequence
    const reads: number[] = [],
      writes: number[] = []
    for (let i = 0; i < 50; i++) {
      const started = performance.now()
      const at = new Date(Date.parse('2026-10-10T18:41:00Z') + i * 1000).toISOString()
      version = store.submit(
        s.principal,
        {
          kind: 'evidence',
          resourceId: s.itemId,
          at,
          evidence: s.evidence(
            `BENCH-${i}`,
            0,
            'institutional_interpretation',
            'manual',
            'Fictional bounded benchmark note',
          ),
        },
        `bench-${i}`,
        version,
      ).sequence
      writes.push(performance.now() - started)
    }
    for (let i = 0; i < 50; i++) {
      const started = performance.now()
      store.read(s.principal)
      reads.push(performance.now() - started)
    }
    const stats = (times: number[]) => {
      const sorted = [...times].sort((a, b) => a - b)
      return { count: times.length, medianMs: (sorted[24] + sorted[25]) / 2, p95Ms: sorted[47] }
    }
    console.log(
      JSON.stringify({
        classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
        reads: stats(reads),
        writes: stats(writes),
        guardChecks: { read: 1, write: 2 },
        authorizationCache: false,
        improvementTarget: 'NOT_PROVEN_NO_SLICE0_REEXECUTION_AUTHORIZED',
        finalVersion: version,
        createdAt: new Date().toISOString(),
      }),
    )
  } else if (job.mode === 'populate') {
    const proof = populate(store, job.institution)
    console.log(
      JSON.stringify({
        state: proof.read.state,
        version: proof.read.version,
        brief: proof.read.brief,
        events: proof.read.events,
      }),
    )
  } else if (job.mode === 'read') {
    console.log(JSON.stringify(store.read(s.principal)))
  } else {
    if (!job.operation || !job.key || !job.version) throw new Error('INCOMPLETE_PROOF_JOB')
    if (job.mode === 'retry-batch') {
      const results = Array.from({ length: 10 }, () =>
        store.submit(s.principal, job.operation!, job.key!, job.version!),
      )
      console.log(JSON.stringify(results))
    } else if (job.mode === 'crash-before') {
      store.submit(s.principal, job.operation, job.key, job.version, () => process.exit(74))
    } else {
      const result = store.submit(s.principal, job.operation, job.key, job.version)
      if (job.mode === 'crash-after') process.exit(73)
      console.log(JSON.stringify(result))
    }
  }
} finally {
  store.close()
}
