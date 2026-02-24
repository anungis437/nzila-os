/**
 * Safety Training Records Viewer Component
 * 
 * Displays employee safety training records with:
 * - Training completion status
 * - Certificate expiry tracking
 * - Compliance monitoring
 * - Training history
 * - Upcoming refresher alerts
 * 
 * @module components/health-safety/SafetyTrainingRecords Viewer
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import {
  GraduationCap,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Download,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
 
import { cn } from "@/lib/utils";

export interface TrainingRecord {
  employeeId: string;
  employeeName: string;
  trainingName: string;
  completionDate: Date;
  expiryDate?: Date;
  certificateUrl?: string;
  status: "current" | "expiring_soon" | "expired" | "not_started";
  complianceCategory: string;
}

export interface SafetyTrainingRecordsViewerProps {
  organizationId: string;
  employeeId?: string; // If provided, show single employee view
  onViewCertificate?: (recordId: string) => void;
}

export function SafetyTrainingRecordsViewer({
  organizationId,
  employeeId,
  onViewCertificate: _onViewCertificate
}: SafetyTrainingRecordsViewerProps) {
  const { toast } = useToast();
  const [records, setRecords] = React.useState<TrainingRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  React.useEffect(() => {
    loadTrainingRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, employeeId, statusFilter]);

  async function loadTrainingRecords() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        organizationId,
        ...(employeeId && { employeeId }),
        ...(statusFilter !== "all" && { status: statusFilter })
      });

      const response = await fetch(`/api/health-safety/training/records?${params}`);

      if (!response.ok) {
        throw new Error("Failed to load training records");
      }

      const data = await response.json();
      if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRecords(data.records.map((r: any) => ({
          ...r,
          completionDate: new Date(r.completionDate),
          expiryDate: r.expiryDate ? new Date(r.expiryDate) : undefined
        })));
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load training records",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getStatusInfo(record: TrainingRecord) {
    if (!record.expiryDate) {
      return {
        status: "current",
        label: "No Expiry",
        color: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
        icon: CheckCircle2
      };
    }

    const daysUntilExpiry = differenceInDays(record.expiryDate, new Date());

    if (daysUntilExpiry < 0) {
      return {
        status: "expired",
        label: "Expired",
        color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        icon: AlertCircle
      };
    }

    if (daysUntilExpiry <= 30) {
      return {
        status: "expiring_soon",
        label: `Expires in ${daysUntilExpiry} days`,
        color: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
        icon: AlertCircle
      };
    }

    return {
      status: "current",
      label: "Current",
      color: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
      icon: CheckCircle2
    };
  }

  const filteredRecords = records.filter(record =>
    record.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.trainingName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const expiringRecords = records.filter(r => {
    const info = getStatusInfo(r);
    return info.status === "expiring_soon";
  });

  const expiredRecords = records.filter(r => {
    const info = getStatusInfo(r);
    return info.status === "expired";
  });

  // Calculate overall compliance
  const totalRequired = records.length;
  const currentlyCompliant = records.filter(r => getStatusInfo(r).status === "current").length;
  const complianceRate = totalRequired > 0 ? Math.round((currentlyCompliant / totalRequired) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {expiredRecords.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Expired Training Certificates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 dark:text-red-400">
              {expiredRecords.length} training certificate{expiredRecords.length !== 1 ? 's have' : ' has'} expired and require renewal.
            </p>
          </CardContent>
        </Card>
      )}

      {expiringRecords.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
              Training Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-600 dark:text-orange-400">
              {expiringRecords.length} training certificate{expiringRecords.length !== 1 ? 's are' : ' is'} expiring within 30 days.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{complianceRate}%</div>
              <Progress value={complianceRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Current</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{currentlyCompliant}</div>
            <p className="text-xs text-muted-foreground">Up to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{expiringRecords.length}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{expiredRecords.length}</div>
            <p className="text-xs text-muted-foreground">Require renewal</p>
          </CardContent>
        </Card>
      </div>

      {/* Training Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Training Records
              </CardTitle>
              <CardDescription>
                Safety training and certification tracking
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col gap-4 mb-6 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees or training..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No training records found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Training</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record, index) => {
                    const statusInfo = getStatusInfo(record);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {record.employeeName}
                        </TableCell>
                        <TableCell>{record.trainingName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.complianceCategory}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(record.completionDate, "MMM dd, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.expiryDate ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(record.expiryDate, "MMM dd, yyyy")}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No expiry</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(statusInfo.color, "flex items-center gap-1 w-fit")}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {record.certificateUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(record.certificateUrl, '_blank')}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Certificate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
