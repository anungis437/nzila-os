/**
 * Data Retention Dashboard Component
 * 
 * Comprehensive retention overview with:
 * - Retention metrics
 * - Category breakdowns
 * - Expiration timelines
 * - Compliance status
 * - Visual analytics
 * - Action recommendations
 * 
 * @module components/compliance/data-retention-dashboard
 */

"use client";

import * as React from "react";
import {
  Database,
  Clock,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, differenceInDays } from "date-fns";

export interface RetentionMetrics {
  totalRecords: number;
  activeRecords: number;
  retainedRecords: number;
  expiringSoon: number;
  pastDue: number;
  storageUsedGB: number;
  storageQuotaGB: number;
}

export interface CategoryRetention {
  category: string;
  totalRecords: number;
  retentionPeriod: string;
  oldestRecord: Date;
  newestRecord: Date;
  expiringCount: number;
  complianceRate: number;
}

export interface ExpiringRecord {
  id: string;
  category: string;
  type: string;
  createdAt: Date;
  expiresAt: Date;
  status: "warning" | "critical" | "overdue";
  action: "archive" | "delete" | "review";
}

export interface DataRetentionDashboardProps {
  metrics: RetentionMetrics;
  categories: CategoryRetention[];
  expiringRecords: ExpiringRecord[];
  timeRange: "7d" | "30d" | "90d" | "1y";
  onTimeRangeChange?: (range: "7d" | "30d" | "90d" | "1y") => void;
  onExecuteRetention?: (categoryId: string) => Promise<void>;
  onViewDetails?: (categoryId: string) => void;
}

export function DataRetentionDashboard({
  metrics,
  categories,
  expiringRecords,
  timeRange,
  onTimeRangeChange,
  onExecuteRetention,
  onViewDetails,
}: DataRetentionDashboardProps) {
  const storagePercentage = (metrics.storageUsedGB / metrics.storageQuotaGB) * 100;

  const statusConfig = {
    warning: {
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      label: "Warning",
    },
    critical: {
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      label: "Critical",
    },
    overdue: {
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      label: "Overdue",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Data Retention Dashboard
          </h2>
          <p className="text-gray-600 mt-1">
            Monitor data lifecycle and retention compliance
          </p>
        </div>
        <Select value={timeRange} onValueChange={onTimeRangeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-3xl font-bold mt-1">{metrics.totalRecords.toLocaleString()}</p>
              </div>
              <Database className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Under Retention</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {metrics.retainedRecords.toLocaleString()}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expiring Soon</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {metrics.expiringSoon.toLocaleString()}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Past Due</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {metrics.pastDue.toLocaleString()}
                </p>
              </div>
              <Archive className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                {metrics.storageUsedGB.toFixed(2)} GB of {metrics.storageQuotaGB} GB used
              </span>
              <span className="font-medium">{storagePercentage.toFixed(1)}%</span>
            </div>
            <Progress value={storagePercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="expiring">
            Expiring Records ({expiringRecords.length})
          </TabsTrigger>
        </TabsList>

        {/* Category Breakdown */}
        <TabsContent value="categories">
          <div className="grid gap-4">
            {categories.map((category) => (
              <Card key={category.category}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{category.category}</h3>
                        <Badge variant="secondary">
                          {category.totalRecords.toLocaleString()} records
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Retention Period</p>
                          <p className="font-medium">{category.retentionPeriod}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Compliance Rate</p>
                          <div className="flex items-center gap-2">
                            <Progress value={category.complianceRate} className="h-2 flex-1" />
                            <span className="font-medium">{category.complianceRate}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-600">Oldest Record</p>
                          <p className="font-medium">
                            {format(category.oldestRecord, "MMM d, yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Expiring Soon</p>
                          <p className="font-medium text-orange-600">
                            {category.expiringCount} records
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {onViewDetails && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewDetails(category.category)}
                        >
                          View Details
                        </Button>
                      )}
                      {onExecuteRetention && category.expiringCount > 0 && (
                        <Button
                          size="sm"
                          onClick={() => onExecuteRetention(category.category)}
                        >
                          Execute Retention
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Expiring Records */}
        <TabsContent value="expiring">
          <Card>
            <CardContent className="p-6">
              {expiringRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  No records expiring in the selected time range
                </div>
              ) : (
                <div className="space-y-3">
                  {expiringRecords.map((record) => {
                    const config = statusConfig[record.status];
                    const daysUntilExpiry = differenceInDays(record.expiresAt, new Date());

                    return (
                      <div
                        key={record.id}
                        className={`border rounded-lg p-4 ${config.borderColor} ${config.bgColor}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={config.color}>
                                {config.label}
                              </Badge>
                              <span className="font-medium">{record.type}</span>
                              <Badge variant="secondary">{record.category}</Badge>
                            </div>

                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-4">
                                <span>
                                  Created: {format(record.createdAt, "MMM d, yyyy")}
                                </span>
                                <span>
                                  Expires: {format(record.expiresAt, "MMM d, yyyy")}
                                </span>
                              </div>
                              <div className={config.color}>
                                {daysUntilExpiry < 0
                                  ? `Overdue by ${Math.abs(daysUntilExpiry)} days`
                                  : `${daysUntilExpiry} days remaining`}
                              </div>
                            </div>
                          </div>

                          <Badge>
                            {record.action === "archive" && "Archive"}
                            {record.action === "delete" && "Delete"}
                            {record.action === "review" && "Review"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

