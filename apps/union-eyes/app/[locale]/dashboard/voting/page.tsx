"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  Vote,
  CheckCircle,
  Clock,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  Lock,
  Pause,
  Info,
  BarChart3,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ApiShapeError, envelopeData, readApiError } from "@/lib/client/api-envelope";
import {
  asRecord,
  countOrNull,
  flagOrFalse,
  optionalString,
  requiredCount,
  requiredString,
} from "@/lib/client/row-fields";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const MAX_PAGES = 40;
const DASH = "—";

type SessionStatus = "draft" | "active" | "paused" | "closed" | "cancelled";
type Tab = "active" | "upcoming" | "past";

// The statuses voting_sessions.status may hold, and the tab each one is listed under.
const TAB_OF_STATUS: Record<SessionStatus, Tab> = {
  draft: "upcoming",
  active: "active",
  paused: "active",
  closed: "past",
  cancelled: "past",
};

const isSessionStatus = (value: string): value is SessionStatus => Object.hasOwn(TAB_OF_STATUS, value);

interface VoteOption {
  id: string;
  label: string;
}

interface VotingSession {
  id: string;
  title: string;
  description: string | null;
  status: SessionStatus;
  startTime: string | null;
  endTime: string | null;
  options: VoteOption[];
  totalVotes: number;
  eligibleVoters: number | null;
  requiresQuorum: boolean;
  quorumThreshold: number | null;
  /** Asked only of an active ballot; null on an active ballot means the answer could not be read. */
  hasVoted: boolean | null;
}

/** A failure the server explained: its words are shown as they came. */
class ServerMessage extends Error {}

function optionalDate(row: Record<string, unknown>, key: string): string | null {
  const value = optionalString(row, key);
  if (value !== null && Number.isNaN(new Date(value).getTime())) throw new ApiShapeError(`${key} is not a date`);
  return value;
}

/** One row of GET /api/voting/sessions: the session's columns plus its options and participation count. */
function readSession(value: unknown): VotingSession {
  const row = asRecord(value, "session");
  const status = requiredString(row, "status");
  if (!isSessionStatus(status)) throw new ApiShapeError(`status ${status} is not a voting status`);
  if (!Array.isArray(row.options)) throw new ApiShapeError("options is missing");
  return {
    id: requiredString(row, "id"),
    title: requiredString(row, "title"),
    description: optionalString(row, "description"),
    status,
    startTime: optionalDate(row, "startTime"),
    endTime: optionalDate(row, "endTime"),
    options: row.options.map((option) => {
      const record = asRecord(option, "option");
      return { id: requiredString(record, "id"), label: requiredString(record, "text") };
    }),
    totalVotes: requiredCount(row, "totalVotes"),
    eligibleVoters: countOrNull(row, "totalEligibleVoters"),
    requiresQuorum: flagOrFalse(row, "requiresQuorum"),
    quorumThreshold: countOrNull(row, "quorumThreshold"),
    hasVoted: null,
  };
}

/** Every session the organization has, a page at a time: the route answers { sessions, total, page, limit }. */
async function fetchSessions(loadFailed: string): Promise<VotingSession[]> {
  const sessions: VotingSession[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetch(`/api/voting/sessions?page=${page}&limit=${PAGE_SIZE}`);
    if (!response.ok) throw new ServerMessage(await readApiError(response, loadFailed));
    const payload = envelopeData(await response.json());
    if (!Array.isArray(payload.sessions)) throw new ApiShapeError("no sessions");
    const total = requiredCount(payload, "total");
    sessions.push(...payload.sessions.map(readSession));
    if (sessions.length >= total) return sessions;
    if (payload.sessions.length === 0) throw new ApiShapeError("fewer sessions than the total");
  }
  throw new ApiShapeError("too many sessions");
}

/** Whether the caller has voted in a session: null when the route could not say. */
async function fetchHasVoted(sessionId: string): Promise<boolean | null> {
  try {
    const response = await fetch(`/api/voting/sessions/${encodeURIComponent(sessionId)}/vote`);
    if (!response.ok) return null;
    const { hasVoted } = envelopeData(await response.json());
    return typeof hasVoted === "boolean" ? hasVoted : null;
  } catch {
    return null;
  }
}

async function fetchVotingScreen(loadFailed: string): Promise<VotingSession[]> {
  const sessions = await fetchSessions(loadFailed);
  return Promise.all(
    sessions.map(async (session) =>
      session.status === "active" ? { ...session, hasVoted: await fetchHasVoted(session.id) } : session,
    ),
  );
}

function formatDate(value: string | null, locale: string): string {
  return value === null ? DASH : new Date(value).toLocaleDateString(locale);
}

function daysRemaining(session: VotingSession): number | null {
  if (session.status !== "active" || session.endTime === null) return null;
  const days = Math.ceil((new Date(session.endTime).getTime() - Date.now()) / 86_400_000);
  return days >= 0 ? days : null;
}

/** Turnout in percent, known only when the session recorded how many members may vote. */
function turnoutOf(session: VotingSession): number | null {
  if (session.eligibleVoters === null || session.eligibleVoters <= 0) return null;
  return Math.round((session.totalVotes / session.eligibleVoters) * 1000) / 10;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const t = useTranslations();
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium border border-green-200">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          {t("voting.active")}
        </span>
      );
    case "paused":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium border border-amber-200">
          <Pause size={14} />
          {t("voting.paused")}
        </span>
      );
    case "draft":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
          <Clock size={14} />
          {t("voting.upcoming")}
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium border border-gray-200">
          <Lock size={14} />
          {t("voting.closed")}
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium border border-gray-200">
          <Lock size={14} />
          {t("voting.cancelled")}
        </span>
      );
  }
}

interface VoteCardProps {
  session: VotingSession;
  locale: string;
  expanded: boolean;
  selectedOptionId: string | undefined;
  submitting: boolean;
  error: string | undefined;
  justVoted: boolean;
  onToggle: () => void;
  onSelect: (optionId: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
}

function VoteCard({
  session,
  locale,
  expanded,
  selectedOptionId,
  submitting,
  error,
  justVoted,
  onToggle,
  onSelect,
  onSubmit,
  onRetry,
}: VoteCardProps) {
  const t = useTranslations();
  const days = daysRemaining(session);
  const turnout = turnoutOf(session);
  const showsTurnout = turnout !== null && session.status !== "draft" && session.status !== "cancelled";
  const canVote = session.status === "active" && session.hasVoted === false && session.options.length > 0;
  const voteUnverified = session.status === "active" && session.hasVoted === null;
  const resultsWithheld = session.status === "closed" || (session.status === "active" && session.hasVoted === true);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={session.status} />
                {session.hasVoted === true && session.status === "active" && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    <CheckCircle size={12} />
                    {t("voting.youVoted")}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{session.title}</h3>
              {session.description !== null && <p className="text-gray-600 mb-3">{session.description}</p>}

              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {t("voting.ends")}: {formatDate(session.endTime, locale)}
                </span>
                {days !== null && (
                  <span className="flex items-center gap-1 text-orange-600 font-medium">
                    <Clock size={14} />
                    {t("voting.daysLeft", { days })}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {t("voting.votesCast", { count: session.totalVotes })}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={session.title}
              className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>

          {showsTurnout && turnout !== null && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">{t("voting.results.progressLabel")}</span>
                <span className="text-sm font-semibold text-blue-900">
                  {session.totalVotes}
                  {t("voting.results.progressOf")}
                  {session.eligibleVoters}
                  {t("voting.results.progressVoters")} ({turnout}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={t("voting.results.progressLabel")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(turnout, 100)}
                className="w-full bg-blue-200 rounded-full h-2"
              >
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(turnout, 100)}%` }}></div>
              </div>
              {session.requiresQuorum && session.quorumThreshold !== null && (
                <p className="text-xs text-blue-700 mt-1">
                  {t("voting.quorum")}: {session.quorumThreshold}%
                </p>
              )}
            </div>
          )}

          {expanded && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
              {justVoted && (
                <p role="status" className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                  {t("voting.casting.toastSuccess")}. {t("voting.casting.toastSuccessDesc")}.
                </p>
              )}

              {canVote && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">{t("voting.castYourVote")}</h4>
                  <div className="space-y-2">
                    {session.options.map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        onClick={() => onSelect(option.id)}
                        disabled={submitting}
                        aria-pressed={selectedOptionId === option.id}
                        className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                          selectedOptionId === option.id
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{option.label}</span>
                          {selectedOptionId === option.id && <CheckCircle size={20} className="text-blue-600" />}
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedOptionId !== undefined && (
                    <>
                      <p className="mt-4 text-sm text-gray-600">{t("voting.casting.reviewDescription")}</p>
                      <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        className="mt-3 w-full px-6 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            {t("voting.casting.submitting")}
                          </>
                        ) : (
                          <>
                            <CheckCircle size={20} />
                            {t("voting.casting.buttonSubmit")}
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}

              {error !== undefined && (
                <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                  {error}
                </p>
              )}

              {voteUnverified && (
                <div role="alert" className="flex items-center justify-between gap-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  <span>{t("voting.voteStatusUnknown")}</span>
                  <button type="button" onClick={onRetry} className="px-3 py-1 rounded border border-amber-400 font-medium hover:bg-amber-100">
                    {t("common.retry")}
                  </button>
                </div>
              )}

              {resultsWithheld && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BarChart3 size={18} />
                    {session.status === "closed" ? t("voting.finalResults") : t("voting.currentResults")}
                  </h4>
                  <p className="text-sm text-gray-600">{t("voting.resultsWithheld")}</p>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">{t("voting.startDate")}</p>
                    <p className="font-medium text-gray-900">{formatDate(session.startTime, locale)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">{t("voting.endDate")}</p>
                    <p className="font-medium text-gray-900">{formatDate(session.endTime, locale)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function VotingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [sessions, setSessions] = useState<VotingSession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<Tab>("active");
  const [expandedVote, setExpandedVote] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [voteErrors, setVoteErrors] = useState<Record<string, string>>({});
  const [votedHere, setVotedHere] = useState<string[]>([]);

  const loadFailed = t("errors.loadingError");

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSessions(await fetchVotingScreen(loadFailed));
    } catch (error) {
      setLoadError(error instanceof ServerMessage ? error.message : loadFailed);
    }
  }, [loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const inTab = (tab: Tab) => (sessions ?? []).filter((session) => TAB_OF_STATUS[session.status] === tab);
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "active", label: t("voting.active") },
    { key: "upcoming", label: t("voting.upcoming") },
    { key: "past", label: t("voting.pastResults") },
  ];
  const totalVotesCast = sessions === null ? null : sessions.reduce((sum, session) => sum + session.totalVotes, 0);

  const handleVote = async (sessionId: string, optionId: string) => {
    setSubmitting(sessionId);
    setVoteErrors((previous) => {
      const { [sessionId]: _cleared, ...rest } = previous;
      return rest;
    });
    try {
      const response = await fetch(`/api/voting/sessions/${encodeURIComponent(sessionId)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (!response.ok) {
        const message = await readApiError(response, t("voting.casting.toastErrorDefault"));
        setVoteErrors((previous) => ({ ...previous, [sessionId]: message }));
        return;
      }
      setVotedHere((previous) => [...previous, sessionId]);
      setSelectedOption((previous) => {
        const { [sessionId]: _cleared, ...rest } = previous;
        return rest;
      });
      setSessions((previous) =>
        previous === null
          ? previous
          : previous.map((session) => (session.id === sessionId ? { ...session, hasVoted: true } : session)),
      );
      await load();
    } catch {
      setVoteErrors((previous) => ({ ...previous, [sessionId]: t("errors.networkError") }));
    } finally {
      setSubmitting(null);
    }
  };

  const renderCards = (list: VotingSession[]) =>
    list.map((session) => (
      <VoteCard
        key={session.id}
        session={session}
        locale={locale}
        expanded={expandedVote === session.id}
        selectedOptionId={selectedOption[session.id]}
        submitting={submitting === session.id}
        error={voteErrors[session.id]}
        justVoted={votedHere.includes(session.id)}
        onToggle={() => setExpandedVote(expandedVote === session.id ? null : session.id)}
        onSelect={(optionId) => setSelectedOption((previous) => ({ ...previous, [session.id]: optionId }))}
        onSubmit={() => {
          const optionId = selectedOption[session.id];
          if (optionId !== undefined) void handleVote(session.id, optionId);
        }}
        onRetry={() => void load()}
      />
    ));

  const activeVotes = inTab("active");
  const upcomingVotes = inTab("upcoming");
  const pastVotes = inTab("past");

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t("voting.title")}</h1>
          <p className="text-gray-600 text-lg">{t("voting.subtitle")}</p>
        </div>

        {loadError !== null && (
          <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <span>{loadError}</span>
            <button type="button" onClick={() => void load()} className="px-3 py-1 rounded border border-red-300 font-medium hover:bg-red-100">
              {t("common.retry")}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-100">
                  <Vote size={24} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t("voting.active")}</p>
                  <p className="text-3xl font-bold text-gray-900">{sessions === null ? DASH : activeVotes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Clock size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t("voting.upcoming")}</p>
                  <p className="text-3xl font-bold text-gray-900">{sessions === null ? DASH : upcomingVotes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Users size={24} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t("voting.results.statVotesCast")}</p>
                  <p className="text-3xl font-bold text-gray-900">{totalVotesCast ?? DASH}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <div role="tablist" className="flex gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-lg border border-white/50 shadow-lg">
            {tabs.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={selectedTab === tab.key}
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                  selectedTab === tab.key ? "bg-blue-600 text-white shadow-lg" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {tab.label} ({sessions === null ? DASH : inTab(tab.key).length})
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {sessions === null ? (
            loadError === null && <p role="status" className="text-gray-600">{t("common.loading")}</p>
          ) : (
            <>
              {selectedTab === "active" &&
                (activeVotes.length === 0 ? (
                  <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
                    <CardContent className="p-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                        <CheckCircle size={32} className="text-green-600" />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("voting.noActiveVotes")}</h2>
                      <p className="text-gray-600">{t("voting.noActiveVotesMessage")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  renderCards(activeVotes)
                ))}

              {selectedTab === "upcoming" &&
                (upcomingVotes.length === 0 ? (
                  <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
                    <CardContent className="p-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                        <Clock size={32} className="text-blue-600" />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("voting.noUpcomingVotes")}</h2>
                      <p className="text-gray-600">{t("voting.noUpcomingVotesMessage")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  renderCards(upcomingVotes)
                ))}

              {selectedTab === "past" && renderCards(pastVotes)}
            </>
          )}
        </div>

        <div className="mt-8">
          <Card className="border-blue-200 bg-linear-to-br from-blue-50 to-white shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-600 text-white">
                  <Info size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">About Union Voting</h3>
                  <p className="text-gray-700 mb-3">
                    Your vote matters! Participate in union decisions to shape workplace policies, elect representatives, and ratify
                    agreements. All votes are confidential and secure.
                  </p>
                  <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
                    <li>Votes are anonymous and confidential</li>
                    <li>You can only vote once per ballot</li>
                    <li>{t("voting.resultsWithheld")}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
