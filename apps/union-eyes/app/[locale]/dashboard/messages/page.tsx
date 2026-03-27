'use client';

import { useState } from 'react';
import { MessagesDashboard } from '@/components/messages/MessagesDashboard';
import { MessageThreadView } from '@/components/messages/MessageThreadView';

export const dynamic = 'force-dynamic';

export default function MessagesDashboardPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  return (
    <div className="container mx-auto py-8">
      {selectedThreadId ? (
        <MessageThreadView
          threadId={selectedThreadId}
          onBack={() => setSelectedThreadId(null)}
        />
      ) : (
        <MessagesDashboard onSelectThread={setSelectedThreadId} />
      )}
    </div>
  );
}
