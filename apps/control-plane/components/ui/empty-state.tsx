import { Inbox } from "lucide-react";
import { EmptyState as CanonicalEmptyState } from "@nzila/ui";

// Adapter: preserves the existing `{title, message}` API while delegating
// rendering to canonical @nzila/ui EmptyState. Keeps the default Inbox icon
// that 17 control-plane pages rely on.
interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <CanonicalEmptyState
      title={title}
      description={message}
      icon={<Inbox className="h-8 w-8" aria-hidden="true" />}
    />
  );
}
