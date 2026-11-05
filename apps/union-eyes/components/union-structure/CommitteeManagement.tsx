"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Archive,
  Search,
  Users,
  Eye,
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
import { readApiError } from "@/lib/client/api-envelope";
import { humanize } from "@/lib/client/row-fields";
import {
  failureText,
  integerOrNull,
  loadCommittees,
  loadUnits,
  loadWorksites,
  textOrNull,
  type CommitteeRow,
  type UnitRow,
  type WorksiteRow,
} from "./structure-data";

const COMMITTEE_TYPES: Record<string, string> = {
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

const COMMITTEE_TYPE_CODES = Object.keys(COMMITTEE_TYPES);

const COMMITTEE_STATUSES: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-500",
  archived: "bg-gray-400",
};

const labelOf = (labels: Record<string, string>, code: string) => labels[code] ?? humanize(code);

/** The statuses to choose from, plus the stored one when it is none of them (the column is free text, so a record can hold another). */
function statusChoices(current: string): string[] {
  const known = Object.keys(COMMITTEE_STATUSES);
  return current === "" || known.includes(current) ? known : [...known, current];
}

// Counts are text in the form so that a blank field is blank, not zero.
const wholeNumber = z.string().regex(/^\d{0,9}$/, "Enter a whole number");
const atLeastOne = (value: string) => value === "" || Number(value) >= 1;

// Only what the form edits and /api/committees takes from a steward. The chair and the secretary are people, set where people are chosen.
const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  committeeType: z.string().refine((code) => COMMITTEE_TYPE_CODES.includes(code), "Select a committee type"),
  status: z.string().min(1, "Select a status"),
  contactEmail: z
    .string()
    .max(255)
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address"),
  isOrganizationWide: z.boolean(),
  unitId: z.string(),
  worksiteId: z.string(),
  meetingFrequency: z.string().max(100),
  meetingDay: z.string().max(50),
  meetingTime: z.string().max(50),
  meetingLocation: z.string(),
  maxMembers: wholeNumber.refine(atLeastOne, "Must be at least 1"),
  currentMemberCount: wholeNumber,
  requiresAppointment: z.boolean(),
  requiresElection: z.boolean(),
  termLength: wholeNumber.refine(atLeastOne, "Must be at least 1"),
  mandate: z.string(),
  description: z.string(),
  notes: z.string(),
});

type CommitteeFormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: CommitteeFormValues = {
  name: "",
  committeeType: "",
  status: "active",
  contactEmail: "",
  isOrganizationWide: false,
  unitId: "",
  worksiteId: "",
  meetingFrequency: "",
  meetingDay: "",
  meetingTime: "",
  meetingLocation: "",
  maxMembers: "",
  currentMemberCount: "",
  requiresAppointment: false,
  requiresElection: false,
  termLength: "",
  mandate: "",
  description: "",
  notes: "",
};

const countText = (value: number | null) => (value === null ? "" : String(value));

// The route leaves the notes out of what it sends, so an edit has nothing to show there: the field is for a new committee only.
function formValuesOf(committee: CommitteeRow): CommitteeFormValues {
  return {
    name: committee.name,
    committeeType: committee.committeeType,
    status: committee.status,
    contactEmail: committee.contactEmail ?? "",
    isOrganizationWide: committee.isOrganizationWide,
    unitId: committee.unitId ?? "",
    worksiteId: committee.worksiteId ?? "",
    meetingFrequency: committee.meetingFrequency ?? "",
    meetingDay: committee.meetingDay ?? "",
    meetingTime: committee.meetingTime ?? "",
    meetingLocation: committee.meetingLocation ?? "",
    maxMembers: countText(committee.maxMembers),
    currentMemberCount: countText(committee.currentMemberCount),
    requiresAppointment: committee.requiresAppointment,
    requiresElection: committee.requiresElection,
    termLength: countText(committee.termLength),
    mandate: committee.mandate ?? "",
    description: committee.description ?? "",
    notes: "",
  };
}

/**
 * The body POST /api/committees and PATCH /api/committees/{id} take: a blank optional field is sent as null, which clears it, and an
 * organization-wide committee has no unit or worksite. The notes go with a new committee only: an edit cannot show them, so it must not rewrite them.
 */
export function toCommitteePayload(values: CommitteeFormValues, editing: boolean) {
  return {
    name: values.name,
    committeeType: values.committeeType,
    status: values.status,
    contactEmail: textOrNull(values.contactEmail),
    isOrganizationWide: values.isOrganizationWide,
    unitId: values.isOrganizationWide ? null : textOrNull(values.unitId),
    worksiteId: values.isOrganizationWide ? null : textOrNull(values.worksiteId),
    meetingFrequency: textOrNull(values.meetingFrequency),
    meetingDay: textOrNull(values.meetingDay),
    meetingTime: textOrNull(values.meetingTime),
    meetingLocation: textOrNull(values.meetingLocation),
    maxMembers: integerOrNull(values.maxMembers),
    currentMemberCount: integerOrNull(values.currentMemberCount),
    requiresAppointment: values.requiresAppointment,
    requiresElection: values.requiresElection,
    termLength: integerOrNull(values.termLength),
    mandate: textOrNull(values.mandate),
    description: textOrNull(values.description),
    ...(editing ? {} : { notes: textOrNull(values.notes) }),
  };
}

interface CommitteeManagementProps {
  organizationId: string;
  onUpdate?: () => void;
  readOnly?: boolean;
}

export function CommitteeManagement({
  organizationId,
  onUpdate,
  readOnly = false,
}: CommitteeManagementProps) {
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [worksites, setWorksites] = useState<WorksiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<CommitteeRow | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();

  const form = useForm<CommitteeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });
  const isOrganizationWide = useWatch({ control: form.control, name: "isOrganizationWide" });

  useEffect(() => {
    let current = true;
    Promise.all([loadCommittees(), loadUnits(), loadWorksites()]).then(
      ([committeeRows, unitRows, worksiteRows]) => {
        if (!current) return;
        setCommittees(committeeRows);
        setUnits(unitRows);
        setWorksites(worksiteRows);
        setLoadError(null);
        setLoading(false);
      },
      (error: unknown) => {
        logger.error("Failed to load committees", error);
        if (!current) return;
        // The scope names come from the unit and worksite lists, so any of the three failing leaves the screen incomplete: an error, never a partial table.
        setCommittees([]);
        setUnits([]);
        setWorksites([]);
        setLoadError(failureText(error, "Unknown error"));
        setLoading(false);
      },
    );
    return () => {
      current = false;
    };
  }, [organizationId, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const handleCreate = () => {
    setEditingCommittee(null);
    form.reset(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (committee: CommitteeRow) => {
    setEditingCommittee(committee);
    form.reset(formValuesOf(committee));
    setDialogOpen(true);
  };

  const handleArchive = async (committee: CommitteeRow) => {
    if (!confirm(`Archive committee '${committee.name}'? The record is kept, with its status set to archived.`)) return;

    try {
      const response = await fetch(`/api/committees/${encodeURIComponent(committee.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readApiError(response, "Failed to archive committee"));

      toast({
        title: "Success",
        description: "Committee archived",
      });

      reload();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: failureText(error, "Failed to archive committee"),
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: CommitteeFormValues) => {
    try {
      const response = await fetch(
        editingCommittee ? `/api/committees/${encodeURIComponent(editingCommittee.id)}` : "/api/committees",
        {
          method: editingCommittee ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toCommitteePayload(values, editingCommittee !== null)),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response, "Failed to save committee"));

      toast({
        title: "Success",
        description: `Committee ${editingCommittee ? "updated" : "created"} successfully`,
      });

      setDialogOpen(false);
      reload();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: failureText(error, "Failed to save committee"),
        variant: "destructive",
      });
    }
  };

  const unitNameOf = (committee: CommitteeRow) =>
    committee.unitId ? units.find((unit) => unit.id === committee.unitId)?.name : undefined;
  const worksiteNameOf = (committee: CommitteeRow) =>
    committee.worksiteId ? worksites.find((worksite) => worksite.id === committee.worksiteId)?.name : undefined;

  const scopeOf = (committee: CommitteeRow) =>
    committee.isOrganizationWide
      ? "Organization-wide"
      : [unitNameOf(committee), worksiteNameOf(committee)].filter(Boolean).join(" / ") || "—";

  // Archiving keeps the committee with status "archived", so it leaves this working list.
  const query = searchQuery.toLowerCase();
  const filteredCommittees = committees.filter(
    (committee) =>
      committee.status !== "archived" &&
      (committee.name.toLowerCase().includes(query) ||
        committee.committeeType.toLowerCase().includes(query) ||
        labelOf(COMMITTEE_TYPES, committee.committeeType).toLowerCase().includes(query))
  );

  const openWorkspace = (committee: CommitteeRow) => router.push(`/${locale}/dashboard/committees/${committee.id}`);

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
          {!readOnly && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Committee
            </Button>
          )}
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
                aria-label="Search committees"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : loadError !== null ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p role="alert" className="text-sm text-destructive">
                Failed to load committees: {loadError}
              </p>
              <Button variant="outline" onClick={reload}>
                Retry
              </Button>
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
                  {!readOnly && <TableHead className="w-17.5">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommittees.map((committee) => (
                  <TableRow
                    key={committee.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openWorkspace(committee)}
                  >
                    <TableCell className="font-medium">
                      {committee.name}
                    </TableCell>
                    <TableCell>
                      {labelOf(COMMITTEE_TYPES, committee.committeeType)}
                    </TableCell>
                    <TableCell>{scopeOf(committee)}</TableCell>
                    <TableCell>
                      {committee.currentMemberCount === null ? "—" : committee.currentMemberCount}
                      {committee.maxMembers !== null && ` / ${committee.maxMembers}`}
                    </TableCell>
                    <TableCell>
                      {committee.meetingFrequency || "—"}
                    </TableCell>
                    <TableCell>{committee.contactEmail || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${STATUS_COLORS[committee.status] ?? "bg-gray-500"} text-white`}
                      >
                        {labelOf(COMMITTEE_STATUSES, committee.status)}
                      </Badge>
                    </TableCell>
                    {!readOnly && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${committee.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openWorkspace(committee)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Workspace
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEdit(committee)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleArchive(committee)}
                              className="text-destructive"
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(COMMITTEE_TYPES).map(([code, label]) => (
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
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusChoices(field.value).map((code) => (
                              <SelectItem key={code} value={code}>
                                {labelOf(COMMITTEE_STATUSES, code)}
                              </SelectItem>
                            ))}
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
                          value={field.value}
                          disabled={isOrganizationWide}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {units
                              .filter((unit) => unit.status !== "archived" || unit.id === field.value)
                              .map((unit) => (
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
                          value={field.value}
                          disabled={isOrganizationWide}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select worksite (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {worksites
                              .filter((worksite) => worksite.status !== "archived" || worksite.id === field.value)
                              .map((worksite) => (
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
                          <Input type="number" min="1" {...field} />
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
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormDescription>
                          Recorded by hand: this screen does not count a roster.
                        </FormDescription>
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

                {!editingCommittee && (
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
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
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
