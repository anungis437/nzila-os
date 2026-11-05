/** CUPE bootstrap must report the actual checklist consumed by /api/pilot/onboarding. */
export const CUPE_BOOTSTRAP_SOURCE = 'api/pilot/bootstrap/cupe';
export const PILOT_ONBOARDING_ITEM_IDS = [
  'org-seeded', 'users-invited', 'roles-assigned', 'contracts-uploaded',
  'employers-imported', 'integrations-configured', 'export-verified',
] as const;

export function summarizePilotOnboarding(rows: ReadonlyArray<{ itemId: string; completed: boolean }>) {
  const state = new Map(rows.map(row => [row.itemId, row.completed]));
  const completed = PILOT_ONBOARDING_ITEM_IDS.filter(id => state.get(id) === true).length;
  return {
    checklistInitialized: PILOT_ONBOARDING_ITEM_IDS.filter(id => state.has(id)).length,
    completed,
    pending: PILOT_ONBOARDING_ITEM_IDS.length - completed,
    total: PILOT_ONBOARDING_ITEM_IDS.length,
  };
}
