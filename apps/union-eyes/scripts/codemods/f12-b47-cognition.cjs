const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
const KT = 'lib/knowledge-transfer/'
fs.writeFileSync(KT + 'governance/interview-read-limit.ts', "/** The most published exit interviews one derived analysis reads, so cost and any model prompt stay bounded as interviews accumulate. */\nexport const INTERVIEW_READ_LIMIT = 500\n")

const LIMITED = [
  ['topic-graph/topic-graph-builder.ts', '    .where(derivedAnalyticsCondition(orgId));\n'],
  ['succession/succession-analyzer.ts', '    .where(derivedAnalyticsCondition(orgId));\n'],
  ['resilience-index/resilience-calculator.ts', '    .where(derivedAnalyticsCondition(orgId));\n'],
  ['propagation/dependency-propagator.ts', '    .where(derivedAnalyticsCondition(orgId));\n'],
  ['continuity-risk/risk-detector.ts', '    .where(derivedAnalyticsCondition(orgId));\n'],
  ['simulation/continuity-simulator.ts', '    .where(derivedAnalyticsCondition(orgId));\n'],
]
for (const [file, anchor] of LIMITED) {
  edit(KT + file, [[anchor, anchor.replace(';\n', '') + '\n    .limit(INTERVIEW_READ_LIMIT);\n']])
  let s = fs.readFileSync(KT + file, 'utf8')
  const imp = "import { INTERVIEW_READ_LIMIT } from '@/lib/knowledge-transfer/governance/interview-read-limit';\n"
  const firstImport = s.indexOf('import ')
  s = s.slice(0, firstImport) + imp + s.slice(firstImport)
  fs.writeFileSync(KT + file, s)
}

// Documentation strategy: a low or unknown documentation score selects it (the expression parsed as score ?? (0 < 65)).
edit(KT + 'resilience-strategies/strategy-modeler.ts', [
  [
    "  // Always recommend documentation as foundational\n  if (resilienceIndex.dimensions.find((d) => d.name === 'Documentation Maturity')?.score ?? 0 < 65) {",
    "  // A low or unmeasured documentation score selects the documentation strategy; a high one does not.\n  const documentationScore = resilienceIndex.dimensions.find((d) => d.name === 'Documentation Maturity')?.score;\n  if (documentationScore === undefined || !Number.isFinite(documentationScore) || documentationScore < 65) {",
  ],
])

// Personality: no characterization is made from the absence of recorded activity.
edit(KT + 'maturity-personalities/personality-models.ts', [
  ["  | 'continuity_progressive';    // Leading-edge, adaptive governance culture", "  | 'continuity_progressive'     // Leading-edge, adaptive governance culture\n  | 'insufficient_data';         // Too little recorded activity to characterize"],
])
edit(KT + 'maturity-personalities/personality-profiler.ts', [
  [
    "  continuity_progressive: {",
    "  insufficient_data: {\n    name: 'Insufficient data',\n    description: 'Too little governance activity has been recorded to characterize this organization.',\n    characteristics: [],\n    strategicFocus: 'Record governance decisions and reasoning sessions; no characterization is made until enough activity exists.',\n  },\n  continuity_progressive: {",
  ],
  ["  if (totalInteractions < 2) return 'resilience_fragile';", "  if (totalInteractions < 2) return 'insufficient_data';"],
  [
    "  const identityStatement = `This organization operates as a \"${meta.name}\" institution — ${meta.description.split('.')[0].toLowerCase()}.`;",
    "  const identityStatement =\n    personalityType === 'insufficient_data'\n      ? 'Too little governance activity has been recorded to characterize this organization.'\n      : `This organization operates as a \"${meta.name}\" institution — ${meta.description.split('.')[0].toLowerCase()}.`;",
  ],
])
edit('lib/knowledge-transfer/maturity-personalities/__tests__/personality-profiler.test.ts', [
  [
    "  it('profiles a fragile organization with no history', async () => {",
    "  it('makes no characterization of an organization with no recorded history', async () => {",
  ],
  ["    expect(p.personalityType).toBe('resilience_fragile');\n    expect(p.stabilityProfile.stabilityRating).toBe('insufficient_data');", "    expect(p.personalityType).toBe('insufficient_data');\n    expect(p.identityStatement).not.toContain('Resilience-Fragile');\n    expect(p.stabilityProfile.stabilityRating).toBe('insufficient_data');"],
])

// Narratives: zero evidence is stated as zero evidence, not as a derivation.
edit('lib/organizational-narratives/index.ts', [
  [
    "    `Derived from ${evidenceCount} institutional evidence item${evidenceCount === 1 ? '' : 's'} ${conf}.`,",
    "    evidenceCount === 0\n      ? 'No institutional evidence is attached to this result, so it is guidance, not a finding.'\n      : `Derived from ${evidenceCount} institutional evidence item${evidenceCount === 1 ? '' : 's'} ${conf}.`,",
  ],
])
