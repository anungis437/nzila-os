/**
 * Message Thread View Component
 * Display and interact with a single message thread
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Paperclip, ArrowLeft, CheckCheck, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: string;
  messageType: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  status: string;
  readAt?: string;
  createdAt: string;
}

interface Thread {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  memberId: string;
  staffId: string | null;
  createdAt: string;
}

interface MessageThreadViewProps {
  threadId: string;
  onBack: () => void;
}

export function MessageThreadView({ threadId, onBack }: MessageThreadViewProps) {
  const { user } = useUser();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchThread();
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchThread, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThread = async () => {
    try {
      const response = await fetch(`/api/messages/threads/${threadId}`);
      if (!response.ok) throw new Error('Failed to fetch thread');

      const data = await response.json();
      setThread(data.thread);
      setMessages(data.messages);
    } catch (_error) {
toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) {
      toast.error('Please enter a message or select a file');
      return;
    }

    try {
      setSending(true);

      let response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('content', newMessage);

        response = await fetch(`/api/messages/threads/${threadId}/messages`, {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch(`/api/messages/threads/${threadId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage }),
        });
      }

      if (!response.ok) throw new Error('Failed to send message');

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchThread();
      toast.success('Message sent');
    } catch (_error) {
toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large (max 10MB)');
        return;
      }
      setSelectedFile(file);
      toast.success(`File selected: ${file.name}`);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading conversation...</div>;
  }

  if (!thread) {
    return <div className="text-center py-12">Thread not found</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{thread.subject}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{thread.status}</Badge>
            <Badge variant="outline">{thread.priority}</Badge>
            <span className="text-sm text-muted-foreground capitalize">
              {thread.category}
            </span>
          </div>
        </div>
      </div>

      <Card className="flex flex-col h-[600px]">
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => {
            const isOwnMessage = message.senderId === user?.id;
            return (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-3',
                  isOwnMessage ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {message.senderRole === 'staff' ? 'ST' : 'ME'}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'max-w-[70%] rounded-lg p-3',
                    isOwnMessage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {message.senderRole === 'staff' ? 'Staff' : 'You'}
                    </span>
                    <span className="text-xs opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.fileUrl && (
                    <a
                      href={message.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline mt-2 block"
                    >
                      ðŸ“Ž {message.fileName}
                    </a>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {isOwnMessage && (
                      message.status === 'read' ? (
                        <CheckCheck className="h-3 w-3 opacity-70" />
                      ) : (
                        <Check className="h-3 w-3 opacity-70" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4">
          {selectedFile && (
            <div className="mb-2 p-2 bg-muted rounded text-sm">
              ðŸ“Ž {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="ml-2"
              >
                Remove
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Attach file"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 min-h-[60px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button onClick={sendMessage} disabled={sending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}

