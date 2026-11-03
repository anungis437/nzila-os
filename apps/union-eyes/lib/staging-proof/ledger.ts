import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

/**
 * The staging proof harness's own bookkeeping (UE-CONV-H-016): the single-use nonce, the run, and the events that open and close it.
 *
 * The three relations (staging_proof_nonce_uses, staging_proof_runs, staging_proof_run_events, platform 0078) hold no tenant data, so they are SYSTEM_ONLY: every
 * statement here runs as the system role inside withSystemContext, in one transaction per call, and the tenant runtime role has neither a grant nor a policy on them.
 * The synthetic organization and seed rows the scenarios make are tenant data and are not written here.
 */
export type ProofRunEnd = 'completed' | 'failed' | 'cleanup_failed';

type Rows<T> = Array<T>;

/**
 * Opens a run for the nonce. Returns false, and writes nothing, when the nonce has been used before: a nonce is accepted once, and the primary key decides
 * it atomically (two requests with the same nonce cannot both win).
 */
export async function createProofRun(input: {
  proofRunId: string;
  nonce: string;
  scenario: string;
  correlationId: string;
}): Promise<boolean> {
  return withSystemContext(async (tx) => {
    const nonceRows = (await tx.execute(sql`
      insert into staging_proof_nonce_uses (nonce, proof_run_id, expires_at)
      values (${input.nonce}, ${input.proofRunId}::uuid, now() + interval '10 minutes')
      on conflict do nothing
      returning nonce
    `)) as unknown as Rows<{ nonce: string }>;
    if (nonceRows.length !== 1) return false;

    await tx.execute(sql`
      insert into staging_proof_runs (id, nonce, scenario, correlation_id, status)
      values (${input.proofRunId}::uuid, ${input.nonce}, ${input.scenario}, ${input.correlationId}, 'started')
    `);
    await tx.execute(sql`
      insert into staging_proof_run_events (
        proof_run_id, scenario, event_type, correlation_id, expected_outcome
      ) values (
        ${input.proofRunId}::uuid, ${input.scenario}, 'started', ${input.correlationId},
        ${JSON.stringify({ service_boundary: true, cleanup: true })}::jsonb
      )
    `);
    return true;
  });
}

/** Settles a started run exactly once and records the closing event; a run that is missing or already settled is an error and nothing is written. */
export async function finalizeProofRun(input: {
  proofRunId: string;
  scenario: string;
  eventType: ProofRunEnd;
  correlationId: string;
  createdIdentifiers?: Record<string, string>;
  actualOutcome: Record<string, boolean>;
  cleanupPassed: boolean;
}): Promise<void> {
  await withSystemContext(async (tx) => {
    const finalized = (await tx.execute(sql`
      update staging_proof_runs
         set status = ${input.eventType},
             cleanup_passed = ${input.cleanupPassed},
             finalized_at = now()
       where id = ${input.proofRunId}::uuid
         and status = 'started'
       returning id
    `)) as unknown as Rows<{ id: string }>;
    if (finalized.length !== 1) {
      throw new Error('deadline-proof: proof run is missing or already finalized');
    }
    await tx.execute(sql`
      insert into staging_proof_run_events (
        proof_run_id, scenario, event_type, correlation_id, created_identifiers,
        expected_outcome, actual_outcome, cleanup_passed
      ) values (
        ${input.proofRunId}::uuid, ${input.scenario}, ${input.eventType}, ${input.correlationId},
        ${JSON.stringify(input.createdIdentifiers ?? {})}::jsonb,
        ${JSON.stringify({ service_boundary: true, cleanup: true })}::jsonb,
        ${JSON.stringify(input.actualOutcome)}::jsonb, ${input.cleanupPassed}
      )
    `);
  });
}
