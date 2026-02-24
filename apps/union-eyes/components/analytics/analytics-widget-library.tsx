/**
 * Analytics Widget Library Component
 * 
 * Pre-built analytics widgets with:
 * - Widget collection by category
 * - Preview mode
 * - Quick-add functionality
 * - Customization options
 * - Search and filtering
 * - Widget templates
 * 
 * @module components/analytics/analytics-widget-library
 */

"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  Calendar,
  Award,
  MessageSquare,
  CheckCircle,
  Clock,
  Search,
  Plus,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface Widget {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  dataSource: string;
  visualization: "stat" | "bar" | "line" | "pie" | "table" | "gauge";
  metrics: string[];
  previewImage?: string;
}

const WIDGET_LIBRARY: Widget[] = [
  {
    id: "total-members",
    name: "Total Members",
    description: "Display total active member count",
    category: "Membership",
    icon: <Users className="h-5 w-5" />,
    dataSource: "members",
    visualization: "stat",
    metrics: ["Total Count", "Active Members"],
  },
  {
    id: "member-growth",
    name: "Member Growth",
    description: "Track member growth over time",
    category: "Membership",
    icon: <TrendingUp className="h-5 w-5" />,
    dataSource: "members",
    visualization: "line",
    metrics: ["New Members", "Total Members", "Churn Rate"],
  },
  {
    id: "members-by-department",
    name: "Members by Department",
    description: "Distribution of members across departments",
    category: "Membership",
    icon: <BarChart3 className="h-5 w-5" />,
    dataSource: "members",
    visualization: "bar",
    metrics: ["Member Count by Department"],
  },
  {
    id: "claims-overview",
    name: "Claims Overview",
    description: "Summary of claim statuses",
    category: "Claims",
    icon: <FileText className="h-5 w-5" />,
    dataSource: "claims",
    visualization: "stat",
    metrics: ["Open Claims", "Resolved Claims", "Pending Claims"],
  },
  {
    id: "claims-by-type",
    name: "Claims by Type",
    description: "Breakdown of claims by category",
    category: "Claims",
    icon: <BarChart3 className="h-5 w-5" />,
    dataSource: "claims",
    visualization: "pie",
    metrics: ["Claim Distribution"],
  },
  {
    id: "claim-resolution-time",
    name: "Resolution Time",
    description: "Average time to resolve claims",
    category: "Claims",
    icon: <Clock className="h-5 w-5" />,
    dataSource: "claims",
    visualization: "gauge",
    metrics: ["Average Days", "Target Days"],
  },
  {
    id: "training-completion",
    name: "Training Completion Rate",
    description: "Overall training completion percentage",
    category: "Training",
    icon: <Award className="h-5 w-5" />,
    dataSource: "training",
    visualization: "gauge",
    metrics: ["Completion Rate", "Enrollments", "Completions"],
  },
  {
    id: "popular-courses",
    name: "Popular Courses",
    description: "Most enrolled training courses",
    category: "Training",
    icon: <TrendingUp className="h-5 w-5" />,
    dataSource: "training",
    visualization: "bar",
    metrics: ["Enrollment Count", "Completion Rate"],
  },
  {
    id: "certifications-expiring",
    name: "Certifications Expiring",
    description: "Track certifications expiring soon",
    category: "Training",
    icon: <Calendar className="h-5 w-5" />,
    dataSource: "certifications",
    visualization: "table",
    metrics: ["Member Name", "Certification", "Expiry Date"],
  },
  {
    id: "election-turnout",
    name: "Election Turnout",
    description: "Voter participation rates",
    category: "Voting",
    icon: <CheckCircle className="h-5 w-5" />,
    dataSource: "voting",
    visualization: "gauge",
    metrics: ["Turnout %", "Total Voters", "Votes Cast"],
  },
  {
    id: "voting-trends",
    name: "Voting Trends",
    description: "Participation trends over time",
    category: "Voting",
    icon: <TrendingUp className="h-5 w-5" />,
    dataSource: "voting",
    visualization: "line",
    metrics: ["Turnout Rate", "Eligible Voters"],
  },
  {
    id: "engagement-score",
    name: "Member Engagement",
    description: "Overall engagement metrics",
    category: "Engagement",
    icon: <TrendingUp className="h-5 w-5" />,
    dataSource: "engagement",
    visualization: "stat",
    metrics: ["Engagement Score", "Active Members"],
  },
  {
    id: "communication-stats",
    name: "Communication Stats",
    description: "Email and message metrics",
    category: "Engagement",
    icon: <MessageSquare className="h-5 w-5" />,
    dataSource: "communications",
    visualization: "bar",
    metrics: ["Messages Sent", "Open Rate", "Click Rate"],
  },
];

const CATEGORIES = ["All", "Membership", "Claims", "Training", "Voting", "Engagement"];

export interface AnalyticsWidgetLibraryProps {
  onAddWidget?: (widget: Widget) => void;
}

export function AnalyticsWidgetLibrary({ onAddWidget }: AnalyticsWidgetLibraryProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("All");
  const [_previewWidget, setPreviewWidget] = React.useState<Widget | null>(null);

  const filteredWidgets = React.useMemo(() => {
    return WIDGET_LIBRARY.filter((widget) => {
      const matchesSearch =
        searchQuery === "" ||
        widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        widget.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || widget.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const widgetsByCategory = React.useMemo(() => {
    return filteredWidgets.reduce((acc, widget) => {
      if (!acc[widget.category]) {
        acc[widget.category] = [];
      }
      acc[widget.category].push(widget);
      return acc;
    }, {} as Record<string, Widget[]>);
  }, [filteredWidgets]);

  const getVisualizationBadge = (type: Widget["visualization"]) => {
    const config = {
      stat: { color: "bg-blue-100 text-blue-800", label: "Stat Card" },
      bar: { color: "bg-green-100 text-green-800", label: "Bar Chart" },
      line: { color: "bg-purple-100 text-purple-800", label: "Line Chart" },
      pie: { color: "bg-orange-100 text-orange-800", label: "Pie Chart" },
      table: { color: "bg-gray-100 text-gray-800", label: "Table" },
      gauge: { color: "bg-yellow-100 text-yellow-800", label: "Gauge" },
    };
    return <Badge className={config[type].color}>{config[type].label}</Badge>;
  };

  const renderWidgetPreview = (widget: Widget) => {
    return (
      <div className="space-y-4">
        <div className="border rounded-lg p-6 bg-gray-50">
          <div className="text-center">
            <div className="flex justify-center mb-4">{widget.icon}</div>
            <div className="text-sm text-gray-600 mb-2">{widget.name}</div>
            <div className="text-3xl font-bold">1,234</div>
            <div className="text-xs text-gray-500 mt-1">Sample Data</div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">Data Source</div>
            <div className="text-sm text-gray-600">{widget.dataSource}</div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Visualization Type</div>
            {getVisualizationBadge(widget.visualization)}
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Available Metrics</div>
            <div className="flex flex-wrap gap-2">
              {widget.metrics.map((metric) => (
                <Badge key={metric} variant="outline">
                  {metric}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Analytics Widget Library
        </h2>
        <p className="text-gray-600 mt-1">
          Pre-built widgets for dashboards and reports
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search widgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Widget Grid */}
      <div className="space-y-6">
        {Object.entries(widgetsByCategory).map(([category, widgets]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {category}
              <Badge variant="outline">{widgets.length}</Badge>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgets.map((widget) => (
                <Card key={widget.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {widget.icon}
                        <CardTitle className="text-base">{widget.name}</CardTitle>
                      </div>
                      {getVisualizationBadge(widget.visualization)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{widget.description}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {widget.metrics.slice(0, 2).map((metric) => (
                        <Badge key={metric} variant="outline" className="text-xs">
                          {metric}
                        </Badge>
                      ))}
                      {widget.metrics.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{widget.metrics.length - 2} more
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setPreviewWidget(widget)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              {widget.icon}
                              {widget.name}
                            </DialogTitle>
                          </DialogHeader>
                          {renderWidgetPreview(widget)}
                          <DialogFooter>
                            <Button onClick={() => onAddWidget?.(widget)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add to Dashboard
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => onAddWidget?.(widget)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredWidgets.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50 text-gray-400" />
            <p className="text-gray-600">No widgets found</p>
            <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

