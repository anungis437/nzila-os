export async function seedChildOrganizations(): Promise<{
  localsCreated: number;
  districtsCreated: number;
  skipped: string[];
}> {
  return {
    localsCreated: 0,
    districtsCreated: 0,
    skipped: [],
  };
}
