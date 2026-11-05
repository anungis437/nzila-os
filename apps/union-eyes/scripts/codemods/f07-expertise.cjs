const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('lib/knowledge-transfer/expertise/expertise-extractor.ts', [
  [
    "export async function extractExpertise(",
    `export class ExpertiseExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpertiseExtractionError';
  }
}

const SENSITIVITIES = ['low', 'medium', 'high', 'critical'] as const;
const LIST_FIELDS = [
  'expertiseDomains', 'systemsOwnership', 'vendorRelationships', 'undocumentedWorkflows',
  'complianceAreas', 'governanceObligations', 'crossTeamDependencies',
] as const;

/** A model answer is evidence only when it has the profile's shape; anything else is refused, not repaired into a default. */
function parseProfile(content: string): Omit<ExpertiseProfile, 'sourceInterviewId'> {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new ExpertiseExtractionError('The model answer is not valid JSON');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ExpertiseExtractionError('The model answer is not a profile object');
  const profile = raw as Record<string, unknown>;
  if (!SENSITIVITIES.includes(profile.continuitySensitivity as never)) {
    throw new ExpertiseExtractionError('The model answer has no valid continuity sensitivity');
  }
  for (const field of LIST_FIELDS) {
    const value = profile[field];
    if (value !== undefined && !(Array.isArray(value) && value.every((entry) => typeof entry === 'string'))) {
      throw new ExpertiseExtractionError(\`The model answer has an invalid \${field}\`);
    }
  }
  return {
    ...Object.fromEntries(LIST_FIELDS.map((field) => [field, (profile[field] as string[] | undefined) ?? []])),
    continuitySensitivity: profile.continuitySensitivity as ExpertiseProfile['continuitySensitivity'],
    continuityJustification: typeof profile.continuityJustification === 'string' ? profile.continuityJustification : '',
  } as Omit<ExpertiseProfile, 'sourceInterviewId'>;
}

/**
 * Extracts an expertise profile. When the model's answer cannot be parsed or has the wrong shape this throws: a default
 * "medium" profile used to be returned and stored as the interview's continuity risk, which presented a guess as an assessment.
 */
export async function extractExpertise(`,
  ],
])

{
  const f = 'lib/knowledge-transfer/expertise/expertise-extractor.ts'
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  const re = /  try \{\n    const parsed = JSON\.parse\(result\.content\)[\s\S]*?\n  \}\n\}\n\n\/\*\*\n \* Derive/
  if (!re.test(s)) throw new Error('fallback block not found')
  s = s.replace(re, '  return { ...parseProfile(result.content), sourceInterviewId: interview.id };\n}\n\n/**\n * Derive')
  fs.writeFileSync(f, s)
}
console.log('ok')
