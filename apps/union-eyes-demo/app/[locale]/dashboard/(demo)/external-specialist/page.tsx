/**
 * Synthetic external-specialist sandbox.
 *
 * Renders without a counterpart login so the journey can be walked on
 * fixture data. Passwords are not shown and are not sent.
 */
import type { Metadata } from 'next';
import { ExternalSpecialistSandbox } from '@/components/demo/external-specialist-sandbox';
import { SANDBOX_BANNER } from '@/lib/demo/sandbox/claim-labels';
import { readHandoffQueueConfig } from '@/lib/demo/sandbox/handoff';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'External specialist sandbox',
  description: SANDBOX_BANNER,
};

export default function ExternalSpecialistSandboxPage() {
  return (
    <article>
      <h1 style={{ fontSize: 28, marginTop: 0 }}>External specialist</h1>
      <ExternalSpecialistSandbox config={readHandoffQueueConfig()} />
    </article>
  );
}
