'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Flag,
  Users,
  MapPin,
  Calendar,
  Target,
  Award,
  TrendingUp,
  CheckCircle,
  XCircle,
  Pause,
  Search,
  Clock,
  AlertCircle,
  Briefcase,
  FileText,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ---------------------------------------------------------------------------
// Types (mirroring the DB schema columns available via the proxy API)
// ---------------------------------------------------------------------------
interface Campaign {
  id: string;
  campaignName: string;
  campaignCode: string;
  campaignType: string;
  campaignStatus: string;
  targetEmployerName: string;
  workplaceCity: string;
  workplaceProvince: string;
  estimatedEligibleWorkers: number;
  cardsSignedCount: number;
  cardsSignedPercentage: number;
  cardSigningThresholdPercentage: number;
  superMajorityThresholdPercentage: number;
  organizingCommitteeSize: number;
  campaignLaunchDate?: string;
  cardCheckDeadline?: string;
  // Extended fields (may not be filled from proxy)
  industry?: string;
  priority?: string;
  organizingStrategy?: string;
  keyIssues?: string[];
  contactsIdentified?: number;
  contactsCommitted?: number;
  houseVisitsCompleted?: number;
  workplaceMeetingsHeld?: number;
  electionEligibleVoters?: number;
  votesForUnion?: number;
  votesAgainstUnion?: number;
  electionResult?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatStatusLabel(status: string) {
  return status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(dateString?: string) {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default', card_check: 'secondary', certification_pending: 'secondary',
    certification_vote: 'secondary', won: 'default', lost: 'destructive',
    research: 'outline', pre_campaign: 'outline', suspended: 'destructive', abandoned: 'destructive',
  };
  return map[status] || 'outline';
}

function getStatusIcon(status: string) {
  const icons: Record<string, typeof Flag> = {
    active: TrendingUp, card_check: CheckCircle, won: Award,
    lost: XCircle, suspended: Pause, research: Search,
  };
  const Icon = icons[status] || Flag;
  return <Icon className="w-4 h-4" />;
}

function getProgressColor(pct: number, warn: number, good: number) {
  if (pct >= good) return 'bg-green-600';
  if (pct >= warn) return 'bg-yellow-600';
  return 'bg-red-600';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CampaignDetailConsole({ campaignId }: { campaignId: string }) {
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // The proxy forwards to Django; try the campaigns list and pick by id
      const res = await fetch('/api/v2/organizing/campaigns');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const items: Campaign[] = Array.isArray(json) ? json : (json?.campaigns ?? json?.data ?? []);
      const found = items.find((c) => c.id === campaignId);
      if (found) {
        setCampaign(found);
      } else {
        setError('Campaign not found.');
      }
    } catch {
      setError('Unable to load campaign details.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-100">
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading campaign details...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-6 space-y-6">
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h3 className="text-xl font-semibold mb-2 text-red-900">Error</h3>
              <p className="text-red-800 mb-4">{error || 'Campaign not found.'}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => load()}>Retry</Button>
                <Button variant="outline" onClick={() => router.push(`${localePrefix}/dashboard/organizing`)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaigns
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pct = campaign.cardsSignedPercentage;
  const progressVal = Math.min(pct, 100);

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/dashboard/organizing`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">{campaign.campaignName}</h1>
            <Badge variant={getStatusBadgeVariant(campaign.campaignStatus)} className="gap-1">
              {getStatusIcon(campaign.campaignStatus)}
              {formatStatusLabel(campaign.campaignStatus)}
            </Badge>
          </div>
          <p className="text-muted-foreground">{campaign.targetEmployerName}</p>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{campaign.workplaceCity}, {campaign.workplaceProvince}</span>
            <span className="text-xs bg-muted px-2 py-1 rounded">{campaign.campaignCode}</span>
            {campaign.industry && <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{campaign.industry}</span>}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Eligible Workers</p>
                <p className="text-2xl font-bold">{campaign.estimatedEligibleWorkers.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cards Signed</p>
                <p className="text-2xl font-bold">{campaign.cardsSignedCount}</p>
              </div>
              <FileText className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Signing %</p>
                <p className="text-2xl font-bold">{pct.toFixed(1)}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Committee</p>
                <p className="text-2xl font-bold">{campaign.organizingCommitteeSize}</p>
              </div>
              <Target className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card signing progress */}
      <Card>
        <CardHeader>
          <CardTitle>Card Signing Progress</CardTitle>
          <CardDescription>
            {campaign.cardsSignedCount} of {campaign.estimatedEligibleWorkers} workers signed ({pct.toFixed(1)}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden mb-2">
            <div
              className="absolute h-full border-l-2 border-yellow-800 opacity-50"
              style={{ left: `${campaign.cardSigningThresholdPercentage}%` }}
            />
            <div
              className="absolute h-full border-l-2 border-green-800 opacity-50"
              style={{ left: `${campaign.superMajorityThresholdPercentage}%` }}
            />
            <div
              className={`h-full transition-all ${getProgressColor(pct, campaign.cardSigningThresholdPercentage, campaign.superMajorityThresholdPercentage)}`}
              style={{ width: `${progressVal}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-yellow-800" /> Threshold ({campaign.cardSigningThresholdPercentage}%)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-800" /> Super Majority ({campaign.superMajorityThresholdPercentage}%)</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="outreach">Outreach Metrics</TabsTrigger>
          {campaign.electionResult && <TabsTrigger value="results">Election Results</TabsTrigger>}
        </TabsList>

        {/* Details */}
        <TabsContent value="details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Campaign Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Type" value={formatStatusLabel(campaign.campaignType)} />
                <Row label="Priority" value={campaign.priority ? formatStatusLabel(campaign.priority) : '—'} />
                <Row label="Industry" value={campaign.industry ?? '—'} />
                <Row label="Campaign Code" value={campaign.campaignCode} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Key Dates</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Launch Date" value={formatDate(campaign.campaignLaunchDate)} icon={<Calendar className="w-3 h-3" />} />
                <Row label="Card Check Deadline" value={formatDate(campaign.cardCheckDeadline)} icon={<Target className="w-3 h-3" />} />
              </CardContent>
            </Card>
            {campaign.keyIssues && campaign.keyIssues.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">Key Issues</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {campaign.keyIssues.map((issue, i) => (
                      <Badge key={i} variant="secondary">{issue}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {campaign.organizingStrategy && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">Organizing Strategy</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{campaign.organizingStrategy}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader><CardTitle>Campaign Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <TimelineItem label="Campaign Launch" date={campaign.campaignLaunchDate} icon={<Flag className="w-4 h-4" />} />
                <TimelineItem label="Card Check Deadline" date={campaign.cardCheckDeadline} icon={<Target className="w-4 h-4" />} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outreach */}
        <TabsContent value="outreach">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Contacts Identified" value={campaign.contactsIdentified ?? 0} />
            <MetricCard label="Contacts Committed" value={campaign.contactsCommitted ?? 0} />
            <MetricCard label="House Visits" value={campaign.houseVisitsCompleted ?? 0} />
            <MetricCard label="Workplace Meetings" value={campaign.workplaceMeetingsHeld ?? 0} />
          </div>
          {(campaign.contactsIdentified ?? 0) > 0 && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">Commitment Funnel</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <FunnelRow label="Identified" value={campaign.contactsIdentified ?? 0} total={campaign.estimatedEligibleWorkers} />
                <FunnelRow label="Committed" value={campaign.contactsCommitted ?? 0} total={campaign.estimatedEligibleWorkers} />
                <FunnelRow label="Cards Signed" value={campaign.cardsSignedCount} total={campaign.estimatedEligibleWorkers} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Election results */}
        {campaign.electionResult && (
          <TabsContent value="results">
            <Card>
              <CardHeader><CardTitle>Election Results</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Result" value={formatStatusLabel(campaign.electionResult)} />
                <Row label="Eligible Voters" value={String(campaign.electionEligibleVoters ?? '—')} />
                <Row label="Votes For" value={String(campaign.votesForUnion ?? '—')} />
                <Row label="Votes Against" value={String(campaign.votesAgainstUnion ?? '—')} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------
function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium flex items-center gap-1">{icon}{value}</span>
    </div>
  );
}

function TimelineItem({ label, date, icon }: { label: string; date?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{formatDate(date)}</div>
      </div>
      {date && <Badge variant="outline" className="text-xs">{new Date(date) <= new Date() ? 'Past' : 'Upcoming'}</Badge>}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function FunnelRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value.toLocaleString()} ({pct}%)</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
