/**
 * Health & Safety Dashboard - Main Overview
 * 
 * Comprehensive workplace health and safety management dashboard:
 * - Key safety metrics and KPIs
 * - Incident trends and analytics
 * - Inspection status overview
 * - Critical hazards and alerts
 * - Quick action buttons
 * - Compliance tracking
 * 
 * @page app/[locale]/dashboard/health-safety/page.tsx
 */

"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield,
  AlertTriangle,
  ClipboardCheck,
  FileWarning,
  Users,
  CheckCircle2,
  Plus,
  Download,
  ArrowRight,
  Target,
} from "lucide-react";
import { 
  HealthSafetyDashboard,
} from "@/components/health-safety";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

export default function HealthSafetyPage() {
  const organizationId = useOrganizationId();
  const [period] = useState<"7d" | "30d" | "90d" | "12m">("30d");

  // Quick stats for overview cards
  const [quickStats, setQuickStats] = useState({
    totalIncidents: 0,
    openHazards: 0,
    inspectionsDue: 0,
    trainingDue: 0,
    daysWithoutIncident: 0,
    complianceRate: 0,
  });

  useEffect(() => {
    if (organizationId) {
      // eslint-disable-next-line react-hooks/immutability
      loadQuickStats();
    }
  }, [organizationId, period]);

  const loadQuickStats = async () => {
    try {
      // In production, this would fetch from your API
      // Example: const response = await fetch(`/api/health-safety/stats?organizationId=${organizationId}&period=${period}`);
      // For now, using mock data matching the component interface
      setQuickStats({
        totalIncidents: 12,
        openHazards: 8,
        inspectionsDue: 3,
        trainingDue: 15,
        daysWithoutIncident: 45,
        complianceRate: 94,
      });
    } catch (error) {
      logger.error("Failed to load stats:", error);
      toast.error("Failed to load health & safety statistics");
    }
  };

  const handleExportData = () => {
    toast.info("Exporting health & safety data...");
    // Implement export functionality
  };

  if (!organizationId) {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">No Organization Selected</h2>
        <p className="text-muted-foreground">
          Please select an organization to view health & safety data.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Shield className="h-8 w-8 text-green-600" />
              Health & Safety
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Workplace safety monitoring and incident management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportData}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Data
            </Button>
            <Link href="/dashboard/health-safety/incidents/new">
              <Button className="flex items-center gap-2 bg-linear-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
                <Plus className="h-4 w-4" />
                Report Incident
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Quick Overview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Days Without Incident</CardTitle>
              <Target className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {quickStats.daysWithoutIncident}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Target: 90 days
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Hazards</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {quickStats.openHazards}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires attention
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {quickStats.complianceRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                OSHA standards
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <Link href="/dashboard/health-safety/incidents">
            <Card className="bg-linear-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <FileWarning className="h-8 w-8" />
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-xl font-bold mb-1">Incidents</h3>
                <p className="text-blue-100 text-sm">
                  {quickStats.totalIncidents} reported this month
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/health-safety/inspections">
            <Card className="bg-linear-to-br from-green-500 to-green-600 text-white hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <ClipboardCheck className="h-8 w-8" />
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-xl font-bold mb-1">Inspections</h3>
                <p className="text-green-100 text-sm">
                  {quickStats.inspectionsDue} due this week
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/health-safety/hazards">
            <Card className="bg-linear-to-br from-orange-500 to-orange-600 text-white hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <AlertTriangle className="h-8 w-8" />
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-xl font-bold mb-1">Hazards</h3>
                <p className="text-orange-100 text-sm">
                  {quickStats.openHazards} open reports
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/health-safety/training">
            <Card className="bg-linear-to-br from-purple-500 to-purple-600 text-white hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <Users className="h-8 w-8" />
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-xl font-bold mb-1">Training</h3>
                <p className="text-purple-100 text-sm">
                  {quickStats.trainingDue} members due
                </p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Main Dashboard Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <HealthSafetyDashboard
            organizationId={organizationId}
            period={period}
          />
        </motion.div>
      </div>
    </div>
  );
}
