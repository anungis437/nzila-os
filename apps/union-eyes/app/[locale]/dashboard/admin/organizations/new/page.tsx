/**
 * Create New Organization Page
 * Form for creating a new organization in the hierarchy
 */
"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OrganizationBreadcrumb } from "@/components/organization/organization-breadcrumb";
import type { OrganizationType, LabourSector, CAJurisdiction } from "@/types/organization";

const sectors: LabourSector[] = [
  "healthcare",
  "education",
  "public_service",
  "trades",
  "manufacturing",
  "transportation",
  "retail",
  "hospitality",
  "technology",
  "construction",
  "utilities",
  "telecommunications",
  "financial_services",
  "agriculture",
  "arts_culture",
  "other",
];

const jurisdictions: CAJurisdiction[] = [
  "CA-FED",
  "CA-AB",
  "CA-BC",
  "CA-MB",
  "CA-NB",
  "CA-NL",
  "CA-NS",
  "CA-NT",
  "CA-NU",
  "CA-ON",
  "CA-PE",
  "CA-QC",
  "CA-SK",
  "CA-YT",
];

const orgTypes: OrganizationType[] = [
  "platform",
  "congress",
  "federation",
  "union",
  "local",
  "region",
  "district",
];

export default function NewOrganizationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId } = useOrganization();
  const t = useTranslations("adminOrganizationsNewPage");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableOrganizations, setAvailableOrganizations] = useState<any[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    type: "local" as OrganizationType,
    parentId: searchParams.get("parent") || organizationId || "",
    description: "",
    sector: "other" as LabourSector,
    jurisdiction: "CA-FED" as CAJurisdiction,
    charterNumber: "",
    affiliationDate: ""
  });

  // Load available organizations for parent selection
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations?status=active");
        const data = await response.json();
        setAvailableOrganizations(data.data || []);
      } catch (_error) {
}
    };
    loadOrganizations();
  }, []);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          type: formData.type,
          parent_id: formData.parentId || null,
          description: formData.description || null,
          status: "active",
          settings: {
            sector: formData.sector,
            jurisdiction: formData.jurisdiction,
            charter_number: formData.charterNumber || null,
            affiliation_date: formData.affiliationDate || null
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("failedToCreateOrganization"));
      }

      const result = await response.json();
      router.push(`/dashboard/admin/organizations/${result.data.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("error"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <OrganizationBreadcrumb />
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("basicInformationTitle")}</CardTitle>
            <CardDescription>
              {t("basicInformationDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("organizationNameLabel")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("organizationNamePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t("slugLabel")}</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder={t("slugPlaceholder")}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("slugHelp")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t("organizationTypeLabel")}</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as OrganizationType }))}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orgTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      <div>
                        <div>{t(`orgType.${type}`)}</div>
                        <div className="text-xs text-muted-foreground">{t(`orgTypeDescription.${type}`)}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("descriptionLabel")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t("descriptionPlaceholder")}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Hierarchy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("hierarchyTitle")}</CardTitle>
            <CardDescription>
              {t("hierarchyDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent">{t("parentOrganizationLabel")}</Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, parentId: value }))}
              >
                <SelectTrigger id="parent">
                  <SelectValue placeholder={t("noParentOption")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("noParentOption")}</SelectItem>
                  {availableOrganizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("parentOrganizationHelp")}
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t("inheritanceNotice")}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Classification */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("classificationTitle")}</CardTitle>
            <CardDescription>
              {t("classificationDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sector">{t("primarySectorLabel")}</Label>
              <Select
                value={formData.sector}
                onValueChange={(value) => setFormData(prev => ({ ...prev, sector: value as LabourSector }))}
              >
                <SelectTrigger id="sector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map(sector => (
                    <SelectItem key={sector} value={sector}>
                      {t(`sector.${sector}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jurisdiction">{t("jurisdictionLabel")}</Label>
              <Select
                value={formData.jurisdiction}
                onValueChange={(value) => setFormData(prev => ({ ...prev, jurisdiction: value as CAJurisdiction }))}
              >
                <SelectTrigger id="jurisdiction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map(jurisdiction => (
                    <SelectItem key={jurisdiction} value={jurisdiction}>
                      {t(`jurisdiction.${jurisdiction}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("additionalDetailsTitle")}</CardTitle>
            <CardDescription>
              {t("additionalDetailsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="charter">{t("charterNumberLabel")}</Label>
              <Input
                id="charter"
                value={formData.charterNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, charterNumber: e.target.value }))}
                placeholder={t("charterNumberPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="affiliation">{t("affiliationDateLabel")}</Label>
              <Input
                id="affiliation"
                type="date"
                value={formData.affiliationDate}
                onChange={(e) => setFormData(prev => ({ ...prev, affiliationDate: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            {t("cancelButton")}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("creatingButton")}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t("createOrganizationButton")}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
