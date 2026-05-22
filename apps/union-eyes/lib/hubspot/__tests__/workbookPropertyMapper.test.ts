import { describe, expect, it } from 'vitest';
import {
  WORKBOOK_DEAL_STAGES,
  WORKBOOK_TIER_LABELS,
  buildWorkbookCompanyProperties,
  buildWorkbookContactProperties,
  workbookTierToStage,
} from '@/lib/hubspot/workbookPropertyMapper';
import { runStewardshipCartography } from '@/lib/workbook/engines/stewardshipCartography';

describe('workbookPropertyMapper', () => {
  it('maps each tier to its deal stage', () => {
    expect(workbookTierToStage('workbook_self_guided')).toBe('workbook_self_guided_purchased');
    expect(workbookTierToStage('workbook_facilitated')).toBe('workbook_facilitated_interest');
    expect(workbookTierToStage('workbook_enterprise')).toBe('workbook_enterprise_inquiry');
  });

  it('exposes deal-stage identifiers for every tier label', () => {
    for (const key of Object.keys(WORKBOOK_TIER_LABELS) as Array<keyof typeof WORKBOOK_TIER_LABELS>) {
      const stage = workbookTierToStage(key);
      expect(WORKBOOK_DEAL_STAGES[stage]).toBeDefined();
    }
  });

  it('contact properties include tier label + UTM attribution when provided', () => {
    const props = buildWorkbookContactProperties({
      tier: 'workbook_self_guided',
      attribution: { source: 'newsletter', medium: 'email', campaign: 'q1' },
    });
    expect(props.oci_workbook_tier).toBe(WORKBOOK_TIER_LABELS.workbook_self_guided);
    expect(props.oci_utm_source).toBe('newsletter');
    expect(props.oci_utm_medium).toBe('email');
    expect(props.oci_utm_campaign).toBe('q1');
  });

  it('company properties never leak holder names or notes', () => {
    const cartography = runStewardshipCartography([
      {
        id: 'h1',
        role: 'Director of Records',
        criticality: 'institution_critical',
        tenureBand: '15y_plus',
        successorIdentified: false,
      },
    ]);
    const props = buildWorkbookCompanyProperties({
      cartography,
      modulesComplete: 1,
      totalModules: 6,
    });
    const serialized = JSON.stringify(props).toLowerCase();
    expect(serialized).not.toContain('director of records');
    // Only counts + bands + indexes are present:
    expect(props.oci_continuity_carrier_count).toBe('1');
    expect(props.oci_institution_critical_carriers).toBe('1');
    expect(props.oci_institution_critical_without_successor).toBe('1');
  });
});
