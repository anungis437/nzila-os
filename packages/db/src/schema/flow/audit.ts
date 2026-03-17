/**
 * Flow — Audit (Spec §5B)
 *
 * Flow leverages the shared commerce audit infrastructure:
 * - commerce_evidence_artifacts: sealed evidence packs
 * - commerce_timeline_events: lifecycle event log
 * - @nzila/commerce-audit package: buildTransitionAuditEntry, buildCommerceEvidencePack
 *
 * The flow_domain_events table (events.ts) provides the canonical
 * persisted domain event shape per Spec §5A.
 */
import type { InferSelectModel } from 'drizzle-orm'
import { commerceEvidenceArtifacts, commerceTimelineEvents } from '../commerce'

export type FlowEvidenceArtifact = InferSelectModel<typeof commerceEvidenceArtifacts>
export type FlowTimelineEvent = InferSelectModel<typeof commerceTimelineEvents>
