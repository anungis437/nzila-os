import { describe, expect, it } from 'vitest';

import {
  ALERT_TEMPLATE_COUNT,
  ALERT_TEMPLATES,
  createRuleFromTemplate,
  getAlertTemplate,
  getAlertTemplatesByCategory,
  getAlertTemplatesBySeverity,
  getTemplateOverview,
  validateAlertRule,
} from '../alert-rules';
import { AlertCategory, AlertSeverity, NotificationChannel } from '@/types/alerts';

describe('lib/alerts/alert-rules', () => {
  describe('getAlertTemplate', () => {
    it('finds a template by name or returns undefined', () => {
      expect(getAlertTemplate('RLS Bypass Attempt')).toBeDefined();
      expect(getAlertTemplate('no-such-template')).toBeUndefined();
    });
  });

  describe('getAlertTemplatesByCategory / BySeverity', () => {
    it('filters by category and severity', () => {
      expect(getAlertTemplatesByCategory(AlertCategory.SECURITY).length).toBeGreaterThan(0);
      expect(getAlertTemplatesBySeverity(AlertSeverity.CRITICAL).length).toBeGreaterThan(0);
    });
  });

  describe('createRuleFromTemplate', () => {
    it('builds a rule with overrides applied', () => {
      const template = getAlertTemplate('RLS Bypass Attempt')!;
      const rule = createRuleFromTemplate(template, { name: 'Custom Name' });
      expect(rule.name).toBe('Custom Name');
      expect(rule.enabled).toBe(true);
      expect(rule.recipients?.length).toBeGreaterThan(0);
      expect(rule.runbook_url).toContain('/docs/runbooks/');
    });
  });

  describe('getTemplateOverview', () => {
    it('groups every template name under a category', () => {
      const overview = getTemplateOverview();
      const total = Object.values(overview).reduce((a, names) => a + names.length, 0);
      expect(total).toBe(ALERT_TEMPLATES.length);
      expect(ALERT_TEMPLATE_COUNT).toBe(ALERT_TEMPLATES.length);
    });
  });

  describe('validateAlertRule', () => {
    it('reports schema errors as invalid', () => {
      const result = validateAlertRule({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('warns on critical alert without urgent channel and short cooldown', () => {
      const template = getAlertTemplate('RLS Bypass Attempt')!;
      const rule = createRuleFromTemplate(template, {
        recipients: [{ channel: NotificationChannel.EMAIL, target: 'x@example.org' }],
        auto_resolve_minutes: 30,
      });
      const result = validateAlertRule(rule);
      expect(result.warnings.some((w) => w.includes('SMS or PagerDuty'))).toBe(true);
    });
  });
});
