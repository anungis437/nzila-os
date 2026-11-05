const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
// KPI health: direction comes from the thresholds, not an assumption that lower is always worse.
edit('app/api/targets/summary/route.ts', [
  [
    "/**\n * Determine KPI health by comparing currentValue against thresholds.\n */\nfunction computeHealth(\n  currentValue: number | null,\n  target: number | null,\n  warning: number | null,\n  critical: number | null,\n): 'on_track' | 'at_risk' | 'critical' | 'no_data' {\n  if (currentValue == null || target == null) return 'no_data';\n  if (critical != null && currentValue <= critical) return 'critical';\n  if (warning != null && currentValue <= warning) return 'at_risk';\n  return 'on_track';\n}\n",
    "",
  ],
  ["import { persistAtomicAudit } from '@/lib/audit/atomic-audit';\n", "import { persistAtomicAudit } from '@/lib/audit/atomic-audit';\nimport { computeKpiHealth } from '@/lib/kpi/health';\n"],
  ["const health = computeHealth(currentValue, targetNum, warningNum, criticalNum);", "const health = computeKpiHealth(currentValue, targetNum, warningNum, criticalNum);"],
])
// Compliance rates with nothing to measure are unknown, not 100.
edit('lib/services/dashboard-kpi-service.ts', [
  ["      deadlineAdherence: number;\n", "      /** Null when no alert has been resolved: there is nothing to measure. */\n      deadlineAdherence: number | null;\n"],
  ["      documentationRate: number;\n", "      /** Null when no alert exists. */\n      documentationRate: number | null;\n"],
  ["Math.round((resolvedWithinThreshold / resolvedAlerts.length) * 100) : 100,", "Math.round((resolvedWithinThreshold / resolvedAlerts.length) * 100) : null,"],
  ["Math.round((documentedAlertCount / alertRows.length) * 100) : 100,", "Math.round((documentedAlertCount / alertRows.length) * 100) : null,"],
])
edit('lib/services/__tests__/dashboard-kpi-service.test.ts', [
  ['  it("buildLeadershipDashboard handles empty inputs with default compliance values", () => {', '  it("buildLeadershipDashboard reports unknown, not 100, for compliance rates with nothing to measure", () => {'],
  ["    expect(result.compliance.metrics.deadlineAdherence).toBe(100);\n    expect(result.compliance.metrics.documentationRate).toBe(100);\n    expect(result.compliance.alerts).toEqual([]);", "    expect(result.compliance.metrics.deadlineAdherence).toBeNull();\n    expect(result.compliance.metrics.documentationRate).toBeNull();\n    expect(result.compliance.alerts).toEqual([]);"],
])
edit('components/leadership/compliance-summary-card.tsx', [
  ["  deadlineAdherence: number; // percentage 0-100\n", "  deadlineAdherence: number | null; // percentage 0-100; null when nothing was measured\n"],
  ["  documentationRate: number; // percentage 0-100\n", "  documentationRate: number | null; // percentage 0-100; null when nothing was measured\n"],
  ["function adherenceColor(pct: number): string {\n", "function adherenceColor(pct: number | null): string {\n  if (pct === null) return \"text-muted-foreground\";\n"],
  ["      value: `${metrics.deadlineAdherence}%`,", "      value: metrics.deadlineAdherence === null ? \"—\" : `${metrics.deadlineAdherence}%`,"],
  ["      value: `${metrics.documentationRate}%`,", "      value: metrics.documentationRate === null ? \"—\" : `${metrics.documentationRate}%`,"],
])
