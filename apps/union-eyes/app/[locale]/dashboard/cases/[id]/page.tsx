/**
 * Case Detail Page (Dashboard)
 * 
 * Comprehensive case view with timeline, evidence, and actions.
 * This page lives under /dashboard so it inherits the sidebar layout.
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { useHasPermission } from '@/lib/auth/rbac-hooks';
import { Permission } from '@/lib/auth/roles';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/index';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  User,
  Calendar,
  AlertCircle,
  Upload,
  Download,
  MessageSquare,
  CheckCircle,
  Brain,
  DollarSign,
  Edit,
} from 'lucide-react';

interface CaseDetail {
  id: string;
  caseNumber: string;
  memberName: string;
  memberId: string;
  memberEmail: string;
  memberPhone: string;
  isAnonymous: boolean;
  type: string;
  status: string;
  priority: string;
  description: string;
  desiredOutcome: string;
  incidentDate: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
  assignedTo: string;
  assignedToId: string;
  assignedAt: string | null;
  // AI Assessment
  aiScore: number | null;
  meritConfidence: number | null;
  precedentMatch: number | null;
  complexityScore: number | null;
  // Financial
  claimAmount: string | null;
  settlementAmount: string | null;
  legalCosts: string | null;
  courtCosts: string | null;
  // Resolution
  resolutionOutcome: string | null;
  resolvedAt: string | null;
  progress: number | null;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  actor: string;
}

interface Evidence {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
}

export default function CaseDetailPage() {
  const _router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations('caseDetailPage');
  const caseId = params.id as string;
  const canManageClaims = useHasPermission(Permission.EDIT_ALL_CLAIMS);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<{ status: string; priority: string; description: string }>({ status: '', priority: '', description: '' });

  useEffect(() => {
    fetchCaseDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const fetchCaseDetail = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unwrap = (d: any) => d?.data?.data ?? d?.data ?? d;
    try {
      // Case data is critical — must succeed
      const caseData = await api.cases.get(caseId);
      const raw = unwrap(caseData);
      // Map claim fields to CaseDetail interface
      setCaseDetail({
        id: raw?.claimId ?? raw?.id ?? '',
        caseNumber: raw?.claimNumber ?? raw?.caseNumber ?? '',
        memberName: raw?.memberName ?? '',
        memberId: raw?.memberId ?? '',
        memberEmail: raw?.memberEmail ?? '',
        memberPhone: raw?.memberPhone ?? '',
        isAnonymous: raw?.isAnonymous ?? false,
        type: raw?.claimType ?? raw?.type ?? '',
        status: raw?.status ?? '',
        priority: raw?.priority ?? '',
        description: raw?.description ?? '',
        desiredOutcome: raw?.desiredOutcome ?? '',
        incidentDate: raw?.incidentDate ?? '',
        location: raw?.location ?? '',
        createdAt: raw?.createdAt ?? '',
        updatedAt: raw?.updatedAt ?? '',
        deadline: raw?.deadline ?? null,
        assignedTo: raw?.assignedTo ?? '',
        assignedToId: raw?.assignedToId ?? '',
        assignedAt: raw?.assignedAt ?? null,
        aiScore: raw?.aiScore ?? null,
        meritConfidence: raw?.meritConfidence ?? null,
        precedentMatch: raw?.precedentMatch ?? null,
        complexityScore: raw?.complexityScore ?? null,
        claimAmount: raw?.claimAmount ?? null,
        settlementAmount: raw?.settlementAmount ?? null,
        legalCosts: raw?.legalCosts ?? null,
        courtCosts: raw?.courtCosts ?? null,
        resolutionOutcome: raw?.resolutionOutcome ?? null,
        resolvedAt: raw?.resolvedAt ?? null,
        progress: raw?.progress ?? null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error fetching case', error);
      setError(msg);
      setLoading(false);
      return;
    }

    // Timeline and evidence are non-critical — don't block case display
    try {
      const timelineData = await api.cases.timeline(caseId);
      const tl = unwrap(timelineData);
      setTimeline(Array.isArray(tl) ? tl : []);
    } catch (_e) {
      logger.warn('Failed to fetch case timeline');
    }
    try {
      const evidenceData = await api.cases.evidence.list(caseId);
      const ev = unwrap(evidenceData);
      setEvidence(Array.isArray(ev) ? ev : []);
    } catch (_e) {
      logger.warn('Failed to fetch case evidence');
    }

    setLoading(false);
  };

  const addNote = async () => {
    if (!note.trim()) return;

    try {
      await api.cases.notes.create(caseId, note);
      setNote('');
      // Refresh timeline to show new note
      const timelineData = await api.cases.timeline(caseId);
      setTimeline(timelineData as TimelineEvent[]);
    } catch (error) {
      logger.error('Error adding note', error);
    }
  };

  const startEditing = () => {
    if (!caseDetail) return;
    setEditFields({
      status: caseDetail.status,
      priority: caseDetail.priority,
      description: caseDetail.description,
    });
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveEdits = async () => {
    try {
      await api.cases.update(caseId, editFields);
      setCaseDetail((prev) => prev ? { ...prev, ...editFields } : prev);
      setEditing(false);
    } catch (err) {
      logger.error('Error saving case edits', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'investigation':
        return 'bg-blue-100 text-blue-800';
      case 'mediation':
        return 'bg-yellow-100 text-yellow-800';
      case 'arbitration':
        return 'bg-purple-100 text-purple-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (value: string) => new Date(value).toLocaleDateString(locale);
  const formatDateTime = (value: string) => new Date(value).toLocaleString(locale);
  const formatCurrency = (value: string | null) => {
    if (!value) return null;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(Number(value));
  };
  const formatCaseType = (value: string) => value.replace('_', ' ');
  const formatStatus = (value: string) => t(`statuses.${value}`);
  const formatPriority = (value: string) => t(`priorities.${value}`);

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('error.title')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button variant="outline" onClick={() => { setError(null); setLoading(true); fetchCaseDetail(); }}>
            {t('error.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !caseDetail) {
    return <div className="container mx-auto py-6">{t('loading')}</div>;
  }

  const isOverdue = caseDetail.deadline && new Date(caseDetail.deadline) < new Date();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span>{t('breadcrumbs.cases')}</span>
          <span>/</span>
          <span>{caseDetail.caseNumber}</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{caseDetail.caseNumber}</h1>
            <p className="text-muted-foreground mt-1">
              {t('openedLine', { type: formatCaseType(caseDetail.type), date: formatDate(caseDetail.createdAt) })}
            </p>
          </div>
          <div className="flex gap-2">
            {canManageClaims && !editing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </Button>
            )}
            {editing && (
              <>
                <Button size="sm" onClick={saveEdits}>{t('actions.save')}</Button>
                <Button variant="outline" size="sm" onClick={cancelEditing}>{t('actions.cancel')}</Button>
              </>
            )}
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              {t('actions.export')}
            </Button>
          </div>
        </div>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('cards.member')}</span>
          </div>
          <p className="font-medium">{caseDetail.memberName}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('cards.status')}</span>
          </div>
          {editing ? (
            <select
              value={editFields.status}
              onChange={(e) => setEditFields({ ...editFields, status: e.target.value })}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              {['submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation', 'resolved', 'rejected', 'closed'].map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
          ) : (
            <Badge className={getStatusColor(caseDetail.status)}>
              {formatStatus(caseDetail.status)}
            </Badge>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('cards.priority')}</span>
          </div>
          {editing ? (
            <select
              value={editFields.priority}
              onChange={(e) => setEditFields({ ...editFields, priority: e.target.value })}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              {['low', 'medium', 'high', 'critical'].map((p) => (
                <option key={p} value={p}>{formatPriority(p)}</option>
              ))}
            </select>
          ) : (
            <Badge className={getPriorityColor(caseDetail.priority)}>
              {formatPriority(caseDetail.priority)}
            </Badge>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('cards.deadline')}</span>
          </div>
          <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
            {caseDetail.deadline ? formatDate(caseDetail.deadline) : t('cards.none')}
            {isOverdue ? ` ${t('cards.overdue')}` : ''}
          </p>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-2">{t('description.title')}</h3>
            {editing ? (
              <Textarea
                value={editFields.description}
                onChange={(e) => setEditFields({ ...editFields, description: e.target.value })}
                rows={4}
              />
            ) : (
              <p className="text-muted-foreground">{caseDetail.description}</p>
            )}
          </Card>

          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList>
              <TabsTrigger value="timeline">{t('tabs.timeline')}</TabsTrigger>
              <TabsTrigger value="evidence">{t('tabs.evidence')}</TabsTrigger>
              <TabsTrigger value="notes">{t('tabs.notes')}</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">{t('timeline.title')}</h3>
                <div className="space-y-4">
                  {timeline.map((event) => (
                    <div key={event.id} className="flex gap-4 relative">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        {event.id !== timeline[timeline.length - 1].id && (
                          <div className="h-full w-px bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{event.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{t('timeline.byActor', { actor: event.actor })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="evidence">
              <Card>
                <div className="p-6 border-b">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{t('evidence.title')}</h3>
                    <Button size="sm">
                      <Upload className="mr-2 h-4 w-4" />
                      {t('evidence.upload')}
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('evidence.table.fileName')}</TableHead>
                      <TableHead>{t('evidence.table.type')}</TableHead>
                      <TableHead>{t('evidence.table.size')}</TableHead>
                      <TableHead>{t('evidence.table.uploaded')}</TableHead>
                      <TableHead>{t('evidence.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidence.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.fileName}</TableCell>
                        <TableCell>{doc.fileType.split('/')[1].toUpperCase()}</TableCell>
                        <TableCell>{(doc.size / 1024).toFixed(0)} KB</TableCell>
                        <TableCell>
                          {formatDate(doc.uploadedAt)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">{t('notes.title')}</h3>
                <div className="space-y-4">
                  <div>
                    <Textarea
                      placeholder={t('notes.placeholder')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                    />
                    <Button className="mt-2" onClick={addNote}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      {t('notes.addNote')}
                    </Button>
                  </div>
                  <div className="text-muted-foreground text-center py-8">
                    {t('notes.empty')}
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">{t('assignedTo.title')}</h3>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{caseDetail.assignedTo}</p>
                <p className="text-sm text-muted-foreground">{t('assignedTo.caseManager')}</p>
              </div>
            </div>
            {canManageClaims && caseDetail.assignedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('assignedTo.since', { date: formatDate(caseDetail.assignedAt) })}
              </p>
            )}
          </Card>

          {/* Member Contact — steward only, non-anonymous */}
          {canManageClaims && !caseDetail.isAnonymous && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User size={18} className="text-blue-600" />
                  {t('memberContact.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {caseDetail.memberName && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('memberContact.name')}</p>
                    <p className="text-gray-900">{caseDetail.memberName}</p>
                  </div>
                )}
                {caseDetail.memberEmail && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('memberContact.email')}</p>
                    <a href={`mailto:${caseDetail.memberEmail}`} className="text-blue-600 hover:underline text-sm">{caseDetail.memberEmail}</a>
                  </div>
                )}
                {caseDetail.memberPhone && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('memberContact.phone')}</p>
                    <a href={`tel:${caseDetail.memberPhone}`} className="text-blue-600 hover:underline text-sm">{caseDetail.memberPhone}</a>
                  </div>
                )}
                {!caseDetail.memberName && !caseDetail.memberEmail && (
                  <p className="text-sm text-gray-500">{t('memberContact.empty')}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Assessment — steward only */}
          {canManageClaims && (caseDetail.aiScore != null || caseDetail.meritConfidence != null) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain size={18} className="text-purple-600" />
                  {t('aiAssessment.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {caseDetail.aiScore != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('aiAssessment.aiScore')}</span>
                    <span className="font-semibold text-gray-900">{t('aiAssessment.outOf100', { value: caseDetail.aiScore })}</span>
                  </div>
                )}
                {caseDetail.meritConfidence != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('aiAssessment.meritConfidence')}</span>
                    <span className="font-semibold text-gray-900">{t('aiAssessment.percent', { value: caseDetail.meritConfidence })}</span>
                  </div>
                )}
                {caseDetail.precedentMatch != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('aiAssessment.precedentMatch')}</span>
                    <span className="font-semibold text-gray-900">{t('aiAssessment.percent', { value: caseDetail.precedentMatch })}</span>
                  </div>
                )}
                {caseDetail.complexityScore != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('aiAssessment.complexity')}</span>
                    <span className="font-semibold text-gray-900">{t('aiAssessment.outOf100', { value: caseDetail.complexityScore })}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Financial Summary — steward only */}
          {canManageClaims && (caseDetail.claimAmount || caseDetail.settlementAmount) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign size={18} className="text-green-600" />
                  {t('financialSummary.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {caseDetail.claimAmount && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('financialSummary.claimAmount')}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(caseDetail.claimAmount)}</span>
                  </div>
                )}
                {caseDetail.settlementAmount && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('financialSummary.settlementAmount')}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(caseDetail.settlementAmount)}</span>
                  </div>
                )}
                {caseDetail.legalCosts && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('financialSummary.legalCosts')}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(caseDetail.legalCosts)}</span>
                  </div>
                )}
                {caseDetail.courtCosts && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('financialSummary.courtCosts')}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(caseDetail.courtCosts)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-semibold mb-3">{t('quickActions.title')}</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                {t('quickActions.scheduleMeeting')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                {t('quickActions.generateReport')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('quickActions.updateStatus')}
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">{t('statistics.title')}</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('statistics.daysOpen')}</dt>
                <dd className="font-medium">
                  {Math.floor((Date.now() - new Date(caseDetail.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('statistics.evidenceItems')}</dt>
                <dd className="font-medium">{evidence.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('statistics.timelineEvents')}</dt>
                <dd className="font-medium">{timeline.length}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
