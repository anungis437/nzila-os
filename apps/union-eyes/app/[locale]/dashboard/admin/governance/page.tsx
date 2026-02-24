"use client";


export const dynamic = 'force-dynamic';
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldCheck,
  Landmark,
  Gavel,
  FileCheck2,
  Users,
  Sparkles,
  CalendarClock,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface GovernanceEvent {
  id: string;
  title: string;
  eventDate: string;
}

interface ReservedMatterVote {
  id: string;
  title: string;
  matterType: string;
  votingDeadline?: string;
}

interface MissionAudit {
  id: string;
  auditYear: number;
  auditorFirm: string;
  overallPass: boolean;
}

interface GoldenShareStatus {
  share?: {
    certificateNumber: string;
  };
  sunsetProgress?: {
    consecutiveYears: number;
    requiredYears: number;
    percentComplete: number;
  };
}

interface GovernanceDashboard {
  goldenShare: GoldenShareStatus | null;
  recentVotes: ReservedMatterVote[];
  pendingVotes: ReservedMatterVote[];
  recentAudits: MissionAudit[];
  recentEvents: GovernanceEvent[];
  stats: {
    totalVotes: number;
    votesApproved: number;
    votesVetoed: number;
    auditsPassed: number;
    auditsFailed: number;
  };
}

const jsonSafeParse = (value: string) => {
  try {
    return { ok: true, data: JSON.parse(value) } as const;
  } catch (error) {
    return { ok: false, error: error as Error } as const;
  }
};

export default function GovernancePage() {
  const [dashboard, setDashboard] = useState<GovernanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const [shareForm, setShareForm] = useState({
    certificateNumber: "",
    issueDate: "",
    councilMembersJson: "",
  });
  const [reservedMatterForm, setReservedMatterForm] = useState({
    matterType: "mission_change",
    title: "",
    description: "",
    proposedBy: "",
    votingDeadline: "",
    classATotalVotes: "",
    matterDetailsJson: "{}",
  });
  const [classAVoteForm, setClassAVoteForm] = useState({
    voteId: "",
    votesFor: "",
    votesAgainst: "",
    abstain: "",
  });
  const [classBVoteForm, setClassBVoteForm] = useState({
    voteId: "",
    vote: "approve",
    voteRationale: "",
    councilMembersVotingJson: "[]",
  });
  const [auditForm, setAuditForm] = useState({
    auditYear: "",
    auditPeriodStart: "",
    auditPeriodEnd: "",
    auditorFirm: "",
    auditorName: "",
    auditDate: "",
    unionRevenuePercent: "",
    memberSatisfactionPercent: "",
    dataViolations: "0",
    auditorOpinion: "",
  });
  const [electionForm, setElectionForm] = useState({
    electionYear: "",
    electionDate: "",
    positionsAvailable: "",
    candidatesJson: "[]",
    winnersJson: "[]",
    totalVotes: "",
    participationRate: "",
  });

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/governance/dashboard");
      if (!response.ok) throw new Error("Failed to load governance dashboard");
      const data = await response.json();
      setDashboard(data.data);
    } catch (_error) {
toast.error("Unable to load governance dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const shareExists = Boolean(dashboard?.goldenShare?.share);

  const stats = useMemo(
    () => [
      {
        label: "Reserved Matters",
        value: dashboard?.stats?.totalVotes ?? 0,
        icon: <Gavel className="h-5 w-5" />,
      },
      {
        label: "Approved",
        value: dashboard?.stats?.votesApproved ?? 0,
        icon: <ShieldCheck className="h-5 w-5" />,
      },
      {
        label: "Vetoed",
        value: dashboard?.stats?.votesVetoed ?? 0,
        icon: <AlertTriangle className="h-5 w-5" />,
      },
      {
        label: "Audits Passed",
        value: dashboard?.stats?.auditsPassed ?? 0,
        icon: <FileCheck2 className="h-5 w-5" />,
      },
    ],
    [dashboard]
  );

  const submitGoldenShare = async () => {
    const parsedMembers = jsonSafeParse(shareForm.councilMembersJson);
    if (!parsedMembers.ok) {
      toast.error("Council members JSON is invalid");
      return;
    }

    try {
      const response = await fetch("/api/governance/golden-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateNumber: shareForm.certificateNumber,
          issueDate: shareForm.issueDate,
          councilMembers: parsedMembers.data,
        }),
      });

      if (!response.ok) throw new Error("Failed to issue golden share");
      toast.success("Golden share issued");
      setShareForm({ certificateNumber: "", issueDate: "", councilMembersJson: "" });
      fetchDashboard();
    } catch (_error) {
toast.error("Unable to issue golden share");
    }
  };

  const submitReservedMatter = async () => {
    const parsedDetails = jsonSafeParse(reservedMatterForm.matterDetailsJson);
    if (!parsedDetails.ok) {
      toast.error("Matter details JSON is invalid");
      return;
    }

    try {
      const response = await fetch("/api/governance/reserved-matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterType: reservedMatterForm.matterType,
          title: reservedMatterForm.title,
          description: reservedMatterForm.description,
          proposedBy: reservedMatterForm.proposedBy,
          votingDeadline: reservedMatterForm.votingDeadline,
          classATotalVotes: Number(reservedMatterForm.classATotalVotes),
          matterDetails: parsedDetails.data,
        }),
      });

      if (!response.ok) throw new Error("Failed to create reserved matter");
      toast.success("Reserved matter created");
      setReservedMatterForm({
        matterType: "mission_change",
        title: "",
        description: "",
        proposedBy: "",
        votingDeadline: "",
        classATotalVotes: "",
        matterDetailsJson: "{}",
      });
      fetchDashboard();
    } catch (_error) {
toast.error("Unable to create reserved matter");
    }
  };

  const submitClassAVote = async () => {
    try {
      const response = await fetch(`/api/governance/reserved-matters/${classAVoteForm.voteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          votesFor: Number(classAVoteForm.votesFor),
          votesAgainst: Number(classAVoteForm.votesAgainst),
          abstain: Number(classAVoteForm.abstain),
        }),
      });

      if (!response.ok) throw new Error("Failed to record Class A vote");
      toast.success("Class A vote recorded");
      setClassAVoteForm({ voteId: "", votesFor: "", votesAgainst: "", abstain: "" });
      fetchDashboard();
    } catch (_error) {
toast.error("Unable to record Class A vote");
    }
  };

  const submitClassBVote = async () => {
    const parsedCouncilVotes = jsonSafeParse(classBVoteForm.councilMembersVotingJson);
    if (!parsedCouncilVotes.ok) {
      toast.error("Council votes JSON is invalid");
      return;
    }

    try {
      const response = await fetch(
        `/api/governance/reserved-matters/${classBVoteForm.voteId}/class-b-vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vote: classBVoteForm.vote,
            voteRationale: classBVoteForm.voteRationale,
            councilMembersVoting: parsedCouncilVotes.data,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to record Class B vote");
      toast.success("Class B vote recorded");
      setClassBVoteForm({
        voteId: "",
        vote: "approve",
        voteRationale: "",
        councilMembersVotingJson: "[]",
      });
      fetchDashboard();
    } catch (_error) {
toast.error("Unable to record Class B vote");
    }
  };

  const submitAudit = async () => {
    try {
      const response = await fetch("/api/governance/mission-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditYear: Number(auditForm.auditYear),
          auditPeriodStart: auditForm.auditPeriodStart,
          auditPeriodEnd: auditForm.auditPeriodEnd,
          auditorFirm: auditForm.auditorFirm,
          auditorName: auditForm.auditorName,
          auditDate: auditForm.auditDate,
          unionRevenuePercent: Number(auditForm.unionRevenuePercent),
          memberSatisfactionPercent: Number(auditForm.memberSatisfactionPercent),
          dataViolations: Number(auditForm.dataViolations),
          auditorOpinion: auditForm.auditorOpinion,
        }),
      });

      if (!response.ok) throw new Error("Failed to create mission audit");
      toast.success("Mission audit recorded");
      setAuditForm({
        auditYear: "",
        auditPeriodStart: "",
        auditPeriodEnd: "",
        auditorFirm: "",
        auditorName: "",
        auditDate: "",
        unionRevenuePercent: "",
        memberSatisfactionPercent: "",
        dataViolations: "0",
        auditorOpinion: "",
      });
      fetchDashboard();
    } catch (_error) {
toast.error("Unable to create mission audit");
    }
  };

  const submitElection = async () => {
    const parsedCandidates = jsonSafeParse(electionForm.candidatesJson);
    const parsedWinners = jsonSafeParse(electionForm.winnersJson);

    if (!parsedCandidates.ok || !parsedWinners.ok) {
      toast.error("Candidates or winners JSON is invalid");
      return;
    }

    try {
      const response = await fetch("/api/governance/council-elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electionYear: Number(electionForm.electionYear),
          electionDate: electionForm.electionDate,
          positionsAvailable: Number(electionForm.positionsAvailable),
          candidates: parsedCandidates.data,
          winners: parsedWinners.data,
          totalVotes: Number(electionForm.totalVotes),
          participationRate: electionForm.participationRate
            ? Number(electionForm.participationRate)
            : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to record council election");
      toast.success("Council election recorded");
      setElectionForm({
        electionYear: "",
        electionDate: "",
        positionsAvailable: "",
        candidatesJson: "[]",
        winnersJson: "[]",
        totalVotes: "",
        participationRate: "",
      });
      fetchDashboard();
    } catch (_error) {
toast.error("Unable to record council election");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-stone-50 via-amber-50/70 to-slate-100">
      <div className="container mx-auto px-6 py-10 space-y-10 font-poppins">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-amber-200/60 bg-white/80 p-8 shadow-xl backdrop-blur"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-amber-800">
                <Landmark className="h-6 w-6" />
                <span className="text-sm uppercase tracking-[0.3em]">Governance Console</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">
                Golden Share + Reserved Matter Controls
              </h1>
              <p className="mt-2 text-slate-600">
                Track mission safeguards, approvals, audits, and council elections in one place.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={fetchDashboard}
              className="gap-2 border-amber-200 text-amber-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </motion.div>

        {loading ? (
          <Card className="border-amber-200/60 bg-white/70 shadow-sm">
            <CardContent className="flex items-center gap-3 py-6 text-slate-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading governance signal...
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="border-amber-200/50 bg-white/80 shadow-sm">
                <CardContent className="flex items-center justify-between py-6">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{stat.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    {stat.icon}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card className="border-amber-200/60 bg-white/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Golden Share Status</CardTitle>
              {shareExists ? (
                <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700">Pending issuance</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {shareExists ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Certificate</span>
                    <span className="font-semibold">
                      {dashboard?.goldenShare?.share?.certificateNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Consecutive compliance years</span>
                    <span className="font-semibold">
                      {dashboard?.goldenShare?.sunsetProgress?.consecutiveYears ?? 0} /
                      {dashboard?.goldenShare?.sunsetProgress?.requiredYears ?? 5}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sunset progress</span>
                    <span className="font-semibold">
                      {Math.round(dashboard?.goldenShare?.sunsetProgress?.percentComplete ?? 0)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Issue the Class B special voting share to establish governance protections.
                  </p>
                  <div className="grid gap-3">
                    <Input
                      placeholder="Certificate number"
                      value={shareForm.certificateNumber}
                      onChange={(event) =>
                        setShareForm((prev) => ({ ...prev, certificateNumber: event.target.value }))
                      }
                    />
                    <Input
                      type="date"
                      value={shareForm.issueDate}
                      onChange={(event) =>
                        setShareForm((prev) => ({ ...prev, issueDate: event.target.value }))
                      }
                    />
                    <Textarea
                      placeholder='Council members JSON (e.g. [{"name":"A","union":"Local","termStart":"2026-02-01T00:00:00Z","termEnd":"2028-02-01T00:00:00Z","electedDate":"2026-01-15T00:00:00Z"}])'
                      value={shareForm.councilMembersJson}
                      onChange={(event) =>
                        setShareForm((prev) => ({ ...prev, councilMembersJson: event.target.value }))
                      }
                      rows={4}
                    />
                    <Button onClick={submitGoldenShare} className="gap-2 bg-amber-600 text-white">
                      <Sparkles className="h-4 w-4" />
                      Issue Golden Share
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.recentEvents || []).map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200/70 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <p className="text-xs text-slate-500">{event.eventDate}</p>
                </div>
              ))}
              {!dashboard?.recentEvents?.length && (
                <p className="text-sm text-slate-500">No governance events recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="border-amber-200/60 bg-white/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Reserved Matter Intake</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Title"
                  value={reservedMatterForm.title}
                  onChange={(event) =>
                    setReservedMatterForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
                <Input
                  placeholder="Proposed by"
                  value={reservedMatterForm.proposedBy}
                  onChange={(event) =>
                    setReservedMatterForm((prev) => ({ ...prev, proposedBy: event.target.value }))
                  }
                />
                <Input
                  placeholder="Voting deadline"
                  type="datetime-local"
                  value={reservedMatterForm.votingDeadline}
                  onChange={(event) =>
                    setReservedMatterForm((prev) => ({ ...prev, votingDeadline: event.target.value }))
                  }
                />
                <Input
                  placeholder="Class A total votes"
                  value={reservedMatterForm.classATotalVotes}
                  onChange={(event) =>
                    setReservedMatterForm((prev) => ({ ...prev, classATotalVotes: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3">
                <select
                  value={reservedMatterForm.matterType}
                  onChange={(event) =>
                    setReservedMatterForm((prev) => ({ ...prev, matterType: event.target.value }))
                  }
                  className="h-10 rounded-md border border-amber-200 bg-white px-3 text-sm"
                >
                  <option value="mission_change">Mission change</option>
                  <option value="sale_control">Sale / control</option>
                  <option value="data_governance">Data governance</option>
                  <option value="major_contract">Major contract</option>
                </select>
                <Textarea
                  placeholder="Description"
                  value={reservedMatterForm.description}
                  onChange={(event) =>
                    setReservedMatterForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                />
                <Textarea
                  placeholder='Matter details JSON (e.g. {"recipient":"employer"})'
                  value={reservedMatterForm.matterDetailsJson}
                  onChange={(event) =>
                    setReservedMatterForm((prev) => ({ ...prev, matterDetailsJson: event.target.value }))
                  }
                  rows={3}
                />
                <Button onClick={submitReservedMatter} className="gap-2 bg-slate-900 text-white">
                  <Gavel className="h-4 w-4" />
                  Submit reserved matter
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-white/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Pending Decisions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.pendingVotes || []).map((vote) => (
                <div key={vote.id} className="rounded-xl border border-slate-200/70 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{vote.title}</p>
                  <p className="text-xs text-slate-500">Deadline: {vote.votingDeadline}</p>
                </div>
              ))}
              {!dashboard?.pendingVotes?.length && (
                <p className="text-sm text-slate-500">No pending reserved matters.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-amber-200/60 bg-white/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Record Class A Vote</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input
                placeholder="Reserved matter vote ID"
                value={classAVoteForm.voteId}
                onChange={(event) =>
                  setClassAVoteForm((prev) => ({ ...prev, voteId: event.target.value }))
                }
              />
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  placeholder="Votes for"
                  value={classAVoteForm.votesFor}
                  onChange={(event) =>
                    setClassAVoteForm((prev) => ({ ...prev, votesFor: event.target.value }))
                  }
                />
                <Input
                  placeholder="Votes against"
                  value={classAVoteForm.votesAgainst}
                  onChange={(event) =>
                    setClassAVoteForm((prev) => ({ ...prev, votesAgainst: event.target.value }))
                  }
                />
                <Input
                  placeholder="Abstain"
                  value={classAVoteForm.abstain}
                  onChange={(event) =>
                    setClassAVoteForm((prev) => ({ ...prev, abstain: event.target.value }))
                  }
                />
              </div>
              <Button onClick={submitClassAVote} className="bg-slate-900 text-white">
                Record Class A results
              </Button>
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-white/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Record Class B Vote</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input
                placeholder="Reserved matter vote ID"
                value={classBVoteForm.voteId}
                onChange={(event) =>
                  setClassBVoteForm((prev) => ({ ...prev, voteId: event.target.value }))
                }
              />
              <select
                value={classBVoteForm.vote}
                onChange={(event) =>
                  setClassBVoteForm((prev) => ({ ...prev, vote: event.target.value }))
                }
                className="h-10 rounded-md border border-amber-200 bg-white px-3 text-sm"
              >
                <option value="approve">Approve</option>
                <option value="veto">Veto</option>
              </select>
              <Textarea
                placeholder="Vote rationale"
                value={classBVoteForm.voteRationale}
                onChange={(event) =>
                  setClassBVoteForm((prev) => ({ ...prev, voteRationale: event.target.value }))
                }
                rows={2}
              />
              <Textarea
                placeholder='Council members voting JSON (e.g. [{"member":"A","vote":"approve","rationale":""}])'
                value={classBVoteForm.councilMembersVotingJson}
                onChange={(event) =>
                  setClassBVoteForm((prev) => ({ ...prev, councilMembersVotingJson: event.target.value }))
                }
                rows={3}
              />
              <Button onClick={submitClassBVote} className="bg-amber-600 text-white">
                Record Council vote
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Card className="border-amber-200/60 bg-white/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Mission Audit Intake</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Audit year"
                  value={auditForm.auditYear}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, auditYear: event.target.value }))
                  }
                />
                <Input
                  placeholder="Auditor firm"
                  value={auditForm.auditorFirm}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, auditorFirm: event.target.value }))
                  }
                />
                <Input
                  placeholder="Auditor name"
                  value={auditForm.auditorName}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, auditorName: event.target.value }))
                  }
                />
                <Input
                  placeholder="Audit date"
                  type="date"
                  value={auditForm.auditDate}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, auditDate: event.target.value }))
                  }
                />
                <Input
                  placeholder="Audit period start"
                  type="date"
                  value={auditForm.auditPeriodStart}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, auditPeriodStart: event.target.value }))
                  }
                />
                <Input
                  placeholder="Audit period end"
                  type="date"
                  value={auditForm.auditPeriodEnd}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, auditPeriodEnd: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  placeholder="Union revenue %"
                  value={auditForm.unionRevenuePercent}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, unionRevenuePercent: event.target.value }))
                  }
                />
                <Input
                  placeholder="Member satisfaction %"
                  value={auditForm.memberSatisfactionPercent}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, memberSatisfactionPercent: event.target.value }))
                  }
                />
                <Input
                  placeholder="Data violations"
                  value={auditForm.dataViolations}
                  onChange={(event) =>
                    setAuditForm((prev) => ({ ...prev, dataViolations: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Auditor opinion"
                value={auditForm.auditorOpinion}
                onChange={(event) =>
                  setAuditForm((prev) => ({ ...prev, auditorOpinion: event.target.value }))
                }
              />
              <Button onClick={submitAudit} className="gap-2 bg-slate-900 text-white">
                <FileCheck2 className="h-4 w-4" />
                Record audit
              </Button>
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-white/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Audits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.recentAudits || []).map((audit) => (
                <div key={audit.id} className="rounded-xl border border-slate-200/70 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{audit.auditYear}</p>
                    <Badge
                      className={
                        audit.overallPass
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }
                    >
                      {audit.overallPass ? "Pass" : "Fail"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{audit.auditorFirm}</p>
                </div>
              ))}
              {!dashboard?.recentAudits?.length && (
                <p className="text-sm text-slate-500">No audits recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Card className="border-amber-200/60 bg-white/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Council Election Record</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Election year"
                  value={electionForm.electionYear}
                  onChange={(event) =>
                    setElectionForm((prev) => ({ ...prev, electionYear: event.target.value }))
                  }
                />
                <Input
                  placeholder="Election date"
                  type="date"
                  value={electionForm.electionDate}
                  onChange={(event) =>
                    setElectionForm((prev) => ({ ...prev, electionDate: event.target.value }))
                  }
                />
                <Input
                  placeholder="Positions available"
                  value={electionForm.positionsAvailable}
                  onChange={(event) =>
                    setElectionForm((prev) => ({ ...prev, positionsAvailable: event.target.value }))
                  }
                />
                <Input
                  placeholder="Total votes"
                  value={electionForm.totalVotes}
                  onChange={(event) =>
                    setElectionForm((prev) => ({ ...prev, totalVotes: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Participation rate %"
                value={electionForm.participationRate}
                onChange={(event) =>
                  setElectionForm((prev) => ({ ...prev, participationRate: event.target.value }))
                }
              />
              <Textarea
                placeholder='Candidates JSON (e.g. [{"name":"A","union":"Local"}])'
                value={electionForm.candidatesJson}
                onChange={(event) =>
                  setElectionForm((prev) => ({ ...prev, candidatesJson: event.target.value }))
                }
                rows={3}
              />
              <Textarea
                placeholder='Winners JSON (e.g. [{"name":"B","union":"Local","term_start":"2026-02-01","term_end":"2028-02-01"}])'
                value={electionForm.winnersJson}
                onChange={(event) =>
                  setElectionForm((prev) => ({ ...prev, winnersJson: event.target.value }))
                }
                rows={3}
              />
              <Button onClick={submitElection} className="gap-2 bg-amber-600 text-white">
                <Users className="h-4 w-4" />
                Record council election
              </Button>
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-white/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Reserved Matters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.recentVotes || []).map((vote) => (
                <div key={vote.id} className="rounded-xl border border-slate-200/70 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{vote.title}</p>
                  <p className="text-xs text-slate-500">{vote.matterType}</p>
                </div>
              ))}
              {!dashboard?.recentVotes?.length && (
                <p className="text-sm text-slate-500">No reserved matter votes yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-200/60 bg-white/85 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Next 30 Days</CardTitle>
            <Badge className="bg-amber-100 text-amber-700">Governance cadence</Badge>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-200/60 bg-white p-4">
              <CalendarClock className="h-5 w-5 text-amber-700" />
              <p className="mt-3 text-sm font-semibold text-slate-900">Audit milestones</p>
              <p className="text-xs text-slate-500">Ensure audit evidence is uploaded and reviewed.</p>
            </div>
            <div className="rounded-2xl border border-amber-200/60 bg-white p-4">
              <ShieldCheck className="h-5 w-5 text-amber-700" />
              <p className="mt-3 text-sm font-semibold text-slate-900">Council confirmation</p>
              <p className="text-xs text-slate-500">Confirm Class B votes prior to deadlines.</p>
            </div>
            <div className="rounded-2xl border border-amber-200/60 bg-white p-4">
              <Sparkles className="h-5 w-5 text-amber-700" />
              <p className="mt-3 text-sm font-semibold text-slate-900">Mission reporting</p>
              <p className="text-xs text-slate-500">Publish summary for board and council sign-off.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
