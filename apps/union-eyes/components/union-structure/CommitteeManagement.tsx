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
  Users,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { createCommitteeSchema } from "@/lib/validation/union-structure-schemas";

// Form schema (omit audit fields)
// NOTE: Known TypeScript limitation with react-hook-form + Zod schemas using .default()
// Fields with .default() create optional types that conflict with react-hook-form's type inference
// Runtime behavior is correct - type errors suppressed below
const formSchema = createCommitteeSchema.omit({
  organizationId: true,
}).extend({
  status: z.string(),
  isOrganizationWide: z.boolean(),
  currentMemberCount: z.number(),
  requiresAppointment: z.boolean(),
  requiresElection: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface Committee {
  id: string;
  name: string;
  committeeType: string;
  status: string;
  isOrganizationWide: boolean;
  unitId: string | null;
  unitName?: string | null;
  worksiteId: string | null;
  worksiteName?: string | null;
  currentMemberCount: number;
  maxMembers: number | null;
  meetingFrequency: string | null;
  contactEmail: string | null;
}

interface BargainingUnit {
  id: string;
  name: string;
}

interface Worksite {
  id: string;
  name: string;
}

interface CommitteeManagementProps {
  organizationId: string;
  onUpdate?: () => void;
}

export function CommitteeManagement({
  organizationId,
  onUpdate,
}: CommitteeManagementProps) {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [units, setUnits] = useState<BargainingUnit[]>([]);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<FormData, any, FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: "",
      committeeType: "bargaining",
      status: "active",
      unitId: undefined,
      worksiteId: undefined,
      isOrganizationWide: false,
      mandate: "",
      meetingFrequency: "",
      meetingDay: "",
      meetingTime: "",
      meetingLocation: "",
      maxMembers: undefined,
      currentMemberCount: 0,
      requiresAppointment: false,
      requiresElection: false,
      termLength: undefined,
      chairId: "",
      secretaryId: "",
      contactEmail: "",
      description: "",
      notes: "",
      customFields: {},
    },
  });

  // Fetch committees
  const fetchCommittees = async () => {
    try {
      const response = await fetch(
        `/api/committees?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error("Failed to fetch committees");
      const data = await response.json();
      setCommittees(data.data || []);
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load committees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch bargaining units
  const fetchUnits = async () => {
    try {
      const response = await fetch(
        `/api/bargaining-units?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error("Failed to fetch bargaining units");
      const data = await response.json();
      setUnits(data.data || []);
    } catch (error) {
      logger.error("Failed to fetch bargaining units", error);
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
    fetchCommittees();
    fetchUnits();
    fetchWorksites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleCreate = () => {
    setEditingCommittee(null);
    form.reset({
      name: "",
      committeeType: "bargaining",
      status: "active",
      unitId: undefined,
      worksiteId: undefined,
      isOrganizationWide: false,
      mandate: "",
      meetingFrequency: "",
      meetingDay: "",
      meetingTime: "",
      meetingLocation: "",
      maxMembers: undefined,
      currentMemberCount: 0,
      requiresAppointment: false,
      requiresElection: false,
      termLength: undefined,
      contactEmail: "",
      description: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (committee: Committee) => {
    setEditingCommittee(committee);
    form.reset({
      name: committee.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      committeeType: committee.committeeType as any,
      status: committee.status,
      unitId: committee.unitId || undefined,
      worksiteId: committee.worksiteId || undefined,
      isOrganizationWide: committee.isOrganizationWide,
      mandate: "",
      meetingFrequency: committee.meetingFrequency || "",
      meetingDay: "",
      meetingTime: "",
      meetingLocation: "",
      maxMembers: committee.maxMembers || undefined,
      currentMemberCount: committee.currentMemberCount,
      requiresAppointment: false,
      requiresElection: false,
      contactEmail: committee.contactEmail || "",
      description: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this committee?")) return;

    try {
      const response = await fetch(`/api/committees/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete committee");

      toast({
        title: "Success",
        description: "Committee deleted successfully",
      });

      await fetchCommittees();
      onUpdate?.();
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete committee",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        organizationId,
        unitId: data.unitId || null,
        worksiteId: data.worksiteId || null,
        mandate: data.mandate || null,
        meetingFrequency: data.meetingFrequency || null,
        meetingDay: data.meetingDay || null,
        meetingTime: data.meetingTime || null,
        meetingLocation: data.meetingLocation || null,
        maxMembers: data.maxMembers || null,
        termLength: data.termLength || null,
        chairId: data.chairId || null,
        secretaryId: data.secretaryId || null,
        contactEmail: data.contactEmail || null,
        description: data.description || null,
        notes: data.notes || null,
      };

      const url = editingCommittee
        ? `/api/committees/${editingCommittee.id}`
        : "/api/committees";
      const method = editingCommittee ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save committee");
      }

      toast({
        title: "Success",
        description: `Committee ${editingCommittee ? "updated" : "created"} successfully`,
      });

      setDialogOpen(false);
      await fetchCommittees();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save committee",
        variant: "destructive",
      });
    }
  };

  const filteredCommittees = committees.filter(
    (committee) =>
      committee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      committee.committeeType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-500",
      inactive: "bg-gray-500",
      archived: "bg-gray-400",
    };
    return colors[status] || "bg-gray-500";
  };

  const getCommitteeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bargaining: "Bargaining",
      grievance: "Grievance",
      health_safety: "Health & Safety",
      political_action: "Political Action",
      equity: "Equity",
      education: "Education",
      organizing: "Organizing",
      steward: "Steward",
      executive: "Executive",
      finance: "Finance",
      communications: "Communications",
      social: "Social",
      pension_benefits: "Pension & Benefits",
      other: "Other",
    };
    return labels[type] || type;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Committees</CardTitle>
            <CardDescription>
              Manage union committees and their memberships
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Committee
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search committees..."
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
          ) : filteredCommittees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No committees found" : "No committees yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommittees.map((committee) => (
                  <TableRow key={committee.id}>
                    <TableCell className="font-medium">
                      {committee.name}
                    </TableCell>
                    <TableCell>
                      {getCommitteeTypeLabel(committee.committeeType)}
                    </TableCell>
                    <TableCell>
                      {committee.isOrganizationWide
                        ? "Organization-wide"
                        : committee.unitName || committee.worksiteName || "—"}
                    </TableCell>
                    <TableCell>
                      {committee.currentMemberCount}
                      {committee.maxMembers && ` / ${committee.maxMembers}`}
                    </TableCell>
                    <TableCell>
                      {committee.meetingFrequency || "—"}
                    </TableCell>
                    <TableCell>{committee.contactEmail || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(committee.status)} text-white`}
                      >
                        {committee.status}
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
                          <DropdownMenuItem
                            onClick={() => handleEdit(committee)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(committee.id)}
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
              {editingCommittee ? "Edit Committee" : "Create Committee"}
            </DialogTitle>
            <DialogDescription>
              {editingCommittee
                ? "Update committee information"
                : "Add a new committee to your organization"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Basic Information</h3>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Committee Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Bargaining Committee"
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
                    name="committeeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Committee Type *</FormLabel>
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
                            <SelectItem value="bargaining">
                              Bargaining
                            </SelectItem>
                            <SelectItem value="grievance">Grievance</SelectItem>
                            <SelectItem value="health_safety">
                              Health & Safety
                            </SelectItem>
                            <SelectItem value="political_action">
                              Political Action
                            </SelectItem>
                            <SelectItem value="equity">Equity</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="organizing">
                              Organizing
                            </SelectItem>
                            <SelectItem value="steward">Steward</SelectItem>
                            <SelectItem value="executive">Executive</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="communications">
                              Communications
                            </SelectItem>
                            <SelectItem value="social">Social</SelectItem>
                            <SelectItem value="pension_benefits">
                              Pension & Benefits
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
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
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="committee@union.org"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Scope */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Scope</h3>

                <FormField
                  control={form.control}
                  name="isOrganizationWide"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Organization-Wide Committee</FormLabel>
                        <FormDescription>
                          Check if this committee serves the entire organization
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unitId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bargaining Unit</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                          disabled={form.watch("isOrganizationWide")}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {units.map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.name}
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
                          disabled={form.watch("isOrganizationWide")}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select worksite (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {worksites.map((worksite) => (
                              <SelectItem key={worksite.id} value={worksite.id}>
                                {worksite.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Meetings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Meetings</h3>

                <FormField
                  control={form.control}
                  name="meetingFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Frequency</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Monthly, Bi-weekly"
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
                    name="meetingDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Day</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., First Monday" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="meetingTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Time</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 6:00 PM" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="meetingLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Union Hall, Room 201"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Composition */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Composition</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxMembers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Members</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseInt(e.target.value) : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentMemberCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Members</FormLabel>
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
                    name="requiresAppointment"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Requires Appointment</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requiresElection"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Requires Election</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="termLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Term Length (months)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="e.g., 12"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Additional Information</h3>

                <FormField
                  control={form.control}
                  name="mandate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mandate</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Committee mandate and responsibilities..."
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description..."
                          rows={2}
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
                  {editingCommittee ? "Update" : "Create"} Committee
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
