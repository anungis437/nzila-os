import React, { type ReactNode } from 'react'
import type { OperatorInstitutionalWorkflowView } from '../../lib/operator-workflow/view'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '0.7rem' }}>
      <dt style={{ fontWeight: 600 }}>{label}</dt>
      <dd style={{ marginLeft: 0, overflowWrap: 'anywhere' }}>{children}</dd>
    </div>
  )
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ borderTop: '1px solid #cbd5e1', padding: '1rem 0' }}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}
export function OperatorWorkflow({
  view,
  availableRunIds = [],
}: {
  view: OperatorInstitutionalWorkflowView
  availableRunIds?: string[]
}) {
  if (view.access === 'DENIED')
    return (
      <article aria-label="Workflow unavailable">
        <h1>Workflow unavailable</h1>
        <p role="alert">{view.message}</p>
        <p>No evidence or requirement details are available in this context.</p>
      </article>
    )
  return (
    <article
      aria-label="Synthetic institutional workflow"
      style={{
        maxWidth: '58rem',
        margin: '0 auto',
        padding: '1.5rem',
        color: '#172033',
        background: '#fff',
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.6,
        overflowWrap: 'anywhere',
      }}
    >
      <header>
        <p>
          <strong>
            Synthetic reference experience — no live source or institutional decision service
          </strong>
        </p>
        <h1>Understand this evidence workflow</h1>
        <p>Cora can interpret; authorized institutions determine.</p>
        <p role="status">
          <strong>{view.lifecycleMessage}</strong>: {view.statusReason}
        </p>
        {view.currentCheckState === 'EXPIRED' && (
          <p>
            Current validity: <strong>EXPIRED</strong>. The earlier technical result has not been
            changed.
          </p>
        )}
        <p>
          {view.actionable
            ? 'Use is permitted for the named context only.'
            : 'Do not act on this historical or restricted result.'}
        </p>
      </header>
      <Section title="Overview">
        <dl>
          <Fact label="Institution">{view.institution}</Fact>
          <Fact label="Purpose">{view.purpose}</Fact>
          <Fact label="Current permission">
            {view.permissions.status === 'ALLOWED'
              ? 'Authorized for the named recipient and purpose.'
              : 'Use is not currently authorized.'}
          </Fact>
          <Fact label="Evidence currentness">
            {view.freshness.message} <span>({view.freshness.state})</span>
          </Fact>
          <Fact
            label={view.technical.historical ? 'Historical technical result' : 'Technical result'}
          >
            {view.technical.message}
          </Fact>
          <Fact label="Recipient decision status">
            {view.decision.reference
              ? 'An external decision reference is recorded; Cora has not inferred its outcome.'
              : 'No recipient decision reference is recorded. A technical match is not a decision.'}
          </Fact>
        </dl>
      </Section>
      <Section title="Evidence and authority">
        <dl>
          <Fact label="Evidence identity">
            {view.evidence.reference.id} / {view.evidence.reference.version}
          </Fact>
          <Fact label="Evidence class">{view.evidence.class}</Fact>
          <Fact label="Source system / provider">{view.evidence.provider}</Fact>
          <Fact label="Issuer / source authority">{view.evidence.issuer}</Fact>
          <Fact label="Cora processing">
            Technical interpretation and governed workflow support only. Cora is not the issuer or
            recipient decision authority.
          </Fact>
          <Fact label="Requirement owner">{view.requirement.owner}</Fact>
          <Fact label="Recipient decision authority">{view.decision.owner}</Fact>
          <Fact label="Provenance">{view.evidence.provenanceRef}</Fact>
          <Fact label="Source observation time">{view.evidence.observedAt ?? 'Unknown'}</Fact>
          <Fact label="Evidence validity">
            {view.evidence.validFrom ?? 'Unknown'} to {view.evidence.validUntil ?? 'Unknown'}
          </Fact>
          <Fact label="Currentness verification time">
            {view.freshness.verifiedAt ?? 'No current verification time established'}
          </Fact>
        </dl>
        <h3>Known limitations</h3>
        <ul>
          {view.evidence.limitations.map((limitation, index) => (
            <li key={index}>{limitation}</li>
          ))}
        </ul>
      </Section>
      <Section title="Permissions">
        <dl>
          <Fact label="Permitted recipient">{view.permissions.recipient}</Fact>
          <Fact label="Permitted purpose">{view.permissions.purpose}</Fact>
          <Fact label="Authorization expiry">
            {view.permissions.expiresAt ?? 'Not established — no unlimited-use right is inferred'}
          </Fact>
          <Fact label="Revocation time">
            {view.permissions.revokedAt ?? 'No revocation recorded'}
          </Fact>
        </dl>
        <ul>
          {view.permissions.actions.map((action) => (
            <li key={action.label}>
              {action.label}:{' '}
              {action.allowed ? 'Permitted in this context' : 'Not permitted or not established'}
            </li>
          ))}
        </ul>
        <p>
          Permission to disclose does not grant permission to keep, export or restore source
          content.
        </p>
        <details>
          <summary>Technical permission details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(
              {
                recipient: view.permissions.rawRecipient,
                source: view.permissions.rawSource,
                reasons: view.permissions.reasons,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </Section>
      <Section title="Requirement">
        <dl>
          <Fact label="Requirement owner">{view.requirement.owner}</Fact>
          <Fact label="Requirement identity">
            {view.requirement.reference.id} / {view.requirement.reference.version}
          </Fact>
          <Fact label="Interpretation">
            {view.requirement.interpretation.id} / {view.requirement.interpretation.version}
          </Fact>
        </dl>
        <h3>
          {view.technical.historical ? 'Criteria at the historical check' : 'Required criteria'}
        </h3>
        <ul>
          {view.technical.criteria.map((criterion) => (
            <li key={criterion.ref}>
              {criterion.ref}:{' '}
              {criterion.state === 'MATCHED'
                ? 'Technically met'
                : criterion.state === 'MISSING'
                  ? 'Additional evidence needed'
                  : criterion.state === 'CONFLICT'
                    ? 'Conflicting assertions'
                    : criterion.state === 'NOT_MET'
                      ? 'Not met under this requirement'
                      : 'Meaning or authorization unresolved'}
            </li>
          ))}
        </ul>
        {view.technical.unresolvedSemantics.length > 0 && (
          <>
            <h3>Unresolved limitations</h3>
            <ul>
              {view.technical.unresolvedSemantics.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
        {view.technical.conflicts.length > 0 && (
          <div role="note" aria-label="Unresolved source conflict">
            <h3>Sources disagree — no winner selected</h3>
            <p>
              Cora has not selected a winner. The named issuers must correct or clarify their
              assertions; the recipient’s authorized review process must determine how to proceed.
            </p>
            {view.technical.conflicts.map((conflict) => (
              <div key={conflict.criterion}>
                <h4>{conflict.criterion}</h4>
                <ul>
                  {conflict.assertions.map((assertion) => (
                    <li key={`${assertion.evidenceId}:${assertion.issuer}`}>
                      Evidence {assertion.evidenceId} / {assertion.version}; source{' '}
                      {assertion.provider}; issuer {assertion.issuer}; claim{' '}
                      {JSON.stringify(assertion.value)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Reuse">
        <p>
          {view.reuse.qualification === 'QUALIFIED_REUSE'
            ? view.reuse.historical
              ? 'This evidence was reused in an earlier authorized context. That historical use does not authorize new use.'
              : 'This evidence was reused from an earlier governed context.'
            : view.reuse.qualification === 'NOT_EVALUATED'
              ? 'No cross-institutional reuse has been established for this run.'
              : 'This attempt does not qualify as governed evidence reuse.'}
        </p>
        <dl>
          <Fact label="Originating context">{view.reuse.originContext ?? 'None established'}</Fact>
          <Fact label="Consuming context">{view.reuse.consumingContext}</Fact>
          <Fact label="Reconstruction avoided">
            {view.reuse.reconstructionAvoided
              ? 'Established for the recorded synthetic use'
              : 'Not established'}
          </Fact>
          <Fact label="Reuse authorization">
            {view.permissions.status === 'ALLOWED' && !view.reuse.historical
              ? 'Named context only'
              : 'Historical or restricted — not permission for further reuse'}
          </Fact>
        </dl>
        {view.reuse.noNewRetrieval && (
          <p>No new source retrieval was required for the recorded synthetic reuse.</p>
        )}
        <p>
          Additional institutional verification is still required under the recipient’s own process.
        </p>
        {view.reuse.reasons.length > 0 && (
          <ul>
            {view.reuse.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <details>
          <summary>Technical reuse and friction details</summary>
          <p>Local synthetic action counts, not productivity or marketing KPIs.</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(view.metrics, null, 2)}
          </pre>
        </details>
      </Section>
      <Section title="Decision">
        <h3>
          {view.technical.historical ? 'Historical Cora technical check' : 'Cora technical check'}
        </h3>
        <p>{view.technical.message}</p>
        <h3>Recipient-owned decision</h3>
        <p>
          Cora does not own the institutional decision. A technical result is not approval,
          certification, eligibility, funding or procurement qualification.
        </p>
        <dl>
          <Fact label="Decision owner">{view.decision.owner}</Fact>
          <Fact label="External disposition reference">
            {view.decision.reference ?? 'Awaiting a recipient-owned reference; no outcome inferred'}
          </Fact>
          <Fact label="Recipient record time">{view.decision.at ?? 'Not recorded'}</Fact>
        </dl>
      </Section>
      <Section title="Lineage">
        <dl>
          <Fact label="Workflow run">{view.runId}</Fact>
        </dl>
        {view.successorRunIds.length > 0 && (
          <>
            <h3>Authorized successor runs</h3>
            <ul>
              {view.successorRunIds.map((id) => (
                <li key={id}>
                  {availableRunIds.includes(id) ? (
                    <a href={`#run-${encodeURIComponent(id)}`}>{id}</a>
                  ) : (
                    <span>{id} (not included in this reference collection)</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <ol>
          {view.lineage.map((entry) => (
            <li key={entry.auditId}>
              <strong>
                {entry.prior ?? 'Start'} → {entry.next}
              </strong>
              ; <time dateTime={entry.at}>{entry.at}</time>; evidence {entry.evidence.id} /{' '}
              {entry.evidence.version}; requirement {entry.requirement.id} /{' '}
              {entry.requirement.version}; reason {entry.reason}
            </li>
          ))}
        </ol>
        <details>
          <summary>Canonical states and audit references</summary>
          <dl>
            <Fact label="Canonical lifecycle">{view.lifecycle}</Fact>
            <Fact label="Canonical resolution">{view.technical.state}</Fact>
            <Fact label="Resolution time">
              {view.technical.evaluatedAt ?? 'No completed resolution recorded'}
            </Fact>
            <Fact label="Reuse qualification">{view.reuse.qualification}</Fact>
            <Fact label="Provenance digest">{view.evidence.provenanceDigest}</Fact>
            <Fact label="Capsule reference">{view.evidence.capsuleRef}</Fact>
          </dl>
          <ul>
            {view.lineage.map((entry) => (
              <li key={entry.auditId}>{entry.auditId}</li>
            ))}
          </ul>
        </details>
      </Section>
    </article>
  )
}
