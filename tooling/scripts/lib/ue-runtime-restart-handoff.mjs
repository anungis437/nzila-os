/** Fail-closed hand-off between a real filing and its post-restart persistence check. */
import { existsSync, readFileSync, unlinkSync } from 'node:fs'

export function resetRestartCaseHandoff(path) {
  // Remove stale proof before running the new filing. Never reuse an earlier run's case.
  if (existsSync(path)) unlinkSync(path)
}

export function requireRestartCaseHandoff(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('Restart acceptance: fresh journey A hand-off was not written')
    throw error
  }
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('Restart acceptance: fresh journey A hand-off is not valid JSON')
  }
  if (!value || typeof value.caseId !== 'string' ||
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.caseId) ||
      typeof value.claimNumber !== 'string' || !value.claimNumber.trim()) {
    throw new Error('Restart acceptance: fresh journey A hand-off lacks a valid case identifier or claim number')
  }
  return { caseId: value.caseId, claimNumber: value.claimNumber }
}
