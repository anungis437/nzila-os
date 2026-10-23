import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FX, MATTER, PDF, SUB_ITO, stageMatter, stageSent, withDoc, world0, withMember, offered, accepted, withClaims, withObjection, itoApproved, itoSent } from './scenario.ts';
import { act, decide, must, see } from './trace.ts';
import { openWait, publishStatus, readDocument, recordAroDecision, releaseDocument, requestInfo, requestRecordsAccess, submissionEvent, supplyInfo, uploadDocument } from '../src/journey.ts';
import { memberView } from '../src/journey-views.ts';
import { asDependencyId, asDocumentId } from '../src/ids.ts';
import { CLAIM_X, MEMBER_P, OTHER_MEMBER_P, SPEC_1 } from './helpers.ts';

const base = { fixture: FX.matter001, persona: 'MEMBER' as const, p: MEMBER_P };

describe('Journey D — Member', () => {
  it('[WA-J-D] before anything is published the member sees "no update" and the records-access channel, never the internal state', () => {
    const w = stageSent();
    see(w, { ...base, id: 'D-01', op: 'member reads their view with nothing published', expect: 'no update, no documents, no requests, records-access channel available', req: ['WA-REQ-063'], find: ['WA-R3-011'], mx: ['WA-T085', 'WA-T051'], view: (x) => memberView(x, MEMBER_P), check: (v) => {
      assert.deepEqual(v?.status, { state: 'NO_UPDATE_PUBLISHED', recordsAccessRequestChannel: 'AVAILABLE' });
      assert.deepEqual(v?.documents, []);
      assert.deepEqual(v?.openRequests, []);
      assert.equal(v?.recordsAccessRequestChannel, 'AVAILABLE');
      const json = JSON.stringify(v);
      for (const banned of ['DISPATCHED', 'FAKE-WSIB', 'FAKE-TX', 'ITO', 'REQ-1', 'objection']) assert.equal(json.includes(banned), false, banned);
    } });
    see(w, { ...base, id: 'D-02', op: 'member view carries no claims, decisions, submissions or tasks', expect: 'exactly four fields', req: ['WA-REQ-063'], mx: ['WA-T085'], view: (x) => memberView(x, MEMBER_P), check: (v) => assert.deepEqual(Object.keys(v ?? {}).sort(), ['documents', 'openRequests', 'recordsAccessRequestChannel', 'status']) });
  });

  it('[WA-J-D] requested information: the member supplies a document, which stays quarantined and unreadable until a professional releases something', () => {
    let w = stageMatter();
    w = must(requestInfo(w, SPEC_1, { requestId: 'REQ-INFO-1', matterId: MATTER, addressedTo: 'MEMBER', code: 'MEDICAL_REPORT' }));
    see(w, { ...base, id: 'D-03', op: 'member sees the request', expect: 'one open request by code only', req: ['WA-REQ-053'], view: (x) => memberView(x, MEMBER_P), check: (v) => assert.deepEqual(v?.openRequests, [{ id: 'REQ-INFO-1', code: 'MEDICAL_REPORT' }]) });
    w = act(w, { ...base, id: 'D-04', op: 'another member supplies the same request', p: OTHER_MEMBER_P, persona: 'ADVERSARY', expect: 'NOT_FOUND', req: ['WA-REQ-013'], find: ['WA-R1-02'], mx: ['WA-ADV-04'], run: (x) => supplyInfo(x, OTHER_MEMBER_P, { requestId: 'REQ-INFO-1', documentId: asDocumentId('X') }) });
    w = act(w, { ...base, id: 'D-05', op: 'member uploads a document', expect: 'OK', audit: 'DOCUMENT_UPLOADED_QUARANTINED', req: ['WA-REQ-060'], find: ['WA-R1-12'], mx: ['WA-T010'], run: (x) => uploadDocument(x, MEMBER_P, { documentId: asDocumentId('FAKE-DOC-M1'), matterId: MATTER, filename: 'SYNTH-CANARY psychiatrist letter.pdf', declaredMime: 'application/pdf', header: PDF, sizeBytes: 3000 }) });
    w = act(w, { ...base, id: 'D-06', op: 'member marks the request supplied', expect: 'OK', audit: 'INFO_SUPPLIED_PENDING_REVIEW', req: ['WA-REQ-053'], run: (x) => supplyInfo(x, MEMBER_P, { requestId: 'REQ-INFO-1', documentId: asDocumentId('FAKE-DOC-M1') }) });
    decide({ ...base, id: 'D-07', op: 'member opens their own upload before any release', expect: 'NOT_FOUND', req: ['WA-REQ-060', 'WA-REQ-061'], find: ['WA-R1-03'], mx: ['WA-T019'], run: () => readDocument(w, MEMBER_P, asDocumentId('FAKE-DOC-M1')) });
    see(w, { ...base, id: 'D-08', op: 'member view after supplying', expect: 'request no longer open; the quarantined upload is not listed', req: ['WA-REQ-053'], view: (x) => memberView(x, MEMBER_P), check: (v) => {
      assert.deepEqual(v?.openRequests, []);
      assert.deepEqual(v?.documents, []);
      assert.equal(JSON.stringify(v).includes('SYNTH-CANARY'), false);
    } });
    assert.equal(w.infoRequests[0]?.status, 'SUPPLIED_PENDING_REVIEW', 'supplied is not accepted: a professional still reviews it');
  });

  it('[WA-J-D] a submitted document, a pending WSIB action and an actual decision are three different things the member can tell apart', () => {
    let w = stageSent();
    w = act(w, { ...base, id: 'D-09', op: 'professional publishes wording that claims WSIB received the documents (only sent)', p: SPEC_1, persona: 'DOMENIC', expect: 'MISREPRESENTS_PROGRESS', req: ['WA-REQ-111'], find: ['WA-C-003', 'WA-R1-14'], mx: ['WA-T111'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'DOCUMENTS_SENT_TO_WSIB', text: 'WSIB has received your documents.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    w = act(w, { ...base, id: 'D-10', op: 'professional publishes "sent" with honest wording', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'STATUS_PUBLISHED', req: ['WA-REQ-063'], find: ['WA-R1-14'], mx: ['WA-T085'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'DOCUMENTS_SENT_TO_WSIB', text: 'Your documents were sent to WSIB. We are waiting for WSIB to confirm they arrived.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    const sent = see(w, { ...base, id: 'D-11', op: 'member reads the "sent" status', expect: 'stage DOCUMENTS_SENT_TO_WSIB', req: ['WA-REQ-063'], view: (x) => memberView(x, MEMBER_P), check: (v) => assert.equal(v?.status.stage, 'DOCUMENTS_SENT_TO_WSIB') });
    w = act(w, { ...base, id: 'D-12', op: 'professional publishes "receipt confirmed" before a human recorded receipt', p: SPEC_1, persona: 'DOMENIC', expect: 'EVIDENCE_DOES_NOT_SUPPORT_STAGE', req: ['WA-REQ-032', 'WA-REQ-063'], find: ['WA-R1-04', 'WA-R1-14'], mx: ['WA-T040', 'WA-ADV-09'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'WSIB_RECEIPT_CONFIRMED', text: 'WSIB has received your documents.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    w = must(submissionEvent(w, SPEC_1, SUB_ITO, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE WSIB CLERK', receivedAt: '2026-10-24T14:00:00Z' }));
    w = act(w, { ...base, id: 'D-13', op: 'professional publishes receipt wording that says the objection was filed', p: SPEC_1, persona: 'DOMENIC', expect: 'MISREPRESENTS_PROGRESS', req: ['WA-REQ-111'], find: ['WA-C-001', 'WA-C-003'], mx: ['WA-T111'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'WSIB_RECEIPT_CONFIRMED', text: 'Your objection was filed.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    w = act(w, { ...base, id: 'D-14', op: 'professional publishes "receipt confirmed" with honest wording', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'STATUS_PUBLISHED', req: ['WA-REQ-063'], find: ['WA-C-001'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'WSIB_RECEIPT_CONFIRMED', text: 'WSIB has received your documents. WSIB has not yet made a decision.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    const confirmed = see(w, { ...base, id: 'D-15', op: 'member reads the "pending WSIB action" status', expect: 'stage WSIB_RECEIPT_CONFIRMED; wording says no decision yet', req: ['WA-REQ-063'], find: ['WA-C-001'], view: (x) => memberView(x, MEMBER_P), check: (v) => {
      assert.equal(v?.status.stage, 'WSIB_RECEIPT_CONFIRMED');
      assert.match(v?.status.text ?? '', /not yet made a decision/);
    } });
    w = must(openWait(w, SPEC_1, { id: asDependencyId('DEP-ARO'), matterId: MATTER, claimId: CLAIM_X, kind: 'ARO_DECISION', waitingSince: '2026-12-16', expectedWindowDays: null }));
    w = act(w, { ...base, id: 'D-16', op: 'professional publishes a decision stage that states the outcome', p: SPEC_1, persona: 'DOMENIC', expect: 'EVIDENCE_DOES_NOT_SUPPORT_STAGE', req: ['WA-REQ-063'], find: ['WA-R1-14', 'WA-R4-08'], mx: ['WA-T085'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'ARO_DECISION_RECEIVED', text: 'Your appeal was denied.', evidence: { kind: 'DEPENDENCY', id: asDependencyId('DEP-ARO') } }) });
    w = must(recordAroDecision(w, SPEC_1, { id: asDependencyId('DEP-ARO'), receivedOn: '2027-02-01', outcome: 'ADVERSE', finalDecisionDocumentId: asDocumentId('FAKE-DOC-FINAL'), assessmentId: 'TA-1' }));
    w = act(w, { ...base, id: 'D-17', op: 'professional states the outcome in a status line after the decision arrived', p: SPEC_1, persona: 'DOMENIC', expect: 'MISREPRESENTS_PROGRESS', req: ['WA-REQ-111'], find: ['WA-C-003'], mx: ['WA-T111'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'ARO_DECISION_RECEIVED', text: 'Your appeal was denied.', evidence: { kind: 'DEPENDENCY', id: asDependencyId('DEP-ARO') } }) });
    w = act(w, { ...base, id: 'D-18', op: 'professional publishes that a decision arrived and who will explain it', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'STATUS_PUBLISHED', req: ['WA-REQ-063'], find: ['WA-R4-08'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'ARO_DECISION_RECEIVED', text: 'A decision has arrived. Your representative will contact you to explain it.', evidence: { kind: 'DEPENDENCY', id: asDependencyId('DEP-ARO') } }) });
    const decided = see(w, { ...base, id: 'D-19', op: 'member reads the decision stage', expect: 'stage ARO_DECISION_RECEIVED; no outcome, no tribunal prompt or assessment detail', req: ['WA-REQ-063', 'WA-REQ-090'], find: ['WA-R5-05'], mx: ['WA-T085'], view: (x) => memberView(x, MEMBER_P), check: (v) => {
      assert.equal(v?.status.stage, 'ARO_DECISION_RECEIVED');
      const json = JSON.stringify(v);
      for (const banned of ['denied', 'adverse', 'ADVERSE', 'TA-1', 'tribunal', 'NEEDS_PROFESSIONAL']) assert.equal(json.includes(banned), false, banned);
    } });
    assert.deepEqual([sent?.status.stage, confirmed?.status.stage, decided?.status.stage], ['DOCUMENTS_SENT_TO_WSIB', 'WSIB_RECEIPT_CONFIRMED', 'ARO_DECISION_RECEIVED']);
    assert.equal(w.assessments.length, 1, 'a professional prompt exists internally and stays internal');
  });

  it('[WA-J-D] restricted medical material, another member\'s records and historical claims are never reachable', () => {
    let w = withDoc(stageMatter(), 'FAKE-DOC-MED', 'MEDICAL', 'SYNTH-CANARY psychiatric assessment.pdf');
    decide({ ...base, id: 'D-20', op: 'member guesses the id of a restricted medical document', expect: 'NOT_FOUND', req: ['WA-REQ-061'], find: ['WA-R1-03'], mx: ['WA-T019', 'WA-ADV-04'], run: () => readDocument(w, MEMBER_P, asDocumentId('FAKE-DOC-MED')) });
    decide({ ...base, id: 'D-21', op: 'another member opens the same document', p: OTHER_MEMBER_P, persona: 'ADVERSARY', expect: 'NOT_FOUND', req: ['WA-REQ-013'], find: ['WA-R1-02'], mx: ['WA-T020'], run: () => readDocument(w, OTHER_MEMBER_P, asDocumentId('FAKE-DOC-MED')) });
    see(w, { ...base, id: 'D-22', op: 'another member reads a member view', p: OTHER_MEMBER_P, persona: 'ADVERSARY', expect: 'no view', req: ['WA-REQ-013'], find: ['WA-R1-02'], view: (x) => memberView(x, OTHER_MEMBER_P), check: (v) => assert.equal(v, null) });
    see(w, { ...base, id: 'D-23', op: 'member view with a restricted document, two claims and a historical claim on file', expect: 'no title, class, claim number or employer anywhere', req: ['WA-REQ-061', 'WA-REQ-063'], find: ['WA-R1-03', 'WA-R4-01'], mx: ['WA-T023', 'WA-T071'], view: (x) => memberView(x, MEMBER_P), check: (v) => {
      const json = JSON.stringify(v);
      for (const banned of ['SYNTH-CANARY', 'psychiatric', 'MEDICAL', 'FAKE-WSIB', 'EMPLOYER-']) assert.equal(json.includes(banned), false, banned);
    } });
    w = act(w, { ...base, id: 'D-24', op: 'member requests access to the full record outside the portal', expect: 'OK', audit: 'RECORDS_ACCESS_REQUESTED', req: ['WA-REQ-063'], find: ['WA-R1-03'], mx: ['WA-T051'], run: (x) => requestRecordsAccess(x, MEMBER_P, MATTER) });
    assert.deepEqual(w.audit.at(-1)?.details, {}, 'the request carries no document reference or content');
    w = act(w, { ...base, id: 'D-25', op: 'another member opens a records-access request on this matter', p: OTHER_MEMBER_P, persona: 'ADVERSARY', expect: 'NOT_FOUND', req: ['WA-REQ-013'], find: ['WA-R1-02'], run: (x) => requestRecordsAccess(x, OTHER_MEMBER_P, MATTER) });
  });

  it('[WA-J-D] released correspondence is the only document a member can open; the title appears only for what is released', () => {
    let w = withDoc(stageMatter(), 'FAKE-DOC-CORR', 'WSIB_CORRESPONDENCE', 'wsib-letter.pdf');
    w = withDoc(w, 'FAKE-DOC-NOTE', 'RESTRICTED_PROFESSIONAL', 'SYNTH-CANARY strategy note.pdf');
    w = act(w, { ...base, id: 'D-26', op: 'professional releases the correspondence to the member', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'DOCUMENT_RELEASED', req: ['WA-REQ-061'], find: ['WA-R1-03'], run: (x) => releaseDocument(x, SPEC_1, { documentId: asDocumentId('FAKE-DOC-CORR'), audience: { kind: 'MEMBER', memberId: MEMBER_P.subjectMemberId! }, grantId: 'G-CORR', actions: ['VIEW'] }) });
    see(w, { ...base, id: 'D-27', op: 'member lists documents', expect: 'only the released correspondence', req: ['WA-REQ-061'], find: ['WA-R1-03'], mx: ['WA-T023'], view: (x) => memberView(x, MEMBER_P), check: (v) => {
      assert.deepEqual(v?.documents.map((d) => d.title), ['wsib-letter.pdf']);
      assert.equal(JSON.stringify(v).includes('SYNTH-CANARY'), false);
    } });
    void [world0, withMember, offered, accepted, withClaims, withObjection, itoApproved, itoSent, stageSent];
  });

  it('[WA-J-D] English and French content contract: French is required only if policy says so, is shown only if it exists, and carries no quality claim', () => {
    let w = stageSent({ bilingualRequired: true });
    w = act(w, { ...base, id: 'D-28', op: 'publish English-only when policy requires French', p: SPEC_1, persona: 'DOMENIC', expect: 'FR_TEXT_REQUIRED', req: ['WA-REQ-112'], find: ['WA-R1-19', 'WA-R6-04'], mx: ['WA-T112'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'DOCUMENTS_SENT_TO_WSIB', text: 'Your documents were sent to WSIB.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    w = act(w, { ...base, id: 'D-29', op: 'publish with a French text that overstates progress', p: SPEC_1, persona: 'DOMENIC', expect: 'MISREPRESENTS_PROGRESS', req: ['WA-REQ-112'], mx: ['WA-T112'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'DOCUMENTS_SENT_TO_WSIB', text: 'Your documents were sent to WSIB.', textFr: 'Votre opposition a été acceptée.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    w = act(w, { ...base, id: 'D-30', op: 'publish both languages', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'STATUS_PUBLISHED', req: ['WA-REQ-112'], mx: ['WA-T112'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'DOCUMENTS_SENT_TO_WSIB', text: 'Your documents were sent to WSIB.', textFr: 'Vos documents ont été envoyés à WSIB.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    see(w, { ...base, id: 'D-31', op: 'member reads in French', expect: 'French text, locale fr', req: ['WA-REQ-112'], mx: ['WA-T112'], view: (x) => memberView(x, MEMBER_P, 'fr'), check: (v) => assert.deepEqual([v?.status.locale, v?.status.text], ['fr', 'Vos documents ont été envoyés à WSIB.']) });
    see(w, { ...base, id: 'D-32', op: 'member reads in English', expect: 'English text, locale en', req: ['WA-REQ-112'], mx: ['WA-T112'], view: (x) => memberView(x, MEMBER_P, 'en'), check: (v) => assert.deepEqual([v?.status.locale, v?.status.text], ['en', 'Your documents were sent to WSIB.']) });
    assert.equal(w.publications[0]?.translationStatus, 'UNREVIEWED', 'no translation or reading-level quality is claimed');
  });
});
