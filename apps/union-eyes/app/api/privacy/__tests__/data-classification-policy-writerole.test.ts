import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// DEF-0B6-CMP-FIREWALL-POLICY-NO-WRITER-OR-ENFORCER: the route was the generic factory over data_classification_policy, a platform table no route
// writes and nothing enforces, under the name of an employer data firewall. It answers 501 and no longer binds the table at all, so the
// writeRole question this test used to pin (compliance_manager, never the per-org admin) has no write to protect.
describe('compliance/data-classification-policy route (platform classification doctrine)', () => {
  const source = readFileSync(resolve(__dirname, '../../compliance/data-classification-policy/route.ts'), 'utf8');

  it('answers 501 and binds neither the factory nor the table', () => {
    expect(source).toContain('ApiError.notImplemented');
    expect(source).not.toMatch(/crudRoutes\(/);
    expect(source).not.toMatch(/dataClassificationPolicy/);
  });

  it('exports the same methods it did, all refused', () => {
    expect(source).toContain('export const GET = handler');
    expect(source).toContain('export const POST = handler');
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
