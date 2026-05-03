export const UE_TEST_ORGS = {
  primary: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'UE QA Primary Local',
    slug: 'ue-qa-primary',
    organizationType: 'local' as const,
    hierarchyPath: ['ue-qa-primary'],
    hierarchyLevel: 0,
  },
  secondary: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'UE QA Secondary Local',
    slug: 'ue-qa-secondary',
    organizationType: 'local' as const,
    hierarchyPath: ['ue-qa-secondary'],
    hierarchyLevel: 0,
  },
  uxTesterIsolated: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'UE QA External Tester Sandbox',
    slug: 'ue-qa-ux-sandbox',
    organizationType: 'local' as const,
    hierarchyPath: ['ue-qa-ux-sandbox'],
    hierarchyLevel: 0,
  },
  productionLike: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'UE Production Like Guardrail Org',
    slug: 'ue-prod-like-guardrail',
    organizationType: 'local' as const,
    hierarchyPath: ['ue-prod-like-guardrail'],
    hierarchyLevel: 0,
  },
} as const

export type UeTestOrgKey = keyof typeof UE_TEST_ORGS
