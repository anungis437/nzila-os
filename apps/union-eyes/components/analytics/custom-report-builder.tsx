/**
 * Custom Report Builder Component
 * 
 * Drag-and-drop report builder with:
 * - Data source selection
 * - Field picker with drag-drop
 * - Filtering, grouping, sorting
 * - Calculated fields
 * - Chart type selection
 * - Save as template
 * 
 * @module components/analytics/custom-report-builder
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  FileText,
  Plus,
  Trash2,
  BarChart3,
  Table as TableIcon,
  PieChart,
  LineChart,
  Filter,
  Calculator,
  Save,
  Play,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
 
import {
  Table as _Table,
} from "@/components/ui/table";

const reportBuilderSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  description: z.string().optional(),
  dataSource: z.string().min(1, "Data source is required"),
  fields: z.array(z.string()).min(1, "At least one field is required"),
  filters: z.array(
    z.object({
      field: z.string(),
      operator: z.string(),
      value: z.string(),
    })
  ),
  groupBy: z.array(z.string()).optional(),
  sortBy: z.array(
    z.object({
      field: z.string(),
      direction: z.enum(["asc", "desc"]),
    })
  ),
  calculatedFields: z.array(
    z.object({
      name: z.string(),
      formula: z.string(),
    })
  ),
  chartType: z.enum(["table", "bar", "line", "pie", "none"]),
  limit: z.number().optional(),
});

type ReportBuilderData = z.infer<typeof reportBuilderSchema>;

interface DataSource {
  id: string;
  name: string;
  fields: DataField[];
}

interface DataField {
  id: string;
  name: string;
  type: "string" | "number" | "date" | "boolean";
}

const DATA_SOURCES: DataSource[] = [
  {
    id: "members",
    name: "Members",
    fields: [
      { id: "id", name: "Member ID", type: "string" },
      { id: "name", name: "Full Name", type: "string" },
      { id: "email", name: "Email", type: "string" },
      { id: "department", name: "Department", type: "string" },
      { id: "role", name: "Role", type: "string" },
      { id: "joinDate", name: "Join Date", type: "date" },
      { id: "status", name: "Status", type: "string" },
    ],
  },
  {
    id: "claims",
    name: "Claims",
    fields: [
      { id: "id", name: "Claim ID", type: "string" },
      { id: "type", name: "Claim Type", type: "string" },
      { id: "status", name: "Status", type: "string" },
      { id: "priority", name: "Priority", type: "string" },
      { id: "submittedDate", name: "Submitted Date", type: "date" },
      { id: "resolvedDate", name: "Resolved Date", type: "date" },
      { id: "amount", name: "Amount", type: "number" },
    ],
  },
  {
    id: "training",
    name: "Training",
    fields: [
      { id: "id", name: "Course ID", type: "string" },
      { id: "title", name: "Course Title", type: "string" },
      { id: "category", name: "Category", type: "string" },
      { id: "enrollments", name: "Enrollments", type: "number" },
      { id: "completions", name: "Completions", type: "number" },
      { id: "avgRating", name: "Avg Rating", type: "number" },
    ],
  },
  {
    id: "voting",
    name: "Voting & Elections",
    fields: [
      { id: "id", name: "Election ID", type: "string" },
      { id: "title", name: "Election Title", type: "string" },
      { id: "type", name: "Type", type: "string" },
      { id: "startDate", name: "Start Date", type: "date" },
      { id: "endDate", name: "End Date", type: "date" },
      { id: "turnout", name: "Turnout", type: "number" },
      { id: "eligibleVoters", name: "Eligible Voters", type: "number" },
    ],
  },
];

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "greaterThan", label: "Greater Than" },
  { value: "lessThan", label: "Less Than" },
  { value: "between", label: "Between" },
  { value: "in", label: "In List" },
];

export interface CustomReportBuilderProps {
  onSave?: (report: ReportBuilderData) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRun?: (report: ReportBuilderData) => Promise<any>;
}

export function CustomReportBuilder({ onSave, onRun }: CustomReportBuilderProps) {
  const [selectedDataSource, setSelectedDataSource] = React.useState<DataSource | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [filters, setFilters] = React.useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [calculatedFields, setCalculatedFields] = React.useState<any[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportResults, setReportResults] = React.useState<any[] | null>(null);

  const form = useForm<ReportBuilderData>({
    resolver: zodResolver(reportBuilderSchema),
    defaultValues: {
      name: "",
      description: "",
      dataSource: "",
      fields: [],
      filters: [],
      groupBy: [],
      sortBy: [],
      calculatedFields: [],
      chartType: "table",
    },
  });

  const handleDataSourceChange = (dataSourceId: string) => {
    const source = DATA_SOURCES.find((ds) => ds.id === dataSourceId);
    setSelectedDataSource(source || null);
    form.setValue("dataSource", dataSourceId);
    form.setValue("fields", []);
  };

  const addFilter = () => {
    setFilters([...filters, { field: "", operator: "equals", value: "" }]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateFilter = (index: number, updates: any) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setFilters(newFilters);
    form.setValue("filters", newFilters);
  };

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
    form.setValue("filters", newFilters);
  };

  const addCalculatedField = () => {
    setCalculatedFields([...calculatedFields, { name: "", formula: "" }]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateCalculatedField = (index: number, updates: any) => {
    const newFields = [...calculatedFields];
    newFields[index] = { ...newFields[index], ...updates };
    setCalculatedFields(newFields);
    form.setValue("calculatedFields", newFields);
  };

  const removeCalculatedField = (index: number) => {
    const newFields = calculatedFields.filter((_, i) => i !== index);
    setCalculatedFields(newFields);
    form.setValue("calculatedFields", newFields);
  };

  const handleRunReport = async () => {
    const data = form.getValues();
    setIsRunning(true);
    try {
      const results = await onRun?.(data);
      setReportResults(results || []);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveReport = async (data: ReportBuilderData) => {
    await onSave?.(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Custom Report Builder
        </h2>
        <p className="text-gray-600 mt-1">
          Build custom reports with drag-and-drop interface
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSaveReport)} className="space-y-6">
          {/* Report Details */}
          <Card>
            <CardHeader>
              <CardTitle>Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My Custom Report" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chartType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visualization Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="table">
                            <div className="flex items-center gap-2">
                              <TableIcon className="h-4 w-4" />
                              Table
                            </div>
                          </SelectItem>
                          <SelectItem value="bar">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              Bar Chart
                            </div>
                          </SelectItem>
                          <SelectItem value="line">
                            <div className="flex items-center gap-2">
                              <LineChart className="h-4 w-4" />
                              Line Chart
                            </div>
                          </SelectItem>
                          <SelectItem value="pie">
                            <div className="flex items-center gap-2">
                              <PieChart className="h-4 w-4" />
                              Pie Chart
                            </div>
                          </SelectItem>
                          <SelectItem value="none">None (Data Only)</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Input {...field} placeholder="Describe what this report shows" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Data Source Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Data Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="dataSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Data Source</FormLabel>
                    <Select onValueChange={handleDataSourceChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a data source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DATA_SOURCES.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {selectedDataSource && (
            <>
              {/* Field Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="fields"
                    render={() => (
                      <FormItem>
                        <div className="grid grid-cols-3 gap-3">
                          {selectedDataSource.fields.map((field) => (
                            <FormField
                              key={field.id}
                              control={form.control}
                              name="fields"
                              render={({ field: formField }) => (
                                <div className="flex items-center space-x-2 border rounded-lg p-3">
                                  <Checkbox
                                    checked={formField.value?.includes(field.id)}
                                    onCheckedChange={(checked) => {
                                      const current = formField.value || [];
                                      const updated = checked
                                        ? [...current, field.id]
                                        : current.filter((f) => f !== field.id);
                                      formField.onChange(updated);
                                    }}
                                  />
                                  <Label className="text-sm flex-1">
                                    <div>{field.name}</div>
                                    <div className="text-xs text-gray-500">{field.type}</div>
                                  </Label>
                                </div>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      Filters
                    </CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addFilter}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Filter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {filters.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No filters added</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filters.map((filter, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <Select
                            value={filter.field}
                            onValueChange={(value) => updateFilter(index, { field: value })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedDataSource.fields.map((field) => (
                                <SelectItem key={field.id} value={field.id}>
                                  {field.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={filter.operator}
                            onValueChange={(value) => updateFilter(index, { operator: value })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATORS.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Input
                            value={filter.value}
                            onChange={(e) => updateFilter(index, { value: e.target.value })}
                            placeholder="Value"
                            className="flex-1"
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFilter(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Calculated Fields */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Calculated Fields
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCalculatedField}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Calculated Field
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {calculatedFields.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No calculated fields added</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {calculatedFields.map((field, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <Input
                            value={field.name}
                            onChange={(e) =>
                              updateCalculatedField(index, { name: e.target.value })
                            }
                            placeholder="Field name"
                            className="flex-1"
                          />
                          <Input
                            value={field.formula}
                            onChange={(e) =>
                              updateCalculatedField(index, { formula: e.target.value })
                            }
                            placeholder="Formula (e.g., field1 + field2)"
                            className="flex-[2]"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCalculatedField(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={handleRunReport} disabled={isRunning}>
              <Play className="h-4 w-4 mr-2" />
              {isRunning ? "Running..." : "Run Report"}
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              Save Report
            </Button>
          </div>
        </form>
      </Form>

      {/* Report Results */}
      {reportResults && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 mb-4">
              {reportResults.length} rows returned
            </div>
            {/* Results would be displayed here based on chart type */}
            <div className="text-gray-500">
              Preview would display based on selected visualization type
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

