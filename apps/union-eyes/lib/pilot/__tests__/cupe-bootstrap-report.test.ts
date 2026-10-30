import { describe, expect, it } from 'vitest';
import { PILOT_ONBOARDING_ITEM_IDS, summarizePilotOnboarding } from '../cupe-bootstrap-report';

describe('CUPE bootstrap canonical onboarding evidence', () => {
  it('does not invent invitations or integrations from fixture seeding', () => {
    expect(summarizePilotOnboarding([{ itemId: 'org-seeded', completed: true }])).toEqual({
      checklistInitialized: 1, completed: 1, pending: 6, total: 7,
    });
  });
  it('ignores obsolete checklist IDs and counts only persisted canonical items', () => {
    expect(summarizePilotOnboarding([
      { itemId: 'org_profile_configured', completed: true },
      { itemId: 'team_invited', completed: true },
      { itemId: 'org-seeded', completed: false },
      { itemId: 'users-invited', completed: true },
    ])).toEqual({ checklistInitialized: 2, completed: 1, pending: 6, total: 7 });
  });
  it('uses the seven canonical onboarding IDs', () => {
    expect(PILOT_ONBOARDING_ITEM_IDS).toEqual([
      'org-seeded', 'users-invited', 'roles-assigned', 'contracts-uploaded',
      'employers-imported', 'integrations-configured', 'export-verified',
    ]);
  });
});
