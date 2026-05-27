/**
 * v2 Foundation — Modernization Fragility Coverage
 *
 * Validates that the v1.2.0-foundation has at least one direct
 * modernization-fragility signal (the confidence-marker) and that the
 * routing path is declared. Remaining themes (per
 * MODERNIZATION_INSTABILITY_SIGNAL_MODEL.md) are scheduled for v1.3.0
 * and recorded as `.todo` placeholders.
 */
import { describe, it, expect } from 'vitest';
import { V2_QUESTIONS } from '../../../modalities-v2/registry';
import { ROUTING_PATHS } from '../../../routing-v2/pathTypes';

describe('v2 Foundation — modernization fragility coverage', () => {
  it('foundation ships at least one modernization-continuity confidence marker', () => {
    const modernizationMarker = V2_QUESTIONS.find(
      (q) => q.id === 'v2_cm_modernization_uncertainty',
    );
    expect(modernizationMarker).toBeDefined();
    expect(modernizationMarker!.modality).toBe('confidence_marker');
  });

  it('routing-v2 declares a modernization_fragility_path activated by uncertainty', () => {
    const path = ROUTING_PATHS.find((p) => p.id === 'modernization_fragility_path');
    expect(path).toBeDefined();
    expect(path!.deepensWith).toContain('modernization_fragility');
  });

  it('modernization-fragility question contributes to institutional_continuity', () => {
    const q = V2_QUESTIONS.find((q) => q.id === 'v2_cm_modernization_uncertainty');
    expect(q?.weights.institutional_continuity).toBeDefined();
  });

  it('ownership ambiguity has dedicated evidence_strength probe (v1.3.0)', () => {
    const q = V2_QUESTIONS.find((q) => q.id === 'v2_es_ownership_ambiguity');
    expect(q).toBeDefined();
    expect(q?.modality).toBe('evidence_strength');
  });

  it('platform migration dependency has dedicated dependency_mapping probe (v1.3.0)', () => {
    const q = V2_QUESTIONS.find((q) => q.id === 'v2_dm_platform_migration_dependency');
    expect(q).toBeDefined();
    expect(q?.modality).toBe('dependency_mapping');
  });

  it('undocumented workflow replacement has dedicated contradiction_pair (v1.3.0)', () => {
    const q = V2_QUESTIONS.find((q) => q.id === 'v2_cp_undocumented_workflow_replacement');
    expect(q).toBeDefined();
    expect(q?.modality).toBe('contradiction_pair');
  });

  it('shadow operational systems have dedicated confidence_marker (v1.3.0)', () => {
    const q = V2_QUESTIONS.find((q) => q.id === 'v2_cm_shadow_operational_systems');
    expect(q).toBeDefined();
    expect(q?.modality).toBe('confidence_marker');
  });

  it('digital continuity fragmentation has dedicated topology_mapping (v1.3.0)', () => {
    const q = V2_QUESTIONS.find((q) => q.id === 'v2_tm_digital_continuity_fragmentation');
    expect(q).toBeDefined();
    expect(q?.modality).toBe('topology_mapping');
  });

  it('modernization onboarding burden has dedicated contradiction_pair (v1.3.0)', () => {
    const q = V2_QUESTIONS.find((q) => q.id === 'v2_cp_modernization_onboarding_burden');
    expect(q).toBeDefined();
    expect(q?.modality).toBe('contradiction_pair');
  });

  it('continuity debt accumulation has dedicated stability_marker (v1.3.0)', () => {
    const q = V2_QUESTIONS.find((q) => q.id === 'v2_sm_continuity_debt_accumulation');
    expect(q).toBeDefined();
    expect(q?.modality).toBe('stability_marker');
  });
});
