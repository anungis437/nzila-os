/**
 * Employer Management Component
 * 
 * CRUD interface for managing employer entities (companies that employ union members).
 * Features:
 * - List all employers in a table
 * - Create new employers
 * - Edit existing employers  
 * - Soft delete employers
 * - View related worksites and bargaining units
 */
"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
 
import {
  Plus,
  Edit,
  Trash2,
  Search,
  MoreVertical,
  MapPin,
  Phone as _Phone,
} from "lucide-react";
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
import { createEmployerSchema } from "@/lib/validation/union-structure-schemas";

// NOTE: Known TypeScript limitation with react-hook-form + Zod schemas using .default()
// The base schema's address.country field uses .default('Canada'), creating type: string | undefined
// This conflicts with react-hook-form's strict type inference expecting: string
// Runtime behavior is correct - suppressing type errors below. See: lib/validation/union-structure-schemas.ts
const formSchema = createEmployerSchema.omit({
  organizationId: true,
}).extend({
  status: z.enum(['active', 'inactive', 'contract_expired', 'in_bargaining', 'dispute', 'archived']),
});

type EmployerFormData = z.infer<typeof formSchema>;

interface Employer {
  id: string;
  organizationId: string;
  name: string;
  legalName?: string;
  businessNumber?: string;
  employerType?: string;
  parentCompanyId?: string;
  industryType?: string;
  totalEmployees?: number;
  unionizedEmployees?: number;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  status: string;
  relationshipStartDate?: string;
  relationshipType?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    worksites: number;
    bargainingUnits: number;
  };
}

interface EmployerManagementProps {
  organizationId: string;
  onUpdate?: () => void;
}

export function EmployerManagement({ organizationId, onUpdate }: EmployerManagementProps) {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployer, setEditingEmployer] = useState<Employer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<EmployerFormData, any, EmployerFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: "",
      legalName: "",
      dbaName: "",
      employerType: "private",
      status: "active",
      businessNumber: "",
      email: "",
      phone: "",
      website: "",
      mainAddress: {
        street: "",
        city: "",
        province: "",
        postal_code: "",
        country: "Canada",
      },
      totalEmployees: 0,
      unionizedEmployees: 0,
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      notes: "",
    },
  });

  useEffect(() => {
    fetchEmployers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const fetchEmployers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/employers?organizationId=${organizationId}`);
      if (!response.ok) throw new Error("Failed to fetch employers");
      const data = await response.json();
      setEmployers(data.data || []);
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load employers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingEmployer(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (employer: Employer) => {
    setEditingEmployer(employer);
    // @ts-expect-error - Type mismatch between DB model and form schema (known limitation)
    form.reset({
      name: employer.name,
      legalName: employer.legalName || "",
      dbaName: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employerType: (employer.employerType as any) || "private",
      status: employer.status,
      businessNumber: employer.businessNumber || "",
      email: employer.contactEmail || "",
      phone: employer.contactPhone || "",
      website: employer.website || "",
      mainAddress: {
        street: employer.address || "",
        city: employer.city || "",
        province: employer.province || "",
        postal_code: employer.postalCode || "",
        country: employer.country || "Canada",
      },
      totalEmployees: employer.totalEmployees || 0,
      unionizedEmployees: employer.unionizedEmployees || 0,
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      notes: employer.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this employer? This will soft-delete the record.")) {
      return;
    }

    try {
      const response = await fetch(`/api/employers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete employer");

      toast({
        title: "Success",
        description: "Employer deleted successfully",
      });

      fetchEmployers();
      onUpdate?.();
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete employer",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: EmployerFormData) => {
    try {
      setIsSubmitting(true);

      const payload = {
        ...data,
        organizationId,
      };

      const url = editingEmployer
        ? `/api/employers/${editingEmployer.id}`
        : `/api/employers`;

      const method = editingEmployer ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save employer");
      }

      toast({
        title: "Success",
        description: `Employer ${editingEmployer ? "updated" : "created"} successfully`,
      });

      setIsDialogOpen(false);
      fetchEmployers();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to save employer",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployers = employers.filter((employer) =>
    employer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employer.legalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employer.industryType?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Worksites</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredEmployers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No employers found
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
                      <TableCell>{employer.industryType || "—"}</TableCell>
                      <TableCell>
                        {employer.unionizedEmployees && employer.totalEmployees ? (
                          <div className="text-sm">
                            <div>{employer.unionizedEmployees.toLocaleString()} union</div>
                            <div className="text-muted-foreground">
                              {employer.totalEmployees.toLocaleString()} total
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {employer.city && employer.province ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {employer.city}, {employer.province}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(employer.status)}
                        >
                          {employer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {employer._count?.worksites || 0}
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
                            <DropdownMenuItem onClick={() => handleEdit(employer)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(employer.id)}
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
                        <FormLabel>Employer Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="non_profit">Non-Profit</SelectItem>
                            <SelectItem value="crown_corporation">Crown Corporation</SelectItem>
                            <SelectItem value="municipal">Municipal</SelectItem>
                            <SelectItem value="provincial">Provincial</SelectItem>
                            <SelectItem value="federal">Federal</SelectItem>
                            <SelectItem value="educational">Educational</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
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

                  <FormField
                    control={form.control}
                    name="unionizedEmployees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unionized Employees</FormLabel>
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
                  name="mainAddress.street"
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
                    name="mainAddress.city"
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
                    name="mainAddress.province"
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
                            <SelectItem value="YT">Yukon</SelectItem>
                            <SelectItem value="NT">Northwest Territories</SelectItem>
                            <SelectItem value="NU">Nunavut</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mainAddress.postal_code"
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
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="contract_expired">Contract Expired</SelectItem>
                          <SelectItem value="in_bargaining">In Bargaining</SelectItem>
                          <SelectItem value="dispute">Dispute</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
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
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingEmployer ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
