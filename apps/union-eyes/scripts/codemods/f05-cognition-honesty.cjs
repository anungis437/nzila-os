const fs = require('fs')
const edit = (file, pairs) => {
  let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  for (const [from, to] of pairs) {
    if (!t.includes(from)) throw new Error(`${file}: missing ${from.slice(0, 60)}`)
    t = t.replace(from, to)
  }
  fs.writeFileSync(file, t)
}
edit('lib/knowledge-transfer/resilience-index/resilience-calculator.ts', [
  [
    "  const interviews = await loadPublishedInterviews(orgId);\n\n  // Calculate dimensions",
    "  const interviews = await loadPublishedInterviews(orgId);\n\n  // With no dependency data and no usable interview there is nothing to measure. The scores would divide by zero, or read a strong score from\n  // the absence of risks that were never looked for, so the index is refused rather than calculated.\n  if (propagationMap.nodes.length === 0 && interviews.length === 0) {\n    throw ApiError.conflict('There is no published, consented interview or dependency data for this organization, so a resilience index cannot be calculated.');\n  }\n\n  // Calculate dimensions",
  ],
  ["import { db } from '@/db/db';", "import { db } from '@/db/db';\nimport { ApiError } from '@/lib/api/errors';"],
])
edit('lib/organizational-operating-intelligence/kernel-bridge-foundational.ts', [
  [
    "      const payload = await spec.invoke(organizationId);\n      return {\n        payload,\n        confidenceScore: 60,",
    "      const payload = await spec.invoke(organizationId);\n      // No constant: confidence is the amount of evidence the engine reports having read, capped at 100, and 0 when it reports none.\n      const reported = payload as { interviewsAnalyzed?: number; entriesAnalyzed?: number; interviewCount?: number } | null;\n      const evidence = Number(reported?.interviewsAnalyzed ?? reported?.entriesAnalyzed ?? reported?.interviewCount ?? 0);\n      return {\n        payload,\n        confidenceScore: Number.isFinite(evidence) ? Math.max(0, Math.min(100, Math.round(evidence))) : 0,",
  ],
])
console.log('ok')
