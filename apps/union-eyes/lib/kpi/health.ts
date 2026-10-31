export type KpiHealth = 'on_track' | 'at_risk' | 'critical' | 'no_data'

/**
 * A target has no stored direction, but its thresholds state it: for a figure that should stay low (response time, backlog), the
 * warning and critical levels sit ABOVE the target and critical is the highest; for one that should stay high they sit below.
 * The direction is read from that order, and a target whose thresholds do not decide it is treated as higher-is-better.
 */
export function kpiLowerIsBetter(target: number | null, warning: number | null, critical: number | null): boolean {
  if (warning != null && critical != null && warning !== critical) return critical > warning
  if (target != null && warning != null && warning !== target) return warning > target
  if (target != null && critical != null && critical !== target) return critical > target
  return false
}

export function computeKpiHealth(
  currentValue: number | null,
  target: number | null,
  warning: number | null,
  critical: number | null,
): KpiHealth {
  if (currentValue == null || target == null || !Number.isFinite(currentValue)) return 'no_data'
  if (kpiLowerIsBetter(target, warning, critical)) {
    if (critical != null && currentValue >= critical) return 'critical'
    if (warning != null && currentValue >= warning) return 'at_risk'
    return 'on_track'
  }
  if (critical != null && currentValue <= critical) return 'critical'
  if (warning != null && currentValue <= warning) return 'at_risk'
  return 'on_track'
}
