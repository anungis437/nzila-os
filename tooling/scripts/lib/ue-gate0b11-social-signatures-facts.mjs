/**
 * Gate 0B.11 facts: the e-signature request routes (signatures/documents, documents/[id], sign, audit/[documentId]) and
 * the social media routes (accounts, accounts/callback, posts, campaigns, analytics, feed). Ten route files, 24
 * operations. The signature routes are hand-written over lib/signature/signature-service.ts and the provider
 * factory; the social routes are hand-written over lib/social-media/social-media-service.ts and three platform API
 * clients; the feed route is the generic CRUD factory over the communications campaigns table. Every evidence item is
 * produced by `opAuthoring` from the exact handler, the helper or service it reaches, or the resolved schema, and is
 * proved again by the validator. This tranche records the source; it repairs nothing and approves no route.
 */
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'
import { APP, API, LOW_ROLE, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { mk } from './ue-gate0b4-record.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const ESIG_CAP = 'UE-OMIT-ESIGNATURE-DOCUMENT-REQUESTS'
const SOCIAL_CAP = 'UE-OMIT-SOCIAL-MEDIA-PUBLISHING'
const COMMS_CAP = 'UE-OMIT-COMMUNICATIONS-CAMPAIGN-AUTHORING'
const GATE = 14
const COMMS_GATE = 11

const D_ESIG = 'UE-INST-ESIGNATURE-REQUEST-AUTHORITY-SIGNER-IDENTITY-AND-LEGAL-VALIDITY'
const D_SOCIAL = 'UE-INST-SOCIAL-MEDIA-PUBLISHING-AUTHORITY-AND-CREDENTIAL-CUSTODY'
const D_COMMS_OWNER = 'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'
const D_AUDIT_READERS = 'UE-INST-AUDIT-HISTORY-READERS'

const SIG_SERVICE = `${APP}lib/signature/signature-service.ts`
const SIG_PROVIDERS = `${APP}lib/signature/providers.ts`
const SIG_PROJECTION = `${APP}lib/documents/signature-projection.ts`
const SIG_SCHEMA = `${APP}db/schema/domains/documents/signatures.ts`
const SOCIAL_SERVICE = `${APP}lib/social-media/social-media-service.ts`
const SOCIAL_SCHEMA = `${APP}db/schema/social-media-schema.ts`
const API_SECURITY = `${APP}lib/middleware/api-security.ts`
const OPERATION_AUDIT = `${APP}lib/audit/operation-audit.ts`
const CAMPAIGNS_SCHEMA = `${APP}db/schema/domains/communications/campaigns.ts`
const FEED_WIDGET = `${APP}components/social-media/social-feed-widget.tsx`

const SIG_ROUTES = [
  'signatures/audit/[documentId]/route.ts',
  'signatures/documents/[id]/route.ts',
  'signatures/documents/route.ts',
  'signatures/sign/route.ts',
]
const ACCOUNT_ROUTES = ['social-media/accounts/route.ts', 'social-media/accounts/callback/route.ts']
const POST_ROUTES = ['social-media/posts/route.ts']
const CAMPAIGN_ROUTES = ['social-media/campaigns/route.ts']
const ANALYTICS_ROUTES = ['social-media/analytics/route.ts']
const FEED_ROUTES = ['social-media/feed/route.ts']

export const ROUTES = new Set([...SIG_ROUTES, ...ACCOUNT_ROUTES, ...POST_ROUTES, ...CAMPAIGN_ROUTES, ...ANALYTICS_ROUTES, ...FEED_ROUTES])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  SOC_ESIGNATURE_REQUESTS: {
    capabilityId: ESIG_CAP,
    domain: 'ESIGNATURE_REQUESTS_SIGNING_AND_AUDIT_TRAIL',
    actor: 'Member or steward sending a document for signature to named signers (platform users or external e-mail addresses), a signer recording a signature, the sender voiding a request, and the sender or a signer reading the status and audit trail of a signature document',
    routes: SIG_ROUTES,
    evidence: [
      ev(SIG_SCHEMA, 'fileHash: text("file_hash").notNull(), // SHA-256 for integrity'),
      ev(SIG_SCHEMA, 'hashChain: text("hash_chain"), // Link to previous event'),
      ev(SIG_SERVICE, '* Generate audit report for legal compliance'),
      ev(SIG_PROVIDERS, ' * Simple signature system without external provider'),
    ],
  },
  SOC_SOCIAL_ACCOUNT_CONNECTIONS: {
    capabilityId: SOCIAL_CAP,
    domain: 'SOCIAL_MEDIA_ACCOUNT_CONNECTIONS_AND_OAUTH_CREDENTIALS',
    actor: 'Steward connecting, refreshing and disconnecting the organization Facebook, Instagram, X and LinkedIn pages through an OAuth flow, and any member listing the connected accounts',
    routes: ACCOUNT_ROUTES,
    evidence: [
      ev(SOCIAL_SCHEMA, "accessToken: text('access_token').notNull(),"),
      ev(SOCIAL_SCHEMA, "refreshToken: text('refresh_token'),"),
      ev(`${API}social-media/accounts/route.ts`, " * Endpoints for managing social media account connections."),
    ],
  },
  SOC_SOCIAL_POSTS_AND_CAMPAIGNS: {
    capabilityId: SOCIAL_CAP,
    domain: 'SOCIAL_MEDIA_POSTS_AND_CAMPAIGNS',
    actor: 'Steward publishing a post to the connected platform accounts of the organization, removing a published post, and keeping social media campaigns; any member listing the posts and campaigns',
    routes: [...POST_ROUTES, ...CAMPAIGN_ROUTES],
    evidence: [
      ev(SOCIAL_SCHEMA, "platformPostId: text('platform_post_id'),"),
      ev(SOCIAL_SCHEMA, "goalImpressions: integer('goal_impressions'),"),
      ev(`${API}social-media/posts/route.ts`, " * Supports create, read, update, delete, and publish operations."),
    ],
  },
  SOC_SOCIAL_ANALYTICS: {
    capabilityId: SOCIAL_CAP,
    domain: 'SOCIAL_MEDIA_ANALYTICS_AND_EXPORT',
    actor: 'Member or steward reading account analytics, post performance and campaign metrics, and exporting them as CSV or JSON',
    routes: ANALYTICS_ROUTES,
    evidence: [
      ev(SOCIAL_SCHEMA, "totalImpressions: integer('total_impressions').default(0),"),
      ev(`${API}social-media/analytics/route.ts`, " * Supports account analytics, post performance, campaign metrics, and exports."),
    ],
  },
  SOC_SOCIAL_FEED_CAMPAIGN_FACADE: {
    capabilityId: COMMS_CAP,
    domain: 'COMMUNICATIONS_CAMPAIGN_RECORDS_SERVED_AS_SOCIAL_FEED',
    actor: 'Member reading, and steward creating, mass communication campaign rows through a route and a widget that are named for a social media feed',
    routes: FEED_ROUTES,
    evidence: [
      ev(`${API}social-media/feed/route.ts`, ' * CRUD collection route for campaigns'),
      ev(CAMPAIGNS_SCHEMA, ' * Mass communication campaigns across channels'),
      ev(FEED_WIDGET, "const res = await fetch('/api/v2/social-media/feed');"),
    ],
  },
}

/* ------------------------------------------------------------------------------------------------------------ */
/* defects                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

const D = (id, ownerCapabilityId, severity, title, extra = {}, gate = GATE) => ({ id, ownerCapabilityId, gate, severity, title, ...extra })
const route = (name) => `${API}${name}`
const act = (name, quote) => ({ ref: route(name), quote })

const DEF_SIGNER_IDENTITY = 'DEF-0B11-SOC-SIGNER-IDENTITY-IS-SENDER-TYPED-TEXT-AND-A-SENDER-CAN-SIGN-AS-A-NAMED-PERSON-AND-COMPLETE-THE-DOCUMENT'
const DEF_AUDIT_TRAIL = 'DEF-0B11-SOC-SIGNATURE-AUDIT-TRAIL-HAS-NO-HASH-CHAIN-OR-VERIFICATION-AND-IS-SERVED-AS-A-LEGAL-COMPLIANCE-REPORT-OF-SELF-ASSERTED-EVIDENCE'
const DEF_VOID = 'DEF-0B11-SOC-VOID-SWALLOWS-THE-PROVIDER-FAILURE-AND-RECORDS-VOIDED-WHILE-THE-ENVELOPE-CAN-STILL-BE-SIGNED'
const DEF_SEND = 'DEF-0B11-SOC-ANY-AUTHENTICATED-USER-SENDS-AN-UPLOADED-FILE-TO-TYPED-ADDRESSES-THROUGH-THE-ORGANIZATION-SIGNATURE-PROVIDER-ACCOUNT'
const DEF_INTERNAL = 'DEF-0B11-SOC-INTERNAL-SIGNATURE-PROVIDER-IS-A-STUB-THAT-SENDS-NOTHING-AND-THE-REQUEST-IS-RECORDED-AS-SENT'
const DEF_UNENFORCED = 'DEF-0B11-SOC-SIGNING-IGNORES-THE-STORED-EXPIRY-SIGNING-ORDER-AND-AUTHENTICATION-REQUIREMENT'
const DEF_GET_SYNC = 'DEF-0B11-SOC-SIGNATURE-DOCUMENT-GET-CALLS-THE-PROVIDER-AND-WRITES-STATUS-SIGNER-AND-AUDIT-ROWS'
const DEF_SIG_READS = 'DEF-0B11-SOC-SIGNATURE-READS-AND-ACCESS-CHECK-USE-THE-BARE-DB-HANDLE-WITH-NO-ORGANIZATION-PREDICATE-AND-ACCEPT-ANY-USER-ID-A-SENDER-TYPED-AS-SIGNER'
const DEF_SIG_DISCLOSURE = 'DEF-0B11-SOC-SIGNATURE-STATUS-AND-AUDIT-DISCLOSE-EVERY-SIGNER-ADDRESS-IP-USER-AGENT-AND-LOCATION-TO-EVERY-OTHER-SIGNER'
const DEF_EXTERNAL_FIRST = 'DEF-0B11-SOC-SIGNATURE-ENVELOPE-AND-STORED-FILE-ARE-CREATED-BEFORE-AND-OUTSIDE-THE-TRANSACTION-THAT-RECORDS-THEM'
const DEF_PATCH_SCHEMA = 'DEF-0B11-SOC-SIGNATURE-PATCH-DECLARES-A-SCHEMA-IT-NEVER-APPLIES-AND-STORES-UNBOUNDED-REASON-TEXT'
const DEF_SIG_LIST = 'DEF-0B11-SOC-SIGNATURE-LIST-IS-UNPAGINATED-AND-RETURNS-WHOLE-SIGNER-ROWS'

const DEF_TOKENS = 'DEF-0B11-SOC-OAUTH-ACCESS-AND-REFRESH-TOKENS-ARE-STORED-AS-PLAINTEXT-TEXT-COLUMNS-WITH-PAGE-AND-ORGANIZATION-ADMIN-SCOPES'
const DEF_PUBLISH = 'DEF-0B11-SOC-POST-PUBLISHES-AT-ONCE-TO-EVERY-ACTIVE-ACCOUNT-OF-THE-SELECTED-PLATFORMS-AT-STEWARD-FLOOR-WITH-NO-APPROVAL-OR-CLASSIFICATION-CHECK'
const DEF_SSRF = 'DEF-0B11-SOC-X-MEDIA-URL-IS-FETCHED-BY-THE-SERVER-WITH-ONLY-A-SCHEME-CHECK-AND-THE-BODY-IS-UPLOADED-TO-THE-PLATFORM'
const DEF_CALLBACK = 'DEF-0B11-SOC-OAUTH-CALLBACK-IS-A-GET-THAT-INSERTS-THE-CREDENTIAL-CLEARS-ITS-COOKIES-BEFORE-VALIDATION-AND-AUDITS-AFTER-COMMIT-TO-A-LOG-LINE'
const DEF_CONNECT_AUDIT = 'DEF-0B11-SOC-CONNECT-AUDIT-IS-A-LOG-LINE-THAT-DROPS-THE-ACTION-ORGANIZATION-AND-PLATFORM-THE-CALLER-PASSES'
const DEF_CONNECT_AUTHORITY = 'DEF-0B11-SOC-STEWARD-CONNECTS-THE-ORGANIZATION-PUBLISHING-IDENTITY-WITH-ADMIN-LEVEL-SCOPES-AND-PICKS-THE-FIRST-PAGE-AUTOMATICALLY'
const DEF_DISCONNECT = 'DEF-0B11-SOC-DISCONNECT-DELETES-THE-CREDENTIAL-EVEN-WHEN-REVOCATION-FAILS-AND-NEVER-REVOKES-META-OR-LINKEDIN-TOKENS'
const DEF_REFRESH = 'DEF-0B11-SOC-ANY-REFRESH-FAILURE-MARKS-THE-ACCOUNT-EXPIRED-AND-A-SUCCESS-FORCES-IT-ACTIVE'
const DEF_PUBLISH_STATE = 'DEF-0B11-SOC-PUBLISH-RECORDS-THE-ROW-AFTER-THE-EXTERNAL-POST-AUDITS-COMPLETED-WHEN-EVERY-PLATFORM-FAILED-AND-RETURNS-PLATFORM-ERROR-TEXT'
const DEF_SCHEDULE = 'DEF-0B11-SOC-SCHEDULED-POST-IS-PUBLISHED-AT-ONCE-ON-INSTAGRAM-X-AND-LINKEDIN-WHILE-THE-ROW-SAYS-SCHEDULED-AND-HASHTAGS-AND-MENTIONS-ARE-NOT-SENT'
const DEF_NOT_LINKED = 'DEF-0B11-SOC-POSTS-ARE-NEVER-LINKED-TO-A-CAMPAIGN-SO-CAMPAIGN-METRICS-AND-THE-DELETE-GUARD-NEVER-SEE-A-POST'
const DEF_NO_WRITER = 'DEF-0B11-SOC-ANALYTICS-AND-ENGAGEMENT-FIGURES-HAVE-NO-WRITER-SO-EVERY-METRIC-IS-ZERO-OR-EMPTY'
const DEF_PLATFORM_FIELDS = 'DEF-0B11-SOC-CAMPAIGN-ANALYTICS-PLATFORM-AND-GOAL-FIGURES-READ-FIELDS-THE-QUERY-DOES-NOT-SELECT-AND-A-HARD-CODED-UNDEFINED'
const DEF_CAMPAIGN_CREATE = 'DEF-0B11-SOC-CAMPAIGN-CREATE-VALIDATES-GOALS-AND-STATUS-THEN-DISCARDS-THEM-AND-REPORTS-SUCCESS'
const DEF_CAMPAIGN_UPDATE = 'DEF-0B11-SOC-CAMPAIGN-UPDATE-APPLIES-UNVALIDATED-BODY-FIELDS-INCLUDING-STATUS-AND-PLATFORMS'
const DEF_EXPORT = 'DEF-0B11-SOC-ANALYTICS-EXPORT-IS-A-DELETE-VERB-READ-AT-MEMBER-FLOOR-WITH-UNBOUNDED-ROWS-UNNEUTRALISED-CSV-AND-MISMATCHED-COLUMNS'
const DEF_ID_FIRST = 'DEF-0B11-SOC-RECORD-IS-LOADED-BY-ID-ALONE-ON-THE-BARE-DB-HANDLE-AND-THE-ORGANIZATION-IS-COMPARED-AFTERWARDS'
const DEF_PAGING = 'DEF-0B11-SOC-LIMIT-AND-OFFSET-ARE-PARSED-FROM-THE-QUERY-WITH-NO-NUMBER-CHECK-OR-UPPER-BOUND'
const DEF_DELETE_EXTERNAL = 'DEF-0B11-SOC-POST-DELETE-REMOVES-THE-PLATFORM-POST-BEFORE-THE-LOCAL-ROW-AND-AUDITS-INTENT-AND-OUTCOME-ONLY'
const DEF_FEED = 'DEF-0B11-SOC-FEED-ROUTE-SERVES-THE-COMMUNICATIONS-CAMPAIGNS-TABLE-TO-ANY-MEMBER-AS-A-SOCIAL-FEED'

export const DEFECTS = [
  D(DEF_SIGNER_IDENTITY, ESIG_CAP, 'HIGH',
    'The signature request route reads the signers list from a multipart field with JSON.parse and no schema, and stores each signer name, e-mail address and user id exactly as the sender typed them, with no check that the user id belongs to the organization or to a person whose name or e-mail address matches; recordSignature then binds a signature only by requiring the signer row user id to equal the authenticated caller, so a sender can list their own user id with another person name and e-mail address, record the signature as that person (the audit trail row names the stored signer name and the sender-typed e-mail address as the actor), and when every signer row is signed the document is set to completed with no provider acknowledgment; the same local signing can complete a document that was sent through DocuSign or HelloSign without that provider ever being asked, so a signed or completed record states an identity and an act that no identified counterpart gave.',
    {
      riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'],
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any authenticated user with an organization can create a signature document (withApiAuth sets no role floor) naming any signer text, list their own user id as a signer, sign it through the sign route, and the service marks the signer signed and the document completed with an audit row that attributes the signature to the typed name and e-mail address.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'UNAUTHORIZED_MUTATION'],
          description: 'A completed signature document and its audit trail record that a named person signed when the only actor was the sender, so an agreement, consent or acknowledgment can be shown as signed by someone who never saw it.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          act('signatures/documents/route.ts', 'export const POST = withApiAuth(async (request: NextRequest) => {'),
          act('signatures/documents/route.ts', 'signers = JSON.parse(signersJson);'),
          { ref: SIG_SERVICE, quote: 'if (existingSigner.userId === null || existingSigner.userId !== data.actorUserId) {' },
          { ref: SIG_SERVICE, quote: 'actorEmail: updated.email,' },
        ],
        existingContainment: 'NONE',
        justification: 'Reachability needs only an authenticated session in an organization, the signer name and e-mail address are free text the sender controls, and the only identity binding is a user id equality that a sender satisfies by naming themselves; no verification of the typed identity, no counter-signature step and no provider acknowledgment is required before the document is completed, so the false attestation is available to every signed-in user.',
      },
    }),
  D(DEF_AUDIT_TRAIL, ESIG_CAP, 'HIGH',
    'The signature audit trail rows are plain inserts into signature_audit_trail: the hash_chain column is declared as a future link and AuditTrailService.log never sets it, nothing recomputes the stored file hash after creation or compares it at signing or completion, no row is signed or sealed, and the signer IP address comes from the first value of a client-supplied x-forwarded-for header, the geolocation from the request body and the signature image from any URL the signer posts; the audit route nevertheless returns the rows and, with format=report, a report that the service documents as generated for legal compliance, so a document status, a report and an audit trail are presented as evidence of an e-signature when none of their contents is verified or tamper-evident.',
    {
      riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'The sender and every signer of a document can read the audit trail and the report; the rows are written by the application with caller-supplied IP address, user agent, geolocation and signature image URL and any database writer can alter them without a mismatch being detectable.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'DATA_QUALITY'],
          description: 'An organization that relies on the report as proof of who signed, when and from where could present self-asserted and alterable records as legal evidence, and a counterparty or tribunal that tests them would find no hash chain, no verified identity and no sealed document.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          act('signatures/audit/[documentId]/route.ts', 'const report = await AuditTrailService.generateAuditReport(documentId);'),
          { ref: SIG_SERVICE, quote: '* Generate audit report for legal compliance' },
          { ref: SIG_SCHEMA, quote: 'hashChain: text("hash_chain"), // Link to previous event' },
        ],
        existingContainment: 'NONE',
        blockingCondition: 'The audit report, a completed status or a stored signature is relied on or given to a counterparty, regulator or tribunal as evidence of an electronic signature, or the organization states that its signatures are legally valid.',
        justification: 'The harm needs reliance on the report as legal evidence, which no source in the repository decides or prevents, and the read is limited to the sender and the signers of a document; but the report and the trail are labelled for legal compliance while the chain column is unused and the evidence is self-asserted, so the route must not be used for that purpose until the institution names the validity basis and the records are sealed and verified.',
      },
    }),
  D(DEF_VOID, ESIG_CAP, 'HIGH',
    'The void path calls provider.voidEnvelope inside a try block whose catch is empty, before and outside the transaction that records the void, and then sets the document to voided and writes the document_voided audit row and the atomic audit row whether or not the provider voided the envelope; a DocuSign or HelloSign envelope that failed to void stays open and signable by its signers at the provider while the organization record, the audit trail and the PATCH response say voided, and the provider status sync then ignores the provider later reporting completed because a voided state is final.',
    {
      riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'The sender of a document that was created through DocuSign or HelloSign can void it; the provider call is made first and its failure, including an expired credential or a provider outage, is discarded, after which the local record is voided and the success message is returned.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'FINANCIAL_INTEGRITY'],
          description: 'A signer can complete an agreement at the provider that the organization has recorded and told the counterparty is voided, leaving the two records in conflict, and the organization record will not reflect the provider completion.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          act('signatures/documents/[id]/route.ts', 'await SignatureService.voidDocument(documentId, userId, reason);'),
          { ref: SIG_SERVICE, quote: 'await provider.voidEnvelope(document.providerEnvelopeId, reason);' },
          { ref: SIG_SERVICE, quote: 'throw new SignatureAuthorityError("FORBIDDEN", "Only the sender of a document can void it");' },
        ],
        existingContainment: {
          summary: 'Only the person who sent the document can void it, and a completed, voided, declined or expired document cannot be voided, so the actor set is the senders of provider-backed documents.',
          evidence: [
            { ref: SIG_SERVICE, quote: 'if (document.sentBy !== voidedBy) {' },
          ],
        },
        blockingCondition: 'An organization configures a DocuSign or HelloSign credential and a sender voids a provider-backed document that a signer can still open at the provider.',
        justification: 'Without a configured external provider the void touches only the local record, and the sender-only rule limits who can trigger it, so the harm needs a live provider envelope; once one exists the swallowed failure leaves an open envelope that the organization records as voided, which is a false outcome that the route must not produce.',
      },
    }),
  D(DEF_SEND, ESIG_CAP, 'HIGH',
    'The signature request route has no role floor, no rate limit, no file size or type bound and no approval step: any authenticated user with an organization uploads a file in a multipart form, supplies a title, a description and a list of signers by name and e-mail address, and the service sends the file bytes, the signer names and e-mail addresses, the subject and the message to DocuSign or HelloSign under the organization provider credential, which then e-mails the typed addresses from the organization account, with no consent record for the recipients and no decision naming who may send documents for signature in the union name.',
    {
      riskCategories: ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any member of any organization with an active session can call the POST; when DOCUSIGN_API_KEY or HELLOSIGN_API_KEY is set the default provider is the external one and the upload plus the typed recipients and message are transmitted to it and e-mailed to the typed addresses under the organization account.',
        potentialImpact: {
          classes: ['PRIVACY_OR_CONSENT', 'UNAUTHORIZED_MUTATION'],
          description: 'The organization signature account can be used by any member to send arbitrary documents and messages to arbitrary external addresses in the union name, disclosing the uploaded content and the recipient data to a third-party provider without any institutional approval or recipient consent, and consuming the provider quota.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          act('signatures/documents/route.ts', 'export const POST = withApiAuth(async (request: NextRequest) => {'),
          act('signatures/documents/route.ts', 'const formData = await request.formData();'),
          { ref: SIG_PROVIDERS, quote: 'process.env.DOCUSIGN_API_KEY' },
        ],
        existingContainment: 'NONE',
        blockingCondition: 'A DocuSign or HelloSign credential is configured for a deployment (the provider factory then prefers it over the internal stub) and the route is reachable by members.',
        justification: 'The external transmission exists only when a provider credential is configured, which is why the disposition is conditional, but once it is configured the route lets every authenticated user send content and messages to arbitrary recipients through the organization account, a PRIVACY_OR_CONSENT harm that the route, the service and the factory do not limit by role, approval, rate or recipient.',
      },
    }),
  D(DEF_INTERNAL, ESIG_CAP, 'MEDIUM',
    'When no DocuSign or HelloSign credential is configured, or the caller sends provider internal, the provider factory returns InternalSignatureProvider, whose createEnvelope fabricates an envelope id and signing URLs that the service never stores or sends, whose status read always answers sent with no signers, and whose void and reminder methods are empty; the service nevertheless inserts the document as sent, writes the document_sent audit row, and the route answers success true, so signers who are external (no user id) receive nothing and can never sign because recordSignature rejects a signer with no user id.',
    undefined),
  D(DEF_UNENFORCED, ESIG_CAP, 'MEDIUM',
    'The request route stores expiresAt, requireAuthentication and sequentialSigning on the document and the signing order on each signer, and recordSignature checks none of them: a signature is accepted after the expiry date, out of the signing order and without the authentication the sender required, and nothing sets the expired status for an internal document, so the options the sender chose and the audit text describe controls that do not operate.',
    undefined),
  D(DEF_GET_SYNC, ESIG_CAP, 'MEDIUM',
    'The document status GET calls getDocumentStatus, which for any document that has a provider envelope and is not completed calls the provider and then updates the document status, the signer rows and the audit trail rows (each synchronization commits its own atomic audit under the system-provider-sync actor), so a read by any signer writes rows and makes an outbound provider call on every request, while a provider outage is swallowed and the stored status is returned as current.',
    { riskCategories: ['GET_WITH_SIDE_EFFECTS'] }),
  D(DEF_SIG_READS, ESIG_CAP, 'MEDIUM',
    'The access check and the reads of signature documents, signers and audit rows run through the shared db import with no tenant context and no organization predicate (verifyDocumentAccess, getDocumentStatus, getDocumentAudit and generateAuditReport look the document up by id alone), and access rests on the sender or signer relationship, where a signer user id is whatever the sender typed with no check that it belongs to the sender organization, so a user of another organization named as a signer reads the document status, every signer row and the full audit trail of the organization, and isolation of these reads is not provable from the route or the service.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  D(DEF_SIG_DISCLOSURE, ESIG_CAP, 'MEDIUM',
    'The document status returns every signer row with e-mail address, IP address, user agent, geolocation, signature image URL and provider identifiers, and the audit route returns every audit row and the report with actor e-mail addresses and IP addresses, to the sender and to every signer, so each signer, including an external counterparty who has a platform account, sees the network address and location of every other signer; the projection removes storage locations and extracted text only.',
    undefined),
  D(DEF_EXTERNAL_FIRST, ESIG_CAP, 'MEDIUM',
    'createSignatureRequest creates the provider envelope, which e-mails the signers, and uploads the file to document storage before the transaction that inserts the document, the signer rows, the audit trail rows and the atomic audit row, with no compensation, so a failure of the insert (for example a signer user id that is not a profile) leaves a live envelope that signers can complete and a stored file with no organization record or audit row, and the atomic audit proves only the local rows.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(DEF_PATCH_SCHEMA, ESIG_CAP, 'LOW',
    'The document PATCH declares a zod schema (_signaturesDocumentsSchema) that requires a reason and is never applied; the handler reads action and reason from the raw JSON, accepts only the action void, and stores the reason text with no length bound in the document row, the audit trail row and the audit details.',
    undefined),
  D(DEF_SIG_LIST, ESIG_CAP, 'LOW',
    'The documents GET returns every document the caller sent and every document the caller must sign, with the complete signer row for the signing side, in one unpaginated response with no limit, so the response grows without bound with the number of requests.',
    undefined),

  D(DEF_TOKENS, SOCIAL_CAP, 'HIGH',
    'The OAuth callback and the token refresh store the provider access token and refresh token in the text columns access_token and refresh_token of social_accounts exactly as received, with no encryption, no vault reference and no column-level protection (the calendar connection capability has a token-crypto module; nothing in lib/social-media or the social routes uses one), and the Meta, LinkedIn and X authorization requests ask for page management and posting, business_management and rw_organization_admin scopes, so a database read, backup or log exposure yields working publishing and administration credentials for every connected organization account.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A steward who completes the OAuth flow causes the platform tokens to be written to the database in clear text; no route returns them (the accounts list selects a fixed field list), but every service that loads the row (publishing, refresh, delete) reads them and anyone with database or backup access reads them directly.',
        potentialImpact: {
          classes: ['PRIVACY_OR_CONSENT', 'UNAUTHORIZED_MUTATION'],
          description: 'A leaked token lets the holder publish, delete and administer the union public pages and read their data until each token is revoked, and the organization cannot tell from its own records that a token was used elsewhere.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          act('social-media/accounts/callback/route.ts', "export const GET = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
          act('social-media/accounts/callback/route.ts', 'accessToken,'),
          { ref: SOCIAL_SCHEMA, quote: "accessToken: text('access_token').notNull()," },
        ],
        existingContainment: 'NONE',
        blockingCondition: 'An organization connects a social media account through the OAuth flow (the first stored token is the exposure) in a deployment whose database, backups or logs are readable by anyone other than the application.',
        justification: 'The credential is not returned by any route, so exposure needs a path to the stored rows, which is a condition rather than a current caller; once an account is connected the tokens sit in clear text with publishing and administration scope and no revocation path other than the swallowed disconnect, so the route must not store them this way when it is activated.',
      },
    }),
  D(DEF_PUBLISH, SOCIAL_CAP, 'HIGH',
    'The post route at the steward floor validates only shape and length, then publishSocialPost publishes the text, media URLs and link at once to every active account of the organization on each selected platform (the caller cannot choose an account, so every connected page of a platform receives the post), through the platform APIs, with no draft, review or approval state, no check of the content against any classification, no check that a linked document, a media file or a mention names a member who consented, and no record of who in the union decided to speak; the response reports the platform post ids and permalinks as published.',
    {
      riskCategories: ['PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT', 'EXTERNAL_DISCLOSURE_WITHOUT_DECISION'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any steward of an organization with a connected active Facebook, Instagram, X or LinkedIn account can post any text, link and media URLs to every such account in one request, limited only by a 20-per-hour rate limit and the platform character limits.',
        potentialImpact: {
          classes: ['PRIVACY_OR_CONSENT', 'UNAUTHORIZED_MUTATION'],
          description: 'A single steward can make a public statement in the union name, including member names in mentions or media, bargaining or grievance content and links, on every connected public page with no approval, no consent check and no way to recall it other than a separate delete.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          act('social-media/posts/route.ts', "export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
          act('social-media/posts/route.ts', 'socialMediaService.publishPost('),
          { ref: SOCIAL_SERVICE, quote: 'inArray(socialAccounts.platform, content.platforms),' },
        ],
        existingContainment: {
          summary: 'The route requires the steward floor, a 20 per hour per-user rate limit and the per-platform character limits, and publishing needs an active connected account for the platform.',
          evidence: [
            { ref: route('social-media/posts/route.ts'), quote: 'RATE_LIMITS.SOCIAL_MEDIA_POST' },
          ],
        },
        blockingCondition: 'An organization connects a Facebook, Instagram, X or LinkedIn account, after which any steward can publish to it.',
        justification: 'The harm needs a connected account and a steward, which limit who can act, but a steward floor is a role title and the union has recorded no decision on who may speak publicly or what may be posted; a public post cannot be reliably recalled, so the route must not publish without an approval and classification step once an account exists.',
      },
    }),
  D(DEF_SSRF, SOCIAL_CAP, 'HIGH',
    'For an X post with media URLs the publisher checks only that the URL scheme is http or https (its comment says it validates the URL to prevent SSRF), then calls fetch(url) from the server with default redirect following, reads the whole body with arrayBuffer with no size, content type, host or address-range check, casts the response content-type header to an image or video type and uploads the bytes to the X media endpoint, so a steward can make the server request loopback, link-local, cloud metadata or private network addresses and any redirect target, and the response of whatever answers as an image or video is posted from the organization X account.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A steward of an organization with a connected X account can include media_urls in the post request (up to ten http or https URLs validated by zod as URLs only); the server fetches each from its own network position before the upload.',
        potentialImpact: {
          classes: ['UNAUTHORIZED_MUTATION', 'PRIVACY_OR_CONSENT'],
          description: 'The server can be made to call internal services and metadata endpoints with GET requests, to download arbitrarily large bodies into memory, and to relay any image or video it can reach to a public account.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          act('social-media/posts/route.ts', 'media_urls: z.array(z.string().url("Invalid media URL")).max(10, "Maximum 10 media files").optional(),'),
          { ref: SOCIAL_SERVICE, quote: 'const mediaResponse = await fetch(url);' },
          { ref: SOCIAL_SERVICE, quote: "if (!['http:', 'https:'].includes(parsed.protocol)) {" },
        ],
        existingContainment: 'NONE',
        blockingCondition: 'An organization connects an X account and the application runs where internal or metadata addresses are reachable from the server.',
        justification: 'The scheme check blocks only non-http schemes and every other address is fetched, so the control named in its own comment is absent; exposure needs a connected X account and a steward, which makes it conditional, but within that set the server-side request is unrestricted and the only response filter is whatever the X media endpoint accepts.',
      },
    }),
  D(DEF_CALLBACK, SOCIAL_CAP, 'MEDIUM',
    'The OAuth callback is a GET that exchanges the code, calls the platform to resolve the identity, and inserts or overwrites the social_accounts row (tokens, status active) with onConflictDoUpdate, so a state-changing request is reachable by a link, and the temporary oauth cookies are cleared before the state, user and organization are compared, so any request to the callback (a forged link or a replay) destroys the pending flow of a connection that is under way; the audit is a logApiAuditEvent call after the row is committed, which writes a log line and no audit row, and the first Facebook Page or LinkedIn organization the account lists is connected without the steward choosing one.',
    { riskCategories: ['GET_WITH_SIDE_EFFECTS', 'AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(DEF_CONNECT_AUDIT, SOCIAL_CAP, 'MEDIUM',
    'Initiating and completing a connection and listing the connected accounts call logApiAuditEvent with an object holding userId, organizationId, action, dataType, success and metadata cast through any, but that function logs only timestamp, userId, endpoint, method, eventType, severity and details from its argument, none of which these calls supply, so the log line carries the user id and undefined values and the action, organization, platform and record id are discarded; no audit row exists for connecting an organization publishing identity.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(DEF_CONNECT_AUTHORITY, SOCIAL_CAP, 'MEDIUM',
    'Any steward starts the OAuth flow for the organization, and the authorization requests ask for Meta pages_manage_posts, pages_manage_engagement, instagram_content_publish and business_management and LinkedIn w_organization_social and rw_organization_admin, which exceed what posting needs and give the stored token administrative rights over the page; the same floor refreshes and disconnects accounts, and no source names the office that may connect, replace or remove the union public identity.',
    undefined),
  D(DEF_DISCONNECT, SOCIAL_CAP, 'MEDIUM',
    'The disconnect deletes the social_accounts row and its tokens and answers Account disconnected successfully even when the X token revocation throws (the catch is empty), and it never revokes Meta or LinkedIn tokens (the code comments that they need no explicit revocation), so a token that was exposed or that the union intended to cancel stays valid at the platform with no stored copy left to revoke later; the platform post removal for scheduled Facebook posts is not attempted.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(DEF_REFRESH, SOCIAL_CAP, 'LOW',
    'The refresh route marks the account expired and writes a token_refresh_failed audit row on any exception, including a transient platform error or a missing refresh token, discards the error and answers a generic 500, and on success sets the account status to active whatever status it held (suspended or rate_limited included); the Meta branch refreshes the stored page token with the user long-lived token exchange.',
    undefined),
  D(DEF_PUBLISH_STATE, SOCIAL_CAP, 'MEDIUM',
    'publishPost inserts the social_posts row after each platform call, so a database failure after a successful platform post is caught as a platform failure and the live post has no row, no audit and a failed result; per-platform failures are caught inside the operation, so the performAuditedOperation outcome record says completed even when every platform failed, and the request answers 500 with the raw platform error text in results when none succeeded but 200 with partial results when some did; the intent and outcome audit is not committed with any data row.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(DEF_SCHEDULE, SOCIAL_CAP, 'MEDIUM',
    'scheduled_for is passed to a platform only for Facebook (scheduled_publish_time); the Instagram, X and LinkedIn branches post immediately, yet the row is inserted with status scheduled, the requested time and no published time, so a post the steward scheduled is live at once while the record says it is waiting, and hashtags and mentions are stored on the row but sent to no platform, link_title and link_description reach only LinkedIn, and campaign_id is dropped.',
    undefined),
  D(DEF_NOT_LINKED, SOCIAL_CAP, 'MEDIUM',
    'The post create schema accepts campaign_id and the handler assigns it to an unused variable, the service insert has no campaign column, so no social_posts row ever has a campaign id; the campaign list metrics, the campaign analytics, the post analytics filter by campaign_id and the CSV campaign export therefore count zero posts for every campaign, and the delete guard that refuses to delete a campaign with posts can never fire.',
    undefined),
  D(DEF_NO_WRITER, SOCIAL_CAP, 'MEDIUM',
    'No route, job or service writes social_analytics rows or the engagement counters of social_posts: fetchAnalytics has no caller and every platform branch of it is an empty block with a comment that the transformation is not implemented, the publish insert leaves impressions, reach, likes, comments and shares at their zero defaults, so the analytics read, the post performance read, the campaign metrics and the export answer 200 with empty or zero figures labelled as impressions, reach and engagement, and the summary averages are computed from those zeros.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_PLATFORM_FIELDS, SOCIAL_CAP, 'MEDIUM',
    'The campaign analytics read builds platform_metrics and the timeline from post fields named impressions, engagement, likes, comments, shares and engagement_rate, which its select does not return (it selects impressionsCount and the other count fields), so those platform figures are zero or NaN-guarded to zero even when posts carry counts, goal_progress is a constant undefined, and the clicks total is a constant zero.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_CAMPAIGN_CREATE, SOCIAL_CAP, 'MEDIUM',
    'The campaign create schema accepts goals and status, checks the goals (metric and a positive target), then stores neither: the insert writes no goal columns and sets status to the literal active, requires at least one platform although the schema marks platforms optional, and the response is a success carrying the campaign row, so a steward is told that goals were recorded for a campaign that has none.',
    undefined),
  D(DEF_CAMPAIGN_UPDATE, SOCIAL_CAP, 'LOW',
    'The campaign update reads name, description, platforms, dates, hashtags, target audience and status from the raw JSON with no schema, writes any of them (status, a platforms array of any strings, hashtags of any type), calls split on the date values so a non-string answers 500, and a status outside the enum fails in the database as a generic 500.',
    undefined),
  D(DEF_EXPORT, SOCIAL_CAP, 'MEDIUM',
    'The analytics DELETE handler writes nothing and exports posts, account analytics or campaigns as CSV or JSON for the date range at the member floor, with no row limit, no rate limit and no audit record; the CSV writer does not neutralise values that start with equals, plus, minus or at, and it looks each cell up by a key derived from the header text, so the campaign export leaves the campaign name, impressions, engagement, likes, comments, shares and clicks columns blank and the account export leaves followers blank, and a zero value is written as blank.',
    undefined),
  D(DEF_ID_FIRST, SOCIAL_CAP, 'LOW',
    'The handler loads the campaign or post by id alone through the shared db import (the post lookup joins the account without an organization predicate) and compares the organization afterwards, answering 403 for another organization row and 404 for a missing one, so isolation of the lookup rests on the later comparison rather than the query and a caller can tell whether a campaign or post id exists in another organization.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  D(DEF_PAGING, SOCIAL_CAP, 'LOW',
    'limit and offset are parseInt of the raw query string with no number check, no minimum and no maximum, and are passed to the query, so a caller can request an arbitrarily large page, a negative value that the database rejects as a 500, or NaN.',
    undefined),
  D(DEF_DELETE_EXTERNAL, SOCIAL_CAP, 'MEDIUM',
    'The post delete asks the platform to remove the post and then updates the local row to deleted, so a failure of the local update after a successful platform removal leaves a row that says published for a post that no longer exists, a platform failure leaves the row published and returns only a generic 500, and the intent and outcome audit records are not committed with the row change.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),

  D(DEF_FEED, COMMS_CAP, 'MEDIUM',
    'The social media feed route is the generic CRUD factory configured over the communications campaigns table at member floor read and steward floor write, so the feed answers with campaign rows (name, subject, body, segment query, audience count, delivery statistics, status) instead of social posts, readable by any member including drafts and the audience query, while the feed widget expects platform, publishedAt, mediaUrls and hashtags and calls the deprecated v2 path; POST inserts a campaign row, not a social post, and publishes nothing.',
    undefined, COMMS_GATE),
]

/* ------------------------------------------------------------------------------------------------------------ */
/* capabilities and decisions                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

export const CAPABILITIES = [
  {
    id: ESIG_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'esignature-document-requests-signing-and-audit-trail',
    primaryGate: GATE,
    dependencyGates: [6, 11, 13],
    actor: 'Sender sending a document for signature to named platform and external signers, signer recording a signature, sender voiding a request, and the sender or a signer reading the status and the audit trail',
    businessOutcome: 'A document is sent for signature only by the offices the institution names and only to recipients with a recorded basis for contact, a signer is a verified identity bound to the person who signs, a signature, a completion and a void state what happened at the signing provider, the audit trail is sealed and verifiable before it is called evidence, the institution states what legal validity a signature carries, and every state change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/signatures (documents, documents/[id], sign, audit/[documentId])',
    service: SIG_SERVICE,
    sourceFiles: [
      SIG_SERVICE,
      SIG_PROVIDERS,
      `${APP}lib/signature/provider-sync.ts`,
      SIG_PROJECTION,
      SIG_SCHEMA,
      `${API}signatures/documents/route.ts`,
      `${API}signatures/sign/route.ts`,
    ],
    proof: [{ type: 'path', ref: SIG_SERVICE }],
    auditEvidence: 'Creating a request, recording a signature, completing a document, voiding and each provider status synchronization commit a persistAtomicAudit row and signature_audit_trail rows in the same tenant transaction; the provider envelope, the stored file and the provider void call are outside that transaction, and the audit trail has an unused hash chain column and is not sealed.',
    privacyClassification: 'Signed and to-be-signed documents (arbitrary uploaded files), signer names, e-mail addresses and user ids, signature images, IP addresses, user agents and geolocation of signers, provider envelope identifiers, and the audit trail and report of each document.',
    gap: 'No existing capability owns the e-signature request workflow. UE-OMIT-PKI-SIGNING-WORKFLOW is bound to app/api/admin/pki and the services/pki files: its record states that its signature value is a literal attestation over a document-reference hash, that its workflow is a process-local map and that its table does not exist, none of which describes these routes, which create provider envelopes, store signature_documents, document_signers and signature_audit_trail rows and are the live signature subsystem the storage authority register names; UE-OMIT-AUDIT-LOG-VISIBILITY owns platform audit log reads, not the per-document signature audit trail; UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS owns calendar provider OAuth connections and its token crypto, not a document signing provider; UE-OMIT-COMMUNICATIONS-* capabilities own mass message campaigns, not a signing request to named signers; and UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. This record closes none of the gaps, names no signing office and states no legal validity, which no source states.',
  },
  {
    id: SOCIAL_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'social-media-publishing-accounts-posts-campaigns-and-analytics',
    primaryGate: GATE,
    dependencyGates: [6, 11, 13],
    actor: 'Steward connecting the organization social media accounts and publishing, scheduling and removing posts under the union name; member reading the accounts, posts, campaigns and analytics',
    businessOutcome: 'The union public accounts are connected and disconnected by the offices the institution names, their credentials are held encrypted and revoked on disconnect, a post is published only after the approval the institution requires and only to the accounts it names, a scheduled post is published at its time, a published and a deleted post match the platform, analytics are measured from the platform and not defaulted, and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/social-media (accounts, accounts/callback, posts, campaigns, analytics)',
    service: SOCIAL_SERVICE,
    sourceFiles: [
      SOCIAL_SERVICE,
      `${APP}lib/social-media/meta-api-client.ts`,
      `${APP}lib/social-media/twitter-api-client.ts`,
      `${APP}lib/social-media/linkedin-api-client.ts`,
      SOCIAL_SCHEMA,
      `${API}social-media/accounts/route.ts`,
      `${API}social-media/accounts/callback/route.ts`,
      `${API}social-media/posts/route.ts`,
    ],
    proof: [{ type: 'path', ref: SOCIAL_SERVICE }],
    auditEvidence: 'Account disconnect and token refresh, campaign create, update and delete commit persistAtomicAudit with the row. Publishing and deleting a post record intent and outcome through performAuditedOperation around the external platform call, which is not atomic. Initiating and completing a connection and listing accounts call logApiAuditEvent, which writes a log line and no audit row. The post and analytics reads are not audited.',
    privacyClassification: 'OAuth access and refresh tokens of the organization Facebook, Instagram, X and LinkedIn accounts, platform account identifiers, post text, media URLs, links, hashtags and mentions (which may name members), campaign targeting text, and engagement and follower figures.',
    gap: 'No existing capability owns social media publishing. UE-OMIT-COMMUNICATIONS-CAMPAIGN-AUTHORING and UE-OMIT-COMMUNICATIONS-CAMPAIGN-DELIVERY own e-mail, SMS and push campaigns to members through the communications campaigns table, and the social routes read and write the separate social_accounts, social_posts, social_campaigns and social_analytics tables and call public platform APIs; UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS owns the personal calendar provider connections and its token-crypto module, not an organization public identity; UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION owns analytics reports over operational tables, not platform engagement figures; UE-OMIT-REWARDS-REDEMPTION-FULFILMENT and UE-OMIT-FEDERATION-LOCAL-HIERARCHY concern other domains; and UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. This record closes none of the gaps and names no office that may speak for the union publicly or hold its platform credentials, which no source states.',
  },
]

export const DECISIONS = [
  {
    id: D_ESIG,
    status: 'OUTSTANDING',
    question: 'Which offices of a union may send a document for signature in its name and to which recipients, what identity proof binds a signer (a platform account, a verified e-mail address, a provider authentication) to the person whose name the audit trail states, what legal validity the union claims for a signature recorded in the platform or at a provider, and what makes the audit trail evidence (a sealed, verifiable record rather than an editable table)?',
    sourceState: 'Any authenticated user with an organization sends a document to typed signers through the provider the deployment configures or an internal stub that sends nothing, a signer is the user id the sender typed beside free-text name and e-mail address, a sender can sign as a named person and complete the document, and the audit trail is an editable table with an unused hash chain column that the service labels as generated for legal compliance. No source names the sending office, the identity proof or the validity basis.',
    softwareOwners: [ESIG_CAP],
  },
  {
    id: D_SOCIAL,
    status: 'OUTSTANDING',
    question: 'Which office of a union may connect, replace and remove its public social media accounts and hold their credentials, who may publish, schedule and delete a post in the union name and what approval, classification and member-consent check precedes publication, which analytics may members read, and how must the platform credentials be held and revoked?',
    sourceState: 'Any steward connects an organization account with administrative scopes and publishes at once to every connected account of a platform with no approval, credentials are stored as plain text and Meta and LinkedIn tokens are never revoked, a scheduled post is published immediately on three platforms, and analytics rows have no writer. No source names the connecting or publishing office, the approval step or the credential custody rule.',
    softwareOwners: [SOCIAL_CAP],
  },
]

/* ------------------------------------------------------------------------------------------------------------ */
/* risk screens                                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

const rlsScreen = (reason, ref, quote) => ({ RLS_ASSUMED_FROM_DB_CLIENT: { reason, evidence: [{ ref, quote }] } })
const analyticsScreen = (reason, quote) => ({ ANALYTICS_CROSSES_BOUNDARY: { reason, evidence: [{ ref: route('social-media/analytics/route.ts'), quote }] } })

const POSTS_GET_RLS = rlsScreen(
  'The read goes through the shared db import, but the condition list starts with the organization predicate taken from the withRoleAuth context and every filter is added to it, so no row of another organization can match whatever policy the connection role carries; the offset and limit bound is a separate defect.',
  route('social-media/posts/route.ts'),
  'const conditions: SQL[] = [eq(socialPosts.organizationId, organizationId)];',
)
const ANALYTICS_ORG = (quote) => ({
  ...rlsScreen(
    'The reads join social_accounts and the where clause carries the organization predicate taken from the withRoleAuth context, so a row of another organization cannot be selected whatever policy the connection role carries; the join is a left join but the predicate on the joined table removes unmatched rows.',
    route('social-media/analytics/route.ts'),
    quote,
  ),
  ...analyticsScreen(
    'The figures are sums over post and analytics rows that the query restricts to the caller organization by the account join, so no row of another organization or of members is aggregated; the defect on the figures concerns their absence of a writer, not their scope.',
    quote,
  ),
})

export const RISK_SCREENS = {
  'social-media/posts/route.ts|GET': POSTS_GET_RLS,
  'social-media/analytics/route.ts|GET': ANALYTICS_ORG('eq(socialAccounts.organizationId, organizationId),'),
  'social-media/analytics/route.ts|POST': ANALYTICS_ORG('eq(socialAccounts.organizationId, organizationId),'),
  'social-media/analytics/route.ts|PUT': analyticsScreen(
    'The aggregation runs only after the campaign row is loaded and its organization is compared with the caller organization, and only the posts of that campaign are summed, so no row of another organization is aggregated once the comparison passes; the id-first lookup is a separate defect.',
    'if (organizationId !== campaign.organizationId) {',
  ),
  'social-media/analytics/route.ts|DELETE': ANALYTICS_ORG('eq(socialAccounts.organizationId, organizationId),'),
  'social-media/accounts/route.ts|GET': rlsScreen(
    'The list reads through the shared db import, but the only condition is the organization predicate taken from the withRoleAuth context, so no row of another organization can match whatever policy the connection role carries.',
    route('social-media/accounts/route.ts'),
    '.where(eq(socialAccounts.organizationId, organizationId))',
  ),
  'social-media/accounts/route.ts|POST': rlsScreen(
    'The handler reads and writes no database row: it builds the authorization address and stores the state, user and organization in short-lived cookies, so the shared db handle is not used for any statement of this operation.',
    route('social-media/accounts/route.ts'),
    "cookieStore.set('oauth_organization_id', organizationId, cookieOpts);",
  ),
  'social-media/accounts/callback/route.ts|GET': rlsScreen(
    'The credential row is inserted or updated inside withRLSContext for the organization taken from the withRoleAuth context, after the stored state organization has been compared with it, so the write does not use the shared db handle without a tenant context.',
    route('social-media/accounts/callback/route.ts'),
    'const [account] = await withRLSContext({ organizationId }, async (tx) =>',
  ),
  'social-media/posts/route.ts|POST': rlsScreen(
    'The publisher selects the accounts with the organization predicate taken from the withRoleAuth context and passes the same organization to every credential load and every row it inserts, so the shared db handle is used only with an explicit organization condition on the account lookup; the missing approval is a separate defect.',
    SOCIAL_SERVICE,
    'eq(socialAccounts.organizationId, organizationId),',
  ),
}

/* ------------------------------------------------------------------------------------------------------------ */
/* shared text                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const base = (a) => ({ service: `${API}${a.route} (${a.method})` })

const SIG_AUTHN = 'Authenticated session: withApiAuth requires authentication on this non-public path and the handler resolves the user with getCurrentUser and answers 401 when none exists.'
const SIG_AUTHZ_NONE = 'No role floor: any authenticated user with an organization passes. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.'
const SIG_ACCESS = 'Relationship check, not a role: verifyDocumentAccess admits the person who sent the document or a signer whose signer-row user id equals the caller, looked up by document id alone through the shared db import; membership of the organization is not a relationship to the document. No kernel decision is made.'
const SIG_SENS = 'Signature document title, description, document type and file name, signer names, e-mail addresses, user ids, IP addresses, user agents, geolocation and signature image URLs, provider envelope ids and the audit trail'

const SOC_AUTHN = 'Authenticated session: withRoleAuth requires authentication and resolves the organization with getOrganizationIdForUser before the handler runs.'
const socAuthz = (floor) => `withRoleAuth('${floor}') requires the ${floor} role through hasRole; a role title is not a kernel decision, no authorizeAction call is made and the union has recorded no decision on who may connect or speak through its social accounts, so kernelAuthorization stays false.`
const SOC_TENANT = 'The organization id comes from the withRoleAuth context, not the body or the query; the lookups and writes carry it as a predicate on the organization column of the social tables.'

const READ_CORR = (audit) => ({ field: 'mutating', manifest: `mutating true, audit ${audit}`, actual: 'The handler is a read and writes no row.' })

/* ------------------------------------------------------------------------------------------------------------ */
/* signature operations                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

function signatureCreate(a) {
  return mk({
    ...base(a),
    persona: 'Any authenticated user with an organization sending a document, supplied as an uploaded file, for signature to signers named by name and e-mail address',
    authn: SIG_AUTHN,
    authz: SIG_AUTHZ_NONE,
    tenant: 'The organization id is taken from the authenticated user, never from the body, and the document insert, the signer inserts, the audit trail rows and the atomic audit run in a tenant context for that organization; the signer user ids and e-mail addresses are body text with no check against the organization.',
    owner: 'signature_documents row of the sender organization, document_signers rows of the typed signers, the stored file, the provider envelope and signature_audit_trail rows.',
    sens: SIG_SENS,
    priv: 'The uploaded file, the title, description, signer names and e-mail addresses are sent to the external signing provider when one is configured and stored; the response returns only the document id, title, status and creation time.',
    mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
    auditDetail: 'The document, signer rows, two signature_audit_trail rows and a signature.document.send persistAtomicAudit row commit in one tenant transaction; the provider envelope, which e-mails the signers, and the stored file are created before that transaction and are not covered by it.',
    reqAudit: 'Record the authorization to send, the recipients and the provider reference in the same transaction as the document, and create the provider envelope only after the local record exists or compensate when the record fails.',
    does: 'Reads the multipart form, parses the signers JSON with no schema, creates an envelope with the provider (the external one when configured, otherwise the internal stub), stores the file, inserts the document as sent, a signer row per typed signer and the audit rows, and answers success with the document summary; there is no role floor, no rate limit and no size limit.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 11, 13],
    future: 'Name the offices that may send documents for signature, validate and verify the signer list (organization membership for platform signers, proof of address for external signers), bound the upload, create the provider envelope only after the local record exists, record consent and the recipients, and state what an internal signature is worth.',
    dec: [D_ESIG],
    ev: [
      a.imp('authentication', 'withApiAuth', 'const requireAuth = options.requireAuth !== false && !isPublic'),
      a.h('authentication', /await getCurrentUser\(\);$/),
      a.h('authorization', 'if (!organizationId) {'),
      a.h('tenantScope', 'const organizationId = user.organizationId;'),
      a.svc('tenantScope', SIG_SERVICE, 'const document = await withRLSContext({ organizationId: data.organizationId }, async (tx) => {', 'SignatureService.createSignatureRequest'),
      a.h('mutation', 'const document = await SignatureService.createSignatureRequest({'),
      a.svc('mutation', SIG_SERVICE, '.insert(signatureDocuments)', 'SignatureService.createSignatureRequest'),
      a.svc('audit', SIG_SERVICE, 'await persistAtomicAudit(tx, {', 'SignatureService.createSignatureRequest'),
      a.svc('privacy', SIG_SERVICE, 'const envelope = await provider.createEnvelope({', 'SignatureService.createSignatureRequest'),
      a.svc('defect', SIG_PROVIDERS, 'process.env.DOCUSIGN_API_KEY'),
      a.h('defect', 'signers = JSON.parse(signersJson);'),
      a.h('defect', 'const formData = await request.formData();'),
      a.h('defect', 'provider: (provider as "internal" | "docusign" | "hellosign" | null) || undefined,'),
      a.svc('defect', SIG_SERVICE, 'userId: signer.userId,', 'SignatureService.createSignatureRequest'),
      a.svc('defect', SIG_SERVICE, 'sequentialSigning: data.sequentialSigning || false,', 'SignatureService.createSignatureRequest'),
      a.svc('defect', SIG_PROVIDERS, '// Generate signing URLs', 'InternalSignatureProvider.createEnvelope'),
      a.sch('defect', SIG_SCHEMA, 'userId: text("user_id").references(() => profiles.userId, {', { symbol: 'documentSigners' }),
    ],
    inf: [
      { claim: 'defect', statement: 'The route has no rate limit call, no file size or type check and no role check, so the only gates are an authenticated session with an organization and the provider configuration.' },
    ],
    def: [DEF_SIGNER_IDENTITY, DEF_SEND, DEF_INTERNAL, DEF_UNENFORCED, DEF_EXTERNAL_FIRST],
    corr: [{ field: 'audit', manifest: 'audit declared atomic', actual: 'The document, signers, trail and audit row commit together, but the provider envelope that e-mails the signers and the stored file are created outside that transaction, so the audit is atomic for the local part only.' }],
  })
}

function signatureList(a) {
  return mk({
    ...base(a),
    persona: 'Authenticated user listing the signature documents they sent and the documents they must sign in their organization',
    authn: SIG_AUTHN,
    authz: SIG_AUTHZ_NONE,
    tenant: 'The organization id is taken from the authenticated user and both queries carry it, together with the sender or signer user id equal to the caller; the queries use the shared db import with no tenant context.',
    owner: "signature_documents rows sent by the caller and the caller's own document_signers rows, in the caller's organization.",
    sens: SIG_SENS,
    priv: "The caller receives every document they sent (every column except storage locations, which the projection removes) and, for documents they must sign, the document and the caller's own signer row with IP address, user agent, geolocation and signature image URL; nothing of another user's documents.",
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: nothing is written and no audit row is recorded.',
    reqAudit: 'Reads of own documents need no audit record; the sender-and-signer relationship should be recorded with the document.',
    does: 'Returns { sent, toSign } for the caller and organization, newest first, with storage keys removed and an evidenceClass added to each document, unpaginated.',
    status: 'IMPLEMENTED_IN_SOURCE',
    gate: GATE,
    deps: [6, 13],
    future: 'Paginate the list, return the signer fields the caller is entitled to and run the reads in a tenant context.',
    dec: [D_ESIG],
    ev: [
      a.imp('authentication', 'withApiAuth', 'const requireAuth = options.requireAuth !== false && !isPublic'),
      a.h('authentication', /await getCurrentUser\(\);$/),
      a.h('authorization', 'if (!organizationId) {'),
      a.h('tenantScope', 'const organizationId = user.organizationId;'),
      a.svc('tenantScope', SIG_SERVICE, 'eq(signatureDocuments.organizationId, organizationId)', 'SignatureService.getUserDocuments'),
      a.h('mutation', 'const documents = await SignatureService.getUserDocuments( userId,'),
      a.svc('mutation', SIG_SERVICE, 'const sent = await db', 'SignatureService.getUserDocuments'),
      a.imp('privacy', 'projectSignaturePayload', "const output: Record<string, unknown> = {};"),
      a.svc('privacy', SIG_PROJECTION, "'fileUrl',"),
      a.svc('defect', SIG_SERVICE, '.orderBy(desc(signatureDocuments.createdAt));', 'SignatureService.getUserDocuments'),
    ],
    inf: [],
    def: [DEF_SIG_LIST, DEF_SIG_READS],
    corr: [],
  })
}

function signatureItemGet(a) {
  return mk({
    ...base(a),
    persona: 'Sender or signer of a signature document reading its status, signers and the provider-synchronized state',
    authn: SIG_AUTHN,
    authz: SIG_ACCESS,
    tenant: 'No organization predicate: the document id comes from the path and is looked up by id alone through the shared db import, and access depends only on the sender or signer relationship, where the signer user id is typed by the sender; a signer in another organization passes.',
    owner: 'signature_documents row of the path id with its document_signers rows, owned by the sender organization.',
    sens: SIG_SENS,
    priv: 'The sender and every signer receive the whole document row (storage locations removed) and every signer row with e-mail address, IP address, user agent, geolocation, signature image URL and provider signer id, including the other signers.',
    mut: 'NONE',
    auditDetail: 'The GET itself records no audit row of the read. When the document has a provider envelope and is not completed, getDocumentStatus calls syncDocumentStatus, which updates the document, the signers and the audit trail and commits a signature.provider_status_sync atomic audit row under a system actor in its own transaction; that audit records the synchronization, not the caller or the read.',
    reqAudit: 'Do not write on a read; move the provider synchronization to an authorized job or an explicit action that records who triggered it, and audit disclosure of signer network data once the readers are named.',
    does: 'Checks the sender or signer relationship, loads the document with its signers, calls the provider and updates status, signers and audit rows when an envelope exists and the document is not completed (a provider failure leaves the stored state and is not reported), and returns the document with storage locations removed.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Return status from stored state, run synchronization as a separate authorized action, scope the lookup by organization in a tenant context and return only the signer fields the caller is entitled to.',
    dec: [D_ESIG],
    ev: [
      a.imp('authentication', 'withApiAuth', 'const requireAuth = options.requireAuth !== false && !isPublic'),
      a.h('authentication', /await getCurrentUser\(\);$/),
      a.h('authorization', 'const hasAccess = await SignatureService.verifyDocumentAccess(documentId, user.id);'),
      a.svc('authorization', SIG_SERVICE, 'const isSender = document.sentBy === userId;', 'SignatureService.verifyDocumentAccess'),
      a.svc('tenantScope', SIG_SERVICE, 'where: eq(signatureDocuments.id, documentId),', 'SignatureService.verifyDocumentAccess'),
      a.h('mutation', 'const document = await SignatureService.getDocumentStatus(documentId);'),
      a.svc('mutation', SIG_SERVICE, 'await this.syncDocumentStatus(documentId);', 'SignatureService.getDocumentStatus'),
      a.svc('mutation', SIG_SERVICE, '.update(signatureDocuments)', 'SignatureService.syncDocumentStatus'),
      a.svc('audit', SIG_SERVICE, 'await persistAtomicAudit(tx, {', 'SignatureService.syncDocumentStatus'),
      a.svc('privacy', SIG_SERVICE, 'with: {', 'SignatureService.getDocumentStatus'),
      a.svc('defect', SIG_SERVICE, 'return { synced: false, reason: "provider_unavailable" };', 'SignatureService.syncDocumentStatus'),
      a.svc('defect', SIG_SERVICE, 'status = await provider.getEnvelopeStatus(document.providerEnvelopeId);', 'SignatureService.syncDocumentStatus'),
      a.svc('defect', SIG_SERVICE, 'const isSigner = document.signers.some((s) => s.userId === userId);', 'SignatureService.verifyDocumentAccess'),
    ],
    inf: [],
    def: [DEF_GET_SYNC, DEF_SIG_READS, DEF_SIG_DISCLOSURE],
    corr: [{ field: 'mutating', manifest: 'read-only GET', actual: 'The GET can call the signature provider and update the document, signer and audit trail rows through getDocumentStatus and syncDocumentStatus, so it is not read-only.' }],
  })
}

function signatureItemPatch(a) {
  return mk({
    ...base(a),
    persona: 'Sender of a signature document voiding it',
    authn: SIG_AUTHN,
    authz: `${SIG_ACCESS} The void itself is further limited by the service to the person who sent the document, and a completed, voided, declined or expired document is refused with 409.`,
    tenant: 'The document is loaded by id alone through the shared db import; the void update then carries the organization of the loaded document in its predicate and runs in a tenant context for it.',
    owner: 'signature_documents row of the path id, owned by the sender organization.',
    sens: SIG_SENS,
    priv: 'The response is a fixed success message; the void reason, a caller-typed text, is stored on the document, in the audit trail and in the audit details.',
    mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
    auditDetail: 'The status update, the document_voided trail row and a signature.document.void persistAtomicAudit row commit in one tenant transaction; the provider void call runs before that transaction, outside it, and its failure is swallowed.',
    reqAudit: 'Record the provider result with the void in the same transaction, refuse the void when the provider does not confirm it, and bound the reason text.',
    does: 'Checks the sender or signer relationship, accepts only action void with a reason, calls the provider to void the envelope (ignoring any failure), then marks the document voided with the reason, writes the trail and audit rows, and answers success.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 11, 13],
    future: 'Confirm the provider void before recording it, validate the body with the declared schema and bound the reason, and name who may withdraw a signature request.',
    dec: [D_ESIG],
    ev: [
      a.imp('authentication', 'withApiAuth', 'const requireAuth = options.requireAuth !== false && !isPublic'),
      a.h('authentication', /await getCurrentUser\(\);$/),
      a.h('authorization', 'const hasAccess = await SignatureService.verifyDocumentAccess(documentId, userId);'),
      a.svc('authorization', SIG_SERVICE, 'if (document.sentBy !== voidedBy) {', 'SignatureService.voidDocument'),
      a.svc('tenantScope', SIG_SERVICE, 'await withRLSContext({ organizationId: document.organizationId }, async (tx) => {', 'SignatureService.voidDocument'),
      a.h('mutation', 'await SignatureService.voidDocument(documentId, userId, reason);'),
      a.svc('mutation', SIG_SERVICE, '.update(signatureDocuments)', 'SignatureService.voidDocument'),
      a.svc('audit', SIG_SERVICE, 'await persistAtomicAudit(tx, {', 'SignatureService.voidDocument'),
      a.svc('defect', SIG_SERVICE, 'await provider.voidEnvelope(document.providerEnvelopeId, reason);', 'SignatureService.voidDocument'),
      a.svc('defect', SIG_SERVICE, '} catch (_error) {', 'SignatureService.voidDocument'),
      a.h('defect', 'const { action, reason } = body;'),
      a.svc('defect', SIG_PROVIDERS, '// Would update database', 'InternalSignatureProvider.voidEnvelope'),
    ],
    inf: [],
    def: [DEF_VOID, DEF_PATCH_SCHEMA, DEF_SIG_READS],
    corr: [{ field: 'audit', manifest: 'audit declared atomic', actual: 'The void state and audit commit together, but the provider void call is outside the transaction and its failure is swallowed, so the audit is atomic for the local part only.' }],
  })
}

function signatureSign(a) {
  return mk({
    ...base(a),
    persona: 'Authenticated platform user recording the signature of a signer row that carries their own user id',
    authn: 'Authenticated session: the handler calls requireApiAuth and answers 401 when no user id results; the route is not wrapped by withApiAuth.',
    authz: 'The service requires the signer row user id to equal the caller and rejects a signer with no user id (an external signer), so a caller signs only a row that bears their id; that id was typed by the sender when the request was created. A role title is not involved and no kernel decision is made, so kernelAuthorization stays false.',
    tenant: 'The signer is loaded by id alone; the document organization is read from the signer document and the update runs in a tenant context for it with the document organization in the signer predicate; the caller organization is not compared with the document organization.',
    owner: 'document_signers row of the body signerId and its signature_documents row.',
    sens: 'Signature image URL, signature type, IP address and user agent of the signer, geolocation sent in the body, the signer name and e-mail address, and the document completion state',
    priv: 'The response returns the whole updated signer row to the caller, including the IP address, user agent, geolocation and signature image URL that were just stored.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The signer update, the document_signed trail row, a signature.document.sign persistAtomicAudit row and, when every signer is signed, the document completion with its trail and atomic audit rows commit in one tenant transaction.',
    reqAudit: 'Keep the in-transaction audit and add the identity proof used, the document hash the signer saw and a seal over the trail row.',
    does: 'Validates signerId, signatureImageUrl (any URL), signatureType and optional geolocation, takes the IP address from x-forwarded-for or x-real-ip and the user agent from the headers, and records the signature when the caller owns the signer row and the document and signer are still open, then marks the document completed when all signers are signed; expiry, signing order and the authentication requirement are not checked and no provider is called.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 11, 13],
    future: 'Bind the signature to a verified identity and to the document hash the signer saw, enforce expiry, order and authentication, take network evidence only from the trusted edge, record the signature with the provider when the document has an envelope, and seal the trail.',
    dec: [D_ESIG],
    ev: [
      a.imp('authentication', 'requireApiAuth', "logger.warn('[Auth] Canonical API authentication required');"),
      a.h('authentication', 'const { userId } = await requireApiAuth();'),
      a.h('authorization', 'actorUserId: userId,'),
      a.svc('authorization', SIG_SERVICE, 'if (existingSigner.userId === null || existingSigner.userId !== data.actorUserId) {', 'SignatureService.recordSignature'),
      a.svc('tenantScope', SIG_SERVICE, 'return withRLSContext({ organizationId: document.organizationId }, async (tx) => {', 'SignatureService.recordSignature'),
      a.h('mutation', 'const signer = await SignatureService.recordSignature({'),
      a.svc('mutation', SIG_SERVICE, '.update(documentSigners)', 'SignatureService.recordSignature'),
      a.svc('audit', SIG_SERVICE, 'await persistAtomicAudit(tx, {', 'SignatureService.recordSignature'),
      a.h('defect', 'signatureImageUrl,'),
      a.h('defect', 'const ipAddress = req.headers.get("x-forwarded-for") ||'),
      a.h('defect', 'geolocation,'),
      a.svc('defect', SIG_SERVICE, 'actorEmail: updated.email,', 'SignatureService.recordSignature'),
      a.svc('defect', SIG_SERVICE, 'const allSigned = signers.every((s) => s.status === "signed");', 'SignatureService.checkCompletion'),
      a.sch('defect', SIG_SCHEMA, 'hashChain: text("hash_chain"), // Link to previous event', { symbol: 'signatureAuditTrail' }),
    ],
    inf: [],
    def: [DEF_SIGNER_IDENTITY, DEF_AUDIT_TRAIL, DEF_UNENFORCED],
    corr: [],
  })
}

function signatureAudit(a) {
  return mk({
    ...base(a),
    persona: 'Sender or signer of a signature document reading its audit trail or audit report',
    authn: SIG_AUTHN,
    authz: SIG_ACCESS,
    tenant: 'No organization predicate: the document id comes from the path, the access check and both audit reads look the document and its rows up by id alone through the shared db import, and a signer in another organization passes the relationship check.',
    owner: 'signature_audit_trail rows and the signature_documents and document_signers rows of the path document id, owned by the sender organization.',
    sens: 'Audit event types and descriptions, actor e-mail addresses and user ids, IP addresses, user agents, geolocation and metadata of every event of the document, and in the report the signer names, e-mail addresses and IP addresses',
    priv: 'The sender and every signer receive all audit rows (IP address, user agent and geolocation of every actor) or, with format=report, a report with the document hash, every signer name, e-mail address and IP address and every event; nothing is redacted per reader.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: nothing is written; the disclosure of signer network data is not audited.',
    reqAudit: 'Name the readers of a signature audit trail and audit each disclosure of signer network and location data.',
    does: 'Checks the sender or signer relationship, then returns the raw audit rows with a count or, with format=report, the generated report whose service comment says it is for legal compliance; the rows carry caller-supplied IP, user agent and geolocation and no verified hash chain.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Seal and verify the trail before it is offered as a report, name the readers and fields, and scope the lookup by organization in a tenant context.',
    dec: [D_ESIG, D_AUDIT_READERS],
    ev: [
      a.imp('authentication', 'withApiAuth', 'const requireAuth = options.requireAuth !== false && !isPublic'),
      a.h('authentication', 'const user = await getCurrentUser();'),
      a.h('authorization', 'const hasAccess = await SignatureService.verifyDocumentAccess(documentId, user.id);'),
      a.svc('authorization', SIG_SERVICE, 'const isSender = document.sentBy === userId;', 'SignatureService.verifyDocumentAccess'),
      a.svc('tenantScope', SIG_SERVICE, 'where: eq(signatureDocuments.id, documentId),', 'SignatureService.verifyDocumentAccess'),
      a.h('mutation', 'const auditTrail = await AuditTrailService.getDocumentAudit(documentId);'),
      a.svc('mutation', SIG_SERVICE, '.where(eq(signatureAuditTrail.documentId, documentId))', 'AuditTrailService.getDocumentAudit'),
      a.svc('privacy', SIG_SERVICE, 'ipAddress: s.ipAddress,', 'AuditTrailService.generateAuditReport'),
      a.sch('defect', SIG_SCHEMA, 'hashChain: text("hash_chain"), // Link to previous event', { symbol: 'signatureAuditTrail' }),
      a.svc('defect', SIG_SERVICE, 'const auditData: SignatureAuditTrailInsert = {', 'AuditTrailService.log'),
      a.svc('defect', SIG_SERVICE, 'fileHash: document?.fileHash,', 'AuditTrailService.generateAuditReport'),
    ],
    inf: [],
    def: [DEF_AUDIT_TRAIL, DEF_SIG_READS, DEF_SIG_DISCLOSURE],
    corr: [],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* social operations                                                                                              */
/* ------------------------------------------------------------------------------------------------------------ */

const SOCIAL_ACCOUNT_SENS = 'Platform, platform user id, username, display name, follower count, engagement rate, connection state and rate-limit counters of each connected account; OAuth access and refresh tokens in the same row'

function accountsGet(a) {
  return mk({
    ...base(a),
    persona: 'Member of the organization listing the connected social media accounts',
    authn: SOC_AUTHN,
    authz: socAuthz('member'),
    tenant: SOC_TENANT,
    owner: 'social_accounts rows of the organization.',
    sens: SOCIAL_ACCOUNT_SENS,
    priv: 'Any member receives each connected account with its platform user id, username, follower and engagement figures, status and rate-limit counters; the select lists fixed columns, so the access and refresh tokens are not returned.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: no row is written; the handler calls logApiAuditEvent, which writes a log line with the user id and undefined values, not an audit row.',
    reqAudit: 'Name who may see the connected accounts of the union; a read of account metadata needs no row audit.',
    does: 'Applies a per-organization rate limit, selects the fixed non-secret columns of the organization accounts newest first and returns them; logApiAuditEvent is called with fields the logger does not read.',
    status: 'IMPLEMENTED_IN_SOURCE',
    gate: GATE,
    deps: [6, 13],
    future: 'Decide the readers of the connected-account list and keep the token columns out of every read model.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', '.where(eq(socialAccounts.organizationId, organizationId))'),
      a.h('mutation', '.from(socialAccounts)'),
      a.tbl('privacy', 'socialAccounts', /accessToken: text\('access_token'\)\.notNull\(\)/),
      a.h('privacy', 'platformUserId: socialAccounts.platformUserId,'),
      a.svc('defect', API_SECURITY, 'details: event.details,', 'logApiAuditEvent'),
      a.h('defect', 'await logApiAuditEvent({'),
    ],
    inf: [],
    def: [DEF_CONNECT_AUDIT],
    corr: [],
  })
}

function accountsPost(a) {
  return mk({
    ...base(a),
    persona: 'Steward starting the OAuth connection of an organization social media account',
    authn: SOC_AUTHN,
    authz: socAuthz('steward'),
    tenant: `${SOC_TENANT} The organization and user are also written to httpOnly cookies that the callback compares with its own authenticated context.`,
    owner: 'The pending OAuth flow of the steward (cookies) that becomes a social_accounts row of the organization when the callback completes.',
    sens: 'OAuth state, the X PKCE code verifier, and the requested platform scopes',
    priv: 'The response is the platform authorization URL; the state, platform, organization and user are set as short-lived httpOnly cookies and the X code verifier as a second cookie.',
    mut: 'LOG_ONLY',
    auditDetail: 'No row is written; the handler calls logApiAuditEvent, which logs a line carrying the user id and undefined values because the call passes none of the fields the logger reads, so no audit record names the initiation, the platform or the organization.',
    reqAudit: 'Record who started a connection of the organization public identity, for which platform and with which scopes, in a durable audit row.',
    does: 'Validates the platform, applies a per-user rate limit, builds the authorization URL for Meta, X or LinkedIn with the post, engagement and administration scopes, sets the state, platform, organization and user cookies (and the X code verifier) and returns auth_url; any failure answers a generic 500.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Name who may connect the union public accounts, request only the scopes the approved use needs, and record the initiation durably.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', "cookieStore.set('oauth_organization_id', organizationId, cookieOpts);"),
      a.h('mutation', "cookieStore.set('oauth_state', state, cookieOpts);"),
      a.h('audit', 'await logApiAuditEvent({'),
      a.svc('audit', API_SECURITY, "logger.info('API_SECURITY_AUDIT', {", 'logApiAuditEvent'),
      a.h('defect', "'business_management',"),
      a.h('defect', "'rw_organization_admin',"),
      a.svc('defect', API_SECURITY, 'details: event.details,', 'logApiAuditEvent'),
    ],
    inf: [],
    def: [DEF_CONNECT_AUDIT, DEF_CONNECT_AUTHORITY],
    corr: [{ field: 'audit', manifest: 'audit declared atomic', actual: 'No row is written and the audit is a logApiAuditEvent log line that drops the action, organization and platform, so no audit record exists.' }],
  })
}

function accountsCallback(a) {
  return mk({
    ...base(a),
    persona: 'Steward whose browser is redirected back from Meta, X or LinkedIn with an authorization code',
    authn: SOC_AUTHN,
    authz: `${socAuthz('steward')} The flow is bound to the initiating user and organization by httpOnly cookies compared with the authenticated context, and to the state by a cookie equal to the query state.`,
    tenant: 'The organization and user come from the authenticated context; the cookies must equal them and the insert carries the context organization. The row is upserted on organization, platform and platform user id.',
    owner: 'social_accounts row of the organization for the connected platform identity.',
    sens: 'OAuth access token, refresh token and expiry of the organization platform account, platform user id, username and display name',
    priv: 'The tokens are exchanged server-side and stored in plain text columns; the response returns only the account id, platform and username.',
    mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
    auditDetail: 'The account row is inserted or overwritten in a tenant transaction with no audit row; after it commits the handler calls logApiAuditEvent, which writes a log line carrying the user id and undefined values, so no durable audit record names the connection.',
    reqAudit: 'Record the connection, the platform identity and the scopes granted in the same transaction as the credential row, with the steward who completed it.',
    does: 'Reads and clears the OAuth cookies, compares state, user and organization, exchanges the code with the platform, takes the first Page or organization the account lists, upserts the social_accounts row with the tokens as received and status active, and returns the account id; a failure answers a generic 500.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Complete the connection through a POST with the state check, let the steward choose the account, encrypt the credentials, record the connection and its scopes in the same transaction, and keep the pending cookies until the state has been verified.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const GET = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('authorization', 'if (!storedState || storedState !== state) {'),
      a.h('tenantScope', 'if (!storedOrganizationId || storedOrganizationId !== organizationId) {'),
      a.h('mutation', '.insert(socialAccounts)'),
      a.h('audit', 'await logApiAuditEvent({'),
      a.svc('audit', API_SECURITY, "logger.info('API_SECURITY_AUDIT', {", 'logApiAuditEvent'),
      a.h('defect', '.onConflictDoUpdate({'),
      a.h('defect', 'clearOAuthCookies(cookieStore);'),
      a.h('defect', 'const page = pages[0];'),
      a.h('defect', 'accessToken,'),
      a.tbl('defect', 'socialAccounts', /accessToken: text\('access_token'\)\.notNull\(\)/),
      a.tbl('privacy', 'socialAccounts', /refreshToken: text\('refresh_token'\)/),
    ],
    inf: [],
    def: [DEF_CALLBACK, DEF_TOKENS, DEF_CONNECT_AUDIT, DEF_CONNECT_AUTHORITY],
    corr: [{ field: 'mutating', manifest: 'read-only GET', actual: 'The GET exchanges an authorization code with the platform and inserts or overwrites the social_accounts row with the tokens, so it is a state-changing request.' }],
  })
}

function accountsDelete(a) {
  return mk({
    ...base(a),
    persona: 'Steward disconnecting an organization social media account',
    authn: SOC_AUTHN,
    authz: socAuthz('steward'),
    tenant: 'The account id comes from the query and is looked up and deleted with the organization from the withRoleAuth context in both predicates, so a foreign account id is simply not found; the lookup loads the credential-bearing row first.',
    owner: 'social_accounts row of the query id in the organization (its posts and analytics rows are removed by cascade).',
    sens: 'OAuth access and refresh tokens of the account, platform identity, and the posts and analytics rows that cascade with it',
    priv: 'The response confirms the disconnect and the account id; the credential row, loaded in full, is deleted.',
    mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
    auditDetail: 'The row delete and a social.account.disconnect persistAtomicAudit row commit in one tenant transaction; the X token revocation runs before it, outside it, and its failure is swallowed.',
    reqAudit: 'Record the revocation result with the disconnect and refuse or flag a disconnect whose token could not be revoked.',
    does: 'Applies a per-user rate limit, loads the organization account by id, asks X to revoke its token (ignoring failure; Meta and LinkedIn tokens are not revoked), deletes the row with its audit record and returns success.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Revoke at every platform, report a failed revocation, keep the posts of a disconnected account instead of cascading them away, and name who may disconnect the union public account.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const DELETE = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', '.where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.organizationId, organizationId)))'),
      a.h('mutation', '.delete(socialAccounts)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'await twitterClient.revokeToken();'),
      a.h('defect', '// Meta and LinkedIn don&apos;t require explicit revocation'),
      a.h('defect', '} catch (_revokeError) {'),
      a.tbl('defect', 'socialAccounts', /organizationId: uuid\('organization_id'\)\.notNull\(\)\.references/),
    ],
    inf: [],
    def: [DEF_DISCONNECT],
    corr: [{ field: 'audit', manifest: 'audit declared atomic', actual: 'The delete and audit commit together, but the X token revocation that precedes them is outside the transaction and its failure is swallowed, so the audit is atomic for the local part only.' }],
  })
}

function accountsPut(a) {
  return mk({
    ...base(a),
    persona: 'Steward refreshing the OAuth token of an organization social media account',
    authn: SOC_AUTHN,
    authz: socAuthz('steward'),
    tenant: 'The account id comes from the body and is looked up and updated with the organization from the withRoleAuth context in every predicate; the lookup loads the credential-bearing row.',
    owner: 'social_accounts row of the body account_id in the organization.',
    sens: 'OAuth access and refresh tokens and their expiry for the account',
    priv: 'The response returns only the new expiry; the new tokens are written to the plain text columns.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The token update and a social.account.token_refresh persistAtomicAudit row commit in one tenant transaction, and a failed refresh commits the expired status with a token_refresh_failed audit row in another; the platform token exchange is an external call outside both.',
    reqAudit: 'Keep the in-transaction audit and record the refresh outcome and the platform response class, not the token.',
    does: 'Loads the organization account by id, exchanges or refreshes the token at Meta, X or LinkedIn, stores the new access token (and refresh token when returned) with the new expiry and status active, and returns the expiry; any exception marks the account expired and answers a generic 500.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Encrypt the stored tokens, distinguish transient from permanent refresh failures, and validate the body.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const PUT = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', '.where(and(eq(socialAccounts.id, account_id), eq(socialAccounts.organizationId, organizationId)))'),
      a.h('mutation', '.update(socialAccounts)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'accessToken: newAccessToken,'),
      a.h('defect', "status: 'expired',"),
      a.h('defect', "status: 'active',"),
      a.h('defect', 'const tokenData = await metaClient.getLongLivedToken(account.accessToken);'),
      a.tbl('defect', 'socialAccounts', /refreshToken: text\('refresh_token'\)/),
    ],
    inf: [],
    def: [DEF_TOKENS, DEF_REFRESH],
    corr: [],
  })
}

const POST_SENS = 'Post text, media URLs, link, hashtags, mentions (which may name members), schedule, platform post ids and permalinks, error messages, engagement counters and the creating user'

function postsGet(a) {
  return mk({
    ...base(a),
    persona: 'Member of the organization listing the social media posts of the organization',
    authn: SOC_AUTHN,
    authz: socAuthz('member'),
    tenant: SOC_TENANT,
    owner: 'social_posts rows of the organization.',
    sens: POST_SENS,
    priv: 'Any member receives every post row of the organization, including drafts, scheduled posts, failed posts with their error text and the creating user id, with the status, campaign and content search filters; no audit of the read.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: nothing is written and no audit row is recorded.',
    reqAudit: 'Name the readers of unpublished posts; reads of published posts need no audit record.',
    does: 'Applies a per-user rate limit, filters the organization posts by status, campaign id and a content ILIKE search, counts them and returns a page ordered newest first with limit and offset taken from the query without bounds.',
    status: 'IMPLEMENTED_IN_SOURCE',
    gate: GATE,
    deps: [6, 13],
    future: 'Limit unpublished posts to the offices that draft them and bound the page size.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', 'const conditions: SQL[] = [eq(socialPosts.organizationId, organizationId)];'),
      a.h('mutation', '.from(socialPosts)'),
      a.h('privacy', '.select()'),
      a.tbl('privacy', 'socialPosts', /errorMessage: text\('error_message'\)/),
      a.h('defect', "const limit = parseInt(searchParams.get('limit') || '20');"),
    ],
    inf: [],
    def: [DEF_PAGING],
    corr: [],
  })
}

function postsPost(a) {
  return mk({
    ...base(a),
    persona: 'Steward publishing a post to the connected social media accounts of the organization',
    authn: SOC_AUTHN,
    authz: socAuthz('steward'),
    tenant: 'The organization id comes from the withRoleAuth context; the publisher selects the active accounts of that organization for the chosen platforms with the organization predicate, loads each credential with the organization predicate and inserts each post row with the organization.',
    owner: 'social_posts rows of the organization and the posts published on its connected platform accounts.',
    sens: POST_SENS,
    priv: 'The text, media URLs, link and mentions are transmitted to the public platforms under the organization account and become public; the response returns the platform post ids, permalinks and the platform error text.',
    mut: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
    auditDetail: 'performAuditedOperation records a social.post.publish.requested row before the publish and a completed or failed row after it, each in its own transaction; the platform posts and the social_posts row inserts are not part of those transactions, and per-platform failures do not make the outcome record fail.',
    reqAudit: 'Record the approver and the exact content hash published to each account, and commit the post row with the audit record.',
    does: 'Validates the body, applies a per-user rate limit and the per-platform character limits, then publishes to every active account of the organization on each selected platform (Facebook scheduling only is passed to the platform), inserts a row per success, and answers 200 when any platform succeeded and 500 when none did; campaign id, hashtags and mentions are not sent.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 11, 13],
    future: 'Add a draft and approval state, let the poster choose accounts, check the content and mentions against classification and consent, enforce the address and size limits on media, honour or refuse scheduling on every platform and commit the row with the audit record.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.svc('tenantScope', SOCIAL_SERVICE, 'eq(socialAccounts.organizationId, organizationId),', 'SocialMediaService.publishPost'),
      a.h('mutation', 'socialMediaService.publishPost('),
      a.svc('mutation', SOCIAL_SERVICE, 'await db.insert(socialPosts).values({', 'SocialMediaService.publishPost'),
      a.h('audit', 'const results = await performAuditedOperation('),
      a.h('audit', 'action: \'social.post.publish\','),
      a.imp('audit', 'performAuditedOperation', 'await inScope(op.scope, organizationId, (tx) => persistAtomicAudit(tx, entry(\'requested\')))'),
      a.svc('privacy', SOCIAL_SERVICE, 'const response = await metaClient.publishFacebookPost(', 'SocialMediaService.publishPost'),
      a.svc('defect', SOCIAL_SERVICE, 'inArray(socialAccounts.platform, content.platforms),', 'SocialMediaService.publishPost'),
      a.svc('defect', SOCIAL_SERVICE, 'const mediaResponse = await fetch(url);', 'SocialMediaService.publishPost'),
      a.svc('defect', SOCIAL_SERVICE, "if (!['http:', 'https:'].includes(parsed.protocol)) {", 'SocialMediaService.publishPost'),
      a.svc('defect', SOCIAL_SERVICE, "status: content.scheduled_for ? 'scheduled' : 'published',", 'SocialMediaService.publishPost'),
      a.svc('defect', SOCIAL_SERVICE, 'postId = tweet.id;', 'SocialMediaService.publishPost'),
      a.h('defect', 'campaign_id: _campaign_id,'),
      a.h('defect', 'media_urls,'),
      a.svc('defect', SOCIAL_SERVICE, 'error: error instanceof Error ? error.message : \'Unknown error\',', 'SocialMediaService.publishPost'),
    ],
    inf: [],
    def: [DEF_PUBLISH, DEF_SSRF, DEF_PUBLISH_STATE, DEF_SCHEDULE, DEF_NOT_LINKED],
    corr: [{ field: 'audit', manifest: 'audit declared atomic', actual: 'The intent and outcome rows are written by performAuditedOperation each in its own transaction around the external platform calls, and the social_posts rows are inserted outside them, so no data row commits with an audit record.' }],
  })
}

function postsDelete(a) {
  return mk({
    ...base(a),
    persona: 'Steward removing a published social media post of the organization',
    authn: SOC_AUTHN,
    authz: socAuthz('steward'),
    tenant: 'The post id comes from the query and is first loaded by id alone (joined to its account) and compared with the context organization afterwards; the service then loads and updates the post with the organization predicate.',
    owner: 'social_posts row of the query id and the post on the platform account.',
    sens: POST_SENS,
    priv: 'The route answers 403 for a post of another organization and 404 for a missing one; on success it removes the post from the public platform and returns the post id.',
    mut: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
    auditDetail: 'performAuditedOperation records a social.post.delete.requested row before and a completed or failed row after the platform removal and the local status update, each in its own transaction; the row update is not committed with them.',
    reqAudit: 'Record the platform confirmation with the row change and keep the removed content for the retention period.',
    does: 'Loads the post by id, compares its account organization with the caller organization, asks the platform to delete the post with the stored token, sets the local row to deleted and returns success; a failure answers a generic 500.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Scope the lookup by organization in the query, record the platform confirmation with the local change and name who may remove a public post.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const DELETE = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', 'if (organizationId !== post.orgId) {'),
      a.h('mutation', 'socialMediaService.deletePost(postId, organizationId),'),
      a.svc('mutation', SOCIAL_SERVICE, 'await db.update(socialPosts).set({', 'SocialMediaService.deletePost'),
      a.h('audit', 'await performAuditedOperation('),
      a.h('audit', "action: 'social.post.delete',"),
      a.imp('audit', 'performAuditedOperation', 'await recordOutcome(op.scope, organizationId, entry(\'completed\'), \'success\')'),
      a.h('defect', '.where(eq(socialPosts.id, postId))'),
      a.svc('defect', SOCIAL_SERVICE, 'await metaClient.deletePost(typedPost.platformPostId!, typedPost.accessToken!);', 'SocialMediaService.deletePost'),
    ],
    inf: [],
    def: [DEF_ID_FIRST, DEF_DELETE_EXTERNAL],
    corr: [{ field: 'audit', manifest: 'audit declared atomic', actual: 'The intent and outcome rows are written by performAuditedOperation each in its own transaction around the platform removal, and the local status update is outside them, so the row change does not commit with an audit record.' }],
  })
}

const CAMPAIGN_SENS = 'Campaign name, description, code, platforms, target audience text, hashtags, schedule, status, goals and the creating user'

function campaignsGet(a) {
  return mk({
    ...base(a),
    persona: 'Member of the organization listing the social media campaigns with their post metrics',
    authn: SOC_AUTHN,
    authz: socAuthz('member'),
    tenant: 'The campaign list carries the organization predicate from the withRoleAuth context; the per-campaign post metrics query filters by campaign id alone, which is bounded by the campaigns already selected.',
    owner: 'social_campaigns rows of the organization and the social_posts counted for each.',
    sens: CAMPAIGN_SENS,
    priv: 'Any member receives every campaign of the organization (including target audience text and planning-state campaigns) with post, impression and engagement totals that are zero because no post carries a campaign id.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: nothing is written and no audit row is recorded.',
    reqAudit: 'Name the readers of campaign planning content; reads need no audit record once readers are named.',
    does: 'Applies a per-user rate limit, filters the organization campaigns by status, search and dates, counts them, returns a page newest first with unbounded limit and offset, and for each campaign runs a posts query by campaign id to sum counters, with a constant zero for clicks and an undefined goal progress.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Link posts to campaigns, derive metrics from recorded platform data, bound the page size and name the readers of campaigns.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', 'const campaignConditions: SQL[] = [eq(socialCampaigns.organizationId, organizationId)];'),
      a.h('mutation', '.from(socialCampaigns)'),
      a.h('privacy', '.select()'),
      a.h('defect', '.where(eq(socialPosts.campaignId, campaign.id));'),
      a.h('defect', 'total_clicks: 0,'),
      a.h('defect', "const limit = parseInt(searchParams.get('limit') || '50');"),
    ],
    inf: [],
    def: [DEF_PAGING, DEF_NOT_LINKED, DEF_NO_WRITER],
    corr: [],
  })
}

function campaignsPost(a) {
  return mk({
    ...base(a),
    persona: 'Steward creating a social media campaign',
    authn: SOC_AUTHN,
    authz: socAuthz('steward'),
    tenant: SOC_TENANT,
    owner: 'social_campaigns row of the organization created by the steward.',
    sens: CAMPAIGN_SENS,
    priv: 'The campaign row is stored and returned in full to the steward.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The campaign insert and a social.campaign.create persistAtomicAudit row commit in one tenant transaction; the audit lists the name and platforms.',
    reqAudit: 'Keep the in-transaction audit and record the goals once they are stored.',
    does: 'Validates the body shape, applies a per-user rate limit, checks the goals and dates, inserts a campaign with status active and the typed name, description, platforms, dates, hashtags and target audience, and returns the row; the goals and the requested status are not stored.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Store the validated goals and status, tie campaigns to posts, and name who may create a public campaign.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', 'organizationId,'),
      a.h('mutation', '.insert(socialCampaigns)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', "status: 'active',"),
      a.h('defect', 'if (!goal.metric || !goal.target_value) {'),
      a.tbl('defect', 'socialCampaigns', /goalImpressions: integer\('goal_impressions'\)/),
    ],
    inf: [],
    def: [DEF_CAMPAIGN_CREATE],
    corr: [],
  })
}

function campaignsPut(a) {
  return mk({
    ...base(a),
    persona: 'Steward updating a social media campaign',
    authn: SOC_AUTHN,
    authz: socAuthz('steward'),
    tenant: 'The campaign id comes from the query and is loaded and updated with the organization from the withRoleAuth context in both predicates.',
    owner: 'social_campaigns row of the query id in the organization.',
    sens: CAMPAIGN_SENS,
    priv: 'The updated campaign row is returned in full to the steward.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The campaign update and a social.campaign.update persistAtomicAudit row commit in one tenant transaction; the audit lists the names of the fields written.',
    reqAudit: 'Keep the in-transaction audit and add the old and new status.',
    does: 'Loads the organization campaign by id, copies any of name, description, platforms, dates, hashtags, target audience and status from the raw JSON body into the update, writes it with its audit record and returns the row.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Validate the body with a schema, restrict status transitions and name who may change a public campaign.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const PUT = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', '.where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))'),
      a.h('mutation', '.update(socialCampaigns)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'if (status !== undefined) updateData.status = status;'),
      a.h('defect', 'if (start_date !== undefined) updateData.startDate = start_date.split(\'T\')[0];'),
    ],
    inf: [],
    def: [DEF_CAMPAIGN_UPDATE],
    corr: [],
  })
}

function campaignsDelete(a) {
  return mk({
    ...base(a),
    persona: 'Steward deleting a social media campaign',
    authn: SOC_AUTHN,
    authz: socAuthz('steward'),
    tenant: 'The campaign id comes from the query and is loaded and deleted with the organization from the withRoleAuth context in both predicates; the posts check filters by campaign id alone.',
    owner: 'social_campaigns row of the query id in the organization.',
    sens: CAMPAIGN_SENS,
    priv: 'The response confirms the deletion and the campaign id; the campaign row is removed permanently and only the audit record keeps its name.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The campaign delete and a social.campaign.delete persistAtomicAudit row commit in one tenant transaction; the audit records the campaign name.',
    reqAudit: 'Keep the in-transaction audit and retain the campaign record for the retention period.',
    does: 'Loads the organization campaign, refuses when a post carries its id (no post ever does), deletes the row with its audit record and returns success.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Link posts to campaigns so the guard operates, and archive instead of deleting.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const DELETE = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', '.where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))'),
      a.h('mutation', '.delete(socialCampaigns)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', '.where(eq(socialPosts.campaignId, campaignId))'),
    ],
    inf: [],
    def: [DEF_NOT_LINKED],
    corr: [],
  })
}

const ANALYTICS_SENS = 'Impressions, reach, likes, comments, shares, clicks, follower counts and engagement rate per account, post and campaign, post text and media URLs, account usernames'

function analyticsGet(a) {
  return mk({
    ...base(a),
    persona: 'Member of the organization reading the daily analytics of the connected social media accounts',
    authn: SOC_AUTHN,
    authz: socAuthz('member'),
    tenant: 'The organization predicate from the withRoleAuth context is applied on the joined social_accounts table, so only rows of accounts of the organization are selected.',
    owner: 'social_analytics rows of the accounts of the organization.',
    sens: ANALYTICS_SENS,
    priv: 'Any member receives per-account daily figures and summaries with the account username and display name.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: nothing is written and no audit row is recorded.',
    reqAudit: 'Name the readers of engagement analytics.',
    does: 'Applies a per-user rate limit, selects social_analytics rows for the date range joined to the organization accounts, groups them by account and sums them; no job or route writes social_analytics, so the answer is empty.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Populate the analytics from the platforms before serving figures, mark an account with no data as having none, and name the readers.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', 'eq(socialAccounts.organizationId, organizationId),'),
      a.h('mutation', '.from(socialAnalytics)'),
      a.tbl('privacy', 'socialAnalytics', /totalImpressions: integer\('total_impressions'\)/),
    ],
    inf: [],
    def: [DEF_NO_WRITER],
    corr: [],
  })
}

function analyticsPost(a) {
  return mk({
    ...base(a),
    persona: 'Member of the organization reading the performance of published posts of a campaign',
    authn: SOC_AUTHN,
    authz: socAuthz('member'),
    tenant: 'The organization predicate from the withRoleAuth context is applied on the joined social_accounts table, and the campaign id from the body is only an additional filter.',
    owner: 'social_posts rows of the accounts of the organization.',
    sens: ANALYTICS_SENS,
    priv: 'Any member receives the published posts of the organization (text, media URLs, account username) with counters, ordered by impressions, with the unbounded limit and offset the body supplies.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The POST returns computed post performance and writes no row.',
    auditDetail: 'A read exposed as POST: nothing is written and the handler records no audit row; the role wrapper emits only its generic request audit event.',
    reqAudit: 'Name the readers of post performance.',
    does: 'Applies a per-user rate limit, requires a campaign id, selects published posts of the date range joined to the organization accounts filtered by that campaign id, sums the counters and returns the posts, the top ten and the summary; no post carries a campaign id, so the result is empty.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Link posts to campaigns, use a GET for a read and bound the page.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.imp('audit', 'withRoleAuth', 'const _emission = auditLog({'),
      a.h('authorization', "export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', 'eq(socialAccounts.organizationId, organizationId),'),
      a.h('mutation', '.from(socialPosts)'),
      a.h('privacy', 'content: socialPosts.content,'),
      a.h('defect', 'postConditions.push(eq(socialPosts.campaignId, campaign_id));'),
      a.h('defect', 'const { platform, campaign_id, start_date, end_date, limit = 50, offset = 0 } = validation.data;'),
    ],
    inf: [],
    def: [DEF_NOT_LINKED, DEF_NO_WRITER, DEF_PAGING],
    corr: [{ field: 'mutating', manifest: 'mutating true, audit declared', actual: 'The POST returns computed post performance and writes no row.' }],
  })
}

function analyticsPut(a) {
  return mk({
    ...base(a),
    persona: 'Member of the organization reading the analytics of one social media campaign',
    authn: SOC_AUTHN,
    authz: socAuthz('member'),
    tenant: 'The campaign is loaded by id alone and its organization compared with the context organization afterwards; the posts query then filters by the campaign id and carries no organization predicate of its own.',
    owner: 'social_campaigns row of the query id and the social_posts rows that carry its id.',
    sens: ANALYTICS_SENS,
    priv: 'Any member of the owning organization receives the campaign description and dates and the published posts with counters; a caller of another organization receives 403, which confirms the campaign id exists.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The PUT returns computed campaign analytics and writes no row.',
    auditDetail: 'A read exposed as PUT: nothing is written and the handler records no audit row; the role wrapper emits only its generic request audit event.',
    reqAudit: 'Name the readers of campaign analytics.',
    does: 'Loads the campaign by id, compares its organization, selects its published posts, computes totals, platform metrics, a timeline and top posts, and returns them with a constant undefined goal progress; the platform metrics read fields the select does not return and no post carries a campaign id.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Use a GET for a read, scope the lookup by organization in the query and compute the platform figures from the selected fields.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.imp('audit', 'withRoleAuth', 'const _emission = auditLog({'),
      a.h('authorization', "export const PUT = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', 'if (organizationId !== campaign.organizationId) {'),
      a.h('mutation', '.from(socialPosts)'),
      a.h('privacy', 'description: campaign.description,'),
      a.h('defect', '.where(eq(socialCampaigns.id, campaignId))'),
      a.h('defect', 'impressions: acc.impressions + (post.impressions || 0),'),
      a.h('defect', 'const goalProgress = undefined;'),
    ],
    inf: [],
    def: [DEF_ID_FIRST, DEF_PLATFORM_FIELDS, DEF_NOT_LINKED, DEF_NO_WRITER],
    corr: [{ field: 'mutating', manifest: 'mutating true, audit declared', actual: 'The PUT returns computed campaign analytics and writes no row.' }],
  })
}

function analyticsDelete(a) {
  return mk({
    ...base(a),
    persona: 'Member of the organization exporting posts, account analytics or campaigns as CSV or JSON',
    authn: SOC_AUTHN,
    authz: socAuthz('member'),
    tenant: 'The posts and account exports carry the organization predicate on the joined social_accounts table and the campaign export on the campaign organization column; the per-campaign post query filters by campaign id.',
    owner: 'social_posts, social_analytics and social_campaigns rows of the organization.',
    sens: ANALYTICS_SENS,
    priv: 'Any member downloads the post text, account usernames and figures, or the campaign names, dates, status and platforms, for the range, without a row limit and with no audit record.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The DELETE returns an export of the selected data and writes or deletes no row.',
    auditDetail: 'A read exposed as DELETE: nothing is written or deleted and the handler records no audit row for the export; the role wrapper emits only its generic request audit event.',
    reqAudit: 'Name who may export social media data and record each export.',
    does: 'Selects the requested data type for the date range, builds a CSV by looking each cell up by a key derived from the header text (so several campaign and follower columns are blank and zeros become blank), without neutralising formula characters, or returns JSON, with no row limit.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Use a GET for an export, bound and audit it, neutralise formula characters and map columns by explicit keys.',
    dec: [D_SOCIAL],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.imp('audit', 'withRoleAuth', 'const _emission = auditLog({'),
      a.h('authorization', "export const DELETE = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('tenantScope', 'eq(socialAccounts.organizationId, organizationId),'),
      a.h('mutation', '.from(socialPosts)'),
      a.h('privacy', 'content: socialPosts.content,'),
      a.h('defect', "const key = header.toLowerCase().replace(/ /g, '_');"),
      a.h('defect', "let value: any = row[key] || '';"),
      a.h('defect', "'Content-Type': 'text/csv',"),
    ],
    inf: [],
    def: [DEF_EXPORT, DEF_NOT_LINKED, DEF_NO_WRITER],
    corr: [{ field: 'mutating', manifest: 'mutating true (DELETE), audit declared', actual: 'The DELETE handler deletes nothing and writes no row; it exports data.' }],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* feed (generic CRUD factory over the communications campaigns table)                                           */
/* ------------------------------------------------------------------------------------------------------------ */

const FEED_SENS = 'Campaign name, channel, subject and body, audience query, schedule, send state and delivery statistics'

function feedProfile() {
  return {
    persona: 'Member reading, and steward creating, the mass communication campaigns of the organization through a route named for a social media feed',
    owner: 'campaigns rows of the organization (communications campaigns, not social posts).',
    sens: FEED_SENS,
    priv: (m) => (m === 'GET'
      ? 'Any member of the organization reads every campaign row, including drafts, the audience query, the body and the delivery statistics, from a route and a widget named for a social media feed; no social post is returned.'
      : 'Any body field is stored, including status, sentAt and the stats counters; the row is a mass communication campaign, not a social post, and nothing is published.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns campaigns rows of the session organization at a role floor of ${floor}, paginated by the factory; the social feed widget expects platform, publishedAt, mediaUrls and hashtags per item, which a campaign row does not carry.`
      : `Inserts a campaigns row from the whole body at a role floor of ${floor}, with the organization and creator from the session, and commits the factory audit record with it; no post is published.`),
    future: 'Serve the feed from social_posts of published posts with the fields the widget needs, or remove the route; keep campaign authoring on the communications routes.',
    gate: COMMS_GATE,
    deps: [9, 13],
    decisions: [D_COMMS_OWNER, D_SOCIAL],
    def: (m) => (m === 'GET' ? [DEF_FEED] : [DEF_FEED, 'DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE']),
    extraEv: (b, model) => [
      b.tbl('privacy', 'campaigns', /segmentQuery: jsonb\('segment_query'\)/),
      b.tbl('defect', 'campaigns', /stats: jsonb\('stats'\)/),
      ...(model.readRole === 'member' && b.method === 'GET' ? [b.imp('defect', 'crudRoutes', 'const lowRole = await readScope(userId, organizationId);')] : []),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route configures crudRoutes over campaigns with orgScoped, readRole member and writeRole steward and nothing else; the feed widget requests /api/v2/social-media/feed and reads items by platform and publishedAt, neither of which the campaigns table has.' },
    ],
    reqRead: 'Audit reads of campaign audiences once the readers are named.',
    status: () => 'FACADE_OVER_GENERIC_TABLE',
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* dispatch                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const HANDLERS = {
  'signatures/documents/route.ts|POST': signatureCreate,
  'signatures/documents/route.ts|GET': signatureList,
  'signatures/documents/[id]/route.ts|GET': signatureItemGet,
  'signatures/documents/[id]/route.ts|PATCH': signatureItemPatch,
  'signatures/sign/route.ts|POST': signatureSign,
  'signatures/audit/[documentId]/route.ts|GET': signatureAudit,
  'social-media/accounts/route.ts|GET': accountsGet,
  'social-media/accounts/route.ts|POST': accountsPost,
  'social-media/accounts/route.ts|DELETE': accountsDelete,
  'social-media/accounts/route.ts|PUT': accountsPut,
  'social-media/accounts/callback/route.ts|GET': accountsCallback,
  'social-media/posts/route.ts|GET': postsGet,
  'social-media/posts/route.ts|POST': postsPost,
  'social-media/posts/route.ts|DELETE': postsDelete,
  'social-media/campaigns/route.ts|GET': campaignsGet,
  'social-media/campaigns/route.ts|POST': campaignsPost,
  'social-media/campaigns/route.ts|PUT': campaignsPut,
  'social-media/campaigns/route.ts|DELETE': campaignsDelete,
  'social-media/analytics/route.ts|GET': analyticsGet,
  'social-media/analytics/route.ts|POST': analyticsPost,
  'social-media/analytics/route.ts|PUT': analyticsPut,
  'social-media/analytics/route.ts|DELETE': analyticsDelete,
}

export function facts(a, readText) {
  const id = `${a.route}|${a.method}`
  if (FEED_ROUTES.includes(a.route)) return applyCrossTenantExposure(crudRecord(a, readText, feedProfile()), DEFECTS)
  const handler = HANDLERS[id]
  if (!handler) throw new Error(`no Gate 0B.11 social-signatures facts for ${id}`)
  return applyCrossTenantExposure(handler(a), DEFECTS)
}

export { LOW_ROLE }
