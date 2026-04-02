export async function seedOrganizationHierarchy(): Promise<{
  federationsCreated: number;
  affiliatesCreated: number;
  skipped: string[];
}> {
  return {
    federationsCreated: 0,
    affiliatesCreated: 0,
    skipped: [],
  };
}
