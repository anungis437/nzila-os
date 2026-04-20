export type ZongaPilotMode = 'none' | 'ms_celebrations'

function normalizePilotMode(value: string | undefined): ZongaPilotMode {
  if (value === 'ms_celebrations') return 'ms_celebrations'
  return 'none'
}

export function getZongaPilotMode(): ZongaPilotMode {
  if (typeof process === 'undefined') return 'none'
  return normalizePilotMode(process.env.NEXT_PUBLIC_ZONGA_PILOT_MODE)
}

export function isMsCelebrationsPilot(): boolean {
  return getZongaPilotMode() === 'ms_celebrations'
}
