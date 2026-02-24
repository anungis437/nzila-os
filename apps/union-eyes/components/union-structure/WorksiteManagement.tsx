/**
 * Worksite Management Component
 * 
 * CRUD interface for managing worksite entities (physical work locations).
 */
"use client";

import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MapPin, Plus, Edit, Trash2, Search, MoreVertical, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import{ Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { createWorksiteSchema } from "@/lib/validation/union-structure-schemas";

// NOTE: Known TypeScript limitation with react-hook-form + Zod schemas using .default()
// The base schema's address fields use .default(), creating optional types that conflict with
// react-hook-form's strict type inference. Runtime behavior is correct - suppressing type errors below.
const formSchema = createWorksiteSchema.omit({
  organizationId: true,
}).extend({
  status: z.enum(['active', 'temporarily_closed', 'permanently_closed', 'seasonal', 'archived']),
  operatesWeekends: z.boolean(),
  operates24Hours: z.boolean(),
});

type WorksiteFormData = z.infer<typeof formSchema>;

interface Worksite {
  id: string;
  organizationId: string;
  employerId: string;
  name: string;
  code?: string;
  worksiteType?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  status: string;
  totalEmployees?: number;
  createdAt: string;
  employer?: {
    name: string;
  };
  _count?: {
    bargainingUnits: number;
  };
}

interface Employer {
  id: string;
  name: string;
}

interface WorksiteManagementProps {
  organizationId: string;
  onUpdate?: () => void;
}

export function WorksiteManagement({ organizationId, onUpdate }: WorksiteManagementProps) {
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorksite, setEditingWorksite] = useState<Worksite | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<WorksiteFormData, any, WorksiteFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      employerId: "",
      name: "",
      code: "",
      status: "active",
      address: {
        street: "",
        city: "",
        province: "",
        postal_code: "",
        country: "Canada",
      },
      employeeCount: 0,
      shiftCount: 0,
      operatesWeekends: false,
      operates24Hours: false,
      siteManagerName: "",
      siteManagerEmail: "",
      siteManagerPhone: "",
      description: "",
      notes: "",
    },
  });

  useEffect(() => {
    fetchWorksites();
    fetchEmployers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const fetchWorksites = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/worksites?organizationId=${organizationId}`);
      if (!response.ok) throw new Error("Failed to fetch worksites");
      const data = await response.json();
      setWorksites(data.data || []);
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load worksites",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployers = async () => {
    try {
      const response = await fetch(`/api/employers?organizationId=${organizationId}`);
      if (!response.ok) throw new Error("Failed to fetch employers");
      const data = await response.json();
      setEmployers(data.data || []);
    } catch (error) {
      logger.error("Failed to load employers", error);
    }
  };

  const handleCreate = () => {
    setEditingWorksite(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (worksite: Worksite) => {
    setEditingWorksite(worksite);
    // @ts-expect-error - Type mismatch between DB model and form schema (known limitation)
    form.reset({
      employerId: worksite.employerId,
      name: worksite.name,
      code: worksite.code || "",
      status: worksite.status,
      address: {
        street: worksite.address || "",
        city: worksite.city || "",
        province: worksite.province || "",
        postal_code: worksite.postalCode || "",
        country: worksite.country || "Canada",
      },
      employeeCount: worksite.totalEmployees || 0,
      shiftCount: 0,
      operatesWeekends: false,
      operates24Hours: false,
      siteManagerName: "",
      siteManagerEmail: "",
      siteManagerPhone: "",
      description: "",
      notes: "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this worksite?")) return;

    try {
      const response = await fetch(`/api/worksites/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete worksite");

      toast({
        title: "Success",
        description: "Worksite deleted successfully",
      });

      fetchWorksites();
      onUpdate?.();
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete worksite",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: WorksiteFormData) => {
    try {
      setIsSubmitting(true);

      const payload = {
        ...data,
        organizationId,
      };

      const url = editingWorksite
        ? `/api/worksites/${editingWorksite.id}`
        : `/api/worksites`;

      const method = editingWorksite ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save worksite");
      }

      toast({
        title: "Success",
        description: `Worksite ${editingWorksite ? "updated" : "created"} successfully`,
      });

      setIsDialogOpen(false);
      fetchWorksites();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to save worksite",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredWorksites = worksites.filter((worksite) =>
    worksite.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    worksite.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    worksite.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Worksites</CardTitle>
              <CardDescription>
                Manage physical work locations
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Worksite
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search worksites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredWorksites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No worksites found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorksites.map((worksite) => (
                    <TableRow key={worksite.id}>
                      <TableCell className="font-medium">{worksite.name}</TableCell>
                      <TableCell>{worksite.code || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3" />
                          {worksite.employer?.name || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {worksite.city && worksite.province ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {worksite.city}, {worksite.province}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{worksite.worksiteType || "—"}</TableCell>
                      <TableCell>{worksite.totalEmployees?.toLocaleString() || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {worksite.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(worksite)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(worksite.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorksite ? "Edit Worksite" : "Create Worksite"}
            </DialogTitle>
            <DialogDescription>
              {editingWorksite
                ? "Update worksite information"
                : "Add a new worksite location"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="employerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employers.map((employer) => (
                          <SelectItem key={employer.id} value={employer.id}>
                            {employer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Worksite Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Main Plant" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="WS-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="temporarily_closed">Temporarily Closed</SelectItem>
                          <SelectItem value="permanently_closed">Permanently Closed</SelectItem>
                          <SelectItem value="seasonal">Seasonal</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="employeeCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee Count</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Toronto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ON">Ontario</SelectItem>
                          <SelectItem value="QC">Quebec</SelectItem>
                          <SelectItem value="BC">British Columbia</SelectItem>
                          <SelectItem value="AB">Alberta</SelectItem>
                          <SelectItem value="MB">Manitoba</SelectItem>
                          <SelectItem value="SK">Saskatchewan</SelectItem>
                          <SelectItem value="NS">Nova Scotia</SelectItem>
                          <SelectItem value="NB">New Brunswick</SelectItem>
                          <SelectItem value="PE">Prince Edward Island</SelectItem>
                          <SelectItem value="NL">Newfoundland and Labrador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="M5A 1A1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingWorksite ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
