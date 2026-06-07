'use client';

/**
 * CopilotChat — Governance-aware continuity reasoning assistant UI
 *
 * Organizational, explainable copilot for organizational continuity governance.
 * Every response exposes evidence, reasoning chain, and governance flags.
 *
 * NOT a chatbot gimmick — a governance instrument.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CopilotQueryResult } from '@/lib/knowledge-transfer/copilot/copilot-models';

interface MessageDisplay {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: CopilotQueryResult;
  isLoading?: boolean;
}

const SUGGESTED_PROMPTS = [
  'Why is this continuity area fragile?',
  'What governance risks does our organization face?',
  'What mitigation strategy reduces the highest concentration risk?',
  'Explain the propagation paths from our weakest areas.',
  'How has organizational resilience changed?',
  'What documentation investments are most critical?',
];

interface ConfidenceBadgeProps {
  confidence: string;
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const map: Record<string, { label: string; color: string }> = {
    high: { label: 'High Confidence', color: 'bg-green-100 text-green-800' },
    medium: { label: 'Medium Confidence', color: 'bg-yellow-100 text-yellow-800' },
    low: { label: 'Low Confidence', color: 'bg-orange-100 text-orange-800' },
    insufficient_data: { label: 'Insufficient Data', color: 'bg-gray-100 text-gray-600' },
  };
  const badge = map[confidence] ?? map.insufficient_data;
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${badge.color}`}>
      {badge.label}
    </span>
  );
}

function severityColor(severity: string): string {
  if (severity === 'significant') return 'border-red-300 bg-red-50 text-red-800';
  if (severity === 'moderate') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

interface ExplainabilityPanelProps {
  result: CopilotQueryResult;
}

function ExplainabilityPanel({ result }: ExplainabilityPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
      >
        <span className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Evidence &amp; Reasoning
          <ConfidenceBadge confidence={result.overallConfidence} />
        </span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-200 px-3 pb-4 pt-3 text-xs">
          {/* Evidence References */}
          {result.evidenceReferences.length > 0 && (
            <div>
              <p className="mb-1.5 font-semibold text-slate-700">Evidence References</p>
              <div className="space-y-1.5">
                {result.evidenceReferences.map((e, i) => (
                  <div key={i} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                    <p className="text-slate-700">{e.observation}</p>
                    <p className="mt-0.5 font-mono text-slate-500">{e.dataPoint}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{e.sourceType}</span>
                      <ConfidenceBadge confidence={e.confidence} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning Chain */}
          {result.reasoningChain.length > 0 && (
            <div>
              <p className="mb-1.5 font-semibold text-slate-700">Reasoning Chain</p>
              <div className="space-y-1.5">
                {result.reasoningChain.map((r) => (
                  <div key={r.stepNumber} className="flex gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      {r.stepNumber}
                    </span>
                    <div>
                      <p className="text-slate-700">{r.reasoning}</p>
                      <p className="mt-0.5 text-slate-500">→ {r.conclusion}</p>
                      {r.assumption && (
                        <p className="mt-0.5 italic text-slate-400">Assumption: {r.assumption}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Governance Flags */}
          {result.governanceFlags.length > 0 && (
            <div>
              <p className="mb-1.5 font-semibold text-slate-700">Governance Flags</p>
              <div className="space-y-1.5">
                {result.governanceFlags.map((flag, i) => (
                  <div key={i} className={`rounded border px-2 py-1.5 ${severityColor(flag.severity)}`}>
                    <p className="font-medium">{flag.concern}</p>
                    <p className="mt-0.5 opacity-80">{flag.implication}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assumptions & Limitations */}
          {result.assumptions.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-slate-700">Assumptions</p>
              <ul className="list-disc space-y-0.5 pl-4 text-slate-500">
                {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          {result.limitations.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-slate-700">Limitations</p>
              <ul className="list-disc space-y-0.5 pl-4 text-slate-500">
                {result.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CopilotChat() {
  const [messages, setMessages] = useState<MessageDisplay[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;
    setError(null);

    const userMsg: MessageDisplay = {
      id: crypto.randomUUID(),
      role: 'user',
      content: queryText.trim(),
    };
    const loadingMsg: MessageDisplay = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsLoading(true);

    // Build prior messages for multi-turn context (max 10 prior pairs)
    const priorMessages = messages
      .filter((m) => !m.isLoading)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/exit-interviews/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText.trim(),
          conversationId,
          priorMessages,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Request failed');
      const result: CopilotQueryResult = json.data;

      if (!conversationId) setConversationId(result.conversationId);

      setMessages((prev) =>
        prev.map((m) =>
          m.isLoading
            ? { ...m, isLoading: false, content: result.answer, result }
            : m,
        ),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !m.isLoading));
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [messages, conversationId, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Continuity Reasoning Advisor</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Evidence-grounded governance intelligence. Every response is auditable.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="py-8">
            <p className="mb-4 text-sm font-medium text-slate-600">Suggested questions:</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[90%]">
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </div>
                      Analyzing continuity data…
                    </div>
                  ) : (
                    <div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                      {msg.result && <ExplainabilityPanel result={msg.result} />}
                      {msg.result?.followUpSuggestions && msg.result.followUpSuggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.result.followUpSuggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => send(s)}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300 hover:text-slate-700"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about organizational continuity, governance risks, or mitigation strategies…"
            disabled={isLoading}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Ask
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          All responses expose evidence, assumptions, and governance implications. Not a substitute for direct governance review.
        </p>
      </div>
    </div>
  );
}
