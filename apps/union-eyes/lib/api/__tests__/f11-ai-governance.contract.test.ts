import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(fileURLToPath(new URL('../../../', import.meta.url)), 'app', 'api');
const read = (route: string) => readFileSync(join(API, ...route.split('/'), 'route.ts'), 'utf8');

describe('F11 AI and model output governance', () => {
  // DEF-0B2-AI-CACHE-PLATFORM-WIDE-ORG-ADMIN
  it('the embedding cache statistics need platform authority, not an organization administrator', () => {
    expect(read('ai/cache-stats')).toContain('withSystemAdminAuth');
  });

  // DEF-0B9-ML-ALERTS-DRIFT-FINDING-IS-A-LITERAL-PSI-AND-ALERT-IDS-CHANGE-EVERY-SECOND / DEF-0B9-ML-ALERT-ACKNOWLEDGE-GUID-NEVER-MATCHES-A-GENERATED-ID-AND-THE-ACKNOWLEDGEMENT-IS-KEYED-ON-THE-ID-ALONE / DEF-0B9-ML-CHURN-PROFILES-NAMED-MEMBERS-FROM-THEIR-CASE-HISTORY-WITH-NO-CONSENT-OR-PURPOSE-DECISION
  it.each(['ml/monitoring/alerts', 'ml/predictions/churn-risk'])('%s answers 501 and returns no literal finding or named member profile', (route) => {
    expect(read(route)).toContain('ApiError.notImplemented');
  });

  // DEF-0B6-EDU-ITEM-FACADES-REWRITE-OR-DELETE-COURSE-BY-PATH-ID
  it('the program enrolment item answers 501 for every method, so a program id never reaches a course row', () => {
    const text = read('education/programs/[id]/enrollments');
    expect(text).toContain('ApiError.notImplemented');
    expect(text).not.toContain('crudRoutes');
  });

  // DEF-0B3-WEEKLY-SUMMARY-FABRICATED-MODEL-CLAIM
  it('the weekly summary states that no model was used and stores no AI reference or confidence', () => {
    const text = read('analytics/insights/weekly-summary');
    expect(text).toContain('aiUsed: false');
    expect(text).toContain('aiReferenceId: null');
    expect(text).toContain('confidenceScore: null');
  });
});
