"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from 'next-intl';
import {
  Vote,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  Lock,
  Info,
  BarChart3,
} from "lucide-react";
 
import { Card, CardContent } from "@/components/ui/card";

type VoteStatus = "active" | "upcoming" | "closed";
type VoteType = "yes-no" | "multiple-choice" | "ranked";

interface VoteOption {
  id: string;
  label: string;
  votes?: number;
  percentage?: number;
}

interface Vote {
  id: string;
  title: string;
  description: string;
  type: VoteType;
  status: VoteStatus;
  startDate: string;
  endDate: string;
  options: VoteOption[];
  totalVotes?: number;
  hasVoted?: boolean;
  userVote?: string;
  quorum?: number;
  currentParticipation?: number;
}

export default function VotingPage() {
  const { user: _user } = useUser();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [_isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"active" | "upcoming" | "past">("active");
  const [expandedVote, setExpandedVote] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  // Fetch voting sessions from API
  useEffect(() => {
    const fetchVotingSessions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/voting/sessions');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch voting sessions: ${response.statusText}`);
        }

        const data = await response.json();
        setVotes(data.sessions || []);
      } catch (err) {
setError(err instanceof Error ? err.message : 'Failed to load voting sessions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVotingSessions();
  }, []);

  const activeVotes = votes.filter(v => v.status === "active");
  const upcomingVotes = votes.filter(v => v.status === "upcoming");
  const pastVotes = votes.filter(v => v.status === "closed");

  const handleVote = async (voteId: string, optionId: string) => {
    setIsSubmitting(voteId);
    
    try {
      const response = await fetch(`/api/voting/sessions/${voteId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ optionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit vote');
      }

      // Update local state to reflect vote
      setVotes(prevVotes => 
        prevVotes.map(v => 
          v.id === voteId 
            ? { ...v, hasVoted: true, userVote: optionId }
            : v
        )
      );
      setSelectedOption(prev => ({ ...prev, [voteId]: optionId }));

      // Refresh votes to get updated counts
      const refreshResponse = await fetch('/api/voting/sessions');
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setVotes(data.sessions || []);
      }
    } catch (err) {
alert(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setIsSubmitting(null);
    }
  };

  const getStatusBadge = (status: VoteStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Active
          </span>
        );
      case "upcoming":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
            <Clock size={14} />
            {t('voting.upcoming')}
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium border border-gray-200">
            <Lock size={14} />
            {t('voting.closed')}
          </span>
        );
    }
  };

  const renderVoteCard = (vote: Vote) => {
    const isExpanded = expandedVote === vote.id;
    const daysRemaining = vote.status === "active" 
      ? Math.ceil((new Date(vote.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <motion.div
        key={vote.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {getStatusBadge(vote.status)}
                  {vote.hasVoted && vote.status === "active" && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      <CheckCircle size={12} />
                      {t('voting.youVoted')}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{vote.title}</h3>
                <p className="text-gray-600 mb-3">{vote.description}</p>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {t('voting.ends')}: {new Date(vote.endDate).toLocaleDateString()}
                  </span>
                  {daysRemaining !== null && daysRemaining >= 0 && (
                    <span className="flex items-center gap-1 text-orange-600 font-medium">
                      <Clock size={14} />
                      {t('voting.daysLeft', { days: daysRemaining })}
                    </span>
                  )}
                  {vote.totalVotes !== undefined && (
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {t('voting.votesCast', { count: vote.totalVotes })}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setExpandedVote(isExpanded ? null : vote.id)}
                className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>

            {/* Participation Progress (Active votes) */}
            {vote.status === "active" && vote.quorum && vote.currentParticipation && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">Participation</span>
                  <span className="text-sm font-semibold text-blue-900">
                    {vote.currentParticipation}% ({vote.totalVotes}/{vote.quorum})
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(vote.currentParticipation, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  {vote.currentParticipation >= 100 ? "Quorum reached!" : `Need ${vote.quorum - (vote.totalVotes || 0)} more votes for quorum`}
                </p>
              </div>
            )}

            {/* Expanded Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    {/* Voting Options */}
                    {vote.status === "active" && !vote.hasVoted ? (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Cast Your Vote</h4>
                        <div className="space-y-2">
                          {vote.options.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => handleVote(vote.id, option.id)}
                              disabled={isSubmitting === vote.id}
                              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                                selectedOption[vote.id] === option.id
                                  ? "border-blue-600 bg-blue-50"
                                  : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{option.label}</span>
                                {selectedOption[vote.id] === option.id && (
                                  <CheckCircle size={20} className="text-blue-600" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                        {selectedOption[vote.id] && (
                          <motion.button
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 w-full px-6 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                          >
                            {isSubmitting === vote.id ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Submitting...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={20} />
                                Submit Vote
                              </>
                            )}
                          </motion.button>
                        )}
                      </div>
                    ) : (
                      // Show Results
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <BarChart3 size={18} />
                          {vote.status === "closed" ? t('voting.finalResults') : t('voting.currentResults')}
                        </h4>
                        <div className="space-y-3">
                          {vote.options.map((option) => (
                            <div key={option.id}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                  {option.label}
                                  {vote.hasVoted && vote.userVote === option.id && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                      <CheckCircle size={10} />
                                      {t('voting.yourVote')}
                                    </span>
                                  )}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">
                                  {option.percentage}% ({option.votes})
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${option.percentage}%` }}
                                  transition={{ duration: 0.8, delay: 0.2 }}
                                  className={`h-3 rounded-full ${
                                    option.percentage && option.percentage > 50 
                                      ? "bg-linear-to-r from-green-500 to-green-600" 
                                      : "bg-linear-to-r from-blue-500 to-blue-600"
                                  }`}
                                ></motion.div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vote Info */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 mb-1">{t('voting.startDate')}</p>
                          <p className="font-medium text-gray-900">
                            {new Date(vote.startDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">{t('voting.endDate')}</p>
                          <p className="font-medium text-gray-900">
                            {new Date(vote.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const t = useTranslations();

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('voting.title')}</h1>
          <p className="text-gray-600 text-lg">{t('voting.subtitle')}</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8"
        >
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-100">
                  <Vote size={24} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('voting.active')}</p>
                  <p className="text-3xl font-bold text-gray-900">{activeVotes.length}</p>
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
                  <p className="text-sm text-gray-600">{t('voting.upcoming')}</p>
                  <p className="text-3xl font-bold text-gray-900">{upcomingVotes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-purple-100">
                  <TrendingUp size={24} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('voting.participationRate')}</p>
                  <p className="text-3xl font-bold text-gray-900">85%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-lg border border-white/50 shadow-lg">
            {[
              { key: "active", label: t('voting.active'), count: activeVotes.length },
              { key: "upcoming", label: t('voting.upcoming'), count: upcomingVotes.length },
              { key: "past", label: t('voting.pastResults'), count: pastVotes.length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                  selectedTab === tab.key
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </motion.div>

        {/* Votes List */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedTab === "active" && (
              <motion.div
                key="active"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {activeVotes.length === 0 ? (
                  <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
                    <CardContent className="p-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                        <CheckCircle size={32} className="text-green-600" />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('voting.noActiveVotes')}</h2>
                      <p className="text-gray-600">{t('voting.noActiveVotesMessage')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  activeVotes.map(vote => renderVoteCard(vote))
                )}
              </motion.div>
            )}

            {selectedTab === "upcoming" && (
              <motion.div
                key="upcoming"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {upcomingVotes.length === 0 ? (
                  <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
                    <CardContent className="p-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                        <Clock size={32} className="text-blue-600" />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('voting.noUpcomingVotes')}</h2>
                      <p className="text-gray-600">{t('voting.noUpcomingVotesMessage')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  upcomingVotes.map(vote => renderVoteCard(vote))
                )}
              </motion.div>
            )}

            {selectedTab === "past" && (
              <motion.div
                key="past"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {pastVotes.map(vote => renderVoteCard(vote))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8"
        >
          <Card className="border-blue-200 bg-linear-to-br from-blue-50 to-white shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-600 text-white">
                  <Info size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">About Union Voting</h3>
                  <p className="text-gray-700 mb-3">
                    Your vote matters! Participate in union decisions to shape workplace policies, 
                    elect representatives, and ratify agreements. All votes are confidential and secure.
                  </p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>â€¢ Votes are anonymous and confidential</li>
                    <li>â€¢ You can only vote once per ballot</li>
                    <li>â€¢ Results are shown after voting closes or you cast your vote</li>
                    <li>â€¢ Email reminders sent before voting deadline</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
