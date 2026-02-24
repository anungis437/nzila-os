/**
 * Messages Dashboard Component
 * Main interface for viewing and managing message threads
 */
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageCircle, Send, Plus, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface MessageThread {
  id: string;
  subject: string;
  memberId: string;
  staffId: string | null;
  status: string;
  priority: string;
  category: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
}

interface MessagesDashboardProps {
  onSelectThread?: (threadId: string) => void;
}

export function MessagesDashboard({ onSelectThread }: MessagesDashboardProps = {}) {
  const { user } = useUser();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);

  // New thread form state
  const [newThreadSubject, setNewThreadSubject] = useState('');
  const [newThreadCategory, setNewThreadCategory] = useState('general');
  const [newThreadPriority, setNewThreadPriority] = useState('normal');
  const [newThreadMessage, setNewThreadMessage] = useState('');

  useEffect(() => {
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/messages/threads?${params}`);
      if (!response.ok) throw new Error('Failed to fetch threads');

      const data = await response.json();
      setThreads(data.threads);
    } catch (_error) {
toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const createThread = async () => {
    if (!newThreadSubject.trim() || !newThreadMessage.trim()) {
      toast.error('Subject and message are required');
      return;
    }

    try {
      const response = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newThreadSubject,
          category: newThreadCategory,
          priority: newThreadPriority,
          initialMessage: newThreadMessage,
          organizationId: user?.publicMetadata?.organizationId || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create thread');

      const { thread } = await response.json();
      toast.success('Message thread created');
      setIsNewThreadOpen(false);
      setNewThreadSubject('');
      setNewThreadMessage('');
      setNewThreadCategory('general');
      setNewThreadPriority('normal');
      fetchThreads();
      onSelectThread?.(thread.id);
    } catch (_error) {
toast.error('Failed to create message thread');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'normal': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'default';
      case 'resolved': return 'secondary';
      case 'closed': return 'outline';
      default: return 'secondary';
    }
  };

  const filteredThreads = threads.filter(thread =>
    thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">
            Communicate with union staff and support
          </p>
        </div>

        <Dialog open={isNewThreadOpen} onOpenChange={setIsNewThreadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
              <DialogDescription>
                Send a message to union staff or support team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={newThreadSubject}
                  onChange={(e) => setNewThreadSubject(e.target.value)}
                  placeholder="What is this about?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={newThreadCategory} onValueChange={setNewThreadCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Inquiry</SelectItem>
                      <SelectItem value="grievance">Grievance</SelectItem>
                      <SelectItem value="dues">Dues & Payments</SelectItem>
                      <SelectItem value="benefits">Benefits</SelectItem>
                      <SelectItem value="technical">Technical Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={newThreadPriority} onValueChange={setNewThreadPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={newThreadMessage}
                  onChange={(e) => setNewThreadMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsNewThreadOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createThread}>
                  <Send className="mr-2 h-4 w-4" />
                  Send Message
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Conversations</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="pl-9 w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading messages...
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <p>No messages found</p>
              <p className="text-sm mt-2">Start a new conversation to get help</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => onSelectThread?.(thread.id)}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{thread.subject}</h3>
                        {thread.unreadCount > 0 && (
                          <Badge variant="default" className="text-xs">
                            {thread.unreadCount} new
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant={getPriorityColor(thread.priority)}>
                          {thread.priority}
                        </Badge>
                        <Badge variant={getStatusColor(thread.status)}>
                          {thread.status}
                        </Badge>
                        <span className="capitalize">{thread.category}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(thread.lastMessageAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

