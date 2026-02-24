"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Building2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { createBargainingUnitSchema } from "@/lib/validation/union-structure-schemas";

// Form schema (omit audit fields)
const formSchema = createBargainingUnitSchema.omit({
  organizationId: true,
});

type FormData = z.infer<typeof formSchema>;

interface BargainingUnit {
  id: string;
  name: string;
  unitNumber: string | null;
  unitType: string;
  status: string;
  employerId: string;
  employerName?: string;
  worksiteId: string | null;
  worksiteName?: string | null;
  memberCount: number;
  certificationNumber: string | null;
  certificationDate: string | null;
  contractExpiryDate: string | null;
  nextBargainingDate: string | null;
}

interface Employer {
  id: string;
  name: string;
}

interface Worksite {
  id: string;
  name: string;
  employerId: string;
}

interface BargainingUnitManagementProps {
  organizationId: string;
  onUpdate?: () => void;
}

export function BargainingUnitManagement({
  organizationId,
  onUpdate,
}: BargainingUnitManagementProps) {
  const [units, setUnits] = useState<BargainingUnit[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<BargainingUnit | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: "",
      unitNumber: "",
      unitType: "full_time",
      status: "active",
      employerId: "",
      worksiteId: undefined,
      certificationNumber: "",
      certificationDate: "",
      certificationBody: "",
      certificationExpiryDate: "",
      currentCollectiveAgreementId: undefined,
      contractExpiryDate: "",
      nextBargainingDate: "",
      memberCount: 0,
      classifications: [],
      chiefStewardId: "",
      bargainingChairId: "",
      description: "",
      notes: "",
      customFields: {},
    },
  });

  // Fetch bargaining units
  const fetchUnits = async () => {
    try {
      const response = await fetch(
        `/api/bargaining-units?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error("Failed to fetch bargaining units");
      const data = await response.json();
      setUnits(data.data || []);
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load bargaining units",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch employers
  const fetchEmployers = async () => {
    try {
      const response = await fetch(
        `/api/employers?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error("Failed to fetch employers");
      const data = await response.json();
      setEmployers(data.data || []);
    } catch (error) {
      logger.error("Failed to fetch employers", error);
    }
  };

  // Fetch worksites
  const fetchWorksites = async () => {
    try {
      const response = await fetch(
        `/api/worksites?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error("Failed to fetch worksites");
      const data = await response.json();
      setWorksites(data.data || []);
    } catch (error) {
      logger.error("Failed to fetch worksites", error);
    }
  };

  useEffect(() => {
    fetchUnits();
    fetchEmployers();
    fetchWorksites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleCreate = () => {
    setEditingUnit(null);
    form.reset({
      name: "",
      unitNumber: "",
      unitType: "full_time",
      status: "active",
      employerId: "",
      worksiteId: undefined,
      certificationNumber: "",
      certificationDate: "",
      certificationBody: "",
      certificationExpiryDate: "",
      contractExpiryDate: "",
      nextBargainingDate: "",
      memberCount: 0,
      description: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (unit: BargainingUnit) => {
    setEditingUnit(unit);
    form.reset({
      name: unit.name,
      unitNumber: unit.unitNumber || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unitType: unit.unitType as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: unit.status as any,
      employerId: unit.employerId,
      worksiteId: unit.worksiteId || undefined,
      certificationNumber: unit.certificationNumber || "",
      certificationDate: unit.certificationDate || "",
      certificationBody: "",
      certificationExpiryDate: "",
      contractExpiryDate: unit.contractExpiryDate || "",
      nextBargainingDate: unit.nextBargainingDate || "",
      memberCount: unit.memberCount,
      description: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bargaining unit?"))
      return;

    try {
      const response = await fetch(`/api/bargaining-units/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete bargaining unit");

      toast({
        title: "Success",
        description: "Bargaining unit deleted successfully",
      });

      await fetchUnits();
      onUpdate?.();
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete bargaining unit",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        organizationId,
        worksiteId: data.worksiteId || null,
        unitNumber: data.unitNumber || null,
        certificationNumber: data.certificationNumber || null,
        certificationDate: data.certificationDate || null,
        certificationBody: data.certificationBody || null,
        certificationExpiryDate: data.certificationExpiryDate || null,
        contractExpiryDate: data.contractExpiryDate || null,
        nextBargainingDate: data.nextBargainingDate || null,
        chiefStewardId: data.chiefStewardId || null,
        bargainingChairId: data.bargainingChairId || null,
        description: data.description || null,
        notes: data.notes || null,
      };

      const url = editingUnit
        ? `/api/bargaining-units/${editingUnit.id}`
        : "/api/bargaining-units";
      const method = editingUnit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save bargaining unit");
      }

      toast({
        title: "Success",
        description: `Bargaining unit ${editingUnit ? "updated" : "created"} successfully`,
      });

      setDialogOpen(false);
      await fetchUnits();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save bargaining unit",
        variant: "destructive",
      });
    }
  };

  const filteredUnits = units.filter(
    (unit) =>
      unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.unitNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.employerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-500",
      under_certification: "bg-yellow-500",
      decertified: "bg-red-500",
      merged: "bg-blue-500",
      inactive: "bg-gray-500",
      archived: "bg-gray-400",
    };
    return colors[status] || "bg-gray-500";
  };

  const getUnitTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      full_time: "Full-Time",
      part_time: "Part-Time",
      casual: "Casual",
      mixed: "Mixed",
      craft: "Craft",
      industrial: "Industrial",
      professional: "Professional",
    };
    return labels[type] || type;
  };

  // Filter worksites by selected employer
  const selectedEmployerId = form.watch("employerId");
  const availableWorksites = worksites.filter(
    (ws) => ws.employerId === selectedEmployerId
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Bargaining Units</CardTitle>
            <CardDescription>
              Manage certified bargaining units and their memberships
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bargaining units..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Building2 className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No bargaining units found"
                  : "No bargaining units yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Worksite</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Contract Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell>{unit.unitNumber || "—"}</TableCell>
                    <TableCell>{getUnitTypeLabel(unit.unitType)}</TableCell>
                    <TableCell>{unit.employerName || "—"}</TableCell>
                    <TableCell>{unit.worksiteName || "—"}</TableCell>
                    <TableCell>{unit.memberCount}</TableCell>
                    <TableCell>
                      {unit.contractExpiryDate
                        ? new Date(unit.contractExpiryDate).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(unit.status)} text-white`}
                      >
                        {unit.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(unit)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(unit.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? "Edit Bargaining Unit" : "Create Bargaining Unit"}
            </DialogTitle>
            <DialogDescription>
              {editingUnit
                ? "Update bargaining unit information"
                : "Add a new bargaining unit to your organization"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Basic Information</h3>

                <FormField
                  control={form.control}
                  name="employerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employer *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
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

                <FormField
                  control={form.control}
                  name="worksiteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Worksite</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select worksite (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableWorksites.map((worksite) => (
                            <SelectItem key={worksite.id} value={worksite.id}>
                              {worksite.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Optional - leave blank if unit spans multiple worksites
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Maintenance Workers Unit"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unitNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="memberCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Member Count</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unitType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="full_time">Full-Time</SelectItem>
                            <SelectItem value="part_time">Part-Time</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                            <SelectItem value="craft">Craft</SelectItem>
                            <SelectItem value="industrial">Industrial</SelectItem>
                            <SelectItem value="professional">
                              Professional
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="under_certification">
                              Under Certification
                            </SelectItem>
                            <SelectItem value="decertified">
                              Decertified
                            </SelectItem>
                            <SelectItem value="merged">Merged</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Certification Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Certification</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="certificationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., CERT-2024-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="certificationBody"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Body</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., OLRB" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="certificationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="certificationExpiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Bargaining Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Bargaining</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contractExpiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Expiry Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nextBargainingDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Next Bargaining Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Additional Information</h3>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the bargaining unit..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
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
                          placeholder="Internal notes..."
                          rows={2}
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
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingUnit ? "Update" : "Create"} Unit
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
