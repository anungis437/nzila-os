/**
 * Dashboard AI Assistant Page
 * Wraps the AI Chatbot component within the dashboard layout shell.
 *
 * GATED: Requires the `ai_steward_copilot` feature flag to be enabled for
 * the user's organization. The underlying API routes enforce the same gate,
 * but checking here surfaces a clear "not available" message instead of
 * silent API failures.
 */
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { isFeatureEnabled, AI_FEATURES } from '@/lib/services/feature-flags';
import { AIChatbot } from '@/components/ai/ai-chatbot';

export const dynamic = 'force-dynamic';

export default async function DashboardAIAssistantPage() {
  const user = await requireUser();
  const enabled = await isFeatureEnabled(AI_FEATURES.STEWARD_COPILOT, {
    userId: user.userId,
    organizationId: user.organizationId ?? undefined,
  });

  if (!enabled) {
    redirect('/dashboard');
  }

  return (
    <div className="h-full overflow-hidden">
      <AIChatbot />
    </div>
  );
}
