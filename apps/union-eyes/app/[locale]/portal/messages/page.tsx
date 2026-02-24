/**
 * Messages Page
 * Main page for member messaging system
 */
'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { MessagesDashboard } from '@/components/messages/MessagesDashboard';
import { MessageThreadView } from '@/components/messages/MessageThreadView';

export default function MessagesPage() {
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
