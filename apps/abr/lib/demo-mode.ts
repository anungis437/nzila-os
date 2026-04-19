export interface DemoContext {
  enabled: boolean;
  organizationId: string;
  organizationName: string;
}

const DEMO_ORGS: Record<string, string> = {
  'metro-university': 'Metro University',
  'city-of-northgate': 'City of Northgate',
  'provincial-health-network': 'Provincial Health Network',
  'national-labour-council': 'National Labour Council',
  'federal-agency-example': 'Federal Agency Example',
};

export function resolveDemoContext(searchParams?: {
  demo?: string;
  org?: string;
}): DemoContext {
  const enabled = searchParams?.demo === 'true' || process.env.ABR_DEMO_MODE === 'true';
  const organizationId = searchParams?.org && DEMO_ORGS[searchParams.org]
    ? searchParams.org
    : process.env.ABR_DEMO_ORG_ID ?? 'metro-university';

  return {
    enabled,
    organizationId,
    organizationName: DEMO_ORGS[organizationId] ?? 'Metro University',
  };
}
