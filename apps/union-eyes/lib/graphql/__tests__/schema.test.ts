import { describe, it, expect } from 'vitest';
import { schema } from '../schema';

describe('GraphQL schema', () => {
  it('exports a schema object', () => {
    expect(schema).toBeDefined();
  });

  // ── Enums ────────────────────────────────────────────────────

  it('defines ClaimStatus enum', () => {
    const type = schema.getType('ClaimStatus');
    expect(type).toBeDefined();
  });

  it('defines ClaimPriority enum', () => {
    const type = schema.getType('ClaimPriority');
    expect(type).toBeDefined();
  });

  it('defines MemberStatus enum', () => {
    const type = schema.getType('MemberStatus');
    expect(type).toBeDefined();
  });

  it('defines VoteStatus enum', () => {
    const type = schema.getType('VoteStatus');
    expect(type).toBeDefined();
  });

  it('defines PensionPlanType enum', () => {
    const type = schema.getType('PensionPlanType');
    expect(type).toBeDefined();
  });

  it('defines PaymentFrequency enum', () => {
    const type = schema.getType('PaymentFrequency');
    expect(type).toBeDefined();
  });

  it('defines RemittanceStatus enum', () => {
    const type = schema.getType('RemittanceStatus');
    expect(type).toBeDefined();
  });

  it('defines InsuranceProvider enum', () => {
    const type = schema.getType('InsuranceProvider');
    expect(type).toBeDefined();
  });

  // ── Object types ─────────────────────────────────────────────

  it('defines Claim type', () => {
    const type = schema.getType('Claim');
    expect(type).toBeDefined();
  });

  it('defines Member type', () => {
    const type = schema.getType('Member');
    expect(type).toBeDefined();
  });

  it('defines User type', () => {
    const type = schema.getType('User');
    expect(type).toBeDefined();
  });

  it('defines Vote type', () => {
    const type = schema.getType('Vote');
    expect(type).toBeDefined();
  });

  it('defines Organization type', () => {
    const type = schema.getType('Organization');
    expect(type).toBeDefined();
  });

  it('defines PensionContribution type', () => {
    const type = schema.getType('PensionContribution');
    expect(type).toBeDefined();
  });

  it('defines ContributionRates type', () => {
    const type = schema.getType('ContributionRates');
    expect(type).toBeDefined();
  });

  it('defines PensionRemittance type', () => {
    const type = schema.getType('PensionRemittance');
    expect(type).toBeDefined();
  });

  it('defines InsuranceClaim type', () => {
    const type = schema.getType('InsuranceClaim');
    expect(type).toBeDefined();
  });

  it('defines InsurancePolicy type', () => {
    const type = schema.getType('InsurancePolicy');
    expect(type).toBeDefined();
  });

  it('defines InsuranceConnection type', () => {
    const type = schema.getType('InsuranceConnection');
    expect(type).toBeDefined();
  });

  // ── Pagination ───────────────────────────────────────────────

  it('defines PageInfo type', () => {
    const type = schema.getType('PageInfo');
    expect(type).toBeDefined();
  });

  it('defines ClaimConnection type', () => {
    const type = schema.getType('ClaimConnection');
    expect(type).toBeDefined();
  });

  it('defines MemberConnection type', () => {
    const type = schema.getType('MemberConnection');
    expect(type).toBeDefined();
  });

  // ── Input types ──────────────────────────────────────────────

  it('defines CreateClaimInput', () => {
    const type = schema.getType('CreateClaimInput');
    expect(type).toBeDefined();
  });

  it('defines UpdateClaimInput', () => {
    const type = schema.getType('UpdateClaimInput');
    expect(type).toBeDefined();
  });

  it('defines CalculatePensionInput', () => {
    const type = schema.getType('CalculatePensionInput');
    expect(type).toBeDefined();
  });

  it('defines PaginationInput', () => {
    const type = schema.getType('PaginationInput');
    expect(type).toBeDefined();
  });

  // ── Root types ───────────────────────────────────────────────

  it('defines Query type', () => {
    const type = schema.getType('Query');
    expect(type).toBeDefined();
  });

  it('defines Mutation type', () => {
    const type = schema.getType('Mutation');
    expect(type).toBeDefined();
  });

  it('defines Subscription type', () => {
    const type = schema.getType('Subscription');
    expect(type).toBeDefined();
  });

  it('defines SystemStatus type', () => {
    const type = schema.getType('SystemStatus');
    expect(type).toBeDefined();
  });

  it('defines ServiceHealth type', () => {
    const type = schema.getType('ServiceHealth');
    expect(type).toBeDefined();
  });

  // ── Scalars ──────────────────────────────────────────────────

  it('defines DateTime scalar', () => {
    const type = schema.getType('DateTime');
    expect(type).toBeDefined();
  });

  it('defines JSON scalar', () => {
    const type = schema.getType('JSON');
    expect(type).toBeDefined();
  });
});
