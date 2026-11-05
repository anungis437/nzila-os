/**
 * Distinct identifier types. A single generic `caseId` must never stand in for
 * a legal or operational identifier (mission §5), so each concept gets its own
 * nominal type. Brands are erased at runtime; they exist to make accidental
 * substitution a compile-time error.
 */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type OrganizationId = Brand<string, 'OrganizationId'>;
export type UserId = Brand<string, 'UserId'>;
export type MemberId = Brand<string, 'MemberId'>;
export type ReferralId = Brand<string, 'ReferralId'>;
export type MatterId = Brand<string, 'MatterId'>;
/** Internal immutable claim key. Never the WSIB claim number. */
export type ClaimId = Brand<string, 'ClaimId'>;
/** External WSIB-issued claim number. Opaque string, never an authorization key. */
export type WsibClaimNumber = Brand<string, 'WsibClaimNumber'>;
export type DecisionId = Brand<string, 'DecisionId'>;
export type IssueId = Brand<string, 'IssueId'>;
export type ObjectionId = Brand<string, 'ObjectionId'>;
export type AppealId = Brand<string, 'AppealId'>;
export type RepresentationAuthorizationId = Brand<string, 'RepresentationAuthorizationId'>;
export type DocumentId = Brand<string, 'DocumentId'>;
export type DisclosureGrantId = Brand<string, 'DisclosureGrantId'>;
export type MatterGrantId = Brand<string, 'MatterGrantId'>;
export type SubmissionId = Brand<string, 'SubmissionId'>;
export type TaskId = Brand<string, 'TaskId'>;
export type ReminderId = Brand<string, 'ReminderId'>;
export type DependencyId = Brand<string, 'DependencyId'>;
export type AuditEventId = Brand<string, 'AuditEventId'>;

export const asOrganizationId = (v: string) => v as OrganizationId;
export const asUserId = (v: string) => v as UserId;
export const asMemberId = (v: string) => v as MemberId;
export const asReferralId = (v: string) => v as ReferralId;
export const asMatterId = (v: string) => v as MatterId;
export const asClaimId = (v: string) => v as ClaimId;
export const asWsibClaimNumber = (v: string) => v as WsibClaimNumber;
export const asDecisionId = (v: string) => v as DecisionId;
export const asIssueId = (v: string) => v as IssueId;
export const asObjectionId = (v: string) => v as ObjectionId;
export const asAppealId = (v: string) => v as AppealId;
export const asAuthorizationId = (v: string) => v as RepresentationAuthorizationId;
export const asDocumentId = (v: string) => v as DocumentId;
export const asDisclosureGrantId = (v: string) => v as DisclosureGrantId;
export const asMatterGrantId = (v: string) => v as MatterGrantId;
export const asSubmissionId = (v: string) => v as SubmissionId;
export const asTaskId = (v: string) => v as TaskId;
export const asReminderId = (v: string) => v as ReminderId;
export const asDependencyId = (v: string) => v as DependencyId;
export const asAuditEventId = (v: string) => v as AuditEventId;
