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
import { useTranslations } from "next-intl";
import { fetchAllRows } from "@/lib/client/crud-lists";
import { formatDay } from "@/lib/client/day";

const UNIT_TYPES = [
  "full_time",
  "part_time",
  "casual",
  "mixed",
  "craft",
  "industrial",
  "professional",
] as const;

type UnitType = (typeof UNIT_TYPES)[number];

// Only what /api/units accepts from a steward. Certification facts, status and member count come from the certification and the
// roster, so this form neither offers nor sends them.
const formSchema = z.object({
  employerId: z.string().min(1, "Employer is required"),
  worksiteId: z.string(),
  name: z.string().trim().min(1, "Name is required").max(255),
  unitNumber: z.string().max(50),
  unitType: z.enum(UNIT_TYPES),
  contractExpiryDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Invalid date"),
  nextBargainingDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Invalid date"),
  description: z.string(),
});

type UnitFormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: UnitFormValues = {
  employerId: "",
  worksiteId: "",
  name: "",
  unitNumber: "",
  unitType: "full_time",
  contractExpiryDate: "",
  nextBargainingDate: "",
  description: "",
};

interface BargainingUnit {
  id: string;
  name: string;
  unitNumber: string | null;
  unitType: UnitType;
  status: string;
  employerId: string;
  worksiteId: string | null;
  memberCount: number | null;
  contractExpiryDate: string | null;
  nextBargainingDate: string | null;
  description: string | null;
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

/** The body PATCH /api/units/{id} and POST /api/units take: an empty optional field is sent as null, which clears it. */
export function toUnitPayload(values: UnitFormValues) {
  return {
    employerId: values.employerId,
    worksiteId: values.worksiteId || null,
    name: values.name,
    unitNumber: values.unitNumber || null,
    unitType: values.unitType,
    contractExpiryDate: values.contractExpiryDate || null,
    nextBargainingDate: values.nextBargainingDate || null,
    description: values.description || null,
  };
}

/** The route's own explanation of a refusal (its error body carries a `message`), or the fallback when it sent none. */
async function failureMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { message?: unknown } | null)?.message;
    return typeof message === "string" && message !== "" ? message : fallback;
  } catch {
    return fallback;
  }
}

/** A calendar date has no time zone: reading "2026-12-31" as UTC midnight would show 30 December west of Greenwich. */
function formatDateOnly(value: string): string {
  return formatDay(value, undefined, "numeric");
}

export function BargainingUnitManagement({
  organizationId,
  onUpdate,
}: BargainingUnitManagementProps) {
  const t = useTranslations("unionStructure.bargainingUnits");
  const [units, setUnits] = useState<BargainingUnit[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState({ units: false, employers: false, worksites: false });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<BargainingUnit | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });

  // A list that did not load is an error on the page, not an empty list: the toast passes, the table below it would not.
  const reportLoadFailure = (what: keyof typeof failed, error: unknown) => {
    logger.error(`Failed to fetch ${what}`, error);
    setFailed((current) => ({ ...current, [what]: true }));
    toast({
      title: t("errorTitle"),
      description: t("failedToLoad"),
      variant: "destructive",
    });
  };

  const fetchUnits = async () => {
    try {
      setUnits(await fetchAllRows<BargainingUnit>("/api/units"));
      setFailed((current) => ({ ...current, units: false }));
    } catch (error) {
      reportLoadFailure("units", error);
    }
  };

  const fetchEmployers = async () => {
    try {
      setEmployers(await fetchAllRows<Employer>("/api/employers"));
      setFailed((current) => ({ ...current, employers: false }));
    } catch (error) {
      reportLoadFailure("employers", error);
    }
  };

  const fetchWorksites = async () => {
    try {
      setWorksites(await fetchAllRows<Worksite>("/api/worksites"));
      setFailed((current) => ({ ...current, worksites: false }));
    } catch (error) {
      reportLoadFailure("worksites", error);
    }
  };

  useEffect(() => {
    Promise.all([fetchUnits(), fetchEmployers(), fetchWorksites()]).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleCreate = () => {
    setEditingUnit(null);
    form.reset(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (unit: BargainingUnit) => {
    setEditingUnit(unit);
    form.reset({
      employerId: unit.employerId,
      worksiteId: unit.worksiteId ?? "",
      name: unit.name,
      unitNumber: unit.unitNumber ?? "",
      unitType: unit.unitType,
      contractExpiryDate: unit.contractExpiryDate ?? "",
      nextBargainingDate: unit.nextBargainingDate ?? "",
      description: unit.description ?? "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm")))
      return;

    try {
      const response = await fetch(`/api/units/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error(await failureMessage(response, t("failedToDelete")));

      toast({
        title: t("successTitle"),
        description: t("deletedSuccess"),
      });

      await fetchUnits();
      onUpdate?.();
    } catch (error) {
      toast({
        title: t("errorTitle"),
        description:
          error instanceof Error ? error.message : t("failedToDelete"),
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: UnitFormValues) => {
    try {
      const url = editingUnit
        ? `/api/units/${encodeURIComponent(editingUnit.id)}`
        : "/api/units";
      const method = editingUnit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toUnitPayload(values)),
      });

      if (!response.ok) throw new Error(await failureMessage(response, t("failedToSave")));

      toast({
        title: t("successTitle"),
        description: editingUnit ? t("updatedSuccess") : t("createdSuccess"),
      });

      setDialogOpen(false);
      await fetchUnits();
      onUpdate?.();
    } catch (error) {
      toast({
        title: t("errorTitle"),
        description:
          error instanceof Error ? error.message : t("failedToSave"),
        variant: "destructive",
      });
    }
  };

  const employerNameOf = (unit: BargainingUnit) =>
    employers.find((employer) => employer.id === unit.employerId)?.name;
  const worksiteNameOf = (unit: BargainingUnit) =>
    unit.worksiteId ? worksites.find((worksite) => worksite.id === unit.worksiteId)?.name : undefined;

  // Deleting a unit archives it: the route keeps the record and lists it with status "archived", so it leaves this working list.
  const query = searchQuery.toLowerCase();
  const filteredUnits = units.filter(
    (unit) =>
      unit.status !== "archived" &&
      (unit.name.toLowerCase().includes(query) ||
        unit.unitNumber?.toLowerCase().includes(query) ||
        employerNameOf(unit)?.toLowerCase().includes(query))
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
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>
              {t("description")}
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addUnit")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          ) : failed.units || failed.employers || failed.worksites ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Building2 className="mb-2 h-8 w-8 text-muted-foreground" />
              <p role="alert" className="text-sm text-destructive">
                {t("failedToLoad")}
              </p>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Building2 className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? t("noUnitsFound")
                  : t("noUnitsYet")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("headerName")}</TableHead>
                  <TableHead>{t("headerUnitNumber")}</TableHead>
                  <TableHead>{t("headerType")}</TableHead>
                  <TableHead>{t("headerEmployer")}</TableHead>
                  <TableHead>{t("headerWorksite")}</TableHead>
                  <TableHead>{t("headerMembers")}</TableHead>
                  <TableHead>{t("headerContractExpiry")}</TableHead>
                  <TableHead>{t("headerStatus")}</TableHead>
                  <TableHead className="w-17.5">{t("headerActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell>{unit.unitNumber || "—"}</TableCell>
                    <TableCell>{getUnitTypeLabel(unit.unitType)}</TableCell>
                    <TableCell>{employerNameOf(unit) || "—"}</TableCell>
                    <TableCell>{worksiteNameOf(unit) || "—"}</TableCell>
                    <TableCell>{unit.memberCount ?? "—"}</TableCell>
                    <TableCell>
                      {unit.contractExpiryDate
                        ? formatDateOnly(unit.contractExpiryDate)
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
                            {t("editButton")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(unit.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("deleteButton")}
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
              {editingUnit ? t("editDialogTitle") : t("createDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingUnit
                ? t("editDialogDescription")
                : t("createDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t("basicInformation")}</h3>

                <FormField
                  control={form.control}
                  name="employerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("employerLabel")} *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          // A worksite belongs to one employer: drop a choice that is not this employer's.
                          const worksiteId = form.getValues("worksiteId");
                          if (worksiteId && !worksites.some((ws) => ws.id === worksiteId && ws.employerId === value)) {
                            form.setValue("worksiteId", "");
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("employerPlaceholder")} />
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
                      <FormLabel>{t("worksiteLabel")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("worksitePlaceholder")} />
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
                        {t("worksiteDescription")}
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
                      <FormLabel>{t("unitNameLabel")} *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("unitNamePlaceholder")}
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
                        <FormLabel>{t("unitNumberLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("unitNumberPlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("unitTypeLabel")} *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="full_time">{t("typeFullTime")}</SelectItem>
                            <SelectItem value="part_time">{t("typePartTime")}</SelectItem>
                            <SelectItem value="casual">{t("typeCasual")}</SelectItem>
                            <SelectItem value="mixed">{t("typeMixed")}</SelectItem>
                            <SelectItem value="craft">{t("typeCraft")}</SelectItem>
                            <SelectItem value="industrial">{t("typeIndustrial")}</SelectItem>
                            <SelectItem value="professional">
                              {t("typeProfessional")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Bargaining Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t("bargainingSection")}</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contractExpiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("contractExpiryLabel")}</FormLabel>
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
                        <FormLabel>{t("nextBargainingLabel")}</FormLabel>
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
                <h3 className="text-sm font-medium">{t("additionalInfoSection")}</h3>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("descriptionLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("descriptionPlaceholder")}
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
                  onClick={() => setDialogOpen(false)}
                >
                  {t("cancelButton")}
                </Button>
                <Button type="submit">
                  {editingUnit ? t("updateButton") : t("createButton")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
