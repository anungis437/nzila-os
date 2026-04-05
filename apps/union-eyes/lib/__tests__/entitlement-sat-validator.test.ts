import { describe, it, expect, vi } from 'vitest';

// Mock transitive deps from entitlements.ts and api-auth-guard.ts
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({ organizationMembers: {}, organizations: {} }));
vi.mock('@/db/schema/domains/member', () => ({ users: {} }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: vi.fn(), redirect: vi.fn(), next: vi.fn() },
}));
vi.mock('@/lib/public-routes', () => ({
  isPublicRoute: vi.fn(), isCronRoute: vi.fn(),
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), or: vi.fn(), sql: vi.fn(),
  relations: vi.fn(() => ({})),
}));
vi.mock('server-only', () => ({}));

import {
  SATSolver,
  EntitlementValidator,
  createUnionEyesEntitlements,
  validateUnionEyesEntitlements,
} from '../entitlement-sat-validator';

describe('entitlement-sat-validator', () => {
  describe('SATSolver', () => {
    it('solves a satisfiable formula', () => {
      const solver = new SATSolver();
      // (A ∨ B) — simple clause, should be satisfiable
      const formula = [
        [
          { variable: 'A', negated: false },
          { variable: 'B', negated: false },
        ],
      ];
      const result = solver.solve(formula);
      expect(result.satisfiable).toBe(true);
      expect(result.assignment).toBeDefined();
    });

    it('detects unsatisfiable formula', () => {
      const solver = new SATSolver();
      // (A) ∧ (¬A) — contradictory
      const formula = [
        [{ variable: 'A', negated: false }],
        [{ variable: 'A', negated: true }],
      ];
      const result = solver.solve(formula);
      expect(result.satisfiable).toBe(false);
    });

    it('solves implications (A → B)', () => {
      const solver = new SATSolver();
      // (¬A ∨ B) ∧ (A) — must have B=true
      const formula = [
        [{ variable: 'A', negated: true }, { variable: 'B', negated: false }],
        [{ variable: 'A', negated: false }],
      ];
      const result = solver.solve(formula);
      expect(result.satisfiable).toBe(true);
      expect(result.assignment!['B']).toBe(true);
    });

    it('handles empty formula as satisfiable', () => {
      const solver = new SATSolver();
      const result = solver.solve([]);
      expect(result.satisfiable).toBe(true);
    });
  });

  describe('EntitlementValidator', () => {
    it('validates a system with no constraints', () => {
      const validator = new EntitlementValidator([], []);
      const result = validator.validateSystem();
      expect(result.isValid).toBe(true);
    });

    it('validates compatible entitlements', () => {
      const validator = new EntitlementValidator(
        [{ entitlement: 'ai_search' as unknown as string }],
        [{ role: 'admin' as unknown as string, entitlements: ['ai_search' as unknown as string] }],
      );
      const result = validator.validateSystem();
      expect(result.isValid).toBe(true);
    });

    it('areEntitlementsCompatible checks simultaneous holding', () => {
      const validator = new EntitlementValidator([], []);
      expect(validator.areEntitlementsCompatible(['a', 'b'])).toBe(true);
    });

    it('getRequiredEntitlements resolves dependency chain', () => {
      const validator = new EntitlementValidator(
        [
          { entitlement: 'predictive_models' as unknown as string, requires: ['advanced_analytics' as unknown as string] },
          { entitlement: 'advanced_analytics' as unknown as string, requires: ['ai_search' as unknown as string] },
        ],
        [],
      );

      const required = validator.getRequiredEntitlements('predictive_models');
      expect(required).toContain('predictive_models');
      expect(required).toContain('advanced_analytics');
      expect(required).toContain('ai_search');
    });
  });

  describe('Union Eyes defaults', () => {
    it('createUnionEyesEntitlements returns constraints and roleMappings', () => {
      const { constraints, roleMappings } = createUnionEyesEntitlements();
      expect(constraints.length).toBeGreaterThan(0);
      expect(roleMappings.length).toBeGreaterThan(0);
    });

    it('validateUnionEyesEntitlements returns valid system', () => {
      const result = validateUnionEyesEntitlements();
      expect(result.isValid).toBe(true);
    });
  });
});
