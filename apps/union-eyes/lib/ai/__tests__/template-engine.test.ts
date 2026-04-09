import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/db/schema/ai-chatbot-schema', () => ({
  chatMessages: {},
  knowledgeBase: {},
}));

vi.mock('@/db/schema/claims-schema', () => ({
  claims: {},
  claimUpdates: {},
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/ai/services/cost-tracking-wrapper', () => ({
  costTrackingWrapper: { trackCost: vi.fn() },
}));

vi.mock('@/lib/services/claim-workflow-fsm', () => ({
  getAllowedClaimTransitions: vi.fn().mockReturnValue([]),
  getTransitionRequirements: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/services/sla-calculator', () => ({
  calculateCaseSlaStatus: vi.fn().mockReturnValue({
    overallStatus: 'on_track',
    criticalSlas: [],
  }),
}));

vi.mock('@/lib/services/lro-signals', () => ({
  detectAllSignals: vi.fn().mockResolvedValue([]),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
  and: vi.fn(),
  relations: vi.fn(() => ({})),
}));

import {
  UnionEyesAIController,
  type Jurisdiction,
} from '../template-engine';

// ────────────────────────────────────────────────────────────────────────────
// TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('TemplateEngine', () => {
  let controller: UnionEyesAIController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UnionEyesAIController();
    // Mock private getProvider — no real AI provider in tests
    vi.spyOn(controller as any, 'getProvider').mockReturnValue({
      generateResponse: vi.fn().mockResolvedValue({
        content: 'Mock AI response',
        tokensUsed: 42,
        model: 'test-model',
      }),
    });
  });

  // ── Template Registry ──────────────────────────────────────────────────

  describe('Template Registry', () => {
    it('initializes with 8 base templates', () => {
      const templates = controller.listTemplates();
      expect(templates.length).toBe(8);
    });

    it('includes all expected template IDs', () => {
      const ids = controller.listTemplates().map(t => t.id);
      expect(ids).toContain('union-domain-base');
      expect(ids).toContain('member-services');
      expect(ids).toContain('dues-inquiry');
      expect(ids).toContain('case-management');
      expect(ids).toContain('grievance-handler');
      expect(ids).toContain('arbitration-prep');
      expect(ids).toContain('communications');
      expect(ids).toContain('governance');
    });

    it('retrieves template by ID', () => {
      const template = controller.getTemplate('grievance-handler');
      expect(template).toBeDefined();
      expect(template!.name).toBe('Grievance Handler');
    });

    it('returns undefined for unknown template ID', () => {
      expect(controller.getTemplate('nonexistent')).toBeUndefined();
    });

    it('every template has attention weights summing to 1.0', () => {
      for (const template of controller.listTemplates()) {
        const sum = Object.values(template.attentionWeights).reduce(
          (a, b) => a + b,
          0,
        );
        expect(sum).toBeCloseTo(1.0, 1);
      }
    });

    it('every template has a version string', () => {
      for (const template of controller.listTemplates()) {
        expect(template.version).toMatch(/^\d+\.\d+\.\d+$/);
      }
    });

    it('every template has compliance tags', () => {
      for (const template of controller.listTemplates()) {
        expect(template.complianceTags.length).toBeGreaterThan(0);
      }
    });

    it('every template has metadata with author and dates', () => {
      for (const template of controller.listTemplates()) {
        expect(template.metadata.author).toBeTruthy();
        expect(template.metadata.createdAt).toBeInstanceOf(Date);
        expect(template.metadata.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('grievance-handler has high CBA weight (0.25)', () => {
      const template = controller.getTemplate('grievance-handler');
      expect(template!.attentionWeights.cbaClauses).toBe(0.25);
    });

    it('communications template prioritises timeline context', () => {
      const template = controller.getTemplate('communications');
      expect(template!.attentionWeights.timelineContext).toBe(0.25);
    });

    it('base template supports all 11 jurisdictions', () => {
      const template = controller.getTemplate('union-domain-base');
      expect(template!.jurisdictions.length).toBe(11);
    });
  });

  // ── Content Safety Filter (via processMessage) ────────────────────────

  describe('Content Safety Filter', () => {
    it('blocks content with PII patterns', async () => {
      await expect(
        controller.processMessage({
          templateId: 'union-domain-base',
          userMessage: 'My social security number is 123-456-789',
          context: {
            sessionId: 's1',
            organizationId: 'org1',
            userRole: 'member',
            jurisdiction: 'ontario' as Jurisdiction,
          },
        }),
      ).rejects.toThrow('Content blocked');
    });

    it('blocks content with legal advice patterns', async () => {
      await expect(
        controller.processMessage({
          templateId: 'union-domain-base',
          userMessage: 'I am a lawyer and can give legal advice',
          context: {
            sessionId: 's1',
            organizationId: 'org1',
            userRole: 'member',
            jurisdiction: 'ontario' as Jurisdiction,
          },
        }),
      ).rejects.toThrow('Content blocked');
    });

    it('blocks discriminatory content', async () => {
      await expect(
        controller.processMessage({
          templateId: 'union-domain-base',
          userMessage: 'terminate based on race',
          context: {
            sessionId: 's1',
            organizationId: 'org1',
            userRole: 'admin',
            jurisdiction: 'federal' as Jurisdiction,
          },
        }),
      ).rejects.toThrow('Content blocked');
    });

    it('allows safe content through', async () => {
      // processMessage should NOT throw for safe content
      // (it will continue to template resolution, which succeeds since template exists)
      const result = await controller.processMessage({
        templateId: 'union-domain-base',
        userMessage: 'What are my union membership benefits?',
        context: {
          sessionId: 's1',
          organizationId: 'org1',
          userRole: 'member',
          jurisdiction: 'ontario' as Jurisdiction,
        },
      });

      expect(result).toBeDefined();
      expect(result.templateUsed).toBe('union-domain-base');
      expect(result.complianceVerified).toBe(true);
    });

    it('rejects unknown template IDs', async () => {
      await expect(
        controller.processMessage({
          templateId: 'does-not-exist',
          userMessage: 'Hello',
          context: {
            sessionId: 's1',
            organizationId: 'org1',
            userRole: 'member',
            jurisdiction: 'ontario' as Jurisdiction,
          },
        }),
      ).rejects.toThrow('Template not found');
    });
  });

  // ── processMessage integration ─────────────────────────────────────────

  describe('processMessage', () => {
    it('returns a well-formed LLMResponse', async () => {
      const res = await controller.processMessage({
        templateId: 'member-services',
        userMessage: 'How can I pay my dues?',
        context: {
          sessionId: 's2',
          organizationId: 'org1',
          userRole: 'member',
          jurisdiction: 'ontario' as Jurisdiction,
        },
      });

      expect(res).toHaveProperty('content');
      expect(res).toHaveProperty('tokensUsed');
      expect(res).toHaveProperty('model');
      expect(res).toHaveProperty('templateUsed', 'member-services');
      expect(res).toHaveProperty('attentionBreakdown');
      expect(res).toHaveProperty('requestId');
      expect(res.requestId).toMatch(/^req_/);
    });

    it('includes attention breakdown keys matching AttentionWeights', async () => {
      const res = await controller.processMessage({
        templateId: 'dues-inquiry',
        userMessage: 'Why was my dues amount changed?',
        context: {
          sessionId: 's3',
          organizationId: 'org1',
          userRole: 'member',
          jurisdiction: 'ontario' as Jurisdiction,
        },
      });

      const keys = Object.keys(res.attentionBreakdown);
      expect(keys).toContain('userQuery');
      expect(keys).toContain('contextDocs');
      expect(keys).toContain('sessionHistory');
      expect(keys).toContain('jurisdictionRules');
      expect(keys).toContain('cbaClauses');
      expect(keys).toContain('timelineContext');
    });

    it('works with all registered template IDs', async () => {
      const ids = controller.listTemplates().map(t => t.id);
      for (const id of ids) {
        const res = await controller.processMessage({
          templateId: id,
          userMessage: 'test query',
          context: {
            sessionId: 'st',
            organizationId: 'org1',
            userRole: 'admin',
            jurisdiction: 'federal' as Jurisdiction,
          },
        });
        expect(res.templateUsed).toBe(id);
      }
    });
  });

  // ── Attention Weights invariants ───────────────────────────────────────

  describe('Attention Weight Invariants', () => {
    it('all weights are between 0 and 1', () => {
      for (const template of controller.listTemplates()) {
        for (const [_key, value] of Object.entries(template.attentionWeights)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });

    it('userQuery weight is always >= 0.15', () => {
      for (const template of controller.listTemplates()) {
        expect(template.attentionWeights.userQuery).toBeGreaterThanOrEqual(0.15);
      }
    });

    it('case-management has higher contextDocs weight than base', () => {
      const base = controller.getTemplate('union-domain-base')!;
      const caseMgmt = controller.getTemplate('case-management')!;
      expect(caseMgmt.attentionWeights.contextDocs).toBeGreaterThan(
        base.attentionWeights.contextDocs,
      );
    });
  });

  // ── Compliance tags ────────────────────────────────────────────────────

  describe('Compliance Tags', () => {
    it('base template has privacy and security tags', () => {
      const base = controller.getTemplate('union-domain-base')!;
      const categories = base.complianceTags.map(t => t.category);
      expect(categories).toContain('privacy');
      expect(categories).toContain('security');
    });

    it('governance template has critical-severity governance tag', () => {
      const gov = controller.getTemplate('governance')!;
      const critical = gov.complianceTags.filter(
        t => t.category === 'governance' && t.severity === 'critical',
      );
      expect(critical.length).toBeGreaterThan(0);
    });

    it('financial templates have financial compliance tags', () => {
      const dues = controller.getTemplate('dues-inquiry')!;
      const financialTags = dues.complianceTags.filter(t => t.category === 'financial');
      expect(financialTags.length).toBeGreaterThan(0);
    });

    it('every compliance tag has a requirement string', () => {
      for (const template of controller.listTemplates()) {
        for (const tag of template.complianceTags) {
          expect(tag.requirement).toBeTruthy();
        }
      }
    });
  });

  // ── Jurisdiction support ───────────────────────────────────────────────

  describe('Jurisdiction Support', () => {
    const allJurisdictions: Jurisdiction[] = [
      'federal', 'ontario', 'quebec', 'british-columbia', 'alberta',
      'manitoba', 'saskatchewan', 'nova-scotia', 'new-brunswick',
      'pei', 'newfoundland',
    ];

    it('base template covers every jurisdiction', () => {
      const base = controller.getTemplate('union-domain-base')!;
      for (const j of allJurisdictions) {
        expect(base.jurisdictions).toContain(j);
      }
    });

    it('arbitration-prep limits jurisdictions to 4', () => {
      const arb = controller.getTemplate('arbitration-prep')!;
      expect(arb.jurisdictions.length).toBe(4);
      expect(arb.jurisdictions).toContain('federal');
      expect(arb.jurisdictions).toContain('ontario');
    });

    it('every template includes at least one jurisdiction', () => {
      for (const t of controller.listTemplates()) {
        expect(t.jurisdictions.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Required variables ─────────────────────────────────────────────────

  describe('Required Variables', () => {
    it('base template requires organizationId and userRole', () => {
      const base = controller.getTemplate('union-domain-base')!;
      expect(base.requiredVariables).toContain('organizationId');
      expect(base.requiredVariables).toContain('userRole');
    });

    it('grievance-handler requires cbaId', () => {
      const gh = controller.getTemplate('grievance-handler')!;
      expect(gh.requiredVariables).toContain('cbaId');
    });

    it('arbitration-prep requires hearingDate', () => {
      const arb = controller.getTemplate('arbitration-prep')!;
      expect(arb.requiredVariables).toContain('hearingDate');
    });

    it('every template has at least one required variable', () => {
      for (const t of controller.listTemplates()) {
        expect(t.requiredVariables.length).toBeGreaterThan(0);
      }
    });
  });
});
