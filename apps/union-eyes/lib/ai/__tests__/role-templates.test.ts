import { describe, it, expect } from 'vitest';

import {
  stewardTemplates,
  officerTemplates,
  adminTemplates,
  mobileTemplates,
} from '../role-templates';

describe('stewardTemplates', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(stewardTemplates)).toBe(true);
    expect(stewardTemplates.length).toBeGreaterThan(0);
  });

  it('each template has required fields', () => {
    for (const t of stewardTemplates) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.version).toBeTruthy();
      expect(t.systemPrompt).toBeTruthy();
      expect(t.attentionWeights).toBeDefined();
      expect(t.jurisdictions!.length).toBeGreaterThan(0);
      expect(t.requiredVariables!.length).toBeGreaterThan(0);
    }
  });

  it('attention weights sum to ~1.0', () => {
    for (const t of stewardTemplates) {
      const sum = Object.values(t.attentionWeights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it('includes grievance template', () => {
    expect(stewardTemplates.some(t => t.id === 'steward-grievance')).toBe(true);
  });

  it('includes rights template', () => {
    expect(stewardTemplates.some(t => t.id === 'steward-rights')).toBe(true);
  });
});

describe('officerTemplates', () => {
  it('exports a non-empty array', () => {
    expect(officerTemplates.length).toBeGreaterThan(0);
  });

  it('each template has valid structure', () => {
    for (const t of officerTemplates) {
      expect(t.id).toBeTruthy();
      expect(t.systemPrompt.length).toBeGreaterThan(50);
      expect(t.complianceTags!.length).toBeGreaterThan(0);
    }
  });

  it('includes bargaining and governance templates', () => {
    expect(officerTemplates.some(t => t.id === 'officer-bargaining')).toBe(true);
    expect(officerTemplates.some(t => t.id === 'officer-governance')).toBe(true);
  });
});

describe('adminTemplates', () => {
  it('exports templates', () => {
    expect(adminTemplates.length).toBeGreaterThan(0);
  });

  it('includes user management template', () => {
    expect(adminTemplates.some(t => t.id === 'admin-user-management')).toBe(true);
  });

  it('includes reporting template', () => {
    expect(adminTemplates.some(t => t.id === 'admin-reporting')).toBe(true);
  });

  it('compliance tags have severity', () => {
    for (const t of adminTemplates) {
      for (const tag of t.complianceTags!) {
        expect(['critical', 'high', 'medium', 'low']).toContain(tag.severity);
      }
    }
  });
});

describe('mobileTemplates', () => {
  it('exports templates', () => {
    expect(mobileTemplates.length).toBeGreaterThan(0);
  });

  it('includes mobile member and steward templates', () => {
    expect(mobileTemplates.some(t => t.id === 'mobile-member')).toBe(true);
    expect(mobileTemplates.some(t => t.id === 'mobile-steward')).toBe(true);
  });

  it('all templates have metadata', () => {
    for (const t of mobileTemplates) {
      expect(t.metadata).toBeDefined();
      expect(t.metadata!.author).toBeTruthy();
    }
  });
});
