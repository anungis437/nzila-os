/** A report window in days: 1..365, with a non-numeric, fractional or out-of-range value refused rather than turned into NaN. */
export function parseWindowDays(raw: string | null, fallback = 30): number | null {
  if (raw === null) return fallback
  if (!/^[1-9][0-9]{0,2}$/.test(raw)) return null
  const days = Number(raw)
  return days <= 365 ? days : null
}
