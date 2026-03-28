/**
 * Health & Safety Overview - Client Component
 * 
 * Comprehensive workplace health and safety management dashboard:
 * - Key safety metrics and KPIs
 * - Incident trends and analytics
 * - Inspection status overview
 * - Critical hazards and alerts
 * - Quick action buttons
 * - Compliance tracking
 * 
 * @module components/health-safety/HealthSafetyOverview
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Plus,
  Download,
} from "lucide-react";
import { 
  HealthSafetyDashboard,
} from "@/components/health-safety";
import { toast } from "sonner";

export default function HealthSafetyOverview() {
  const organizationId = useOrganizationId();
  const [period] = useState<"7d" | "30d" | "90d" | "12m">("30d");

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
    <div className="p-4 md:p-6 lg:p-8">
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
