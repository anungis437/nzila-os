import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// The inheritance path was the generic CRUD factory over pending_profiles, the pre-signup profile table, and recorded no
// succession. It answers 501 until a succession record exists; the profile table is not exposed through it.
describe('continuity inheritance route', () => {
  const source = readFileSync(resolve(__dirname, '../continuity/inheritance/route.ts'), 'utf8');

  it('answers 501 and keeps its role floor', () => {
    expect(source).toContain('ApiError.notImplemented');
    expect(source).toContain("minRole: 'support_agent'");
    expect(source).toContain('export const GET = handler');
    expect(source).toContain('export const POST = handler');
  });

  it('does not expose the pending profile table', () => {
    expect(source).not.toContain('crudRoutes');
    expect(source).not.toContain('pendingProfilesTable');
  });
});
