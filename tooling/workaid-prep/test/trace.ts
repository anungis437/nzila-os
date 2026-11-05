import assert from 'node:assert/strict';
import { safeAppend } from '../scripts/guard.ts';
import type { Principal } from '../src/principal.ts';
import { recordDenial } from '../src/journey.ts';
import type { JResult, World } from '../src/journey.ts';

/**
 * Journey step recorder. Every `act` / `see` is a numbered, individually
 * asserted step. A step is credited to requirements, findings and matrix cases
 * only through the ids it lists, so one synthetic test is never counted as
 * proof of an independent requirement it did not assert.
 *
 * Entries are appended to the file named by WORKAID_TRACE_FILE (a temp file
 * created by scripts/run-tests.ts); with no file set the steps still assert.
 */
export type Persona = 'DOMENIC' | 'ANGELO' | 'UNION_REP' | 'MEMBER' | 'SYSTEM' | 'ADVERSARY';

export interface StepMeta {
  readonly id: string;
  readonly fixture: string;
  readonly persona: Persona;
  readonly p: Principal | null;
  readonly op: string;
  readonly req?: readonly string[];
  readonly find?: readonly string[];
  readonly mx?: readonly string[];
}

export interface TraceEntry {
  readonly stepId: string;
  readonly fixture: string;
  readonly persona: Persona;
  readonly actor: string;
  readonly tenant: string;
  readonly operation: string;
  readonly expected: string;
  readonly actual: string;
  readonly authorizationDecision: string;
  readonly auditExpectation: string;
  readonly requirements: readonly string[];
  readonly findings: readonly string[];
  readonly matrixCases: readonly string[];
  readonly executed: true;
  readonly runtimeProof: 'NONE';
}

const seen = new Set<string>();
function record(meta: StepMeta, expected: string, actual: string, decision: string, audit: string) {
  assert.equal(seen.has(meta.id), false, `duplicate step id ${meta.id}`);
  seen.add(meta.id);
  const entry: TraceEntry = {
    stepId: meta.id,
    fixture: meta.fixture,
    persona: meta.persona,
    actor: meta.p?.userId ?? 'system',
    tenant: meta.p?.organizationId ?? 'system',
    operation: meta.op,
    expected,
    actual,
    authorizationDecision: decision,
    auditExpectation: audit,
    requirements: meta.req ?? [],
    findings: meta.find ?? [],
    matrixCases: meta.mx ?? [],
    executed: true,
    runtimeProof: 'NONE',
  };
  const file = process.env['WORKAID_TRACE_FILE'];
  if (file) safeAppend(file, JSON.stringify(entry) + '\n');
}

/**
 * Runs one operation and asserts its outcome.
 * `expect` is 'OK' or the exact error code. On OK, `audit` names the audit
 * action that must be the last event appended. On a refusal nothing may
 * change in the state or the audit trail; the refusal is logged on the
 * ACTOR's organization only.
 */
export function act(w: World, meta: StepMeta & { expect: string; audit?: string; run: (w: World) => JResult }): World {
  const r = meta.run(w);
  const actual = r.ok ? 'OK' : r.code;
  assert.equal(actual, meta.expect, `${meta.id} (${meta.op}): ${r.ok ? 'succeeded' : r.message}`);
  if (r.ok) {
    if (meta.audit) assert.equal(r.value.audit.at(-1)?.action, meta.audit, `${meta.id}: audit action`);
    record(meta, meta.expect, actual, 'ALLOW', meta.audit ?? 'NONE');
    return r.value;
  }
  const after = meta.p ? recordDenial(w, meta.p, meta.op, r.code) : w;
  assert.deepEqual(after.audit, w.audit, `${meta.id}: a refusal must not append to any audit trail`);
  if (meta.p) {
    const last = after.denied.at(-1)!;
    assert.equal(last.organizationId, meta.p.organizationId, `${meta.id}: the refusal is logged on the actor's organization`);
  }
  record(meta, meta.expect, actual, `DENY:${r.code}`, 'NO_STATE_CHANGE_REFUSAL_LOGGED_ON_ACTOR_ORGANIZATION');
  return after;
}

/** Runs a read/projection and asserts what it shows (or that it shows nothing). */
export function see<T>(w: World, meta: StepMeta & { expect: string; view: (w: World) => T; check: (v: T) => void }): T {
  const v = meta.view(w);
  meta.check(v);
  record(meta, meta.expect, v === null ? 'NULL_VIEW' : 'VIEW', v === null ? 'DENY:NO_VIEW' : 'ALLOW', 'NONE');
  return v;
}

/** An assertion about a document read or any other Decision. */
export function decide(meta: StepMeta & { expect: 'ALLOW' | string; run: () => { allow: boolean; publicOutcome?: string } }): void {
  const d = meta.run();
  const actual = d.allow ? 'ALLOW' : (d.publicOutcome ?? 'DENY');
  assert.equal(actual, meta.expect, `${meta.id} (${meta.op})`);
  record(meta, meta.expect, actual, d.allow ? 'ALLOW' : `DENY:${actual}`, 'NONE');
}

/** Raw contract call used only to build prerequisites; it is deliberately NOT recorded as a step. */
export function must<T>(r: JResult<T>): T {
  assert.equal(r.ok, true, r.ok ? '' : `setup failed: ${r.code} ${r.message}`);
  return (r as { value: T }).value;
}
