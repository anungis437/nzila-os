/**
 * Edit Organization Page
 * Update organization details and settings
 */
"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Trash2,
  AlertTriangle,
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
import type { OrganizationType, LabourSector, CAJurisdiction, OrganizationStatus } from "@/types/organization";

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Canadian sectors
const sectors: { value: LabourSector }[] = [
  { value: "healthcare" },
  { value: "education" },
  { value: "public_service" },
  { value: "trades" },
  { value: "manufacturing" },
  { value: "transportation" },
  { value: "retail" },
  { value: "hospitality" },
  { value: "technology" },
  { value: "construction" },
  { value: "utilities" },
  { value: "telecommunications" },
  { value: "financial_services" },
  { value: "agriculture" },
  { value: "arts_culture" },
  { value: "other" }
];

// Canadian jurisdictions
const jurisdictions: { value: CAJurisdiction }[] = [
  { value: "CA-FED" },
  { value: "CA-AB" },
  { value: "CA-BC" },
  { value: "CA-MB" },
  { value: "CA-NB" },
  { value: "CA-NL" },
  { value: "CA-NS" },
  { value: "CA-NT" },
  { value: "CA-NU" },
  { value: "CA-ON" },
  { value: "CA-PE" },
  { value: "CA-QC" },
  { value: "CA-SK" },
  { value: "CA-YT" }
];

// Organization types
const orgTypes: { value: OrganizationType }[] = [
  { value: "platform" },
  { value: "congress" },
  { value: "federation" },
  { value: "union" },
  { value: "local" },
  { value: "region" },
  { value: "district" }
];

// Organization statuses
const statuses: { value: OrganizationStatus }[] = [
  { value: "active" },
  { value: "inactive" },
  { value: "suspended" },
  { value: "archived" }
];

export default function EditOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('adminOrganizationEditPage');
  const organizationId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableOrganizations, setAvailableOrganizations] = useState<any[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    type: "local" as OrganizationType,
    parentId: "",
    description: "",
    status: "active" as OrganizationStatus,
    sector: "other" as LabourSector,
    jurisdiction: "federal" as CAJurisdiction,
    charterNumber: "",
    affiliationDate: ""
  });

  // Fetch organization details
  const { data: orgData, error: orgError, isLoading } = useSWR(
    organizationId ? `/api/organizations/${organizationId}` : null,
    fetcher
  );

  // Load available organizations for parent selection
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations?status=active");
        const data = await response.json();
        // Filter out current organization and its descendants
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAvailableOrganizations((data.data || []).filter((org: any) => org.id !== organizationId));
      } catch (_error) {
}
    };
    loadOrganizations();
  }, [organizationId]);

  // Populate form when organization data loads
  useEffect(() => {
    if (orgData?.data) {
      const org = orgData.data;
      setFormData({
        name: org.name || "",
        slug: org.slug || "",
        type: org.type || "local",
        parentId: org.parent_id || "",
        description: org.description || "",
        status: org.status || "active",
        sector: org.settings?.sector || "other",
        jurisdiction: org.settings?.jurisdiction || "federal",
        charterNumber: org.settings?.charter_number || "",
        affiliationDate: org.settings?.affiliation_date || ""
      });
    }
  }, [orgData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          type: formData.type,
          parent_id: formData.parentId || null,
          description: formData.description || null,
          status: formData.status,
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
          throw new Error(errorData.error || t('failedToUpdateOrganization'));
      }

      router.push(`/dashboard/admin/organizations/${organizationId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : t('failedToUpdateOrganization'));
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('confirmArchiveOrganization'))) return;
    
    try {
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error(t('failedToArchiveOrganization'));
      
      router.push("/dashboard/admin/organizations");
    } catch (_error) {
      alert(t('failedToArchiveOrganization'));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (orgError || !orgData?.data) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p>{t('organizationNotFound')}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => router.push("/dashboard/admin/organizations")}
          >
            {t('backToOrganizationsButton')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <OrganizationBreadcrumb />
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/dashboard/admin/organizations/${organizationId}`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('subtitle')}
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
            <CardTitle>{t('basicInformationTitle')}</CardTitle>
            <CardDescription>
              {t('basicInformationDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('organizationNameLabel')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('organizationNamePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t('slugLabel')}</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder={t('slugPlaceholder')}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('slugHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t('organizationTypeLabel')}</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as OrganizationType }))}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orgTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div>{t(`orgType.${type.value}`)}</div>
                        <div className="text-xs text-muted-foreground">{t(`orgTypeDescription.${type.value}`)}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t('statusLabel')}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as OrganizationStatus }))}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {t(`status.${status.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Hierarchy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('hierarchyTitle')}</CardTitle>
            <CardDescription>
              {t('hierarchyDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent">{t('parentOrganizationLabel')}</Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, parentId: value }))}
              >
                <SelectTrigger id="parent">
                  <SelectValue placeholder={t('noParentOption')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('noParentOption')}</SelectItem>
                  {availableOrganizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({t(`orgType.${org.type}`)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('parentChangeWarning')}
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* Classification */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('classificationTitle')}</CardTitle>
            <CardDescription>
              {t('classificationDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sector">{t('primarySectorLabel')}</Label>
              <Select
                value={formData.sector}
                onValueChange={(value) => setFormData(prev => ({ ...prev, sector: value as LabourSector }))}
              >
                <SelectTrigger id="sector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map(sector => (
                    <SelectItem key={sector.value} value={sector.value}>
                      {t(`sector.${sector.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jurisdiction">{t('jurisdictionLabel')}</Label>
              <Select
                value={formData.jurisdiction}
                onValueChange={(value) => setFormData(prev => ({ ...prev, jurisdiction: value as CAJurisdiction }))}
              >
                <SelectTrigger id="jurisdiction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map(jurisdiction => (
                    <SelectItem key={jurisdiction.value} value={jurisdiction.value}>
                      {t(`jurisdiction.${jurisdiction.value}`)}
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
            <CardTitle>{t('additionalDetailsTitle')}</CardTitle>
            <CardDescription>
              {t('additionalDetailsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="charter">{t('charterNumberLabel')}</Label>
              <Input
                id="charter"
                value={formData.charterNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, charterNumber: e.target.value }))}
                placeholder={t('charterNumberPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="affiliation">{t('affiliationDateLabel')}</Label>
              <Input
                id="affiliation"
                type="date"
                value={formData.affiliationDate}
                onChange={(e) => setFormData(prev => ({ ...prev, affiliationDate: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="mb-6 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">{t('dangerZoneTitle')}</CardTitle>
            <CardDescription>
              {t('dangerZoneDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">{t('archiveOrganizationTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('archiveOrganizationDescription')}
                </p>
              </div>
              <Button 
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('archiveButton')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/admin/organizations/${organizationId}`)}
            disabled={isSubmitting}
          >
            {t('cancelButton')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('savingButton')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('saveChangesButton')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
