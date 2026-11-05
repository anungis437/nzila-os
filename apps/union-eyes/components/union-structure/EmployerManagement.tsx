/**
 * Employer Management Component
 *
 * The employers of the organization (companies that employ union members), over /api/employers: list, create, edit and archive.
 * Writing needs the steward role and archiving the administrator role. The route decides, and its refusal is shown as the route states it.
 * Archiving keeps the record and sets its status to archived, which takes it off this list.
 */
"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Archive, Edit, MapPin, MoreVertical, Plus, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  provinceChoices,
  textOrNull,
  toAddressPayload,
  type Address,
  type EmployerRow,
} from "./structure-data";

const EMPLOYER_TYPES: Record<string, string> = {
  private: "Private",
  public: "Public",
  non_profit: "Non-Profit",
  crown_corporation: "Crown Corporation",
  municipal: "Municipal",
  provincial: "Provincial",
  federal: "Federal",
  educational: "Educational",
  healthcare: "Healthcare",
};

const EMPLOYER_STATUSES: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  contract_expired: "Contract Expired",
  in_bargaining: "In Bargaining",
  dispute: "Dispute",
  archived: "Archived",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  contract_expired: "bg-amber-100 text-amber-800",
  in_bargaining: "bg-blue-100 text-blue-800",
  dispute: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-800",
};

const labelOf = (labels: Record<string, string>, code: string) => labels[code] ?? humanize(code);

const EMPLOYER_TYPE_CODES = Object.keys(EMPLOYER_TYPES);
const EMPLOYER_STATUS_CODES = Object.keys(EMPLOYER_STATUSES);

// Only what the form edits and /api/employers takes from a steward. Counts are text here so that a blank field is blank, not zero.
const wholeNumber = z.string().regex(/^\d{0,9}$/, "Enter a whole number");

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  legalName: z.string().max(255),
  businessNumber: z.string().max(50),
  employerType: z.string().refine((code) => EMPLOYER_TYPE_CODES.includes(code), "Select an employer type"),
  status: z.string().refine((code) => EMPLOYER_STATUS_CODES.includes(code), "Select a status"),
  totalEmployees: wholeNumber,
  unionizedEmployees: wholeNumber,
  email: z
    .string()
    .max(255)
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address"),
  phone: z.string().max(50).regex(/^[\d\s\-+().ext]*$/, "Invalid phone number format"),
  website: z
    .string()
    .max(500)
    .refine((value) => value === "" || z.url().safeParse(value).success, "Enter a valid URL"),
  street: z.string().max(255),
  city: z.string().max(255),
  province: z.string().max(50),
  postalCode: z.string().max(20),
  notes: z.string(),
});

type EmployerFormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: EmployerFormValues = {
  name: "",
  legalName: "",
  businessNumber: "",
  employerType: "",
  status: "active",
  totalEmployees: "",
  unionizedEmployees: "",
  email: "",
  phone: "",
  website: "",
  ...EMPTY_ADDRESS_FIELDS,
  notes: "",
};

function formValuesOf(employer: EmployerRow): EmployerFormValues {
  return {
    name: employer.name,
    legalName: employer.legalName ?? "",
    businessNumber: employer.businessNumber ?? "",
    employerType: employer.employerType,
    status: employer.status,
    totalEmployees: employer.totalEmployees === null ? "" : String(employer.totalEmployees),
    unionizedEmployees: employer.unionizedEmployees === null ? "" : String(employer.unionizedEmployees),
    email: employer.email ?? "",
    phone: employer.phone ?? "",
    website: employer.website ?? "",
    ...addressFieldsOf(employer.mainAddress),
    notes: employer.notes ?? "",
  };
}

/** The body POST /api/employers and PATCH /api/employers/{id} take: a blank optional field is sent as null, which clears it. */
export function toEmployerPayload(values: EmployerFormValues, existingAddress: Address | null) {
  return {
    name: values.name,
    legalName: textOrNull(values.legalName),
    businessNumber: textOrNull(values.businessNumber),
    employerType: values.employerType,
    status: values.status,
    totalEmployees: integerOrNull(values.totalEmployees),
    unionizedEmployees: integerOrNull(values.unionizedEmployees),
    email: textOrNull(values.email),
    phone: textOrNull(values.phone),
    website: textOrNull(values.website),
    mainAddress: toAddressPayload(
      { street: values.street, city: values.city, province: values.province, postalCode: values.postalCode },
      existingAddress,
    ),
    notes: textOrNull(values.notes),
  };
}

function EmployeeCounts({ employer }: { employer: EmployerRow }) {
  const { unionizedEmployees, totalEmployees } = employer;
  if (unionizedEmployees === null && totalEmployees === null) return <>—</>;
  return (
    <div className="text-sm">
      {unionizedEmployees !== null && <div>{unionizedEmployees.toLocaleString()} union</div>}
      {totalEmployees !== null && (
        <div className="text-muted-foreground">{totalEmployees.toLocaleString()} total</div>
      )}
    </div>
  );
}

interface EmployerManagementProps {
  organizationId: string;
  onUpdate?: () => void;
}

export function EmployerManagement({ organizationId, onUpdate }: EmployerManagementProps) {
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployer, setEditingEmployer] = useState<EmployerRow | null>(null);
  const { toast } = useToast();

  const form = useForm<EmployerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    let current = true;
    loadEmployers().then(
      (rows) => {
        if (!current) return;
        setEmployers(rows);
        setLoadError(null);
        setIsLoading(false);
      },
      (error: unknown) => {
        logger.error("Failed to load employers", error);
        if (!current) return;
        // A list that did not load is an error on the page, never an empty list.
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
    setEditingEmployer(null);
    form.reset(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (employer: EmployerRow) => {
    setEditingEmployer(employer);
    form.reset(formValuesOf(employer));
    setIsDialogOpen(true);
  };

  const handleArchive = async (employer: EmployerRow) => {
    if (!confirm(`Archive employer '${employer.name}'? The record is kept, with its status set to archived.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/employers/${encodeURIComponent(employer.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response, "Failed to archive employer"));

      toast({ title: "Success", description: "Employer archived" });
      reload();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: failureText(error, "Failed to archive employer"),
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: EmployerFormValues) => {
    try {
      const response = await fetch(
        editingEmployer ? `/api/employers/${encodeURIComponent(editingEmployer.id)}` : "/api/employers",
        {
          method: editingEmployer ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toEmployerPayload(values, editingEmployer?.mainAddress ?? null)),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response, "Failed to save employer"));

      toast({
        title: "Success",
        description: `Employer ${editingEmployer ? "updated" : "created"} successfully`,
      });

      setIsDialogOpen(false);
      reload();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: failureText(error, "Failed to save employer"),
        variant: "destructive",
      });
    }
  };

  const query = searchQuery.toLowerCase();
  const filteredEmployers = employers.filter(
    (employer) =>
      employer.status !== "archived" &&
      (employer.name.toLowerCase().includes(query) || employer.legalName?.toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Employers</CardTitle>
              <CardDescription>
                Manage companies that employ union members
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={reload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Employer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search employers"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
          ) : loadError !== null ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p role="alert" className="text-sm text-destructive">
                Failed to load employers: {loadError}
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
                    <TableHead>Type</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "No employers found" : "No employers yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployers.map((employer) => (
                      <TableRow key={employer.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{employer.name}</div>
                            {employer.legalName && employer.legalName !== employer.name && (
                              <div className="text-sm text-muted-foreground">
                                {employer.legalName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{labelOf(EMPLOYER_TYPES, employer.employerType)}</TableCell>
                        <TableCell>
                          <EmployeeCounts employer={employer} />
                        </TableCell>
                        <TableCell>
                          {employer.mainAddress?.city || employer.mainAddress?.province ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {formatLocation(employer.mainAddress)}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={STATUS_STYLES[employer.status] ?? "bg-gray-100 text-gray-800"}
                          >
                            {labelOf(EMPLOYER_STATUSES, employer.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`Actions for ${employer.name}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(employer)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleArchive(employer)}
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
              {editingEmployer ? "Edit Employer" : "Create Employer"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployer
                ? "Update employer information"
                : "Add a new employer to your organization"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-medium">Basic Information</h3>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employer Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC Corporation" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Name</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC Corporation Inc." {...field} />
                      </FormControl>
                      <FormDescription>
                        Full legal name if different from employer name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Number</FormLabel>
                        <FormControl>
                          <Input placeholder="123456789RC0001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(EMPLOYER_TYPES).map(([code, label]) => (
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalEmployees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Employees</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unionizedEmployees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unionized Employees</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-medium">Contact Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="hr@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="font-medium">Address</h3>

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
              </div>

              {/* Status & Notes */}
              <div className="space-y-4">
                <h3 className="font-medium">Status & Notes</h3>

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
                          {Object.entries(EMPLOYER_STATUSES).map(([code, label]) => (
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
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this employer..."
                          rows={3}
                          {...field}
                        />
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
                  {form.formState.isSubmitting ? "Saving..." : editingEmployer ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
