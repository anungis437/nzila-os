"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  COMMERCIAL_STATE_ORDER,
  type CommercialState,
  buildProposalPackage,
  getRecommendedEconomicsTier,
  nextCommercialState,
  normalizeCommercialState,
  previousCommercialState,
} from '@/lib/pilot/commercialization-wave1';

type PilotStatus = 'submitted' | 'review' | 'approved' | 'active' | 'completed' | 'declined';

interface PilotApplicationRecord {
  id: string;
  organizationName: string;
  organizationType: 'local' | 'regional' | 'national';
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  memberCount: number;
  jurisdictions: string[];
  sectors: string[];
  currentSystem?: string | null;
  challenges: string[];
  goals: string[];
  readinessScore?: string | null;
  status: PilotStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responses?: Record<string, any>;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
}

interface TimelineEventRecord {
  at: string;
  type: 'commercial_transition' | 'artifact_version' | 'reference_version' | 'intelligence';
  source: string;
  summary: string;
}

interface ArtifactDiffSummary {
  fromVersionId: string;
  toVersionId: string;
  changedArtifactKeys: string[];
  changedSectionCount: number;
  changedItemCount: number;
}

const STATUS_ORDER: PilotStatus[] = [
  'submitted',
  'review',
  'approved',
  'active',
  'completed',
  'declined',
];

const statusClass: Record<PilotStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700 border-slate-200',
  review: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  active: 'bg-violet-100 text-violet-700 border-violet-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  declined: 'bg-rose-100 text-rose-700 border-rose-200',
};

function toArrayPayload(payload: any): PilotApplicationRecord[] {
  if (Array.isArray(payload)) return payload as PilotApplicationRecord[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as PilotApplicationRecord[];
    if (Array.isArray(obj.items)) return obj.items as PilotApplicationRecord[];
  }
  return [];
}

export default function AdminPilotApplicationsPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? 'en-CA';
  const [applications, setApplications] = useState<PilotApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proposalDraft, setProposalDraft] = useState('');
  const [search, setSearch] = useState('');
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [savingCommercialId, setSavingCommercialId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEventRecord[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [latestArtifactVersionId, setLatestArtifactVersionId] = useState<string | null>(null);
  const [latestArtifactDiff, setLatestArtifactDiff] = useState<ArtifactDiffSummary | null>(null);
  const [operationalRefresh, setOperationalRefresh] = useState(0);

  const selected = useMemo(
    () => applications.find((app) => app.id === selectedId) ?? null,
    [applications, selectedId],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return applications;
    const q = search.trim().toLowerCase();
    return applications.filter((app) =>
      [app.organizationName, app.contactName, app.contactEmail, app.status]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [applications, search]);

  const counts = useMemo(() => {
    const base: Record<PilotStatus, number> = {
      submitted: 0,
      review: 0,
      approved: 0,
      active: 0,
      completed: 0,
      declined: 0,
    };
    for (const app of applications) base[app.status] += 1;
    return base;
  }, [applications]);

  async function loadApplications() {
    setLoading(true);
    try {
      const response = await fetch('/api/pilot/apply', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load applications (${response.status})`);
      }
      const payload = await response.json();
      const rows = toArrayPayload(payload).sort((a, b) => {
        const left = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const right = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return right - left;
      });
      setApplications(rows);
      if (!selectedId && rows[0]) {
        setSelectedId(rows[0].id);
      }
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load pilot applications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) {
      const responses = (selected.responses ?? {}) as Record<string, unknown>;
      const commercialState = normalizeCommercialState(responses.commercialState);
      const championScore = typeof responses.championScore === 'number' ? responses.championScore : undefined;
      const activityScore = typeof responses.activityScore === 'number' ? responses.activityScore : undefined;
      setProposalDraft(
        buildProposalPackage(
          {
            id: selected.id,
            organizationName: selected.organizationName,
            organizationType: selected.organizationType,
            contactName: selected.contactName,
            contactEmail: selected.contactEmail,
            memberCount: selected.memberCount,
            jurisdictions: selected.jurisdictions,
            sectors: selected.sectors,
            currentSystem: selected.currentSystem,
            challenges: selected.challenges,
            goals: selected.goals,
            readinessScore: selected.readinessScore,
          },
          { commercialState, championScore, activityScore },
        ).markdown,
      );
    } else {
      setProposalDraft('');
    }
  }, [selected]);

  useEffect(() => {
    const pilotId = selected?.id;
    if (!pilotId) {
      setTimeline([]);
      setLatestArtifactVersionId(null);
      setLatestArtifactDiff(null);
      return;
    }

    async function loadOperationalPanel() {
      setTimelineLoading(true);
      try {
        const [timelineResponse, artifactResponse] = await Promise.all([
          fetch(`/api/pilot/apply/${pilotId}/commercialization-timeline`, { cache: 'no-store' }),
          fetch(`/api/pilot/apply/${pilotId}/artifacts`, { cache: 'no-store' }),
        ]);

        if (timelineResponse.ok) {
          const timelinePayload = await timelineResponse.json();
          const events = Array.isArray(timelinePayload?.data?.events)
            ? (timelinePayload.data.events as TimelineEventRecord[])
            : [];
          setTimeline(events);
        } else {
          setTimeline([]);
        }

        if (artifactResponse.ok) {
          const artifactPayload = await artifactResponse.json();
          setLatestArtifactVersionId(
            typeof artifactPayload?.data?.latestVersionId === 'string'
              ? artifactPayload.data.latestVersionId
              : null,
          );
          setLatestArtifactDiff(
            artifactPayload?.data?.latestDiff && typeof artifactPayload.data.latestDiff === 'object'
              ? (artifactPayload.data.latestDiff as ArtifactDiffSummary)
              : null,
          );
        } else {
          setLatestArtifactVersionId(null);
          setLatestArtifactDiff(null);
        }
      } catch {
        setTimeline([]);
        setLatestArtifactVersionId(null);
        setLatestArtifactDiff(null);
      } finally {
        setTimelineLoading(false);
      }
    }

    loadOperationalPanel();
  }, [selected?.id, operationalRefresh]);

  const selectedCommercialState: CommercialState = normalizeCommercialState(selected?.responses?.commercialState);

  const selectedProposal = useMemo(() => {
    if (!selected) return null;
    const responses = (selected.responses ?? {}) as Record<string, unknown>;
    const commercialState = normalizeCommercialState(responses.commercialState);
    const championScore = typeof responses.championScore === 'number' ? responses.championScore : undefined;
    const activityScore = typeof responses.activityScore === 'number' ? responses.activityScore : undefined;

    return buildProposalPackage(
      {
        id: selected.id,
        organizationName: selected.organizationName,
        organizationType: selected.organizationType,
        contactName: selected.contactName,
        contactEmail: selected.contactEmail,
        memberCount: selected.memberCount,
        jurisdictions: selected.jurisdictions,
        sectors: selected.sectors,
        currentSystem: selected.currentSystem,
        challenges: selected.challenges,
        goals: selected.goals,
        readinessScore: selected.readinessScore,
      },
      { commercialState, championScore, activityScore },
    );
  }, [selected]);

  async function updateStatus(id: string, nextStatus: PilotStatus) {
    setSavingStatusId(id);
    try {
      const nowIso = new Date().toISOString();
      const body: Record<string, string> = { status: nextStatus };
      if (nextStatus === 'review') body.reviewedAt = nowIso;
      if (nextStatus === 'approved') body.approvedAt = nowIso;

      const response = await fetch(`/api/pilot/apply/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || `Failed to update status (${response.status})`);
      }

      setApplications((prev) => prev.map((app) => (app.id === id ? { ...app, ...body } : app)));
      setOperationalRefresh((value) => value + 1);
      toast.success(`Pilot application moved to ${nextStatus}`);
    } catch (error) {
      toast.error((error as Error).message || 'Unable to update status');
    } finally {
      setSavingStatusId(null);
    }
  }

  async function copyProposal() {
    try {
      await navigator.clipboard.writeText(proposalDraft);
      toast.success('Proposal draft copied to clipboard');
    } catch {
      toast.error('Unable to copy proposal draft');
    }
  }

  async function downloadProposalPackage() {
    if (!selected) return;
    try {
      const response = await fetch(`/api/pilot/apply/${selected.id}/proposal`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unable to generate proposal (${response.status})`);
      }
      const payload = await response.json();
      const markdown = payload?.data?.markdown as string | undefined;
      if (!markdown) throw new Error('Proposal payload was empty');
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `pilot-proposal-${selected.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(href);
      toast.success('Proposal package downloaded');
    } catch (error) {
      toast.error((error as Error).message || 'Unable to download proposal package');
    }
  }

  async function downloadCupePilotPackage() {
    if (!selected) return;
    try {
      const response = await fetch(`/api/pilot/apply/${selected.id}/package-export`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unable to export pilot package (${response.status})`);
      }
      const payload = await response.json();
      const markdown = payload?.data?.bundleMarkdown as string | undefined;
      const fileName = (payload?.data?.fileName as string | undefined) ?? 'pilot-package-export.md';
      if (!markdown) throw new Error('Export payload was empty');

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(href);
      toast.success('Pilot package export downloaded');
    } catch (error) {
      toast.error((error as Error).message || 'Unable to export pilot package');
    }
  }

  async function updateCommercialState(next: CommercialState) {
    if (!selected) return;
    setSavingCommercialId(selected.id);
    try {
      const response = await fetch(`/api/pilot/apply/${selected.id}/commercial-transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetState: next, source: 'admin-ui' }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || `Unable to update commercial state (${response.status})`);
      }

      await loadApplications();
      setOperationalRefresh((value) => value + 1);
      toast.success(`Commercial state moved to ${next}`);
    } catch (error) {
      toast.error((error as Error).message || 'Unable to update commercial state');
    } finally {
      setSavingCommercialId(null);
    }
  }

  async function applyCupeReferenceTemplate() {
    if (!selected) return;
    setSavingCommercialId(selected.id);
    try {
      const response = await fetch(`/api/pilot/apply/${selected.id}/commercial-transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetState: 'qualified',
          source: 'admin-ui',
          applyReferenceTemplate: 'CUPE4373',
          allowSkip: true,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || `Unable to apply CUPE template (${response.status})`);
      }

      await loadApplications();
      setOperationalRefresh((value) => value + 1);
      toast.success('CUPE4373 reference template applied');
    } catch (error) {
      toast.error((error as Error).message || 'Unable to apply CUPE template');
    } finally {
      setSavingCommercialId(null);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Pilot Applications</h1>
        <p className="text-muted-foreground">
          Review applications, advance pilot stages, and generate proposal drafts using existing pilot infrastructure.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {STATUS_ORDER.map((status) => (
          <Card key={status}>
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{status}</p>
              <p className="text-2xl font-semibold">{counts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader className="space-y-3">
            <CardTitle>Queue</CardTitle>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search organization, contact, email, status"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading pilot applications...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pilot applications found.</p>
            ) : (
              filtered.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedId(app.id)}
                  className={`w-full text-left rounded-lg border p-3 transition ${
                    selectedId === app.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{app.organizationName}</p>
                      <p className="text-xs text-muted-foreground">{app.contactName} · {app.contactEmail}</p>
                    </div>
                    <Badge className={statusClass[app.status]}>{app.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {app.memberCount} members · readiness {app.readinessScore ?? 'n/a'}
                  </p>
                </button>
              ))
            )}
            <Button variant="outline" onClick={loadApplications} className="w-full">
              Refresh queue
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select an application to review.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Organization</p>
                      <p className="font-medium">{selected.organizationName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">{selected.organizationType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Contact</p>
                      <p className="font-medium">{selected.contactName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{selected.contactEmail}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Member count</p>
                      <p className="font-medium">{selected.memberCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Readiness score</p>
                      <p className="font-medium">{selected.readinessScore ?? 'n/a'}</p>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted-foreground">Challenges</p>
                    <p>{selected.challenges.join(', ') || 'n/a'}</p>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted-foreground">Goals</p>
                    <p>{selected.goals.join(', ') || 'n/a'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Recommended pilot tier</p>
                      <p className="font-medium">{getRecommendedEconomicsTier(selected.memberCount).label}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Target price band</p>
                      <p className="font-medium">{getRecommendedEconomicsTier(selected.memberCount).targetPriceRange}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Commercial state machine</p>
                    <div className="flex flex-wrap gap-2">
                      {COMMERCIAL_STATE_ORDER.map((state) => (
                        <Badge
                          key={state}
                          className={selectedCommercialState === state ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                        >
                          {state}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selected || savingCommercialId === selected.id}
                        onClick={() => updateCommercialState(previousCommercialState(selectedCommercialState))}
                      >
                        Move backward
                      </Button>
                      <Button
                        size="sm"
                        disabled={!selected || savingCommercialId === selected.id}
                        onClick={() => updateCommercialState(nextCommercialState(selectedCommercialState))}
                      >
                        Move forward
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selected || savingCommercialId === selected.id}
                        onClick={applyCupeReferenceTemplate}
                      >
                        Apply CUPE4373 template
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Commercial state</p>
                        <p className="font-medium">{selectedCommercialState}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Opportunity tier</p>
                        <p className="font-medium">Tier {selectedProposal?.qualificationScores.opportunityTier ?? 'n/a'}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Latest artifact version</p>
                        <p className="font-medium text-xs">{latestArtifactVersionId ?? 'not persisted yet'}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {latestArtifactDiff && (
                    <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
                      <p>
                        Artifact diff {latestArtifactDiff.fromVersionId} to {latestArtifactDiff.toVersionId}
                      </p>
                      <p>
                        Changed artifacts: {latestArtifactDiff.changedArtifactKeys.join(', ') || 'none'}
                      </p>
                      <p>
                        Changed sections: {latestArtifactDiff.changedSectionCount} · Changed items: {latestArtifactDiff.changedItemCount}
                      </p>
                    </div>
                  )}

                  {selectedProposal && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Opportunity</p>
                            <p className="text-xl font-semibold">
                              {selectedProposal.qualificationScores.overallOpportunityScore}
                              <span className="ml-2 text-sm text-muted-foreground">Tier {selectedProposal.qualificationScores.opportunityTier}</span>
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Pilot Fit</p>
                            <p className="text-xl font-semibold">{selectedProposal.qualificationScores.pilotFitScore}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Pilot Revenue</p>
                            <p className="text-xl font-semibold">{selectedProposal.qualificationScores.pilotRevenueScore}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Pilot Readiness</p>
                            <p className="text-xl font-semibold">{selectedProposal.qualificationScores.pilotReadinessScore}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Strategic Value</p>
                            <p className="text-xl font-semibold">{selectedProposal.qualificationScores.pilotStrategicValueScore}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Pilot Risk</p>
                            <p className="text-xl font-semibold">{selectedProposal.qualificationScores.pilotRiskScore}</p>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Adoption</p>
                            <p className="text-xl font-semibold">{selectedProposal.signals.adoptionScore}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Activity</p>
                            <p className="text-xl font-semibold">{selectedProposal.signals.activityScore}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Champion</p>
                            <p className="text-xl font-semibold">{selectedProposal.signals.championScore}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Risk</p>
                            <p className="text-xl font-semibold">{selectedProposal.signals.riskScore}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {STATUS_ORDER.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={selected.status === status ? 'default' : 'outline'}
                        onClick={() => updateStatus(selected.id, status)}
                        disabled={savingStatusId === selected.id || selected.status === status}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposal Draft Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={proposalDraft}
                onChange={(event) => setProposalDraft(event.target.value)}
                className="min-h-[260px] font-mono text-xs"
                placeholder="Select an application to generate a proposal draft."
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={copyProposal} disabled={!proposalDraft}>Copy draft</Button>
                <Button
                  variant="outline"
                  onClick={() => selectedProposal && setProposalDraft(selectedProposal.markdown)}
                  disabled={!selected}
                >
                  Regenerate draft
                </Button>
                <Button variant="outline" onClick={downloadProposalPackage} disabled={!selected}>
                  Download package
                </Button>
                <Button variant="outline" onClick={downloadCupePilotPackage} disabled={!selected}>
                  Export CUPE4373 package
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.assign(`/${locale}/dashboard/billing-admin`)}
                >
                  Initiate conversion handoff
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this draft as the pilot proposal baseline, then finalize commercial terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commercialization Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {timelineLoading ? (
                <p className="text-sm text-muted-foreground">Loading timeline...</p>
              ) : timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No timeline events recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {timeline.slice(0, 30).map((event, idx) => (
                    <div key={`${event.at}-${event.type}-${idx}`} className="rounded-md border p-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.at).toLocaleString()} · {event.type} · {event.source}
                      </p>
                      <p className="text-sm">{event.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
