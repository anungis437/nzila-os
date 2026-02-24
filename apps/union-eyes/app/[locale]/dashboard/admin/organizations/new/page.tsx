/**
 * Create New Organization Page
 * Form for creating a new organization in the hierarchy
 */
"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function NewOrganizationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId } = useOrganization();
  
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
    jurisdiction: "federal" as CAJurisdiction,
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
        throw new Error(errorData.error || "Failed to create organization");
      }

      const result = await response.json();
      router.push(`/dashboard/admin/organizations/${result.data.id}`);
    } catch (error) {
      setError(error.message);
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
            <h1 className="text-3xl font-bold tracking-tight">Create Organization</h1>
            <p className="text-muted-foreground mt-1">
              Add a new organization to the hierarchy
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
              Enter the basic details for the organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
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
                URL-friendly identifier (auto-generated from name)
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
              Position this organization within the hierarchy
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
              <p className="text-xs text-muted-foreground">
                Select the parent organization in the hierarchy
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Child organizations will inherit access permissions from their parent
              </AlertDescription>
            </Alert>
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

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
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
                Creating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Create Organization
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
