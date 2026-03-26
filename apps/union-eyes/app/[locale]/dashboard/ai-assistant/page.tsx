/**
 * Dashboard AI Assistant Page
 * Wraps the AI Chatbot component within the dashboard layout shell.
 */
import { AIChatbot } from '@/components/ai/ai-chatbot';

export const dynamic = 'force-dynamic';

export default function DashboardAIAssistantPage() {
  return (
    <div className="h-full overflow-hidden">
      <AIChatbot />
    </div>
  );
}
