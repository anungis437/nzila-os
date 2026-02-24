/**
 * Edit Organization Page
 * Update organization details and settings
 */
"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
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
const sectors: { value: LabourSector; label: string }[] = [
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "public_service", label: "Public Service" },
  { value: "trades", label: "Trades" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "transportation", label: "Transportation" },
  { value: "retail", label: "Retail" },
  { value: "hospitality", label: "Hospitality" },
  { value: "technology", label: "Technology" },
  { value: "construction", label: "Construction" },
  { value: "utilities", label: "Utilities" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "financial_services", label: "Financial Services" },
  { value: "agriculture", label: "Agriculture" },
  { value: "arts_culture", label: "Arts & Culture" },
  { value: "other", label: "Other" }
];

// Canadian jurisdictions
const jurisdictions: { value: CAJurisdiction; label: string }[] = [
  { value: "CA-FED", label: "Federal" },
  { value: "CA-AB", label: "Alberta" },
  { value: "CA-BC", label: "British Columbia" },
  { value: "CA-MB", label: "Manitoba" },
  { value: "CA-NB", label: "New Brunswick" },
  { value: "CA-NL", label: "Newfoundland and Labrador" },
  { value: "CA-NS", label: "Nova Scotia" },
  { value: "CA-NT", label: "Northwest Territories" },
  { value: "CA-NU", label: "Nunavut" },
  { value: "CA-ON", label: "Ontario" },
  { value: "CA-PE", label: "Prince Edward Island" },
  { value: "CA-QC", label: "Quebec" },
  { value: "CA-SK", label: "Saskatchewan" },
  { value: "CA-YT", label: "Yukon" }
];

// Organization types
const orgTypes: { value: OrganizationType; label: string; description: string }[] = [
  { value: "platform", label: "Platform", description: "SaaS platform provider (Nzila Ventures)" },
  { value: "congress", label: "Congress", description: "National labour congress (e.g., CLC)" },
  { value: "federation", label: "Federation", description: "Provincial/territorial federation (e.g., OFL, BCFED)" },
  { value: "union", label: "Union", description: "National/international union (e.g., CUPE, Unifor)" },
  { value: "local", label: "Local", description: "Local union or chapter" },
  { value: "region", label: "Region", description: "Regional council" },
  { value: "district", label: "District", description: "District labour council" }
];

// Organization statuses
const statuses: { value: OrganizationStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" }
];

export default function EditOrganizationPage() {
  const params = useParams();
  const router = useRouter();
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
        throw new Error(errorData.error || "Failed to update organization");
      }

      router.push(`/dashboard/admin/organizations/${organizationId}`);
    } catch (error) {
      setError(error.message);
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to archive this organization? This action can be reversed later.")) return;
    
    try {
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to archive organization");
      
      router.push("/dashboard/admin/organizations");
    } catch (_error) {
alert("Failed to archive organization");
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
          <p>Organization not found</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => router.push("/dashboard/admin/organizations")}
          >
            Back to Organizations
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
            <h1 className="text-3xl font-bold tracking-tight">Edit Organization</h1>
            <p className="text-muted-foreground mt-1">
              Update organization details and settings
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
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Update the basic details for the organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., CUPE Local 1000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="cupe-local-1000"
                required
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Organization Type *</Label>
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
                        <div>{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
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
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the organization..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Hierarchy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Hierarchy</CardTitle>
            <CardDescription>
              Update position within the organizational hierarchy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Organization</Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, parentId: value }))}
              >
                <SelectTrigger id="parent">
                  <SelectValue placeholder="No parent (root organization)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No parent (root organization)</SelectItem>
                  {availableOrganizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Changing the parent may affect access permissions for members
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* Classification */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Classification</CardTitle>
            <CardDescription>
              Sector and jurisdiction information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sector">Primary Sector</Label>
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
                      {sector.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
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
                      {jurisdiction.label}
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
            <CardTitle>Additional Details</CardTitle>
            <CardDescription>
              Optional information about the organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="charter">Charter Number</Label>
              <Input
                id="charter"
                value={formData.charterNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, charterNumber: e.target.value }))}
                placeholder="e.g., 1000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="affiliation">Affiliation Date</Label>
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
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Archive this organization</h3>
                <p className="text-sm text-muted-foreground">
                  Once archived, this organization will be hidden from active lists
                </p>
              </div>
              <Button 
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Archive
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
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
