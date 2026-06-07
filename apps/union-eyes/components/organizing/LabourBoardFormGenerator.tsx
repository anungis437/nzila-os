/**
 * Labour Board Form Generator
 * Auto-populate provincial certification forms (A-1/B-1) from organizing data
 * Phase 1: Organizing & Certification
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
 
import {
  FileText,
  Download,
  Send,
  AlertCircle,
  MapPin,
  Users,
  Building,
  Calendar,
} from 'lucide-react';

interface FormTemplate {
  id: string;
  jurisdiction: string;
  formType: string;
  formName: string;
  fields: FormField[];
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'address' | 'contact';
  required: boolean;
  mappedTo?: string;
  value?: string;
}

interface OrganizingCampaign {
  id: string;
  campaign_name: string;
  employer_name: string;
  workplace_address: string;
  total_workers: number;
  cards_signed: number;
  filing_deadline?: string;
  jurisdiction: string;
}

interface LabourBoardFormGeneratorProps {
  campaignId: string;
  organizationId: string;
}

const FORM_TEMPLATES: Record<string, FormTemplate[]> = {
  'ontario': [
    {
      id: 'olrb-a1',
      jurisdiction: 'Ontario',
      formType: 'A-1',
      formName: 'Application for Certification',
      fields: [
        { id: 'union_name', label: 'Name of Trade Union', type: 'text', required: true, mappedTo: 'organization.name' },
        { id: 'union_address', label: 'Union Address', type: 'address', required: true, mappedTo: 'organization.address' },
        { id: 'employer_name', label: 'Employer Legal Name', type: 'text', required: true, mappedTo: 'campaign.employer_name' },
        { id: 'employer_address', label: 'Employer Address', type: 'address', required: true, mappedTo: 'campaign.workplace_address' },
        { id: 'bargaining_unit', label: 'Proposed Bargaining Unit Description', type: 'text', required: true, mappedTo: 'campaign.bargaining_unit_scope' },
        { id: 'employee_count', label: 'Number of Employees in Unit', type: 'number', required: true, mappedTo: 'campaign.total_workers' },
        { id: 'membership_evidence', label: 'Membership Evidence Date', type: 'date', required: true },
        { id: 'contact_name', label: 'Union Representative Name', type: 'text', required: true, mappedTo: 'campaign.primary_organizer' },
        { id: 'contact_phone', label: 'Contact Phone', type: 'contact', required: true },
        { id: 'contact_email', label: 'Contact Email', type: 'contact', required: true },
      ],
    },
  ],
  'british_columbia': [
    {
      id: 'bclrb-cert',
      jurisdiction: 'British Columbia',
      formType: 'Certification Application',
      formName: 'Application for Certification (Labour Relations Code)',
      fields: [
        { id: 'union_name', label: 'Trade Union Name', type: 'text', required: true, mappedTo: 'organization.name' },
        { id: 'employer_name', label: 'Employer Name', type: 'text', required: true, mappedTo: 'campaign.employer_name' },
        { id: 'workplace_location', label: 'Workplace Location', type: 'address', required: true, mappedTo: 'campaign.workplace_address' },
        { id: 'unit_description', label: 'Bargaining Unit Description', type: 'text', required: true, mappedTo: 'campaign.bargaining_unit_scope' },
        { id: 'employee_estimate', label: 'Estimated Number of Employees', type: 'number', required: true, mappedTo: 'campaign.total_workers' },
        { id: 'membership_count', label: 'Number of Members in Unit', type: 'number', required: true, mappedTo: 'campaign.cards_signed' },
        { id: 'membership_date', label: 'Membership Evidence Date', type: 'date', required: true },
        { id: 'applicant_name', label: 'Applicant Name', type: 'text', required: true },
        { id: 'applicant_contact', label: 'Applicant Contact Information', type: 'contact', required: true },
      ],
    },
  ],
  'federal': [
    {
      id: 'cirb-cert',
      jurisdiction: 'Federal (CIRB)',
      formType: 'Certification Application',
      formName: 'Application for Certification under Canada Labour Code',
      fields: [
        { id: 'union_name', label: 'Union Name', type: 'text', required: true, mappedTo: 'organization.name' },
        { id: 'union_registration', label: 'Union Registration Number', type: 'text', required: false },
        { id: 'employer_legal_name', label: 'Employer Legal Name', type: 'text', required: true, mappedTo: 'campaign.employer_name' },
        { id: 'employer_operating_name', label: 'Employer Operating Name', type: 'text', required: false },
        { id: 'workplace_address', label: 'Principal Place of Business', type: 'address', required: true, mappedTo: 'campaign.workplace_address' },
        { id: 'unit_description', label: 'Bargaining Unit Description', type: 'text', required: true, mappedTo: 'campaign.bargaining_unit_scope' },
        { id: 'employee_count', label: 'Number of Employees', type: 'number', required: true, mappedTo: 'campaign.total_workers' },
        { id: 'member_count', label: 'Number of Union Members', type: 'number', required: true, mappedTo: 'campaign.cards_signed' },
        { id: 'representative_name', label: 'Union Representative Name', type: 'text', required: true, mappedTo: 'campaign.primary_organizer' },
        { id: 'representative_contact', label: 'Representative Contact', type: 'contact', required: true },
      ],
    },
  ],
};

export function LabourBoardFormGenerator({ campaignId, organizationId: _organizationId }: LabourBoardFormGeneratorProps) {
  const [campaign, setCampaign] = useState<OrganizingCampaign | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaignData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const fetchCampaignData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/organizing/campaigns/${campaignId}`);
      const data = await response.json();
      
      if (data.success) {
        setCampaign(data.data);
        autoPopulateForm(data.data);
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const autoPopulateForm = (campaignData: OrganizingCampaign) => {
    if (!selectedTemplate) return;

    const populated: Record<string, string> = {};

    selectedTemplate.fields.forEach(field => {
      if (field.mappedTo) {
        const path = field.mappedTo.split('.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value: any = campaignData;
        
        for (const key of path) {
          if (key === 'campaign') continue;
          value = value?.[key];
        }
        
        if (value !== undefined && value !== null) {
          populated[field.id] = String(value);
        }
      }
    });

    setFormData(populated);
  };

  const handleTemplateChange = (templateId: string) => {
    const allTemplates = Object.values(FORM_TEMPLATES).flat();
    const template = allTemplates.find(t => t.id === templateId);
    
    if (template) {
      setSelectedTemplate(template);
      if (campaign) {
        autoPopulateForm(campaign);
      }
    }
  };

  const validateForm = (): boolean => {
    if (!selectedTemplate) return false;

    const errors: Record<string, string> = {};
    
    selectedTemplate.fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        errors[field.id] = `${field.label} is required`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGeneratePDF = async () => {
    if (!validateForm()) return;

    try {
      setIsGenerating(true);
      
      const response = await fetch('/api/organizing/forms/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          templateId: selectedTemplate?.id,
          formData,
        }),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate?.formType}_${campaign?.employer_name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (_error) {
} finally {
      setIsGenerating(false);
    }
  };

  const getCompletionPercentage = (): number => {
    if (!selectedTemplate) return 0;
    
    const totalFields = selectedTemplate.fields.length;
    const filledFields = selectedTemplate.fields.filter(
      field => formData[field.id]
    ).length;
    
    return Math.round((filledFields / totalFields) * 100);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading campaign data...</div>;
  }

  if (!campaign) {
    return <div className="text-muted-foreground">Campaign not found.</div>;
  }

  const completionPct = getCompletionPercentage();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Labour Board Form Generator</h2>
        <p className="text-muted-foreground">
          Auto-populate certification forms from organizing campaign data
        </p>
      </div>

      {/* Campaign Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {campaign.campaign_name}
          </CardTitle>
          <CardDescription>{campaign.employer_name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{campaign.workplace_address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {campaign.cards_signed} / {campaign.total_workers} cards signed
              </span>
            </div>
            {campaign.filing_deadline && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Deadline: {new Date(campaign.filing_deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Form Template</CardTitle>
          <CardDescription>
            Choose the appropriate labour board jurisdiction and form type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Jurisdiction & Form Type</Label>
              <Select onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select form template" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORM_TEMPLATES).map(([jurisdiction, templates]) => (
                    <optgroup key={jurisdiction} label={jurisdiction.replace('_', ' ').toUpperCase()}>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.formName} ({template.formType})
                        </SelectItem>
                      ))}
                    </optgroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{selectedTemplate.formName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplate.jurisdiction} - {selectedTemplate.formType}
                  </p>
                </div>
                <Badge variant={completionPct === 100 ? 'default' : 'secondary'}>
                  {completionPct}% Complete
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Fields */}
      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Form Fields
            </CardTitle>
            <CardDescription>
              Fields marked with * are required. Auto-populated fields can be edited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedTemplate.fields.map(field => (
                <div key={field.id}>
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                    {field.mappedTo && (
                      <Badge variant="outline" className="ml-2">Auto-filled</Badge>
                    )}
                  </Label>
                  
                  {field.type === 'text' || field.type === 'contact' ? (
                    <Input
                      id={field.id}
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      placeholder={field.label}
                      className={validationErrors[field.id] ? 'border-red-500' : ''}
                    />
                  ) : field.type === 'number' ? (
                    <Input
                      id={field.id}
                      type="number"
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      placeholder={field.label}
                      className={validationErrors[field.id] ? 'border-red-500' : ''}
                    />
                  ) : field.type === 'date' ? (
                    <Input
                      id={field.id}
                      type="date"
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      className={validationErrors[field.id] ? 'border-red-500' : ''}
                    />
                  ) : (
                    <Textarea
                      id={field.id}
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      placeholder={field.label}
                      className={validationErrors[field.id] ? 'border-red-500' : ''}
                      rows={3}
                    />
                  )}
                  
                  {validationErrors[field.id] && (
                    <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors[field.id]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {selectedTemplate && (
        <div className="flex gap-4">
          <Button onClick={handleGeneratePDF} disabled={isGenerating}>
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
          
          <Button variant="outline" onClick={() => window.open('https://www.canada.ca/en/employment-social-development/services/labour-relations.html', '_blank', 'noopener')}>
            <Send className="h-4 w-4 mr-2" />
            E-File to Labour Board
          </Button>
        </div>
      )}
    </div>
  );
}

