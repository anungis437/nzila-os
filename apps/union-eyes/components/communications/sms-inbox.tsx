/**
 * SMS Inbox Component
 *
 * The SMS conversation records the organization holds, read-only. This release has no way to reply to a text, to mark a conversation read
 * or to archive it: no sender exists, and the conversation table is not one the application may update (it may only read and insert).
 * So the inbox lists and searches what is stored and offers none of those actions. Opt-outs are not recorded automatically either, and
 * it says so rather than claiming a member "has been added to the opt-out list".
 */

'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, MessageSquare, Phone, Clock, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ApiShapeError, envelopeRows, isRecord, readApiError } from '@/lib/client/api-envelope';

const COPY = {
  en: {
    title: 'Inbox',
    conversation: 'conversation',
    conversations: 'conversations',
    search: 'Search by phone or message...',
    all: 'All',
    unread: 'Unread',
    read: 'Read',
    isNew: 'New',
    none: 'No conversations found',
    fromMember: 'From Member',
    fromUnion: 'From Union',
    noneSelected: 'No Conversation Selected',
    noneSelectedHelp: 'Select a conversation from the list to read it',
    loadFailed: 'The conversations could not be loaded.',
    retry: 'Try again',
    unavailableTitle: 'Replying, marking as read and archiving are not available in this release',
    unavailableBody: 'This inbox shows the conversation records that are stored. It cannot send a reply or change a conversation.',
    optOutTitle: 'Possible opt-out request',
    optOutBody: 'This message looks like a request to stop receiving texts. Opt-outs are not recorded automatically in this release, so this member’s request must be handled by hand.',
  },
  fr: {
    title: 'Boîte de réception',
    conversation: 'conversation',
    conversations: 'conversations',
    search: 'Rechercher par numéro ou message...',
    all: 'Toutes',
    unread: 'Non lues',
    read: 'Lues',
    isNew: 'Nouveau',
    none: 'Aucune conversation trouvée',
    fromMember: 'De la part du membre',
    fromUnion: 'De la part du syndicat',
    noneSelected: 'Aucune conversation sélectionnée',
    noneSelectedHelp: 'Sélectionnez une conversation dans la liste pour la lire',
    loadFailed: 'Les conversations n’ont pas pu être chargées.',
    retry: 'Réessayer',
    unavailableTitle: 'La réponse, le marquage comme lu et l’archivage ne sont pas disponibles dans cette version',
    unavailableBody: 'Cette boîte de réception affiche les conversations enregistrées. Elle ne peut ni envoyer de réponse ni modifier une conversation.',
    optOutTitle: 'Demande de désabonnement possible',
    optOutBody: 'Ce message ressemble à une demande de ne plus recevoir de textos. Les désabonnements ne sont pas enregistrés automatiquement dans cette version; la demande de ce membre doit être traitée manuellement.',
  },
} as const;

interface Conversation {
  id: string;
  phoneNumber: string;
  direction: string;
  message: string;
  status: string;
  createdAt: string;
}

/** A conversation record of GET /api/communications/sms/conversations; a record without its text, number and time is refused, not shown blank. */
function conversationFrom(row: unknown): Conversation {
  if (
    !isRecord(row) ||
    typeof row.id !== 'string' ||
    typeof row.phoneNumber !== 'string' ||
    typeof row.message !== 'string' ||
    typeof row.createdAt !== 'string' ||
    Number.isNaN(new Date(row.createdAt).getTime())
  ) {
    throw new ApiShapeError('not a conversation');
  }
  return {
    id: row.id,
    phoneNumber: row.phoneNumber,
    direction: typeof row.direction === 'string' ? row.direction : 'inbound',
    message: row.message,
    status: typeof row.status === 'string' ? row.status : 'received',
    createdAt: row.createdAt,
  };
}

/** A whole message that is one of the standard stop words. */
const OPT_OUT = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|arr[eê]t)\s*[.!]?\s*$/i;

export function SmsInbox() {
  const copy = useLocale().toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Load conversations, and again every 30 seconds
  useEffect(() => {
    let stale = false;
    const load = async () => {
      try {
        const response = await fetch('/api/communications/sms/conversations');
        if (!response.ok) throw new Error(await readApiError(response, copy.loadFailed));
        const rows = envelopeRows(await response.json()).map(conversationFrom);
        if (stale) return;
        setConversations(rows);
        setLoadError(null);
      } catch (error) {
        if (stale) return;
        setLoadError(error instanceof Error && !(error instanceof ApiShapeError) ? error.message : copy.loadFailed);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => {
      stale = true;
      clearInterval(interval);
    };
  }, [copy.loadFailed, reloadTick]);

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
    <div className="space-y-6">
      <div role="status" className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{copy.unavailableTitle}</p>
          <p className="text-sm">{copy.unavailableBody}</p>
          <p className="mt-1 text-xs opacity-80">UE-ACTION-SMS-CONVERSATIONS</p>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => setReloadTick((tick) => tick + 1)}>
            {copy.retry}
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Conversation List */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {copy.title}
              </CardTitle>
              <CardDescription>
                {filteredConversations.length}{' '}
                {filteredConversations.length === 1 ? copy.conversation : copy.conversations}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={copy.search}
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
                  {copy.all}
                </Button>
                <Button
                  variant={statusFilter === 'received' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('received')}
                >
                  {copy.unread}
                </Button>
                <Button
                  variant={statusFilter === 'read' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('read')}
                >
                  {copy.read}
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
                      onClick={() => setSelectedConversation(conv.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{conv.phoneNumber}</span>
                        </div>
                        {conv.status === 'received' && (
                          <Badge variant="default" className="text-xs">
                            {copy.isNew}
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

                  {filteredConversations.length === 0 && !loadError && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>{copy.none}</p>
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
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  {selectedConv.phoneNumber}
                </CardTitle>
                <CardDescription>
                  {formatDistanceToNow(new Date(selectedConv.createdAt), { addSuffix: true })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-muted p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium mb-1">
                        {selectedConv.direction === 'inbound' ? copy.fromMember : copy.fromUnion}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{selectedConv.message}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(selectedConv.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {OPT_OUT.test(selectedConv.message) && (
                  <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive p-4">
                    <p className="font-medium text-destructive">{copy.optOutTitle}</p>
                    <p className="text-sm mt-2">{copy.optOutBody}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-16 w-16 text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{copy.noneSelected}</h3>
                <p className="text-sm text-muted-foreground text-center">{copy.noneSelectedHelp}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
