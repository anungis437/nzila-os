/**
 * Case Management Dashboard
 * 
 * Overview of grievances, arbitrations, and case workflows
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/index';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslations } from "next-intl";
 
import {
  FileText, Plus, Search as _Search, Filter, AlertCircle, Clock, CheckCircle
} from 'lucide-react';

interface CaseStats {
  totalActive: number;
  pendingInvestigation: number;
  inArbitration: number;
  resolvedThisMonth: number;
}

interface Case {
  id: string;
  caseNumber: string;
  memberName: string;
  type: string;
  status: string;
  priority: string;
  createdAt: string;
  deadline: string | null;
  assignedTo: string;
}

export default function CasesDashboardPage() {
  const router = useRouter();
  const t = useTranslations("cases.list");
  const [stats, setStats] = useState<CaseStats>({
    totalActive: 0,
    pendingInvestigation: 0,
    inArbitration: 0,
    resolvedThisMonth: 0,
  });
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchCases();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter]);

  const fetchCases = async () => {
    try {
      const data = await api.cases.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      });
      
      setCases(data as Case[]);
      
      // Calculate stats from data
      setStats({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        totalActive: data.filter((c: any) => c.status !== 'resolved').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pendingInvestigation: data.filter((c: any) => c.status === 'investigation').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inArbitration: data.filter((c: any) => c.status === 'arbitration').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolvedThisMonth: data.filter((c: any) => {
          const resolved = new Date(c.resolvedAt || '');
          const now = new Date();
          return c.status === 'resolved' && 
                 resolved.getMonth() === now.getMonth() &&
                 resolved.getFullYear() === now.getFullYear();
        }).length,
      });
    } catch (error) {
      logger.error('Error fetching cases', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'investigation':
        return 'bg-blue-100 text-blue-800';
      case 'arbitration':
        return 'bg-purple-100 text-purple-800';
      case 'mediation':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
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

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  if (loading) {
    return <div className="container mx-auto py-6">{t("loading")}</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t("heading")}</h1>
          <p className="text-muted-foreground">
            {t("subheading")}
          </p>
        </div>
        <Button onClick={() => router.push('/cases/new')}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newCaseButton")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("statActiveTitle")}</p>
              <p className="text-2xl font-bold">{stats.totalActive}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("statInvestigationTitle")}</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pendingInvestigation}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("statArbitrationTitle")}</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.inArbitration}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("statResolvedTitle")}</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.resolvedThisMonth}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("statusOptionAll")}</SelectItem>
              <SelectItem value="investigation">{t("statusOptionInvestigation")}</SelectItem>
              <SelectItem value="mediation">{t("statusOptionMediation")}</SelectItem>
              <SelectItem value="arbitration">{t("statusOptionArbitration")}</SelectItem>
              <SelectItem value="resolved">{t("statusOptionResolved")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("filterType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("typeOptionAll")}</SelectItem>
              <SelectItem value="disciplinary">{t("typeOptionDisciplinary")}</SelectItem>
              <SelectItem value="workplace_safety">{t("typeOptionWorkplaceSafety")}</SelectItem>
              <SelectItem value="harassment">{t("typeOptionHarassment")}</SelectItem>
              <SelectItem value="termination">{t("typeOptionTermination")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            {t("moreFiltersButton")}
          </Button>
        </div>
      </Card>

      {/* Cases Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tableColCaseNumber")}</TableHead>
              <TableHead>{t("tableColMember")}</TableHead>
              <TableHead>{t("tableColType")}</TableHead>
              <TableHead>{t("tableColStatus")}</TableHead>
              <TableHead>{t("tableColPriority")}</TableHead>
              <TableHead>{t("tableColAssignedTo")}</TableHead>
              <TableHead>{t("tableColDeadline")}</TableHead>
              <TableHead>{t("tableColActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((caseItem) => (
              <TableRow
                key={caseItem.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/dashboard/cases/${caseItem.id}`)}
              >
                <TableCell className="font-medium">{caseItem.caseNumber}</TableCell>
                <TableCell>{caseItem.memberName}</TableCell>
                <TableCell className="capitalize">
                  {caseItem.type.replace('_', ' ')}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(caseItem.status)}>
                    {caseItem.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getPriorityColor(caseItem.priority)}>
                    {caseItem.priority}
                  </Badge>
                </TableCell>
                <TableCell>{caseItem.assignedTo}</TableCell>
                <TableCell>
                  {caseItem.deadline ? (
                    <span className={isOverdue(caseItem.deadline) ? 'text-red-600 font-medium' : ''}>
                      {new Date(caseItem.deadline).toLocaleDateString()}
                      {isOverdue(caseItem.deadline) && ` (${t("deadlineOverdue")})`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("deadlineNone")}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">{t("viewButton")}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
