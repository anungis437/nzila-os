/**
 * Worksite Management Component
 *
 * The worksites of the organization (physical work locations), over /api/worksites: list, create, edit and archive.
 * Writing needs the steward role and archiving the administrator role. The route decides, and its refusal is shown as the route states it.
 * The route leaves the site manager, the notes and the custom fields out of what it sends, so this screen neither shows nor rewrites them.
 */
"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Archive, Building2, Edit, MapPin, MoreVertical, Plus, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger";
import { readApiError } from "@/lib/client/api-envelope";
import { humanize } from "@/lib/client/row-fields";
import {
  addressFieldsOf,
  EMPTY_ADDRESS_FIELDS,
  failureText,
  formatLocation,
  integerOrNull,
  loadEmployers,
  loadWorksites,
  provinceChoices,
  textOrNull,
  toAddressPayload,
  type Address,
  type EmployerRow,
  type WorksiteRow,
} from "./structure-data";

const WORKSITE_STATUSES: Record<string, string> = {
  active: "Active",
  temporarily_closed: "Temporarily Closed",
  permanently_closed: "Permanently Closed",
  seasonal: "Seasonal",
  archived: "Archived",
};

const WORKSITE_STATUS_CODES = Object.keys(WORKSITE_STATUSES);

// Only what the form edits and /api/worksites takes from a steward. The count is text here so that a blank field is blank, not zero.
const formSchema = z.object({
  employerId: z.string().min(1, "Employer is required"),
  name: z.string().trim().min(1, "Name is required").max(255),
  code: z.string().max(50),
  status: z.string().refine((code) => WORKSITE_STATUS_CODES.includes(code), "Select a status"),
  employeeCount: z.string().regex(/^\d{0,9}$/, "Enter a whole number"),
  street: z.string().max(255),
  city: z.string().max(255),
  province: z.string().max(50),
  postalCode: z.string().max(20),
});

type WorksiteFormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: WorksiteFormValues = {
  employerId: "",
  name: "",
  code: "",
  status: "active",
  employeeCount: "",
  ...EMPTY_ADDRESS_FIELDS,
};

function formValuesOf(worksite: WorksiteRow): WorksiteFormValues {
  return {
    employerId: worksite.employerId,
    name: worksite.name,
    code: worksite.code ?? "",
    status: worksite.status,
    employeeCount: worksite.employeeCount === null ? "" : String(worksite.employeeCount),
    ...addressFieldsOf(worksite.address),
  };
}

/** The body POST /api/worksites and PATCH /api/worksites/{id} take: a blank optional field is sent as null, which clears it. */
export function toWorksitePayload(values: WorksiteFormValues, existingAddress: Address | null) {
  return {
    employerId: values.employerId,
    name: values.name,
    code: textOrNull(values.code),
    status: values.status,
    employeeCount: integerOrNull(values.employeeCount),
    address: toAddressPayload(
      { street: values.street, city: values.city, province: values.province, postalCode: values.postalCode },
      existingAddress,
    ),
  };
}

interface WorksiteManagementProps {
  organizationId: string;
  onUpdate?: () => void;
}

export function WorksiteManagement({ organizationId, onUpdate }: WorksiteManagementProps) {
  const [worksites, setWorksites] = useState<WorksiteRow[]>([]);
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorksite, setEditingWorksite] = useState<WorksiteRow | null>(null);
  const { toast } = useToast();

  const form = useForm<WorksiteFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    let current = true;
    Promise.all([loadWorksites(), loadEmployers()]).then(
      ([worksiteRows, employerRows]) => {
        if (!current) return;
        setWorksites(worksiteRows);
        setEmployers(employerRows);
        setLoadError(null);
        setIsLoading(false);
      },
      (error: unknown) => {
        logger.error("Failed to load worksites", error);
        if (!current) return;
        // The employer names and choices come from the second list, so either one failing leaves the screen incomplete: an error, never a partial table.
        setWorksites([]);
        setEmployers([]);
        setLoadError(failureText(error, "Unknown error"));
        setIsLoading(false);
      },
    );
    return () => {
      current = false;
    };
  }, [organizationId, reloadKey]);

  const reload = () => {
    setIsLoading(true);
    setReloadKey((key) => key + 1);
  };

  const handleCreate = () => {
    setEditingWorksite(null);
    form.reset(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (worksite: WorksiteRow) => {
    setEditingWorksite(worksite);
    form.reset(formValuesOf(worksite));
    setIsDialogOpen(true);
  };

  const handleArchive = async (worksite: WorksiteRow) => {
    if (!confirm(`Archive worksite '${worksite.name}'? The record is kept, with its status set to archived.`)) return;

    try {
      const response = await fetch(`/api/worksites/${encodeURIComponent(worksite.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response, "Failed to archive worksite"));

      toast({ title: "Success", description: "Worksite archived" });
      reload();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: failureText(error, "Failed to archive worksite"),
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: WorksiteFormValues) => {
    try {
      const response = await fetch(
        editingWorksite ? `/api/worksites/${encodeURIComponent(editingWorksite.id)}` : "/api/worksites",
        {
          method: editingWorksite ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toWorksitePayload(values, editingWorksite?.address ?? null)),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response, "Failed to save worksite"));

      toast({
        title: "Success",
        description: `Worksite ${editingWorksite ? "updated" : "created"} successfully`,
      });

      setIsDialogOpen(false);
      reload();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: failureText(error, "Failed to save worksite"),
        variant: "destructive",
      });
    }
  };

  const employerNameOf = (worksite: WorksiteRow) =>
    employers.find((employer) => employer.id === worksite.employerId)?.name;

  const query = searchQuery.toLowerCase();
  const filteredWorksites = worksites.filter(
    (worksite) =>
      worksite.status !== "archived" &&
      (worksite.name.toLowerCase().includes(query) ||
        worksite.code?.toLowerCase().includes(query) ||
        worksite.address?.city?.toLowerCase().includes(query)),
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
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={reload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Worksite
              </Button>
            </div>
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
                aria-label="Search worksites"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
          ) : loadError !== null ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p role="alert" className="text-sm text-destructive">
                Failed to load worksites: {loadError}
              </p>
              <Button variant="outline" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Employer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorksites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "No worksites found" : "No worksites yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWorksites.map((worksite) => (
                      <TableRow key={worksite.id}>
                        <TableCell className="font-medium">{worksite.name}</TableCell>
                        <TableCell>{worksite.code || "—"}</TableCell>
                        <TableCell>
                          {employerNameOf(worksite) ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3" />
                              {employerNameOf(worksite)}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {worksite.address?.city || worksite.address?.province ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {formatLocation(worksite.address)}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{worksite.employeeCount === null ? "—" : worksite.employeeCount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {WORKSITE_STATUSES[worksite.status] ?? humanize(worksite.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`Actions for ${worksite.name}`}>
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
                                onClick={() => handleArchive(worksite)}
                                className="text-red-600"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
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
          )}
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
                        {employers
                          .filter((employer) => employer.status !== "archived" || employer.id === field.value)
                          .map((employer) => (
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
                          {Object.entries(WORKSITE_STATUSES).map(([code, label]) => (
                            <SelectItem key={code} value={code}>
                              {label}
                            </SelectItem>
                          ))}
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
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="street"
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
                  name="city"
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
                  name="province"
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
                          {provinceChoices(field.value).map((province) => (
                            <SelectItem key={province.code} value={province.code}>
                              {province.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postalCode"
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : editingWorksite ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
