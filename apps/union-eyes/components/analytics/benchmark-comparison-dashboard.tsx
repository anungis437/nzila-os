"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Download,
  Calendar,
  BarChart3,
  Target,
  Award,
  AlertCircle,
} from "lucide-react";

// Types
type PerformanceIndicator = "excellent" | "above_average" | "average" | "below_average" | "needs_improvement";
type TrendDirection = "improving" | "stable" | "declining";
type ComparisonLevel = "local" | "regional" | "national";
type BenchmarkCategoryGroup = "financial" | "operational" | "engagement" | "training" | "organizing" | "membership";

interface BenchmarkCategory {
  id: string;
  categoryName: string;
  displayName: string;
  categoryGroup: BenchmarkCategoryGroup;
  unitType: string;
  higherIsBetter: boolean;
  icon: string;
  color: string;
}

interface BenchmarkComparison {
  categoryId: string;
  categoryName: string;
  displayName: string;
  unitType: string;
  higherIsBetter: boolean;
  organizationValue: number;
  localAverage: number | null;
  regionalAverage: number | null;
  nationalAverage: number | null;
  percentileRank: number;
  performanceIndicator: PerformanceIndicator;
  trendDirection: TrendDirection;
  varianceFromBenchmark: number;
  variancePercentage: number;
  previousPeriodValue: number | null;
  periodOverPeriodChange: number | null;
}

// Sample benchmark categories
const BENCHMARK_CATEGORIES: BenchmarkCategory[] = [
  // Financial
  { id: "1", categoryName: "dues_collection_rate", displayName: "Dues Collection Rate", categoryGroup: "financial", unitType: "percentage", higherIsBetter: true, icon: "💰", color: "bg-green-500" },
  { id: "2", categoryName: "arrears_percentage", displayName: "Arrears Percentage", categoryGroup: "financial", unitType: "percentage", higherIsBetter: false, icon: "⚠️", color: "bg-red-500" },
  { id: "3", categoryName: "revenue_per_member", displayName: "Revenue per Member", categoryGroup: "financial", unitType: "currency", higherIsBetter: true, icon: "💵", color: "bg-green-500" },
  
  // Operational
  { id: "4", categoryName: "grievance_resolution_time", displayName: "Grievance Resolution Time", categoryGroup: "operational", unitType: "days", higherIsBetter: false, icon: "⏱️", color: "bg-blue-500" },
  { id: "5", categoryName: "grievance_win_rate", displayName: "Grievance Win Rate", categoryGroup: "operational", unitType: "percentage", higherIsBetter: true, icon: "⚖️", color: "bg-purple-500" },
  { id: "6", categoryName: "response_time_hours", displayName: "Response Time", categoryGroup: "operational", unitType: "hours", higherIsBetter: false, icon: "⏰", color: "bg-orange-500" },
  
  // Engagement
  { id: "7", categoryName: "member_engagement_score", displayName: "Member Engagement Score", categoryGroup: "engagement", unitType: "score", higherIsBetter: true, icon: "🎯", color: "bg-indigo-500" },
  { id: "8", categoryName: "meeting_attendance_rate", displayName: "Meeting Attendance Rate", categoryGroup: "engagement", unitType: "percentage", higherIsBetter: true, icon: "👥", color: "bg-cyan-500" },
  { id: "9", categoryName: "email_open_rate", displayName: "Email Open Rate", categoryGroup: "engagement", unitType: "percentage", higherIsBetter: true, icon: "📧", color: "bg-pink-500" },
  
  // Training
  { id: "10", categoryName: "training_completion_rate", displayName: "Training Completion Rate", categoryGroup: "training", unitType: "percentage", higherIsBetter: true, icon: "🎓", color: "bg-yellow-500" },
  { id: "11", categoryName: "certification_compliance_rate", displayName: "Certification Compliance", categoryGroup: "training", unitType: "percentage", higherIsBetter: true, icon: "✅", color: "bg-green-600" },
  { id: "12", categoryName: "avg_training_hours_per_member", displayName: "Avg Training Hours", categoryGroup: "training", unitType: "hours", higherIsBetter: true, icon: "📚", color: "bg-amber-500" },
  
  // Organizing
  { id: "13", categoryName: "organizing_campaign_success_rate", displayName: "Campaign Success Rate", categoryGroup: "organizing", unitType: "percentage", higherIsBetter: true, icon: "🎖️", color: "bg-rose-500" },
  { id: "14", categoryName: "card_signing_conversion_rate", displayName: "Card Signing Conversion", categoryGroup: "organizing", unitType: "percentage", higherIsBetter: true, icon: "✍️", color: "bg-violet-500" },
  { id: "15", categoryName: "avg_campaign_duration_days", displayName: "Avg Campaign Duration", categoryGroup: "organizing", unitType: "days", higherIsBetter: false, icon: "📅", color: "bg-teal-500" },
  
  // Membership
  { id: "16", categoryName: "membership_growth_rate", displayName: "Membership Growth Rate", categoryGroup: "membership", unitType: "percentage", higherIsBetter: true, icon: "📈", color: "bg-emerald-500" },
  { id: "17", categoryName: "member_retention_rate", displayName: "Member Retention Rate", categoryGroup: "membership", unitType: "percentage", higherIsBetter: true, icon: "🔒", color: "bg-lime-500" },
  { id: "18", categoryName: "new_member_onboarding_days", displayName: "New Member Onboarding", categoryGroup: "membership", unitType: "days", higherIsBetter: false, icon: "🚀", color: "bg-sky-500" },
];

// Sample comparison data
const SAMPLE_COMPARISONS: BenchmarkComparison[] = [
  {
    categoryId: "1",
    categoryName: "dues_collection_rate",
    displayName: "Dues Collection Rate",
    unitType: "percentage",
    higherIsBetter: true,
    organizationValue: 94.5,
    localAverage: 91.2,
    regionalAverage: 89.8,
    nationalAverage: 88.5,
    percentileRank: 78,
    performanceIndicator: "excellent",
    trendDirection: "improving",
    varianceFromBenchmark: 6.0,
    variancePercentage: 6.8,
    previousPeriodValue: 93.2,
    periodOverPeriodChange: 1.3,
  },
  {
    categoryId: "4",
    categoryName: "grievance_resolution_time",
    displayName: "Grievance Resolution Time",
    unitType: "days",
    higherIsBetter: false,
    organizationValue: 42,
    localAverage: 38,
    regionalAverage: 45,
    nationalAverage: 52,
    percentileRank: 58,
    performanceIndicator: "above_average",
    trendDirection: "stable",
    varianceFromBenchmark: -10,
    variancePercentage: -19.2,
    previousPeriodValue: 41,
    periodOverPeriodChange: 1,
  },
  {
    categoryId: "7",
    categoryName: "member_engagement_score",
    displayName: "Member Engagement Score",
    unitType: "score",
    higherIsBetter: true,
    organizationValue: 72,
    localAverage: 75,
    regionalAverage: 71,
    nationalAverage: 68,
    percentileRank: 52,
    performanceIndicator: "above_average",
    trendDirection: "improving",
    varianceFromBenchmark: 4,
    variancePercentage: 5.9,
    previousPeriodValue: 68,
    periodOverPeriodChange: 4,
  },
  {
    categoryId: "10",
    categoryName: "training_completion_rate",
    displayName: "Training Completion Rate",
    unitType: "percentage",
    higherIsBetter: true,
    organizationValue: 67.5,
    localAverage: 72.3,
    regionalAverage: 75.8,
    nationalAverage: 78.2,
    percentileRank: 32,
    performanceIndicator: "average",
    trendDirection: "declining",
    varianceFromBenchmark: -10.7,
    variancePercentage: -13.7,
    previousPeriodValue: 71.2,
    periodOverPeriodChange: -3.7,
  },
  {
    categoryId: "13",
    categoryName: "organizing_campaign_success_rate",
    displayName: "Campaign Success Rate",
    unitType: "percentage",
    higherIsBetter: true,
    organizationValue: 82.0,
    localAverage: 68.5,
    regionalAverage: 71.2,
    nationalAverage: 69.8,
    percentileRank: 88,
    performanceIndicator: "excellent",
    trendDirection: "improving",
    varianceFromBenchmark: 12.2,
    variancePercentage: 17.5,
    previousPeriodValue: 78.5,
    periodOverPeriodChange: 3.5,
  },
  {
    categoryId: "16",
    categoryName: "membership_growth_rate",
    displayName: "Membership Growth Rate",
    unitType: "percentage",
    higherIsBetter: true,
    organizationValue: 3.2,
    localAverage: 4.1,
    regionalAverage: 3.8,
    nationalAverage: 2.9,
    percentileRank: 48,
    performanceIndicator: "average",
    trendDirection: "stable",
    varianceFromBenchmark: 0.3,
    variancePercentage: 10.3,
    previousPeriodValue: 3.1,
    periodOverPeriodChange: 0.1,
  },
];

export default function BenchmarkComparisonDashboard() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["1", "4", "7", "10"]);
  const [activeGroup, setActiveGroup] = useState<BenchmarkCategoryGroup>("financial");
  const [comparisonLevels, setComparisonLevels] = useState<Set<ComparisonLevel>>(
    new Set<ComparisonLevel>(["local", "regional", "national"])
  );
  const [periodRange, setPeriodRange] = useState("last_90_days");

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Toggle comparison level
  const toggleComparisonLevel = (level: ComparisonLevel) => {
    setComparisonLevels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  // Get categories for active group
  const groupCategories = BENCHMARK_CATEGORIES.filter(
    (cat) => cat.categoryGroup === activeGroup
  );

  // Get selected comparisons
  const selectedComparisons = SAMPLE_COMPARISONS.filter((comp) =>
    selectedCategories.includes(comp.categoryId)
  );

  // Format value with unit
  const formatValue = (value: number, unitType: string): string => {
    switch (unitType) {
      case "percentage":
        return `${value.toFixed(1)}%`;
      case "currency":
        return `$${value.toFixed(2)}`;
      case "days":
        return `${value.toFixed(0)} days`;
      case "hours":
        return `${value.toFixed(1)} hrs`;
      case "score":
        return value.toFixed(0);
      default:
        return value.toFixed(1);
    }
  };

  // Get performance indicator styling
  const getPerformanceIndicatorStyle = (indicator: PerformanceIndicator) => {
    switch (indicator) {
      case "excellent":
        return "bg-blue-500 text-white";
      case "above_average":
        return "bg-green-500 text-white";
      case "average":
        return "bg-yellow-500 text-white";
      case "below_average":
        return "bg-orange-500 text-white";
      case "needs_improvement":
        return "bg-red-500 text-white";
    }
  };

  // Get performance indicator label
  const getPerformanceIndicatorLabel = (indicator: PerformanceIndicator) => {
    switch (indicator) {
      case "excellent":
        return "Excellent";
      case "above_average":
        return "Above Average";
      case "average":
        return "Average";
      case "below_average":
        return "Below Average";
      case "needs_improvement":
        return "Needs Improvement";
    }
  };

  // Get trend direction icon
  const getTrendIcon = (direction: TrendDirection) => {
    switch (direction) {
      case "improving":
        return <TrendingUp className="h-4 w-4" />;
      case "declining":
        return <TrendingDown className="h-4 w-4" />;
      case "stable":
        return <ArrowRight className="h-4 w-4" />;
    }
  };

  // Get trend direction styling
  const getTrendStyle = (direction: TrendDirection) => {
    switch (direction) {
      case "improving":
        return "text-green-600 bg-green-50";
      case "declining":
        return "text-red-600 bg-red-50";
      case "stable":
        return "text-gray-600 bg-gray-50";
    }
  };

  // Get trend direction label
  const getTrendLabel = (direction: TrendDirection) => {
    switch (direction) {
      case "improving":
        return "Improving";
      case "declining":
        return "Declining";
      case "stable":
        return "Stable";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Benchmark Comparison</h1>
          <p className="text-muted-foreground mt-1">
            Compare your performance against local, regional, and national benchmarks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodRange} onValueChange={setPeriodRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="last_180_days">Last 180 Days</SelectItem>
              <SelectItem value="last_365_days">Last 365 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Comparison Level Toggles */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Comparison Levels:</span>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={comparisonLevels.has("local")}
                  onCheckedChange={() => toggleComparisonLevel("local")}
                />
                <span className="text-sm">Local (Same Region)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={comparisonLevels.has("regional")}
                  onCheckedChange={() => toggleComparisonLevel("regional")}
                />
                <span className="text-sm">Regional (Province)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={comparisonLevels.has("national")}
                  onCheckedChange={() => toggleComparisonLevel("national")}
                />
                <span className="text-sm">National (Canada)</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Category Selection Tabs */}
      <Tabs value={activeGroup} onValueChange={(value) => setActiveGroup(value as BenchmarkCategoryGroup)}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="operational">Operational</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="organizing">Organizing</TabsTrigger>
          <TabsTrigger value="membership">Membership</TabsTrigger>
        </TabsList>

        <TabsContent value={activeGroup} className="mt-4">
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Select Metrics to Compare:</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {groupCategories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                    <span className="text-sm">{category.icon}</span>
                    <span className="text-sm">{category.displayName}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Comparison Results */}
      {selectedComparisons.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Metrics Selected</h3>
          <p className="text-muted-foreground">
            Select one or more metrics from the tabs above to see benchmark comparisons
          </p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {selectedComparisons.map((comparison) => (
            <Card key={comparison.categoryId} className="p-6">
              {/* Comparison Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{comparison.displayName}</h3>
                    <Badge className={getPerformanceIndicatorStyle(comparison.performanceIndicator)}>
                      {getPerformanceIndicatorLabel(comparison.performanceIndicator)}
                    </Badge>
                    <Badge variant="outline" className={getTrendStyle(comparison.trendDirection)}>
                      {getTrendIcon(comparison.trendDirection)}
                      <span className="ml-1">{getTrendLabel(comparison.trendDirection)}</span>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Percentile Rank: {comparison.percentileRank}th</span>
                    {comparison.periodOverPeriodChange !== null && (
                      <span>
                        Period-over-Period:{" "}
                        <span
                          className={
                            comparison.periodOverPeriodChange > 0
                              ? "text-green-600 font-medium"
                              : comparison.periodOverPeriodChange < 0
                              ? "text-red-600 font-medium"
                              : ""
                          }
                        >
                          {comparison.periodOverPeriodChange > 0 ? "+" : ""}
                          {formatValue(comparison.periodOverPeriodChange, comparison.unitType)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold mb-1">
                    {formatValue(comparison.organizationValue, comparison.unitType)}
                  </div>
                  <div className="text-sm text-muted-foreground">Your Performance</div>
                </div>
              </div>

              {/* Percentile Rank Gauge */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-muted-foreground">Percentile Rank</span>
                  <span className="font-medium">{comparison.percentileRank}th percentile</span>
                </div>
                <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                  {/* Color zones */}
                  <div className="absolute inset-0 flex">
                    <div className="w-1/4 bg-red-300" />
                    <div className="w-1/4 bg-yellow-300" />
                    <div className="w-1/4 bg-green-300" />
                    <div className="w-1/4 bg-blue-300" />
                  </div>
                  {/* Percentile marker */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-gray-900"
                    style={{ left: `${comparison.percentileRank}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      You are here
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span>0th (Bottom)</span>
                  <span>25th</span>
                  <span>50th (Median)</span>
                  <span>75th</span>
                  <span>100th (Top)</span>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-4 gap-4">
                {/* Your Value */}
                <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Your Union</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900 mb-1">
                    {formatValue(comparison.organizationValue, comparison.unitType)}
                  </div>
                  {comparison.varianceFromBenchmark !== 0 && (
                    <div
                      className={`text-sm ${
                        (comparison.higherIsBetter && comparison.varianceFromBenchmark > 0) ||
                        (!comparison.higherIsBetter && comparison.varianceFromBenchmark < 0)
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {comparison.varianceFromBenchmark > 0 ? "+" : ""}
                      {formatValue(Math.abs(comparison.varianceFromBenchmark), comparison.unitType)}
                      {" vs. national"}
                    </div>
                  )}
                </div>

                {/* Local Average */}
                {comparisonLevels.has("local") && comparison.localAverage !== null && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Local Average</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {formatValue(comparison.localAverage, comparison.unitType)}
                    </div>
                    <div className="text-xs text-muted-foreground">Same Region</div>
                  </div>
                )}

                {/* Regional Average */}
                {comparisonLevels.has("regional") && comparison.regionalAverage !== null && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Regional Average</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {formatValue(comparison.regionalAverage, comparison.unitType)}
                    </div>
                    <div className="text-xs text-muted-foreground">Province</div>
                  </div>
                )}

                {/* National Average */}
                {comparisonLevels.has("national") && comparison.nationalAverage !== null && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">National Average</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {formatValue(comparison.nationalAverage, comparison.unitType)}
                    </div>
                    <div className="text-xs text-muted-foreground">Canada</div>
                  </div>
                )}
              </div>

              {/* Bar Chart Visualization */}
              <div className="mt-6">
                <div className="space-y-3">
                  {/* Your Value Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="font-medium">Your Union</span>
                      <span className="font-bold">{formatValue(comparison.organizationValue, comparison.unitType)}</span>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 flex items-center justify-end pr-2 text-white text-xs font-medium"
                        style={{ width: `${comparison.percentileRank}%` }}
                      >
                        {comparison.percentileRank}th
                      </div>
                    </div>
                  </div>

                  {/* Local Average Bar */}
                  {comparisonLevels.has("local") && comparison.localAverage !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className="text-muted-foreground">Local Average</span>
                        <span>{formatValue(comparison.localAverage, comparison.unitType)}</span>
                      </div>
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-400"
                          style={{
                            width: `${
                              comparison.higherIsBetter
                                ? (comparison.localAverage / comparison.organizationValue) * comparison.percentileRank
                                : (comparison.organizationValue / comparison.localAverage) * comparison.percentileRank
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Regional Average Bar */}
                  {comparisonLevels.has("regional") && comparison.regionalAverage !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className="text-muted-foreground">Regional Average</span>
                        <span>{formatValue(comparison.regionalAverage, comparison.unitType)}</span>
                      </div>
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-400"
                          style={{
                            width: `${
                              comparison.higherIsBetter
                                ? (comparison.regionalAverage / comparison.organizationValue) * comparison.percentileRank
                                : (comparison.organizationValue / comparison.regionalAverage) * comparison.percentileRank
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* National Average Bar */}
                  {comparisonLevels.has("national") && comparison.nationalAverage !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className="text-muted-foreground">National Average</span>
                        <span>{formatValue(comparison.nationalAverage, comparison.unitType)}</span>
                      </div>
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-400"
                          style={{
                            width: `${
                              comparison.higherIsBetter
                                ? (comparison.nationalAverage / comparison.organizationValue) * comparison.percentileRank
                                : (comparison.organizationValue / comparison.nationalAverage) * comparison.percentileRank
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

