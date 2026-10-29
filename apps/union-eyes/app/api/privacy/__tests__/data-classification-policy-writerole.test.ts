import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  dataClassificationPolicy: { __table: 'data_classification_policy' },
  collectionGet: vi.fn(async () => ({ ok: true, scope: 'collection-get' })),
  collectionPost: vi.fn(async () => ({ ok: true, scope: 'collection-post' })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/db/schema', () => ({ dataClassificationPolicy: m.dataClassificationPolicy }));

describe('compliance/data-classification-policy route (platform classification doctrine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({ GET: m.collectionGet, POST: m.collectionPost });
  });

  it('registers CRUD with writeRole=compliance_manager, never the ordinary per-org admin role (data_classification_policy has no organizationId column — this is platform-wide doctrine)', async () => {
    await import('../../compliance/data-classification-policy/route');

    expect(m.crudRoutes).toHaveBeenCalledWith({
      table: m.dataClassificationPolicy,
      pk: 'id',
      tags: ['Compliance'],
      orgScoped: true,
      unscopedByDesign: expect.any(String),
      readRole: 'member',
      writeRole: 'compliance_manager',
    });
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ writeRole: 'admin' }));
  });
});

// Governance Officer 2.1 P0-D: privacy workflow routes must never be bound to
// classification-policy CRUD. They are NOT_IMPLEMENTED until real incident /
// rights-request / jurisdictional stores exist.
describe.each(['breach', 'dsar', 'provincial'])('privacy/%s route misbinding containment', (name) => {
  const source = readFileSync(resolve(__dirname, `../${name}/route.ts`), 'utf8');

  it('does not import the classification policy table or the CRUD factory', () => {
    expect(source).not.toMatch(/from ['"]@\/db\/schema['"]/);
    expect(source).not.toMatch(/from ['"]@\/lib\/api\/crud-factory['"]/);
    expect(source).not.toMatch(/crudRoutes\(/);
  });

  it('fails closed with NOT_IMPLEMENTED for every method', () => {
    expect(source).toMatch(/ApiError\.notImplemented\(MESSAGE\)/);
    expect(source).toMatch(/export const GET/);
    expect(source).toMatch(/export const POST/);
  });
});
