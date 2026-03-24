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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("unionStructure.bargainingUnits");
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
        title: t("errorTitle"),
        description: t("failedToLoad"),
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
    if (!confirm(t("deleteConfirm")))
      return;

    try {
      const response = await fetch(`/api/bargaining-units/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete bargaining unit");

      toast({
        title: t("successTitle"),
        description: t("deletedSuccess"),
      });

      await fetchUnits();
      onUpdate?.();
    } catch (_error) {
      toast({
        title: t("errorTitle"),
        description: t("failedToDelete"),
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
                  <TableHead className="w-[70px]">{t("headerActions")}</TableHead>
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
                        onValueChange={field.onChange}
                        defaultValue={field.value}
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
                    name="memberCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("memberCountLabel")}</FormLabel>
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
                        <FormLabel>{t("unitTypeLabel")} *</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("statusLabel")} *</FormLabel>
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
                            <SelectItem value="active">{t("statusActive")}</SelectItem>
                            <SelectItem value="under_certification">
                              {t("statusUnderCertification")}
                            </SelectItem>
                            <SelectItem value="decertified">
                              {t("statusDecertified")}
                            </SelectItem>
                            <SelectItem value="merged">{t("statusMerged")}</SelectItem>
                            <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
                            <SelectItem value="archived">{t("statusArchived")}</SelectItem>
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
                <h3 className="text-sm font-medium">{t("certificationSection")}</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="certificationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("certificationNumberLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("certificationNumberPlaceholder")} {...field} />
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
                        <FormLabel>{t("certificationBodyLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("certificationBodyPlaceholder")} {...field} />
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
                        <FormLabel>{t("certificationDateLabel")}</FormLabel>
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
                        <FormLabel>{t("certificationExpiryLabel")}</FormLabel>
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

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("notesLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("notesPlaceholder")}
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
