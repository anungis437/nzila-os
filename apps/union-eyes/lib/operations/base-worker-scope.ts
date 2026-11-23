import scheduled from './scheduled-jobs.json'

/** The deployed job manifest owns both schedules and base monitoring scope.
 * Generic e-signature storage is contained in the canonical base release;
 * its retained staging job is manual, and is never an active base worker. */
const workers = scheduled.jobs.flatMap(job =>
  'baseOperationalCadenceMinutes' in job && typeof job.baseOperationalCadenceMinutes === 'number'
    ? [{ code: job.code, cadenceMinutes: job.baseOperationalCadenceMinutes }] : [])
if (!workers.length || new Set(workers.map(worker => worker.code)).size !== workers.length ||
    workers.some(worker => !Number.isInteger(worker.cadenceMinutes) || worker.cadenceMinutes <= 0)) {
  throw new Error('UE_BASE_WORKER_SCOPE_INVALID')
}
export const BASE_WORKER_CODES = Object.freeze(workers.map(worker => worker.code)) as readonly [string, ...string[]]
export const BASE_WORKER_CADENCES: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(workers.map(worker => [worker.code, worker.cadenceMinutes])))
