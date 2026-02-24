/**
 * Health & Safety - Inspections Management Page
 * 
 * Workplace safety inspections tracking and scheduling:
 * - Inspection schedule calendar
 * - Upcoming and overdue inspections
 * - Inspection checklist management
 * - Findings and corrective actions
 * - Compliance reporting
 * 
 * @page app/[locale]/dashboard/health-safety/inspections/page.tsx
 */

"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  Search,
  Filter,
  Plus,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  TrendingUp,
  FileText,
} from "lucide-react";
import {
  InspectionScheduleCalendar,
  InspectionReportViewer,
  InspectionFindingsCard,
} from "@/components/health-safety";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

type InspectionStatus = "scheduled" | "in-progress" | "completed" | "overdue";
type InspectionType = "routine" | "compliance" | "incident-follow-up" | "spot-check";

export default function InspectionsPage() {
  const router = useRouter();
  const organizationId = useOrganizationId();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InspectionStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<InspectionType | "all">("all");
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter">("month");
  const [selectedInspection, setSelectedInspection] = useState<string | null>(null);

  // Summary statistics
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    completed: 0,
    overdue: 0,
    complianceRate: 0,
    avgScore: 0,
  });

  useEffect(() => {
    if (organizationId) {
      // eslint-disable-next-line react-hooks/immutability
      loadStats();
    }
  }, [organizationId, dateRange]);

  const loadStats = async () => {
    try {
      // In production: fetch from API
      // Example: const response = await fetch(`/api/health-safety/inspections/stats?organizationId=${organizationId}`);
      setStats({
        total: 28,
        scheduled: 12,
        completed: 14,
        overdue: 2,
        complianceRate: 96,
        avgScore: 88.5,
      });
    } catch (error) {
      logger.error("Failed to load stats:", error);
      toast.error("Failed to load inspection statistics");
    }
  };

  const handleScheduleInspection = () => {
    router.push("/dashboard/health-safety/inspections/new");
  };

  const handleViewInspection = (inspectionId: string) => {
    setSelectedInspection(inspectionId);
  };

  const handleExportData = () => {
    toast.info("Exporting inspection data...");
    // Implement export functionality
  };

  if (!organizationId) {
    return (
      <div className="p-8 text-center">
        <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">No Organization Selected</h2>
        <p className="text-muted-foreground">
          Please select an organization to view inspection data.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Link href="/dashboard/health-safety">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <ClipboardCheck className="h-8 w-8 text-green-600" />
                Inspections Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Schedule and track workplace safety inspections
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleExportData}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={handleScheduleInspection}
                className="flex items-center gap-2 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Schedule Inspection
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inspections</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                This {dateRange}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires attention
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.complianceRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                On-time completion
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.avgScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Inspection results
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search inspections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InspectionStatus | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as InspectionType | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="incident-follow-up">Incident Follow-up</SelectItem>
                    <SelectItem value="spot-check">Spot Check</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRange} onValueChange={(value) => setDateRange(value as "week" | "month" | "quarter")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Tabs defaultValue="calendar" className="space-y-4">
            <TabsList className="grid w-full md:w-auto grid-cols-3">
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <FileText className="h-4 w-4" />
                List View
              </TabsTrigger>
              <TabsTrigger value="findings" className="gap-2">
                <AlertCircle className="h-4 w-4" />
                Findings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Inspection Schedule</CardTitle>
                  <CardDescription>
                    View and manage scheduled safety inspections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InspectionScheduleCalendar
                    organizationId={organizationId}
                    onViewInspection={handleViewInspection}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="list" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>All Inspections</CardTitle>
                  <CardDescription>
                    Comprehensive list of workplace safety inspections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedInspection ? (
                    <InspectionReportViewer
                      inspectionId={selectedInspection}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select an inspection to view details</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="findings" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Recent Findings</CardTitle>
                  <CardDescription>
                    Issues identified during inspections requiring attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Mock findings - replace with actual data */}
                    {[1, 2, 3].map((i) => (
                      <InspectionFindingsCard
                        key={i}
                        finding={{
                          id: `finding-${i}`,
                          inspectionId: `inspection-${i}`,
                          severity: i === 1 ? "critical" : i === 2 ? "moderate" : "minor",
                          description: `Finding ${i} description`,
                          location: `Location ${i}`,
                          category: "Safety Equipment",
                          status: "open",
                          assignedTo: "Safety Officer",
                          // eslint-disable-next-line react-hooks/purity
                          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                          createdAt: new Date().toISOString(),
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        } as any}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
