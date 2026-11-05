const fs = require('fs')
const file = 'lib/organizational-operating-intelligence/kernel-bridge.ts'
let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const swaps = [
  ['SystemsDynamicsProfile', 'analyzeSystemsDynamics', 'Systems dynamics analysis'],
  ['GovernanceCoherenceProfile', 'evaluateGovernanceCoherence', 'Governance coherence analysis'],
  ['OperationalCoordinationProfile', 'modelCoordinationBehavior', 'Operational coordination analysis'],
  ['OperatingRhythmProfile', 'analyzeInstitutionalRhythms', 'Operating rhythm analysis'],
  ['MultiDomainCognitionProfile', 'orchestrateMultiDomainCognition', 'Multi-domain cognition synthesis'],
  ['OperationalTrustProfile', 'analyzeOperationalTrust', 'Operational trust analysis'],
]
for (const [type, fn, label] of swaps) {
  const before = `compute: ${fn},`
  if (!t.includes(before)) throw new Error(`missing ${fn}`)
  t = t.replace(before, `compute: notImplementedCompute<${type}>('${label}'),`)
}
t = t.replace(/import \{\n  analyzeSystemsDynamics,\n  evaluateGovernanceCoherence,\n  modelCoordinationBehavior,\n  analyzeInstitutionalRhythms,\n/, 'import {\n')
t = t.replace('  orchestrateMultiDomainCognition,\n  analyzeOperationalTrust,\n', '')
t = t.replace(
  " * presenting constants as an analysis of the organization's own records. They now fail with 501,",
  " * presenting constants as an analysis of the organization's own records. The systems, coherence, coordination, rhythm,\n * multi-domain and trust engines embedded fixed frequencies, response times, integration scores and narratives in the same way.\n * They now fail with 501,",
)
fs.writeFileSync(file, t)
console.log('ok')
