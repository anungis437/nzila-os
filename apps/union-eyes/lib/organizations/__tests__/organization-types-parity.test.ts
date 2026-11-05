import { describe, expect, it } from 'vitest';
import { organizationTypeEnum } from '@/db/schema-organizations';
import { ORGANIZATION_TYPES, isOrganizationType } from '@/types/organization';

describe('organization types', () => {
  it('are the types the database enum lists, in its order', () => {
    expect([...ORGANIZATION_TYPES]).toEqual([...organizationTypeEnum.enumValues]);
  });

  it('recognises a type by its exact name and nothing else', () => {
    for (const type of ORGANIZATION_TYPES) expect(isOrganizationType(type)).toBe(true);
    for (const other of ['chapter', 'Union', '', null, undefined, 3, {}]) expect(isOrganizationType(other)).toBe(false);
  });
});
