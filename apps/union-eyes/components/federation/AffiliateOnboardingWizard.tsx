/**
 * Affiliate Onboarding Wizard Component
 * 
 * Multi-step wizard for adding new affiliate unions with:
 * - Step 1: Basic Information (name, number, sector)
 * - Step 2: Contact Details (email, phone, address)
 * - Step 3: Membership Data (member count, locals)
 * - Step 4: Remittance Setup (schedule, rates)
 * - Form validation
 * - Progress indicator
 * - Draft saving
 * 
 * @module components/federation/AffiliateOnboardingWizard
 */

"use client";

import * as React from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  DollarSign,
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
} from "lucide-react";

export interface AffiliateOnboardingData {
  // Step 1: Basic Information
  name: string;
  shortName: string;
  affiliateNumber: string;
  sector: string;
  description?: string;
  
  // Step 2: Contact Details
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  
  // Step 3: Membership Data
  memberCount: number;
  localCount: number;
  
  // Step 4: Remittance Setup
  remittanceSchedule: "monthly" | "quarterly" | "annual";
  perCapitaRate: number;
}

export interface AffiliateOnboardingWizardProps {
  federationId: string;
  onComplete?: (affiliateId: string) => void;
  onCancel?: () => void;
}

const SECTORS = [
  "Healthcare",
  "Education",
  "Public Service",
  "Trades",
  "Manufacturing",
  "Transportation",
  "Retail",
  "Hospitality",
  "Technology",
  "Construction",
  "Other"
];

const PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"
];

export function AffiliateOnboardingWizard({
  federationId,
  onComplete,
  onCancel
}: AffiliateOnboardingWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<AffiliateOnboardingData>>({
    address: {
      street: "",
      city: "",
      province: "ON",
      postalCode: ""
    },
    remittanceSchedule: "monthly"
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateFormData(field: string, value: any) {
    setFormData(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(prev[parent as keyof typeof prev] as any),
            [child]: value
          }
        };
      }
      return { ...prev, [field]: value };
    });
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }

  function validateStep(step: number): boolean {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.name) newErrors.name = "Organization name is required";
        if (!formData.shortName) newErrors.shortName = "Short name is required";
        if (!formData.affiliateNumber) newErrors.affiliateNumber = "Affiliate number is required";
        if (!formData.sector) newErrors.sector = "Sector is required";
        break;
      case 2:
        if (!formData.contactName) newErrors.contactName = "Contact name is required";
        if (!formData.contactEmail) newErrors.contactEmail = "Email is required";
        if (!formData.contactPhone) newErrors.contactPhone = "Phone is required";
        if (!formData.address?.street) newErrors["address.street"] = "Street address is required";
        if (!formData.address?.city) newErrors["address.city"] = "City is required";
        if (!formData.address?.postalCode) newErrors["address.postalCode"] = "Postal code is required";
        break;
      case 3:
        if (!formData.memberCount || formData.memberCount < 1) {
          newErrors.memberCount = "Member count must be at least 1";
        }
        if (!formData.localCount || formData.localCount < 1) {
          newErrors.localCount = "Local count must be at least 1";
        }
        break;
      case 4:
        if (!formData.perCapitaRate || formData.perCapitaRate < 0) {
          newErrors.perCapitaRate = "Per capita rate is required";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (!validateStep(currentStep)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleSubmit();
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/federation/affiliates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          federationId,
          ...formData
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create affiliate");
      }

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Affiliate Added",
          description: "New affiliate union has been successfully onboarded"
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        onComplete && onComplete(data.affiliateId);
      } else {
        throw new Error(data.error || "Failed to create affiliate");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to add affiliate union",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveDraft() {
    try {
      await fetch(`/api/federation/affiliates/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ federationId, data: formData })
      });
      toast({
        title: "Draft Saved",
        description: "Your progress has been saved"
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive"
      });
    }
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add New Affiliate Union
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Step {currentStep} of {totalSteps}
        </CardDescription>
        <Progress value={progress} className="mt-2" />
        <div className="flex items-center gap-2 mt-4">
          {[1, 2, 3, 4].map((step) => (
            <Badge
              key={step}
              variant={currentStep === step ? "default" : currentStep > step ? "success" : "outline"}
              className="flex items-center gap-1"
            >
              {currentStep > step && <Check className="h-3 w-3" />}
              Step {step}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Organization Name *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => updateFormData("name", e.target.value)}
                placeholder="e.g., Canadian Union of Public Employees"
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shortName">Short Name / Acronym *</Label>
              <Input
                id="shortName"
                value={formData.shortName || ""}
                onChange={(e) => updateFormData("shortName", e.target.value)}
                placeholder="e.g., CUPE"
              />
              {errors.shortName && <p className="text-sm text-red-600">{errors.shortName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="affiliateNumber">Affiliate Number *</Label>
              <Input
                id="affiliateNumber"
                value={formData.affiliateNumber || ""}
                onChange={(e) => updateFormData("affiliateNumber", e.target.value)}
                placeholder="e.g., AFF-001"
              />
              {errors.affiliateNumber && <p className="text-sm text-red-600">{errors.affiliateNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sector">Labour Sector *</Label>
              <Select
                value={formData.sector}
                onValueChange={(value) => updateFormData("sector", value)}
              >
                <SelectTrigger id="sector">
                  <SelectValue placeholder="Select sector" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((sector) => (
                    <SelectItem key={sector} value={sector.toLowerCase().replace(" ", "_")}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sector && <p className="text-sm text-red-600">{errors.sector}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => updateFormData("description", e.target.value)}
                placeholder="Brief description of the union..."
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 2: Contact Details */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  value={formData.contactName || ""}
                  onChange={(e) => updateFormData("contactName", e.target.value)}
                  placeholder="John Smith"
                />
                {errors.contactName && <p className="text-sm text-red-600">{errors.contactName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactTitle">Title *</Label>
                <Input
                  id="contactTitle"
                  value={formData.contactTitle || ""}
                  onChange={(e) => updateFormData("contactTitle", e.target.value)}
                  placeholder="President"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail || ""}
                  onChange={(e) => updateFormData("contactEmail", e.target.value)}
                  placeholder="contact@union.ca"
                />
                {errors.contactEmail && <p className="text-sm text-red-600">{errors.contactEmail}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone || ""}
                  onChange={(e) => updateFormData("contactPhone", e.target.value)}
                  placeholder="(555) 123-4567"
                />
                {errors.contactPhone && <p className="text-sm text-red-600">{errors.contactPhone}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="street">Street Address *</Label>
              <Input
                id="street"
                value={formData.address?.street || ""}
                onChange={(e) => updateFormData("address.street", e.target.value)}
                placeholder="123 Main Street"
              />
              {errors["address.street"] && <p className="text-sm text-red-600">{errors["address.street"]}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.address?.city || ""}
                  onChange={(e) => updateFormData("address.city", e.target.value)}
                  placeholder="Toronto"
                />
                {errors["address.city"] && <p className="text-sm text-red-600">{errors["address.city"]}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Province *</Label>
                <Select
                  value={formData.address?.province}
                  onValueChange={(value) => updateFormData("address.province", value)}
                >
                  <SelectTrigger id="province">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((prov) => (
                      <SelectItem key={prov} value={prov}>
                        {prov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code *</Label>
                <Input
                  id="postalCode"
                  value={formData.address?.postalCode || ""}
                  onChange={(e) => updateFormData("address.postalCode", e.target.value)}
                  placeholder="M1M 1M1"
                />
                {errors["address.postalCode"] && <p className="text-sm text-red-600">{errors["address.postalCode"]}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Membership Data */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="memberCount">Total Member Count *</Label>
              <Input
                id="memberCount"
                type="number"
                min="1"
                value={formData.memberCount || ""}
                onChange={(e) => updateFormData("memberCount", parseInt(e.target.value))}
                placeholder="1500"
              />
              <p className="text-sm text-muted-foreground">
                Number of active members across all locals
              </p>
              {errors.memberCount && <p className="text-sm text-red-600">{errors.memberCount}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="localCount">Number of Locals *</Label>
              <Input
                id="localCount"
                type="number"
                min="1"
                value={formData.localCount || ""}
                onChange={(e) => updateFormData("localCount", parseInt(e.target.value))}
                placeholder="12"
              />
              <p className="text-sm text-muted-foreground">
                Number of local chapters or branches
              </p>
              {errors.localCount && <p className="text-sm text-red-600">{errors.localCount}</p>}
            </div>

            <div className="p-4 bg-muted rounded-md">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">Average Members per Local</p>
                  <p className="text-2xl font-bold">
                    {formData.memberCount && formData.localCount
                      ? Math.round(formData.memberCount / formData.localCount)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Remittance Setup */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remittanceSchedule">Remittance Schedule *</Label>
              <Select
                value={formData.remittanceSchedule}
                onValueChange={(value) => updateFormData("remittanceSchedule", value)}
              >
                <SelectTrigger id="remittanceSchedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                How often remittances are due from this affiliate
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="perCapitaRate">Per Capita Rate (CAD) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="perCapitaRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.perCapitaRate || ""}
                  onChange={(e) => updateFormData("perCapitaRate", parseFloat(e.target.value))}
                  placeholder="3.50"
                  className="pl-9"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Amount per member per month
              </p>
              {errors.perCapitaRate && <p className="text-sm text-red-600">{errors.perCapitaRate}</p>}
            </div>

            {formData.memberCount && formData.perCapitaRate && (
              <div className="p-4 bg-muted rounded-md space-y-2">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">Expected Monthly Remittance</p>
                    <p className="text-2xl font-bold">
                      ${(formData.memberCount * formData.perCapitaRate).toFixed(2)}
                    </p>
                  </div>
                </div>
                {formData.remittanceSchedule === "quarterly" && (
                  <p className="text-sm text-muted-foreground">
                    Quarterly: ${(formData.memberCount * formData.perCapitaRate * 3).toFixed(2)}
                  </p>
                )}
                {formData.remittanceSchedule === "annual" && (
                  <p className="text-sm text-muted-foreground">
                    Annual: ${(formData.memberCount * formData.perCapitaRate * 12).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={saveDraft}
              disabled={isSubmitting}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
          </div>

          <Button
            onClick={handleNext}
            disabled={isSubmitting}
          >
            {currentStep === totalSteps ? (
              <>
                {isSubmitting ? "Creating..." : "Complete Onboarding"}
                <Check className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
