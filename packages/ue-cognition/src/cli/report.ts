/**
 * @nzila/ue-cognition/cli/report — Print latest UE-cognition state.
 *
 * Run via `pnpm --filter @nzila/ue-cognition report`.
 */
import { latestKpiSnapshot } from '../kpis/engine'
import { latestWorkloadByOrg, computeWorkloadFairness } from '../workload/engine'
import { listCaseRiskSnapshots } from '../case-risk/engine'
import { disengagedMembersCount } from '../engagement/engine'
import { listAuditEntries } from '../audit'

const orgId = process.argv[2] ?? '458a56cb-251a-4c91-a0b5-81bb8ac39087'
const tenantId = process.env.NZILA_TENANT_ID ?? 'default'
const subject = { tenantId, orgId }

const cases = listCaseRiskSnapshots().filter((s) => s.subject.orgId === orgId)
const tiered = { low: 0, medium: 0, high: 0, critical: 0 }
for (const c of cases) tiered[c.riskTier] += 1

const stewards = latestWorkloadByOrg(orgId)
const fairness = stewards.length > 0 ? computeWorkloadFairness(subject, stewards) : null

const kpi = latestKpiSnapshot(orgId)
const audits = listAuditEntries().filter((a) => a.subject.orgId === orgId)

console.log('=== @nzila/ue-cognition report ===')
console.log(`Org: ${orgId}`)
console.log(`Cases scored: ${cases.length}`)
console.log(`  by tier: low=${tiered.low} medium=${tiered.medium} high=${tiered.high} critical=${tiered.critical}`)
console.log(`Stewards observed: ${stewards.length}`)
if (fairness) {
  console.log(
    `  fairness=${fairness.fairnessScore.toFixed(2)} mean=${fairness.meanUtilization.toFixed(2)} ` +
    `min=${fairness.minUtilization.toFixed(2)} max=${fairness.maxUtilization.toFixed(2)}`,
  )
}
console.log(`Disengaged/lost members: ${disengagedMembersCount(orgId)}`)
console.log(`Audit entries: ${audits.length}`)
if (kpi) {
  console.log('Latest KPI snapshot:')
  console.log(`  window=${kpi.windowDays}d ROI≈$${kpi.estimatedRoiCad.toFixed(0)} CAD`)
  console.log(`  high-risk surfaced early=${kpi.highRiskCasesSurfacedEarly}`)
  console.log(`  precedent retrievals=${kpi.precedentRetrievalsCount} (${kpi.precedentHoursSaved.toFixed(1)}h saved)`)
} else {
  console.log('No KPI snapshot yet for this org.')
}
