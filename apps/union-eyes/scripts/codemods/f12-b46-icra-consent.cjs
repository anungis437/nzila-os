const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}

// Stepwise start: consent is required and is stamped by the server.
edit('app/api/icra/start/route.ts', [
  [
    "  const consentComplete =\n    payload.consent?.acknowledgedAntiSurveillance === true &&\n    payload.consent?.acknowledgedDataHandling === true &&\n    payload.consent?.acknowledgedExplainability === true\n",
    "  const consent = serverConsentRecord(payload.consent)\n  if (!consent) {\n    return NextResponse.json({ error: 'The three acknowledgements are required before an assessment can start.' }, { status: 400 })\n  }\n",
  ],
  [
    "          consent: consentComplete\n            ? {\n                ...payload.consent,\n                acceptedAt: new Date().toISOString(),\n                doctrineVersion: DOCTRINE_VERSION,\n              }\n            : null,\n",
    "          consent,\n",
  ],
  ["import { DOCTRINE_VERSION } from '@/lib/icra/copy'\n", "import { DOCTRINE_VERSION } from '@/lib/icra/copy'\nimport { serverConsentRecord } from '@/lib/icra/consent'\n"],
])

// Stepwise answer: nothing is stored for an assessment with no recorded consent.
edit('app/api/icra/[assessmentId]/answer/route.ts', [
  [
    "      if (assessment.status !== 'in_progress') {\n        return NextResponse.json({ error: 'Assessment is not accepting answers' }, { status: 409 })\n      }\n",
    "      if (assessment.status !== 'in_progress') {\n        return NextResponse.json({ error: 'Assessment is not accepting answers' }, { status: 409 })\n      }\n      if (!hasRecordedConsent(assessment.consent)) {\n        return NextResponse.json({ error: 'Consent has not been recorded for this assessment' }, { status: 409 })\n      }\n",
  ],
])

// Stepwise submit: consent and required coverage before anything is scored.
edit('app/api/icra/[assessmentId]/submit/route.ts', [
  [
    "      const answerRows = await tx\n        .select()\n        .from(icraAssessmentAnswers)\n        .where(eq(icraAssessmentAnswers.assessmentId, assessmentId))\n\n      if (answerRows.length === 0) {",
    "      if (!hasRecordedConsent(assessment.consent)) {\n        return NextResponse.json({ error: 'Consent has not been recorded for this assessment' }, { status: 409 })\n      }\n\n      const answerRows = await tx\n        .select()\n        .from(icraAssessmentAnswers)\n        .where(eq(icraAssessmentAnswers.assessmentId, assessmentId))\n\n      if (answerRows.length === 0) {",
  ],
  [
    "      const answers: Answer[] = answerRows.map(",
    "      const missing = missingRequiredAnswerIds(answerRows.map((row) => row.questionId))\n      if (missing.length > 0) {\n        return NextResponse.json(\n          { error: 'Required questions are unanswered; a continuity profile cannot be generated.', missingCount: missing.length },\n          { status: 400 },\n        )\n      }\n\n      const answers: Answer[] = answerRows.map(",
  ],
  ["import { computeProfile } from '@/lib/icra/scoring'\n", "import { computeProfile } from '@/lib/icra/scoring'\nimport { hasRecordedConsent } from '@/lib/icra/consent'\nimport { missingRequiredAnswerIds } from '@/lib/icra/stepwise-coverage'\n"],
])
edit('app/api/icra/[assessmentId]/answer/route.ts', [
  ["import { checkRateLimit }", "import { hasRecordedConsent } from '@/lib/icra/consent'\nimport { checkRateLimit }"],
])

// One-shot submit: consent built by the server, supported locale, bounded body and context keys.
edit('app/api/icra/submit/route.ts', [
  [
    "  let body: unknown\n  try {\n    body = await req.json()\n  } catch {\n    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })\n  }\n",
    "  let body: unknown\n  try {\n    const raw = await req.text()\n    if (raw.length > ICRA_SUBMIT_MAX_BODY_BYTES) {\n      return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })\n    }\n    body = JSON.parse(raw)\n  } catch {\n    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })\n  }\n",
  ],
  [
    "  const { consent, orgContext, answers, locale = 'en-CA', turnstileToken } = body\n",
    "  const { orgContext, answers, turnstileToken } = body\n  // The stored consent is built here: a client-supplied time, doctrine version or extra key is not evidence.\n  const consent = serverConsentRecord(body.consent)!\n  const locale = normalizeIcraLocale(body.locale)\n  if (!locale) {\n    return NextResponse.json({ error: 'Unsupported locale.' }, { status: 400 })\n  }\n",
  ],
  [
    "    const entries: Array<[string, string]> = []\n    for (const [k, v] of Object.entries(orgContext)) {\n      if (typeof v !== 'string') continue\n",
    "    const entries: Array<[string, string]> = []\n    const submittedKeys = Object.keys(orgContext)\n    if (submittedKeys.length > MAX_ORG_CONTEXT_KEYS || !submittedKeys.every((key) => ORG_CONTEXT_KEY.test(key))) {\n      return NextResponse.json({ error: 'Invalid organization context.' }, { status: 400 })\n    }\n    for (const [k, v] of Object.entries(orgContext)) {\n      if (typeof v !== 'string') continue\n",
  ],
  [
    "import { DOCTRINE_VERSION } from '@/lib/icra/copy'\n",
    "import { DOCTRINE_VERSION } from '@/lib/icra/copy'\nimport { ICRA_SUBMIT_MAX_BODY_BYTES, normalizeIcraLocale, serverConsentRecord } from '@/lib/icra/consent'\n",
  ],
  ["interface SubmitBody {", "const MAX_ORG_CONTEXT_KEYS = 40\nconst ORG_CONTEXT_KEY = /^[a-z][a-z0-9_]{0,63}$/\n\ninterface SubmitBody {"],
])
