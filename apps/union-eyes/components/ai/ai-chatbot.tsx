/**
 * AI Chatbot Component
 * 
 * Union rights Q&A chatbot with RAG support
 * Real-time messaging interface
 * Citation display and helpful feedback
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
import { Loader2, Send, ThumbsUp, ThumbsDown, FileText, MoreVertical, Archive, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  retrievedDocuments?: Array<{
    documentId: string;
    title: string;
    relevanceScore: number;
    excerpt: string;
  }>;
  tokensUsed?: number;
  responseTimeMs?: number;
  helpful?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessageAt?: string;
  messageCount: number;
}

export function AIChatbot() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Sample suggestions
  const suggestions = [
    { category: "Grievance", title: "How do I file a grievance?", icon: "ðŸ“‹" },
    { category: "Rights", title: "What are my workplace rights?", icon: "âš–ï¸" },
    { category: "Contract", title: "Explain my collective agreement", icon: "ðŸ“„" },
    { category: "Safety", title: "Report a safety concern", icon: "âš ï¸" },
  ];
  
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
  
  const loadSessions = async () => {
    try {
      const response = await fetch("/api/chatbot/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
        
        // Load first session if available
        if (data.sessions.length > 0) {
          loadSession(data.sessions[0].id);
        }
      }
    } catch (_error) {
}
  };
  
  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chatbot/sessions/${sessionId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        
        const session = sessions.find((s) => s.id === sessionId);
        setCurrentSession(session || null);
        setShowSuggestions(data.messages.length === 0);
      }
    } catch (_error) {
}
  };
  
  const createNewSession = async () => {
    try {
      const response = await fetch("/api/chatbot/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New conversation",
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions([data.session, ...sessions]);
        setCurrentSession(data.session);
        setMessages([]);
        setShowSuggestions(true);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to create new chat session",
        variant: "destructive",
      });
    }
  };
  
  const sendMessage = async (content?: string) => {
    const messageContent = content || inputValue.trim();
    
    if (!messageContent || isLoading) return;
    
    // Create session if none exists
    if (!currentSession) {
      await createNewSession();
      // Wait a bit for session creation
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    
    setInputValue("");
    setShowSuggestions(false);
    setIsLoading(true);
    
    // Add user message optimistically
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageContent,
    };
    
    setMessages((prev) => [...prev, tempUserMessage]);
    
    try {
      const response = await fetch("/api/chatbot/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession?.id,
          content: messageContent,
          useRAG: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      const data = await response.json();
      
      // Replace temp message with real one and add assistant response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMessage.id),
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: messageContent,
        },
        {
          id: data.message.id,
          role: "assistant",
          content: data.message.content,
          retrievedDocuments: data.message.retrievedDocuments,
          tokensUsed: data.message.tokensUsed,
          responseTimeMs: data.message.responseTimeMs,
        },
      ]);
      
      // Update session in list
      if (currentSession) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSession.id
              ? {
                  ...s,
                  messageCount: s.messageCount + 2,
                  lastMessageAt: new Date().toISOString(),
                }
              : s
          )
        );
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
    }
  };
  
  const provideFeedback = async (messageId: string, helpful: boolean) => {
    try {
      await fetch(`/api/chatbot/messages/${messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful }),
      });
      
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, helpful } : m))
      );
      
      toast({
        title: "Thank you!",
        description: "Your feedback helps improve our assistant.",
      });
    } catch (_error) {
}
  };
  
  const archiveSession = async (sessionId: string) => {
    try {
      await fetch(`/api/chatbot/sessions/${sessionId}/archive`, {
        method: "POST",
      });
      
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      
      toast({
        title: "Session archived",
        description: "Chat session has been archived",
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to archive session",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Sidebar - Chat History */}
      <Card className="w-80 flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Chat History</CardTitle>
            <Button size="sm" onClick={createNewSession}>
              New Chat
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 rounded-lg mb-2 cursor-pointer hover:bg-accent transition-colors ${
                  currentSession?.id === session.id ? "bg-accent" : ""
                }`}
                onClick={() => loadSession(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{session.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {session.messageCount} messages
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => archiveSession(session.id)}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => archiveSession(session.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
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
          <CardTitle>Union Rights Assistant</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <ScrollArea className="flex-1 px-6" ref={scrollRef}>
            {showSuggestions && messages.length === 0 && (
              <div className="py-8">
                <h3 className="text-lg font-semibold mb-4">
                  How can I help you today?
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {suggestions.map((suggestion, index) => (
                    <Card
                      key={index}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => sendMessage(suggestion.title)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{suggestion.icon}</span>
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
                  {message.retrievedDocuments &&
                    message.retrievedDocuments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Sources:
                        </p>
                        <div className="space-y-1">
                          {message.retrievedDocuments.map((doc, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="font-medium">{doc.title}</span>
                              <span className="text-muted-foreground ml-2">
                                ({Math.round(doc.relevanceScore * 100)}% relevant)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  
                  {/* Feedback */}
                  {message.role === "assistant" && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Was this helpful?
                      </span>
                      <Button
                        size="sm"
                        variant={message.helpful === true ? "default" : "ghost"}
                        className="h-6 w-6 p-0"
                        onClick={() => provideFeedback(message.id, true)}
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant={message.helpful === false ? "default" : "ghost"}
                        className="h-6 w-6 p-0"
                        onClick={() => provideFeedback(message.id, false)}
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                      {message.responseTimeMs && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {(message.responseTimeMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground mb-6 mr-12">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </ScrollArea>
          
          {/* Input */}
          <div className="p-6 border-t">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask a question about your union rights..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="resize-none"
                rows={2}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                className="shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

