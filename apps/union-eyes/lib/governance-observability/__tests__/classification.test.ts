import { describe, it, expect } from 'vitest';
import {
  governanceSensitivityToTelemetry,
  aiRiskToTelemetrySensitivity,
  classifyRoute,
  classifyAIAction,
  classifyPublicationEvent,
  classifyTelemetry,
} from '../classification';

describe('governanceSensitivityToTelemetry', () => {
  it('maps low → internal', () => {
    expect(governanceSensitivityToTelemetry('low')).toBe('internal');
  });
  it('maps moderate → internal', () => {
    expect(governanceSensitivityToTelemetry('moderate')).toBe('internal');
  });
  it('maps high → confidential', () => {
    expect(governanceSensitivityToTelemetry('high')).toBe('confidential');
  });
  it('maps critical → restricted', () => {
    expect(governanceSensitivityToTelemetry('critical')).toBe('restricted');
  });
});

describe('aiRiskToTelemetrySensitivity', () => {
  it('maps assistive → internal', () => {
    expect(aiRiskToTelemetrySensitivity('assistive')).toBe('internal');
  });
  it('maps advisory → internal', () => {
    expect(aiRiskToTelemetrySensitivity('advisory')).toBe('internal');
  });
  it('maps sensitive → confidential', () => {
    expect(aiRiskToTelemetrySensitivity('sensitive')).toBe('confidential');
  });
  it('maps restricted → restricted', () => {
    expect(aiRiskToTelemetrySensitivity('restricted')).toBe('restricted');
  });
});

describe('classifyRoute', () => {
  it('classifies auth routes as auth/confidential', () => {
    const result = classifyRoute('/api/auth/login');
    expect(result.category).toBe('auth');
    expect(result.sensitivity).toBe('confidential');
  });

  it('classifies admin routes as auth/confidential', () => {
    const result = classifyRoute('/api/admin/users');
    expect(result.category).toBe('auth');
    expect(result.sensitivity).toBe('confidential');
  });

  it('classifies member routes as member-action/confidential', () => {
    const result = classifyRoute('/api/members/list');
    expect(result.category).toBe('member-action');
    expect(result.sensitivity).toBe('confidential');
  });

  it('classifies dues routes as member-action', () => {
    const result = classifyRoute('/api/dues/calculate');
    expect(result.category).toBe('member-action');
  });

  it('classifies export routes as export/restricted', () => {
    const result = classifyRoute('/api/export/members');
    expect(result.category).toBe('export');
    expect(result.sensitivity).toBe('restricted');
  });

  it('classifies federation routes as federation/confidential', () => {
    const result = classifyRoute('/api/federation/contracts');
    expect(result.category).toBe('federation');
    expect(result.sensitivity).toBe('confidential');
  });

  it('defaults to governance/internal for unrecognised routes', () => {
    const result = classifyRoute('/api/unknown/endpoint');
    expect(result.category).toBe('governance');
    expect(result.sensitivity).toBe('internal');
  });
});

describe('classifyAIAction', () => {
  it('classifies restricted risk as ai-operation/restricted', () => {
    const result = classifyAIAction('restricted');
    expect(result.category).toBe('ai-operation');
    expect(result.sensitivity).toBe('restricted');
  });

  it('classifies sensitive risk as ai-operation/confidential', () => {
    const result = classifyAIAction('sensitive');
    expect(result.category).toBe('ai-operation');
    expect(result.sensitivity).toBe('confidential');
  });

  it('classifies assistive risk as ai-operation/internal', () => {
    const result = classifyAIAction('assistive');
    expect(result.category).toBe('ai-operation');
    expect(result.sensitivity).toBe('internal');
  });
});

describe('classifyPublicationEvent', () => {
  it('classifies federation publication as federation/restricted', () => {
    const result = classifyPublicationEvent({ isPublic: true, isFederation: true });
    expect(result.category).toBe('federation');
    expect(result.sensitivity).toBe('restricted');
  });

  it('classifies public publication as publication/confidential', () => {
    const result = classifyPublicationEvent({ isPublic: true, isFederation: false });
    expect(result.category).toBe('publication');
    expect(result.sensitivity).toBe('confidential');
  });

  it('classifies internal publication as publication/internal', () => {
    const result = classifyPublicationEvent({ isPublic: false, isFederation: false });
    expect(result.category).toBe('publication');
    expect(result.sensitivity).toBe('internal');
  });
});

describe('classifyTelemetry', () => {
  it('maps governance sensitivity + category correctly', () => {
    const result = classifyTelemetry('critical', 'audit');
    expect(result.sensitivity).toBe('restricted');
    expect(result.category).toBe('audit');
  });
});
