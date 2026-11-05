'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
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
import { ApiShapeError, isRecord } from '@/lib/client/api-envelope';
import { fetchAllRows } from '@/lib/client/crud-lists';
import { formatCampaignDate, formatStatusLabel, readCampaign, signingPercent, targetPercent, type Campaign } from './organizing-readers';

const DASH = '—';
const LOAD_FAILED = 'Unable to load campaign details.';
const NOT_FOUND = 'Campaign not found.';

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    card_check: 'secondary',
    certification_pending: 'secondary',
    certification_vote: 'secondary',
    won: 'default',
    lost: 'destructive',
    research: 'outline',
    planning: 'outline',
    pre_campaign: 'outline',
    suspended: 'destructive',
    abandoned: 'destructive',
  };
  return map[status] || 'outline';
}

function getStatusIcon(status: string) {
  const icons: Record<string, typeof Flag> = {
    active: TrendingUp,
    card_check: CheckCircle,
    won: Award,
    lost: XCircle,
    suspended: Pause,
    research: Search,
  };
  const Icon = icons[status] || Flag;
  return <Icon className="w-4 h-4" />;
}

const figure = (value: number | null) => (value === null ? DASH : value.toLocaleString());

export function CampaignDetailConsole({ campaignId }: { campaignId: string }) {
  const locale = useLocale();
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // There is no single-campaign route: the list is read and the campaign is picked out of it.
      const rows = await fetchAllRows<unknown>('/api/organizing/campaigns');
      const found = rows.find((row) => isRecord(row) && row.id === campaignId);
      if (found === undefined) {
        setCampaign(null);
        setError(NOT_FOUND);
      } else {
        setCampaign(readCampaign(found));
      }
    } catch (failure) {
      setCampaign(null);
      setError(failure instanceof ApiShapeError || failure instanceof TypeError ? LOAD_FAILED : (failure as Error).message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <Card role="alert" className="border-2 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h3 className="text-xl font-semibold mb-2 text-red-900">Error</h3>
              <p className="text-red-800 mb-4">{error || NOT_FOUND}</p>
              <div className="flex gap-2 justify-center">
                {error !== NOT_FOUND && (
                  <Button variant="outline" onClick={() => void load()}>
                    Retry
                  </Button>
                )}
                <Link href={`${localePrefix}/dashboard/organizing`}>
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaigns
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const percent = signingPercent(campaign);
  const target = targetPercent(campaign);
  const percentText = percent === null ? DASH : `${percent.toFixed(1)}%`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`${localePrefix}/dashboard/organizing`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">{campaign.campaignName}</h1>
            <Badge variant={getStatusBadgeVariant(campaign.status)} className="gap-1">
              {getStatusIcon(campaign.status)}
              {formatStatusLabel(campaign.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">{campaign.targetEmployer}</p>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {campaign.workplaceLocation}
            </span>
            <span className="text-xs bg-muted px-2 py-1 rounded">{campaign.campaignCode}</span>
            {campaign.industry && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {campaign.industry}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Workers</p>
                <p className="text-2xl font-bold">{campaign.estimatedUnitSize.toLocaleString()}</p>
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
                <p className="text-2xl font-bold">{figure(campaign.cardsSigned)}</p>
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
                <p className="text-2xl font-bold">{percentText}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Organizing Team</p>
                <p className="text-2xl font-bold">{figure(campaign.teamSize)}</p>
              </div>
              <Target className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Card Signing Progress</CardTitle>
          <CardDescription>
            {figure(campaign.cardsSigned)} of {campaign.estimatedUnitSize.toLocaleString()} workers signed ({percentText})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden mb-2">
            {target !== null && <div className="absolute h-full border-l-2 border-yellow-800 opacity-50" style={{ left: `${Math.min(target, 100)}%` }} />}
            <div className="h-full transition-all bg-blue-600" style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0%</span>
            {campaign.targetCardCount !== null && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-yellow-800" /> Card target ({campaign.targetCardCount.toLocaleString()} cards)
              </span>
            )}
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="outreach">Outreach Metrics</TabsTrigger>
          {campaign.electionResult && <TabsTrigger value="results">Election Results</TabsTrigger>}
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Type" value={formatStatusLabel(campaign.campaignType)} />
                <Row label="Priority" value={campaign.priority ? formatStatusLabel(campaign.priority) : DASH} />
                <Row label="Industry" value={campaign.industry ?? DASH} />
                <Row label="Campaign Code" value={campaign.campaignCode} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Start Date" value={formatCampaignDate(campaign.campaignStartDate, locale)} icon={<Calendar className="w-3 h-3" />} />
                <Row label="Card Deadline" value={formatCampaignDate(campaign.targetCardDeadline, locale)} icon={<Target className="w-3 h-3" />} />
                <Row label="Certification" value={formatCampaignDate(campaign.certificationDate, locale)} icon={<Award className="w-3 h-3" />} />
              </CardContent>
            </Card>
            {campaign.keyIssues.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Key Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {campaign.keyIssues.map((issue, i) => (
                      <Badge key={`${issue}-${i}`} variant="secondary">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {campaign.organizingStrategy && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Organizing Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{campaign.organizingStrategy}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <TimelineItem label="Campaign Start" date={campaign.campaignStartDate} icon={<Flag className="w-4 h-4" />} />
                <TimelineItem label="Card Deadline" date={campaign.targetCardDeadline} icon={<Target className="w-4 h-4" />} />
                <TimelineItem label="Filing" date={campaign.filingDate} icon={<FileText className="w-4 h-4" />} />
                <TimelineItem label="Election" date={campaign.electionDate} icon={<CheckCircle className="w-4 h-4" />} />
                <TimelineItem label="Certification" date={campaign.certificationDate} icon={<Award className="w-4 h-4" />} />
                <TimelineItem label="Campaign End" date={campaign.campaignEndDate} icon={<Pause className="w-4 h-4" />} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outreach">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Contacts Identified" value={campaign.contactsIdentified} />
            <MetricCard label="Contacts Committed" value={campaign.contactsCommitted} />
            <MetricCard label="House Visits" value={campaign.houseVisitsCompleted} />
            <MetricCard label="Workplace Meetings" value={campaign.workplaceMeetingsHeld} />
          </div>
          {(campaign.contactsIdentified ?? 0) > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Commitment Funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FunnelRow label="Identified" value={campaign.contactsIdentified} total={campaign.estimatedUnitSize} />
                <FunnelRow label="Committed" value={campaign.contactsCommitted} total={campaign.estimatedUnitSize} />
                <FunnelRow label="Cards Signed" value={campaign.cardsSigned} total={campaign.estimatedUnitSize} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {campaign.electionResult && (
          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>Election Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Result" value={formatStatusLabel(campaign.electionResult)} />
                <Row label="Eligible Voters" value={figure(campaign.electionEligibleVoters)} />
                <Row label="Votes For" value={figure(campaign.votesForUnion)} />
                <Row label="Votes Against" value={figure(campaign.votesAgainstUnion)} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium flex items-center gap-1">
        {icon}
        {value}
      </span>
    </div>
  );
}

function TimelineItem({ label, date, icon }: { label: string; date: string | null; icon: React.ReactNode }) {
  const locale = useLocale();
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{formatCampaignDate(date, locale)}</div>
      </div>
      {date !== null && (
        <Badge variant="outline" className="text-xs">
          {new Date(date) <= new Date() ? 'Past' : 'Upcoming'}
        </Badge>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <p className="text-2xl font-bold">{figure(value)}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function FunnelRow({ label, value, total }: { label: string; value: number | null; total: number }) {
  if (value === null) return null;
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">
          {value.toLocaleString()} ({pct}%)
        </span>
      </div>
      <Progress value={Math.min(pct, 100)} className="h-2" />
    </div>
  );
}
