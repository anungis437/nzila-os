/**
 * Organizational Rights Intelligence Interface
 *
 * Governance-safe Q&A surface for union rights interpretation, continuity
 * guidance, and organizational memory support. Uses retrieval-augmented
 * generation bounded to the organization's knowledge base.
 *
 * All outputs are interpretive and advisory — human stewardship is always preserved.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, FileText, MoreVertical, Archive, ClipboardList, Scale, FileSignature, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useLocale } from "next-intl";
import { logger } from "@/lib/logger";
import {
  answerFrom,
  createdSessionFrom,
  messagesFrom,
  sessionsFrom,
  type ChatMessageRecord,
  type ChatSessionRecord,
} from "@/components/ai/chatbot-api";

const COPY = {
  en: {
    errorTitle: "Error",
    sessionsLoadFailed: "Failed to load chat sessions",
    messagesLoadFailed: "Failed to load this conversation",
    sessionCreateFailed: "Failed to create new chat session",
    sendFailed: "Failed to send message. Please try again.",
    archivedTitle: "Session archived",
    archivedBody: "Chat session has been archived",
    archiveFailed: "Failed to archive session",
    history: "Chat History",
    newChat: "New Chat",
    messagesOne: "1 message",
    messagesMany: "{count} messages",
    archive: "Archive",
    sessionsLoading: "Loading chats…",
    sessionsError: "Chats could not be loaded.",
    retry: "Try again",
    noSessions: "No chats yet.",
    assistantTitle: "Union Rights Assistant",
    greeting: "How can I help you today?",
    sources: "Sources:",
    relevant: "{percent}% relevant",
    thinking: "Thinking...",
    placeholder: "Ask a question about your union rights...",
    hint: "Press Enter to send, Shift+Enter for new line",
    send: "Send",
    suggestions: [
      { category: "Grievance", title: "How do I submit an intake?" },
      { category: "Rights", title: "What are my workplace rights?" },
      { category: "Agreement", title: "Interpret my collective agreement" },
      { category: "Safety", title: "Report a safety concern" },
    ],
  },
  fr: {
    errorTitle: "Erreur",
    sessionsLoadFailed: "Impossible de charger les sessions de clavardage",
    messagesLoadFailed: "Impossible de charger cette conversation",
    sessionCreateFailed: "Impossible de créer une nouvelle session de clavardage",
    sendFailed: "Impossible d’envoyer le message. Veuillez réessayer.",
    archivedTitle: "Session archivée",
    archivedBody: "La session de clavardage a été archivée",
    archiveFailed: "Impossible d’archiver la session",
    history: "Historique des conversations",
    newChat: "Nouvelle conversation",
    messagesOne: "1 message",
    messagesMany: "{count} messages",
    archive: "Archiver",
    sessionsLoading: "Chargement des conversations…",
    sessionsError: "Les conversations n’ont pas pu être chargées.",
    retry: "Réessayer",
    noSessions: "Aucune conversation pour l’instant.",
    assistantTitle: "Assistant des droits syndicaux",
    greeting: "Comment puis-je vous aider aujourd’hui ?",
    sources: "Sources :",
    relevant: "{percent} % pertinent",
    thinking: "Réflexion en cours...",
    placeholder: "Posez une question sur vos droits syndicaux...",
    hint: "Appuyez sur Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne",
    send: "Envoyer",
    suggestions: [
      { category: "Grief", title: "Comment soumettre une demande de prise en charge ?" },
      { category: "Droits", title: "Quels sont mes droits au travail ?" },
      { category: "Convention", title: "Interprétez ma convention collective" },
      { category: "Sécurité", title: "Signaler un problème de sécurité" },
    ],
  },
} as const;

// Continuity guidance entry points — scoped to rights, governance, and stewardship
const SUGGESTION_ICONS = [
  <ClipboardList key="grievance" size={24} className="text-blue-600" />,
  <Scale key="rights" size={24} className="text-blue-600" />,
  <FileSignature key="agreement" size={24} className="text-blue-600" />,
  <ShieldAlert key="safety" size={24} className="text-amber-600" />,
];

/** Only what a person said and what the assistant answered is a conversation; the table's system and function rows are not shown. */
const isConversation = (message: ChatMessageRecord) => message.role === "user" || message.role === "assistant";

export function AIChatbot() {
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [sessionsState, setSessionsState] = useState<"loading" | "ready" | "error">("loading");
  const [currentSession, setCurrentSession] = useState<ChatSessionRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { toast } = useToast();
  const copy = useLocale().toLowerCase().startsWith("fr") ? COPY.fr : COPY.en;
  const scrollRef = useRef<HTMLDivElement>(null);
  // The latest conversation asked for: an answer for an earlier one that arrives late is not shown.
  const openRequest = useRef(0);

  // Load sessions
  useEffect(() => {
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fail = (description: string) => toast({ title: copy.errorTitle, description, variant: "destructive" });

  const loadSessions = async () => {
    try {
      const response = await fetch("/api/chatbot/sessions");
      if (!response.ok) throw new Error("Chat sessions could not be loaded");
      const rows = sessionsFrom(await response.json());
      setSessions(rows);
      setSessionsState("ready");

      // Load first session if available
      if (rows.length > 0) {
        void loadSession(rows[0]);
      }
    } catch (error) {
      logger.error("Failed to load the chat sessions", error);
      setSessionsState("error");
      fail(copy.sessionsLoadFailed);
    }
  };

  const loadSession = async (session: ChatSessionRecord) => {
    const request = ++openRequest.current;
    try {
      const response = await fetch(`/api/chatbot/sessions/${session.id}/messages`);
      if (!response.ok) throw new Error("The conversation could not be loaded");
      const loaded = messagesFrom(await response.json()).filter(isConversation);
      if (request !== openRequest.current) return;
      setMessages(loaded);
      setCurrentSession(session);
      setShowSuggestions(loaded.length === 0);
    } catch (error) {
      logger.error("Failed to load the conversation", error);
      if (request === openRequest.current) fail(copy.messagesLoadFailed);
    }
  };

  const createNewSession = async (): Promise<ChatSessionRecord | null> => {
    try {
      const response = await fetch("/api/chatbot/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New conversation",
        }),
      });

      if (!response.ok) throw new Error("The chat session could not be created");
      const created = createdSessionFrom(await response.json());
      openRequest.current += 1;
      setSessions((prev) => [created, ...prev]);
      setCurrentSession(created);
      setMessages([]);
      setShowSuggestions(true);
      return created;
    } catch (error) {
      logger.error("Failed to create a chat session", error);
      fail(copy.sessionCreateFailed);
      return null;
    }
  };

  const sendMessage = async (content?: string) => {
    const messageContent = content || inputValue.trim();

    if (!messageContent || isLoading) return;

    // Create session if none exists
    let activeSession = currentSession;
    if (!activeSession) {
      activeSession = await createNewSession();
      if (!activeSession) return; // session creation failed
    }
    const sessionId = activeSession.id;

    setInputValue("");
    setShowSuggestions(false);
    setIsLoading(true);

    // Add user message optimistically
    const tempUserMessage: ChatMessageRecord = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageContent,
      citations: [],
      responseTimeMs: null,
    };

    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await fetch("/api/chatbot/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          content: messageContent,
          useRAG: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const answer = answerFrom(await response.json());

      // Replace temp message with real one and add assistant response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMessage.id),
        { ...tempUserMessage, id: `user-${Date.now()}` },
        answer,
      ]);

      // Update session in list: the route counts the question and the answer
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messageCount: s.messageCount + 2,
                lastMessageAt: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (error) {
      logger.error("Failed to send the message", error);
      fail(copy.sendFailed);

      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const archiveSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chatbot/sessions/${sessionId}/archive`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("The chat session could not be archived");

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }

      toast({
        title: copy.archivedTitle,
        description: copy.archivedBody,
      });
    } catch (error) {
      logger.error("Failed to archive the chat session", error);
      fail(copy.archiveFailed);
    }
  };

  const messageCountLabel = (count: number) => (count === 1 ? copy.messagesOne : copy.messagesMany.replace("{count}", String(count)));
  const suggestions: readonly { category: string; title: string }[] = copy.suggestions;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Sidebar - Chat History */}
      <Card className="w-80 flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{copy.history}</CardTitle>
            <Button size="sm" onClick={createNewSession}>
              {copy.newChat}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4">
            {sessionsState === "loading" && (
              <p role="status" className="py-2 text-sm text-muted-foreground">{copy.sessionsLoading}</p>
            )}
            {sessionsState === "error" && (
              <div role="alert" className="mb-2 rounded-lg border border-destructive/40 p-3 text-sm">
                <p>{copy.sessionsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setSessionsState("loading");
                    void loadSessions();
                  }}
                >
                  {copy.retry}
                </Button>
              </div>
            )}
            {sessionsState === "ready" && sessions.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">{copy.noSessions}</p>
            )}
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 rounded-lg mb-2 cursor-pointer hover:bg-accent transition-colors ${
                  currentSession?.id === session.id ? "bg-accent" : ""
                }`}
                onClick={() => void loadSession(session)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{session.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {messageCountLabel(session.messageCount)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* The menu is inside the session's row, whose click opens the session: archiving must not also reopen it. */}
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.stopPropagation();
                          void archiveSession(session.id);
                        }}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {copy.archive}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle>{copy.assistantTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <ScrollArea className="flex-1 px-6" ref={scrollRef}>
            {showSuggestions && messages.length === 0 && (
              <div className="py-8">
                <h3 className="text-lg font-semibold mb-4">
                  {copy.greeting}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {suggestions.map((suggestion, index) => (
                    <Card
                      key={index}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => void sendMessage(suggestion.title)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {SUGGESTION_ICONS[index]}
                          <Badge variant="secondary">{suggestion.category}</Badge>
                        </div>
                        <p className="text-sm font-medium">{suggestion.title}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-6 ${
                  message.role === "user" ? "ml-12" : "mr-12"
                }`}
              >
                <div
                  className={`p-4 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* Citations */}
                  {message.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {copy.sources}
                      </p>
                      <div className="space-y-1">
                        {message.citations.map((doc, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-medium">{doc.title}</span>
                            <span className="text-muted-foreground ml-2">
                              ({copy.relevant.replace("{percent}", String(Math.round(doc.relevanceScore * 100)))})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response time (answers cannot be rated: no route stores a rating) */}
                  {message.role === "assistant" &&
                    message.responseTimeMs !== null &&
                    message.responseTimeMs > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-end">
                        <span className="text-xs text-muted-foreground">
                          {(message.responseTimeMs / 1000).toFixed(1)}s
                        </span>
                      </div>
                    )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground mb-6 mr-12">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{copy.thinking}</span>
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-6 border-t">
            <div className="flex gap-2">
              <Textarea
                placeholder={copy.placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                className="resize-none"
                rows={2}
              />
              <Button
                onClick={() => void sendMessage()}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                className="shrink-0"
                aria-label={copy.send}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {copy.hint}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
