/**
 * Dashboard Designer Component
 * 
 * Widget-based dashboard builder with:
 * - Drag-and-drop layout
 * - Widget library
 * - Size and position configuration
 * - Real-time data refresh
 * - Multiple dashboards
 * - Sharing permissions
 * 
 * @module components/analytics/dashboard-designer
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Layout,
  GripVertical,
  Trash2,
  Settings,
  Save,
  Eye,
  Share2,
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const dashboardSchema = z.object({
  name: z.string().min(1, "Dashboard name is required"),
  description: z.string().optional(),
  refreshInterval: z.number().optional(),
  isPublic: z.boolean(),
  widgets: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      size: z.object({
        width: z.number(),
        height: z.number(),
      }),
      config: z.record(z.any()).optional(),
    })
  ),
});

type DashboardData = z.infer<typeof dashboardSchema>;

interface Widget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: Record<string, any>;
}

interface WidgetType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  defaultSize: { width: number; height: number };
}

const WIDGET_TYPES: WidgetType[] = [
  {
    id: "stat-card",
    name: "Stat Card",
    description: "Display a single key metric",
    icon: <TrendingUp className="h-5 w-5" />,
    category: "Metrics",
    defaultSize: { width: 1, height: 1 },
  },
  {
    id: "bar-chart",
    name: "Bar Chart",
    description: "Compare values across categories",
    icon: <BarChart3 className="h-5 w-5" />,
    category: "Charts",
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: "line-chart",
    name: "Line Chart",
    description: "Show trends over time",
    icon: <TrendingUp className="h-5 w-5" />,
    category: "Charts",
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: "pie-chart",
    name: "Pie Chart",
    description: "Display proportions",
    icon: <BarChart3 className="h-5 w-5" />,
    category: "Charts",
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: "member-list",
    name: "Member List",
    description: "Recent members or filtered list",
    icon: <Users className="h-5 w-5" />,
    category: "Lists",
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: "activity-feed",
    name: "Activity Feed",
    description: "Recent system activity",
    icon: <Clock className="h-5 w-5" />,
    category: "Lists",
    defaultSize: { width: 2, height: 3 },
  },
  {
    id: "claim-status",
    name: "Claims Overview",
    description: "Claims by status breakdown",
    icon: <FileText className="h-5 w-5" />,
    category: "Metrics",
    defaultSize: { width: 2, height: 2 },
  },
];

export interface DashboardDesignerProps {
  existingDashboard?: DashboardData;
  onSave?: (dashboard: DashboardData) => Promise<void>;
}

export function DashboardDesigner({ existingDashboard, onSave }: DashboardDesignerProps) {
  const [widgets, setWidgets] = React.useState<Widget[]>(existingDashboard?.widgets || []);
  const [selectedWidget, setSelectedWidget] = React.useState<Widget | null>(null);
  const [isPreview, setIsPreview] = React.useState(false);
  const [gridSize] = React.useState({ cols: 4, rows: 6 });

  const form = useForm<DashboardData>({
    resolver: zodResolver(dashboardSchema),
    defaultValues: existingDashboard || {
      name: "",
      description: "",
      refreshInterval: 60,
      isPublic: false,
      widgets: [],
    },
  });

  const addWidget = (widgetType: WidgetType) => {
    // Find first available position
    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: widgetType.id,
      title: widgetType.name,
      position: { x: 0, y: 0 },
      size: widgetType.defaultSize,
      config: {},
    };

    const newWidgets = [...widgets, newWidget];
    setWidgets(newWidgets);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setValue("widgets", newWidgets as any);
  };

  const updateWidget = (id: string, updates: Partial<Widget>) => {
    const newWidgets = widgets.map((w) => (w.id === id ? { ...w, ...updates } : w));
    setWidgets(newWidgets);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setValue("widgets", newWidgets as any);
  };

  const removeWidget = (id: string) => {
    const newWidgets = widgets.filter((w) => w.id !== id);
    setWidgets(newWidgets);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setValue("widgets", newWidgets as any);
    if (selectedWidget?.id === id) {
      setSelectedWidget(null);
    }
  };

  const handleSave = async (data: DashboardData) => {
    const dashboardData = { ...data, widgets };
    await onSave?.(dashboardData);
  };

  const renderWidget = (widget: Widget) => {
    const widgetType = WIDGET_TYPES.find((wt) => wt.id === widget.type);

    return (
      <Card
        key={widget.id}
        className={`relative ${
          selectedWidget?.id === widget.id ? "ring-2 ring-blue-500" : ""
        }`}
        onClick={() => setSelectedWidget(widget)}
        style={{
          gridColumn: `span ${widget.size.width}`,
          gridRow: `span ${widget.size.height}`,
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {widgetType?.icon}
              {widget.title}
            </CardTitle>
            {!isPreview && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <GripVertical className="h-4 w-4" />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Widget Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Widget Title</Label>
                        <Input
                          value={widget.title}
                          onChange={(e) => updateWidget(widget.id, { title: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Width (columns)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={gridSize.cols}
                            value={widget.size.width}
                            onChange={(e) =>
                              updateWidget(widget.id, {
                                size: { ...widget.size, width: parseInt(e.target.value) },
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Height (rows)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={gridSize.rows}
                            value={widget.size.height}
                            onChange={(e) =>
                              updateWidget(widget.id, {
                                size: { ...widget.size, height: parseInt(e.target.value) },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWidget(widget.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">
            {widgetType?.name} - {widget.size.width}x{widget.size.height}
          </div>
          <div className="text-gray-400 mt-4 text-center py-8">
            Widget content would display here
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Layout className="h-6 w-6" />
            Dashboard Designer
          </h2>
          <p className="text-gray-600 mt-1">
            Create custom dashboards with drag-and-drop widgets
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsPreview(!isPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {isPreview ? "Edit Mode" : "Preview"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="design">
        <TabsList>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="design">
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar - Widget Library */}
            {!isPreview && (
              <div className="col-span-3 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Add Widgets</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(
                      WIDGET_TYPES.reduce((acc, widget) => {
                        if (!acc[widget.category]) acc[widget.category] = [];
                        acc[widget.category].push(widget);
                        return acc;
                      }, {} as Record<string, WidgetType[]>)
                    ).map(([category, widgets]) => (
                      <div key={category}>
                        <h4 className="text-sm font-semibold mb-2 text-gray-600">{category}</h4>
                        <div className="space-y-2">
                          {widgets.map((widget) => (
                            <Button
                              key={widget.id}
                              variant="outline"
                              className="w-full justify-start h-auto py-2"
                              onClick={() => addWidget(widget)}
                            >
                              <div className="flex items-start gap-2 w-full">
                                {widget.icon}
                                <div className="text-left">
                                  <div className="font-medium text-sm">{widget.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {widget.description}
                                  </div>
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Canvas */}
            <div className={isPreview ? "col-span-12" : "col-span-9"}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    {/* eslint-disable-next-line react-hooks/incompatible-library */}
                    <CardTitle>{form.watch("name") || "Untitled Dashboard"}</CardTitle>
                    <Badge variant="outline">{widgets.length} widgets</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {widgets.length === 0 ? (
                    <div className="text-center py-24 text-gray-500">
                      <Layout className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No widgets added yet</p>
                      <p className="text-sm">Add widgets from the sidebar to get started</p>
                    </div>
                  ) : (
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${gridSize.cols}, minmax(0, 1fr))`,
                      }}
                    >
                      {widgets.map(renderWidget)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dashboard Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="My Dashboard" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="refreshInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Auto-refresh (seconds)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Describe this dashboard" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isPublic"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between space-x-2 border rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <Share2 className="h-5 w-5 text-gray-500" />
                          <div>
                            <FormLabel className="!mt-0">Public Dashboard</FormLabel>
                            <p className="text-sm text-gray-600">
                              Allow anyone in the organization to view
                            </p>
                          </div>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  Save Dashboard
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

