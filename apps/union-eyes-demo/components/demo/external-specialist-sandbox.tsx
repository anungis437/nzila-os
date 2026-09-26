'use client';

import { useState } from 'react';
import {
  DEFAULT_HANDOFF_QUEUE_CONFIG,
  createOfferedHandoff,
  isActiveInSpecialistQueue,
  transitionHandoff,
  type HandoffAction,
  type HandoffPackage,
  type HandoffQueueConfig,
} from '@/lib/demo/sandbox/handoff';
import { projectSandboxForPersona } from '@/lib/demo/sandbox/journey';
import { SANDBOX_PERSONAS, SANDBOX_USER_IDS, type SandboxPersonaId } from '@/lib/demo/sandbox/personas';
import { buildSandboxSeed } from '@/lib/demo/sandbox/seed';

const SEED = buildSandboxSeed();

export function ExternalSpecialistSandbox({
  config = DEFAULT_HANDOFF_QUEUE_CONFIG,
}: {
  config?: HandoffQueueConfig;
}) {
  const [personaId, setPersonaId] = useState<SandboxPersonaId>('external_specialist');
  const [handoff, setHandoff] = useState<HandoffPackage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const projection = projectSandboxForPersona({
    seed: SEED,
    personaId,
    handoff,
    config,
  });

  function offer() {
    setHandoff(createOfferedHandoff({ seed: SEED }));
    setNotice('Access package offered. Responsibility stays with the institutional home.');
  }

  function act(action: HandoffAction) {
    if (!handoff) {
      setNotice('Offer an access package before changing handoff state.');
      return;
    }
    const actorUserId =
      personaId === 'external_specialist'
        ? SANDBOX_USER_IDS.externalSpecialist
        : SANDBOX_USER_IDS.institutionalAdmin;
    const result = transitionHandoff(handoff, action, actorUserId);
    if (!result.ok) {
      setNotice(result.reason);
      return;
    }
    setHandoff(result.handoff);
    setNotice(`Handoff is ${result.handoff.state}. View access is not a transfer of responsibility.`);
  }

  const queueActive = isActiveInSpecialistQueue(handoff, config);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 880 }}>
      <p
        role="status"
        data-testid="sandbox-banner"
        style={{
          margin: 0,
          padding: '10px 12px',
          background: '#12324a',
          color: '#f4ecd8',
          borderRadius: 6,
        }}
      >
        {projection.banner}
      </p>

      <div role="tablist" aria-label="Synthetic personas" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SANDBOX_PERSONAS.map((persona) => (
          <button
            key={persona.id}
            type="button"
            role="tab"
            aria-selected={personaId === persona.id}
            data-testid={`persona-${persona.id}`}
            onClick={() => {
              setPersonaId(persona.id);
              setNotice(null);
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: personaId === persona.id ? '2px solid #12324a' : '1px solid #cbd5e1',
              background: personaId === persona.id ? '#e8eef3' : '#fff',
            }}
          >
            {persona.roleLabel}
          </button>
        ))}
      </div>

      <p style={{ margin: 0 }}>{projection.accessNotResponsibility}</p>
      <p style={{ margin: 0 }} data-testid="handoff-anti-claim">
        {projection.handoffAntiClaim}
      </p>
      <p style={{ margin: 0 }} data-testid="handoff-state">
        Handoff: {projection.handoffState ?? 'not offered'}
        {config.requireAcknowledgementBeforeActiveQueue
          ? ' · acknowledgement required before the specialist queue is active'
          : ' · acknowledgement is optional for the specialist queue'}
      </p>
      <p style={{ margin: 0 }} data-testid="specialist-queue">
        Specialist queue: {queueActive ? 'active for this matter' : 'not active'}
      </p>

      {personaId === 'institutional_admin' && (
        <section aria-label="Institutional admin">
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Institutional admin</h2>
          <p style={{ marginTop: 0 }}>
            {projection.matterTitle} · offer an access package tied to the representation grant.
          </p>
          <ul>
            {projection.adminGrantLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button type="button" onClick={offer} data-testid="offer-handoff">
            Offer access package
          </button>
        </section>
      )}

      {personaId === 'external_specialist' && (
        <section aria-label="External specialist journey">
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>External specialist</h2>
          <ol style={{ display: 'grid', gap: 8, paddingLeft: 18 }}>
            {projection.steps.map((step) => (
              <li key={step.id} data-testid={`journey-step-${step.id}`}>
                <strong>{step.label}.</strong> {step.detail}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => act('acknowledge')}
            data-testid="acknowledge-view"
            disabled={!handoff || handoff.state === 'ACCEPTED_VIEW'}
          >
            Acknowledge view access
          </button>
        </section>
      )}

      {personaId === 'union_viewer' && (
        <section aria-label="Union viewer">
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Union viewer</h2>
          <p>{projection.viewerSummary}</p>
        </section>
      )}

      {personaId === 'member' && (
        <section aria-label="Member limited status">
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Member</h2>
          <p data-testid="member-status">{projection.memberStatus}</p>
        </section>
      )}

      <section aria-label="Handoff states">
        <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Handoff acknowledgement</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" onClick={() => act('return')} data-testid="handoff-return">
            Mark returned
          </button>
          <button type="button" onClick={() => act('await_external')} data-testid="handoff-await">
            Mark awaiting external
          </button>
          <button type="button" onClick={() => act('reject')} data-testid="handoff-reject">
            Mark rejected
          </button>
          <button type="button" onClick={() => act('clarify')} data-testid="handoff-clarify">
            Mark clarify
          </button>
        </div>
      </section>

      <section aria-label="Claim label">
        <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Claim label</h2>
        <p data-testid="sample-brief" style={{ margin: 0 }}>
          Incoming brief (fail-closed): {projection.sampleBrief}
        </p>
        <p style={{ margin: '8px 0 0' }}>
          No practice-system connector is attached. Disposition: {projection.disposition}. Queue default requires acknowledgement: {String(DEFAULT_HANDOFF_QUEUE_CONFIG.requireAcknowledgementBeforeActiveQueue)}.
        </p>
      </section>

      {notice && (
        <p role="status" data-testid="sandbox-notice">
          {notice}
        </p>
      )}
    </div>
  );
}
