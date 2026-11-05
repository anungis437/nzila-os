const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
const S = A + 'lib/signature/'
addBatch({
  id: 'B110-F06-A6-SIGNATURE-EVIDENCE-INTEGRITY',
  family: 'F06 A6: signature evidence is chained, checked at signing and not self-asserted',
  test: A + 'lib/services/__tests__/s52-f06-a6-signature-evidence-integrity.test.ts',
  previousEvidence: { 'B109-F06-A5-A7-CLAIMED-CONTROLS-OPERATE': '23493f86a' },
  items: [
    {
      prefix: 'DEF-0B11-SOC-SIGNATURE-AUDIT-TRAIL-HAS-NO-HASH',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [S + 'audit-chain.ts', S + 'audit-chain-store.ts', S + 'signer-network-address.ts', S + 'file-integrity.ts', S + 'signature-service.ts', A + 'app/api/signatures/sign/route.ts', S + '__tests__/audit-chain.test.ts', S + '__tests__/audit-chain.pglite.test.ts', S + '__tests__/signer-network-address.test.ts', S + '__tests__/file-integrity.test.ts', S + '__tests__/signature-service.test.ts', S + '__tests__/b44-signer-privacy.test.ts', A + 'app/api/signatures/sign/__tests__/route.test.ts', A + 'db/__tests__/signature-audit-trail-append-only.postgres.test.ts'],
      explanation: 'The trail is now tamper-evident. Every event carries a sequence number and a hash over its content and its predecessor\'s hash (the existing hash_chain column; no migration), written under a per-document advisory lock so concurrent events cannot fork the chain; changing, removing, reordering or forging an event breaks verification at that sequence number (proven on real SQL, including concurrent logging, a changed row, a deleted row, a forged seal and a trail from before chaining). Completion seals the trail: the verified head becomes the last chained event and is repeated in the platform\'s own hash-chained audit log, and a trail whose chain does not verify is not sealed. The report states what verification found (chained events, unchained earlier events, verified, sealed, where it broke), never a constant. Signing recomputes the stored file hash and refuses a mismatch, and records "verified" or why it could not be checked ("unverified:not_own_storage") on the signing event. The signer address is taken from the trusted end of the proxy chain (UE_TRUSTED_PROXY_HOPS, default 1) with its provenance recorded and no address recorded when none is trustworthy, where it used to be the first client-supplied value or the string "unknown"; a browser-reported position is no longer stored; the signature must be an inline PNG or JPEG of bounded size, not a link. Proven on native PostgreSQL 15 and 16: the runtime role can read and add trail events but not update, delete or truncate them, and the system role holds no write.',
      remaining: 'Tamper-evident, not tamper-proof and not a qualified or certified e-signature audit: someone who can rewrite every later row can recompute the chain, and truncating a sealed trail\'s tail is only caught against the platform-audit anchor, which the report does not read back (audit details are not exposed). A document whose stored address is not this organization\'s own storage cannot have its file re-hashed and is recorded as unverified. UE_TRUSTED_PROXY_HOPS must match the deployment\'s proxy depth, and the deployed proxy must append the connecting address.',
    },
    {
      prefix: 'DEF-0B11-SOC-SIGNING-IGNORES-THE-STORED-EXPIRY',
      status: 'PARTIAL',
      files: [S + 'signature-service.ts', S + '__tests__/signature-service.test.ts'],
      explanation: 'The stored terms are honoured or refused, never ignored. Expiry and sequential order were already enforced; now an expired attempt also sets the internal document to expired, with its trail event and platform audit record in one transaction (the refusal rolls the signing back, so it is recorded on its own), and the status read says when an open request has run out. The second-factor requirement, which no code could perform, is no longer stored and ignored: a request that states it is not created, and an existing request that stored it is not signed until it is sent again without it.',
      remaining: 'No second factor exists: requireAuthentication is refused, not implemented. Nothing scheduled sets overdue documents to expired when nobody tries to sign; the status read reports them as expired without writing.',
    },
    {
      prefix: 'DEF-0B11-SOC-SIGNATURE-STATUS-AND-AUDIT-DISCLOSE',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [S + 'signer-privacy.ts', S + 'signature-service.ts', S + '__tests__/b44-signer-privacy.test.ts'],
      explanation: 'A signer sees no other signer\'s e-mail address, network address, device, location or free-text description in the status, the audit trail or the report; the sender sees everything. The report rows now carry their owners (the signer\'s user id, the actor\'s user id) so a signer\'s own rows are recognised and shown whole instead of being withheld with everyone else\'s; the report no longer packs an actor\'s e-mail into one field that no redaction rule could read (actor), and actorEmail is shown only on the viewer\'s own event; the report\'s description key is the one the redaction drops for others (eventDescription). Four tests added.',
      remaining: 'A signer still sees co-signers\' names, signing status and platform user ids, which signing in a sequence needs.',
    },
  ],
})
