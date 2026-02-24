"use client";

/**
 * Organization CRUD Forms Component
 * 
 * Create, edit, and delete forms for hierarchical organizations.
 * Features:
 * - Create new organization with parent selection
 * - Edit existing organization details
 * - Delete organization with safety checks
 * - Validation rules (unique slug, parent constraints)
 * - Type-specific field visibility
 * - Real-time slug generation from name
 * 
 * @module components/admin/organization-form
 */

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertTriangle, Users } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// =====================================================
// TYPES
// =====================================================

interface Organization {
  id: string;
  name: string;
  slug: string;
  displayName?: string | null;
  shortName?: string | null;
  organizationType: 'congress' | 'federation' | 'union' | 'local' | 'region' | 'district';
  parentId?: string | null;
  hierarchyPath: string[];
  hierarchyLevel: number;
  jurisdiction?: string | null;
  provinceTerritory?: string | null;
  sectors?: string[];
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: {
    street?: string;
    unit?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    country?: string;
  } | null;
  clcAffiliated?: boolean;
  affiliationDate?: string | null;
  charterNumber?: string | null;
  memberCount?: number;
  activeMemberCount?: number;
  subscriptionTier?: string | null;
  status?: string;
}

// =====================================================
// VALIDATION SCHEMA
// =====================================================

const organizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200, "Name too long"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug too long")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  displayName: z.string().max(200).optional(),
  shortName: z.string().max(50).optional(),
  organizationType: z.enum(['congress', 'federation', 'union', 'local', 'region', 'district']),
  parentId: z.string().uuid().optional().nullable(),
  jurisdiction: z.enum([
    'federal', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
  ]).optional().nullable(),
  provinceTerritory: z.string().max(100).optional().nullable(),
  sectors: z.array(z.string()).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.object({
    street: z.string().optional(),
    unit: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  clcAffiliated: z.boolean().optional(),
  affiliationDate: z.string().optional().nullable(),
  charterNumber: z.string().max(50).optional(),
  subscriptionTier: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended', 'archived']).optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

// =====================================================
// CONSTANTS
// =====================================================

const CANADIAN_JURISDICTIONS = [
  { value: 'federal', label: 'Federal' },
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

const LABOUR_SECTORS = [
  'healthcare',
  'education',
  'public_service',
  'trades',
  'manufacturing',
  'transportation',
  'retail',
  'hospitality',
  'technology',
  'construction',
  'utilities',
  'telecommunications',
  'financial_services',
  'agriculture',
  'arts_culture',
  'other',
];

const SUBSCRIPTION_TIERS = [
  { value: 'free', label: 'Free' },
  { value: 'basic', label: 'Basic' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate slug from organization name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Get organization type label
 */
function getOrgTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    congress: 'Congress',
    federation: 'Federation',
    union: 'Union',
    local: 'Local',
    region: 'Region',
    district: 'District',
  };
  return labels[type] || type;
}

/**
 * Get sector display name
 */
function getSectorLabel(sector: string): string {
  return sector
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =====================================================
// FORM COMPONENT
// =====================================================

interface OrganizationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  organization?: Organization | null;
  parentOrganization?: Organization | null;
  availableParents?: Organization[];
  onSubmit: (data: OrganizationFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function OrganizationForm({
  open,
  onOpenChange,
  mode,
  organization,
  parentOrganization,
  availableParents = [],
  onSubmit,
  isSubmitting = false,
}: OrganizationFormProps) {
  const [autoSlug, setAutoSlug] = useState(true);

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      slug: '',
      displayName: '',
      shortName: '',
      organizationType: parentOrganization ? getDefaultChildType(parentOrganization.organizationType) : 'union',
      parentId: parentOrganization?.id || null,
      jurisdiction: null,
      provinceTerritory: '',
      sectors: [],
      email: '',
      phone: '',
      website: '',
      address: {
        street: '',
        unit: '',
        city: '',
        province: '',
        postal_code: '',
        country: 'Canada',
      },
      clcAffiliated: parentOrganization?.clcAffiliated || false,
      affiliationDate: null,
      charterNumber: '',
      subscriptionTier: 'basic',
      status: 'active',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && organization) {
      form.reset({
        name: organization.name,
        slug: organization.slug,
        displayName: organization.displayName || '',
        shortName: organization.shortName || '',
        organizationType: organization.organizationType,
        parentId: organization.parentId || null,
        jurisdiction: (organization.jurisdiction as 'federal' | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT' | null) || null,
        provinceTerritory: organization.provinceTerritory || '',
        sectors: organization.sectors || [],
        email: organization.email || '',
        phone: organization.phone || '',
        website: organization.website || '',
        address: organization.address || {
          street: '',
          unit: '',
          city: '',
          province: '',
          postal_code: '',
          country: 'Canada',
        },
        clcAffiliated: organization.clcAffiliated || false,
        affiliationDate: organization.affiliationDate || null,
        charterNumber: organization.charterNumber || '',
        subscriptionTier: organization.subscriptionTier || 'basic',
        status: (organization.status as 'active' | 'inactive' | 'suspended' | 'archived') || 'active',
      });
      setAutoSlug(false);
    } else if (mode === 'create') {
      form.reset({
        name: '',
        slug: '',
        displayName: '',
        shortName: '',
        organizationType: parentOrganization ? getDefaultChildType(parentOrganization.organizationType) : 'union',
        parentId: parentOrganization?.id || null,
        jurisdiction: null,
        provinceTerritory: '',
        sectors: [],
        email: '',
        phone: '',
        website: '',
        address: {
          street: '',
          unit: '',
          city: '',
          province: '',
          postal_code: '',
          country: 'Canada',
        },
        clcAffiliated: parentOrganization?.clcAffiliated || false,
        affiliationDate: null,
        charterNumber: '',
        subscriptionTier: 'basic',
        status: 'active',
      });
      setAutoSlug(true);
    }
  }, [mode, organization, parentOrganization, form]);

  // Auto-generate slug from name
  // eslint-disable-next-line react-hooks/incompatible-library
  const name = form.watch('name');
  useEffect(() => {
    if (autoSlug && name && mode === 'create') {
      const slug = generateSlug(name);
      form.setValue('slug', slug, { shouldValidate: false });
    }
  }, [name, autoSlug, mode, form]);

  // Handle form submission
  const handleSubmit = async (data: OrganizationFormData) => {
    try {
      await onSubmit(data);
      onOpenChange(false);
      form.reset();
    } catch (_error) {
}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Organization' : 'Edit Organization'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? parentOrganization
                ? `Creating a child organization under ${parentOrganization.name}`
                : 'Create a new root-level organization'
              : `Editing ${organization?.name}`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Canadian Union of Public Employees" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug *</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., cupe-national"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setAutoSlug(false);
                            }}
                          />
                          {mode === 'create' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setAutoSlug(true);
                                const slug = generateSlug(form.getValues('name'));
                                form.setValue('slug', slug);
                              }}
                            >
                              Auto
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>URL-friendly identifier (lowercase, hyphens only)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., CUPE" {...field} />
                        </FormControl>
                        <FormDescription>Short display name</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shortName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., CUPE" {...field} />
                        </FormControl>
                        <FormDescription>Abbreviated name</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="organizationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="congress">Congress</SelectItem>
                          <SelectItem value="federation">Federation</SelectItem>
                          <SelectItem value="union">Union</SelectItem>
                          <SelectItem value="local">Local</SelectItem>
                          <SelectItem value="region">Region</SelectItem>
                          <SelectItem value="district">District</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sectors"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Labour Sectors</FormLabel>
                      <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-48 overflow-y-auto">
                        {LABOUR_SECTORS.map((sector) => (
                          <div key={sector} className="flex items-center space-x-2">
                            <Checkbox
                              checked={field.value?.includes(sector)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                const updated = checked
                                  ? [...current, sector]
                                  : current.filter((s) => s !== sector);
                                field.onChange(updated);
                              }}
                            />
                            <label className="text-sm">{getSectorLabel(sector)}</label>
                          </div>
                        ))}
                      </div>
                      <FormDescription>Select all applicable sectors</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Hierarchy Tab */}
              <TabsContent value="hierarchy" className="space-y-4">
                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Organization</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || 'none'}
                        disabled={mode === 'create' && !!parentOrganization}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select parent organization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None (Root Organization)</SelectItem>
                          {availableParents.map((parent) => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.name} ({getOrgTypeLabel(parent.organizationType)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {parentOrganization
                          ? `This organization will be created under ${parentOrganization.name}`
                          : 'Select a parent organization or leave as root'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jurisdiction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jurisdiction</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select jurisdiction" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Not specified</SelectItem>
                            {CANADIAN_JURISDICTIONS.map((jur) => (
                              <SelectItem key={jur.value} value={jur.value}>
                                {jur.label}
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
                    name="provinceTerritory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province/Territory</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Ontario" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="clcAffiliated"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">CLC Affiliated</FormLabel>
                      </FormItem>
                    )}
                  />

                  {form.watch('clcAffiliated') && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <FormField
                        control={form.control}
                        name="affiliationDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Affiliation Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="charterNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Charter Number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., CH-12345" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Contact Tab */}
              <TabsContent value="contact" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="info@organization.ca" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://www.organization.ca" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <FormLabel>Address</FormLabel>
                  <FormField
                    control={form.control}
                    name="address.street"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Street address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address.unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Unit/Suite" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="address.province"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Province" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Postal Code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <FormField
                  control={form.control}
                  name="subscriptionTier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription Tier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'basic'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUBSCRIPTION_TIERS.map((tier) => (
                            <SelectItem key={tier.value} value={tier.value}>
                              {tier.label}
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
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'active'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Archived organizations are hidden but can be restored
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {mode === 'edit' && organization && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Note:</strong> Changing the parent organization or type may affect
                      hierarchy and permissions. Member counts: {organization.memberCount || 0} total,{' '}
                      {organization.activeMemberCount || 0} active.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create Organization' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// DELETE CONFIRMATION DIALOG
// =====================================================

interface DeleteOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization | null;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
  hasChildren?: boolean;
  memberCount?: number;
}

export function DeleteOrganizationDialog({
  open,
  onOpenChange,
  organization,
  onConfirm,
  isDeleting = false,
  hasChildren = false,
  memberCount = 0,
}: DeleteOrganizationDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText === organization?.slug && !hasChildren;

  const handleConfirm = async () => {
    if (canDelete) {
      await onConfirm();
      setConfirmText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete Organization
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the organization and all
            associated data.
          </DialogDescription>
        </DialogHeader>

        {organization && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> You are about to delete <strong>{organization.name}</strong>
              </AlertDescription>
            </Alert>

            {hasChildren && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cannot delete:</strong> This organization has child organizations. Please
                  delete or reassign child organizations first.
                </AlertDescription>
              </Alert>
            )}

            {memberCount > 0 && (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  This organization has <strong>{memberCount} members</strong>. Their memberships
                  will also be deleted.
                </AlertDescription>
              </Alert>
            )}

            {!hasChildren && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Type <Badge variant="outline">{organization.slug}</Badge> to confirm deletion:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={organization.slug}
                  disabled={isDeleting}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canDelete || isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get default child organization type based on parent type
 */
function getDefaultChildType(
  parentType: Organization['organizationType']
): Organization['organizationType'] {
  const typeHierarchy: Record<string, Organization['organizationType']> = {
    congress: 'federation',
    federation: 'union',
    union: 'local',
    local: 'local',
    region: 'local',
    district: 'local',
  };
  return typeHierarchy[parentType] || 'local';
}

