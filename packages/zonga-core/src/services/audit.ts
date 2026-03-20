/**
 * @nzila/zonga-core — Audit Event Builders
 *
 * Pure functions for building Zonga-specific audit events.
 * No I/O — caller persists.
 *
 * @module @nzila/zonga-core/services
 */

export interface ZongaAuditEvent {
  readonly orgId: string
  readonly actorId: string
  readonly action: ZongaAuditAction
  readonly entityType: ZongaEntityType
  readonly targetId: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly timestamp: string
}

export const ZongaAuditAction = {
  // Content lifecycle
  CONTENT_PUBLISH: 'content.publish',
  CONTENT_TAKE_DOWN: 'content.take_down',
  CONTENT_UPLOAD: 'content.upload',
  CONTENT_TRANSCODE: 'content.transcode',
  CONTENT_ARCHIVE: 'content.archive',

  // Revenue
  REVENUE_IMPORT: 'revenue.import',
  REVENUE_RECORD: 'revenue.record',

  // Payouts
  PAYOUT_PREVIEW: 'payout.preview',
  PAYOUT_EXECUTE: 'payout.execute',
  PAYOUT_CANCEL: 'payout.cancel',
  PAYOUT_ACCOUNT_ADD: 'payout.account_add',
  PAYOUT_ACCOUNT_REMOVE: 'payout.account_remove',

  // Creator management
  CREATOR_ACTIVATE: 'creator.activate',
  CREATOR_SUSPEND: 'creator.suspend',
  CREATOR_UPDATE_PAYOUT: 'creator.update_payout',
  CREATOR_VERIFY: 'creator.verify',
  CREATOR_TEAM_ADD: 'creator.team_add',
  CREATOR_TEAM_REMOVE: 'creator.team_remove',

  // Releases
  RELEASE_PUBLISH: 'release.publish',
  RELEASE_WITHDRAW: 'release.withdraw',
  RELEASE_SPLIT_UPDATE: 'release.split_update',
  RELEASE_DISTRIBUTE: 'release.distribute',

  // Rights & disputes
  RIGHTS_SHARE_CREATE: 'rights.share_create',
  RIGHTS_SHARE_UPDATE: 'rights.share_update',
  RIGHTS_DISPUTE_OPEN: 'rights.dispute_open',
  RIGHTS_DISPUTE_RESOLVE: 'rights.dispute_resolve',
  RIGHTS_TAKEDOWN_REQUEST: 'rights.takedown_request',
  RIGHTS_TAKEDOWN_EXECUTE: 'rights.takedown_execute',
  RIGHTS_TAKEDOWN_REINSTATE: 'rights.takedown_reinstate',

  // Events & ticketing
  EVENT_CREATE: 'event.create',
  EVENT_PUBLISH: 'event.publish',
  EVENT_CANCEL: 'event.cancel',
  EVENT_SETTLE: 'event.settle',
  TICKET_PURCHASE: 'ticket.purchase',
  TICKET_REFUND: 'ticket.refund',
  TICKET_TRANSFER: 'ticket.transfer',
  TICKET_SCAN: 'ticket.scan',

  // Moderation
  MODERATION_CASE_CREATE: 'moderation.case_create',
  MODERATION_CASE_RESOLVE: 'moderation.case_resolve',
  MODERATION_CASE_ESCALATE: 'moderation.case_escalate',

  // Fraud
  FRAUD_FLAG_CREATE: 'fraud.flag_create',
  FRAUD_AUTO_BLOCK: 'fraud.auto_block',
  FRAUD_REVIEW_COMPLETE: 'fraud.review_complete',

  // Data governance
  CONSENT_GRANT: 'consent.grant',
  CONSENT_REVOKE: 'consent.revoke',
  EXPORT_REQUEST: 'export.request',
  EXPORT_COMPLETE: 'export.complete',
} as const
export type ZongaAuditAction = (typeof ZongaAuditAction)[keyof typeof ZongaAuditAction]

export const ZongaEntityType = {
  CREATOR: 'creator',
  CONTENT_ASSET: 'content_asset',
  RELEASE: 'release',
  REVENUE_EVENT: 'revenue_event',
  PAYOUT: 'payout',
  EVENT: 'event',
  TICKET: 'ticket',
  TICKET_ORDER: 'ticket_order',
  RIGHTS_SHARE: 'rights_share',
  SPLIT_AGREEMENT: 'split_agreement',
  DISPUTE: 'dispute',
  TAKEDOWN: 'takedown',
  MODERATION_CASE: 'moderation_case',
  FRAUD_FLAG: 'fraud_flag',
  LISTENER: 'listener',
  PLAYLIST: 'playlist',
  LABEL: 'label',
  VENUE: 'venue',
  EXPORT_JOB: 'export_job',
} as const
export type ZongaEntityType = (typeof ZongaEntityType)[keyof typeof ZongaEntityType]

/**
 * Build a Zonga audit event. Pure — caller persists.
 */
export function buildZongaAuditEvent(params: {
  orgId: string
  actorId: string
  action: ZongaAuditAction
  entityType: ZongaEntityType
  targetId: string
  metadata?: Record<string, unknown>
}): ZongaAuditEvent {
  return {
    orgId: params.orgId,
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    targetId: params.targetId,
    metadata: params.metadata ?? {},
    timestamp: new Date().toISOString(),
  }
}
