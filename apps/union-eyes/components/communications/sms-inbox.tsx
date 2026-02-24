/**
 * SMS Inbox Component (Phase 5 - Week 1)
 * Two-way SMS conversation management
 * 
 * Features:
 * - List inbound SMS messages
 * - Reply to messages
 * - Mark as read/archived
 * - Filter by status, date, phone number
 * - Real-time updates
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  Send,
  Archive,
  CheckCircle,
  Phone,
  Clock,
  Search,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SmsInboxProps {
  organizationId: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  direction: 'inbound' | 'outbound';
  message: string;
  status: string;
  createdAt: string;
  readAt?: string;
  userId?: string;
}

export function SmsInbox({ organizationId }: SmsInboxProps) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [_isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Load conversations
  useEffect(() => {
    const loadData = async () => {
      await loadConversations();
    };
    loadData();
    // Poll for new messages every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const loadConversations = async () => {
    try {
      const response = await fetch(`/api/communications/sms/conversations?organizationId=${organizationId}`);
      if (!response.ok) throw new Error('Failed to load conversations');
      const { conversations } = await response.json();
      setConversations(conversations || []);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mark as read
  const markAsRead = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/communications/sms/conversations/${conversationId}/read`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, status: 'read', readAt: new Date().toISOString() } : c
        )
      );
    } catch (_error) {
}
  };

  // Send reply
  const handleReply = async () => {
    if (!selectedConversation || !replyMessage.trim()) return;

    const conversation = conversations.find((c) => c.id === selectedConversation);
    if (!conversation) return;

    setIsSending(true);

    try {
      const response = await fetch('/api/communications/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          organizationId,
          phoneNumber: conversation.phoneNumber,
          message: replyMessage,
        }),
      });

      if (!response.ok) throw new Error('Failed to send reply');

      toast({
        title: 'Success',
        description: 'Reply sent successfully',
      });

      setReplyMessage('');
      loadConversations();
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to send reply',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Archive conversation
  const handleArchive = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/communications/sms/conversations/${conversationId}/archive`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to archive conversation');
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status: 'archived' } : c))
      );

      toast({
        title: 'Success',
        description: 'Conversation archived',
      });
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to archive conversation',
        variant: 'destructive',
      });
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.phoneNumber.includes(searchQuery) ||
      c.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Left Column: Conversation List */}
      <div className="md:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Inbox
            </CardTitle>
            <CardDescription>
              {filteredConversations.length} conversation
              {filteredConversations.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'received' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('received')}
              >
                Unread
              </Button>
              <Button
                variant={statusFilter === 'read' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('read')}
              >
                Read
              </Button>
            </div>

            {/* Conversation List */}
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`cursor-pointer rounded-lg border p-3 hover:bg-muted transition-colors ${
                      selectedConversation === conv.id ? 'bg-muted border-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedConversation(conv.id);
                      if (conv.status === 'received') {
                        markAsRead(conv.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{conv.phoneNumber}</span>
                      </div>
                      {conv.status === 'received' && (
                        <Badge variant="default" className="text-xs">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {conv.message}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}

                {filteredConversations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No conversations found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Conversation Detail */}
      <div className="md:col-span-2">
        {selectedConv ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    {selectedConv.phoneNumber}
                  </CardTitle>
                  <CardDescription>
                    {formatDistanceToNow(new Date(selectedConv.createdAt), { addSuffix: true })}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchive(selectedConv.id)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                  {selectedConv.status === 'received' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsRead(selectedConv.id)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark Read
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Message Thread */}
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium mb-1">
                        {selectedConv.direction === 'inbound' ? 'From Member' : 'From Union'}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{selectedConv.message}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(selectedConv.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Check for STOP message */}
                {selectedConv.message.toLowerCase().includes('stop') && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <Archive className="h-4 w-4" />
                      <span className="font-medium">Opt-Out Request</span>
                    </div>
                    <p className="text-sm mt-2">
                      This member has requested to opt out of SMS communications. They have been
                      automatically added to the opt-out list.
                    </p>
                  </div>
                )}
              </div>

              {/* Reply Form */}
              {!selectedConv.message.toLowerCase().includes('stop') && (
                <div className="space-y-2">
                  <Label htmlFor="reply">Send Reply</Label>
                  <div className="flex gap-2">
                    <Input
                      id="reply"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleReply();
                        }
                      }}
                    />
                    <Button onClick={handleReply} disabled={isSending || !replyMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Press Enter to send â€¢ {replyMessage.length} / 160 characters
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Conversation Selected</h3>
              <p className="text-sm text-muted-foreground text-center">
                Select a conversation from the list to view messages and reply
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

