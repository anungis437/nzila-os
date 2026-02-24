/**
 * Campaign Creation Wizard
 * 
 * Multi-step form for creating a new communication campaign
 * Path: /dashboard/communications/campaigns/new
 * 
 * Phase 4: Communications & Organizing
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { logger } from '@/lib/logger';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Mail, 
  MessageSquare, 
  Bell, 
  Users,
  Calendar,
  Send,
  Loader2
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  type: string;
  category: string;
  subject: string | null;
  body: string;
  variables: Array<{
    name: string;
    description: string;
    required: boolean;
    default: string | null;
    example: string | null;
  }>;
}

interface CampaignForm {
  name: string;
  description: string;
  type: 'campaign' | 'announcement' | 'alert' | 'transactional';
  channel: 'email' | 'sms' | 'push' | 'multi_channel';
  
  // Audience
  segmentId: string | null;
  segmentQuery: Record<string, unknown> | null;
  testMode: boolean;
  
  // Content
  templateId: string | null;
  subject: string;
  body: string;
  variables: Record<string, string>;
  
  // Scheduling
  sendNow: boolean;
  scheduledAt: string | null;
  
  // Settings
  trackOpens: boolean;
  trackClicks: boolean;
}

const STEPS = [
  { id: 1, name: 'Basic Info', icon: Mail },
  { id: 2, name: 'Audience', icon: Users },
  { id: 3, name: 'Content', icon: MessageSquare },
  { id: 4, name: 'Schedule', icon: Calendar },
  { id: 5, name: 'Review', icon: Check },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [audiencePreview, _setAudiencePreview] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<CampaignForm>({
    name: '',
    description: '',
    type: 'campaign',
    channel: 'email',
    segmentId: null,
    segmentQuery: null,
    testMode: false,
    templateId: null,
    subject: '',
    body: '',
    variables: {},
    sendNow: false,
    scheduledAt: null,
    trackOpens: true,
    trackClicks: true,
  });

  // Fetch templates when content step is reached
  useEffect(() => {
    if (currentStep === 3 && templates.length === 0) {
      fetchTemplates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const fetchTemplates = async () => {
    try {
      const params = new URLSearchParams({
        type: formData.channel,
        isActive: 'true',
      });

      const response = await fetch(`/api/messaging/templates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch templates');

      const data = await response.json();
      setTemplates(data.templates);
    } catch (err) {
      logger.error('Failed to fetch templates:', err);
    }
  };

  const updateFormData = (updates: Partial<CampaignForm>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare campaign data
      const campaignData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        channel: formData.channel,
        segmentId: formData.segmentId,
        segmentQuery: formData.segmentQuery,
        testMode: formData.testMode,
        templateId: formData.templateId,
        subject: formData.subject,
        body: formData.body,
        variables: formData.variables,
        scheduledAt: formData.sendNow ? null : formData.scheduledAt,
        settings: {
          trackOpens: formData.trackOpens,
          trackClicks: formData.trackClicks,
        },
      };

      const response = await fetch('/api/messaging/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create campaign');
      }

      const campaign = await response.json();

      // If sendNow is true, trigger send immediately
      if (formData.sendNow) {
        const sendResponse = await fetch(`/api/messaging/campaigns/${campaign.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: false }),
        });

        if (!sendResponse.ok) {
          throw new Error('Campaign created but failed to send');
        }
      }

      // Redirect to campaign detail page
      router.push(`/dashboard/communications/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim() !== '' && formData.type && formData.channel;
      case 2:
        return true; // Audience is optional
      case 3:
        return formData.templateId || formData.body.trim() !== '';
      case 4:
        return formData.sendNow || formData.scheduledAt;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Basics</CardTitle>
              <CardDescription>
                Set up the basic information for your campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  placeholder="e.g., March Member Newsletter"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="Brief description of this campaign"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Campaign Type *</Label>
                <RadioGroup
                  value={formData.type}
                  onValueChange={(value) => updateFormData({ type: value as CampaignForm['type'] })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="campaign" id="type-campaign" />
                    <Label htmlFor="type-campaign" className="font-normal">
                      Campaign - Regular marketing or organizing campaign
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="announcement" id="type-announcement" />
                    <Label htmlFor="type-announcement" className="font-normal">
                      Announcement - Important news or updates
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="alert" id="type-alert" />
                    <Label htmlFor="type-alert" className="font-normal">
                      Alert - Urgent or time-sensitive information
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="transactional" id="type-transactional" />
                    <Label htmlFor="type-transactional" className="font-normal">
                      Transactional - Response to user action
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Channel *</Label>
                <RadioGroup
                  value={formData.channel}
                  onValueChange={(value) => updateFormData({ channel: value as CampaignForm['channel'] })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="email" id="channel-email" />
                    <Label htmlFor="channel-email" className="font-normal flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sms" id="channel-sms" />
                    <Label htmlFor="channel-sms" className="font-normal flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      SMS
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="push" id="channel-push" />
                    <Label htmlFor="channel-push" className="font-normal flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Push Notification
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="multi_channel" id="channel-multi" />
                    <Label htmlFor="channel-multi" className="font-normal">
                      Multi-Channel (Email + SMS + Push)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Select Audience</CardTitle>
              <CardDescription>
                Choose who will receive this campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  Segment selection will be integrated with the member database.
                  For now, the campaign will target all eligible members.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="segment">Segment (Optional)</Label>
                <Select
                  value={formData.segmentId || 'all'}
                  onValueChange={(value) => updateFormData({ segmentId: value === 'all' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    <SelectItem value="active">Active Members</SelectItem>
                    <SelectItem value="inactive">Inactive Members</SelectItem>
                    <SelectItem value="new">New Members (Last 30 Days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {audiencePreview !== null && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Audience</span>
                    <span className="text-2xl font-bold">{audiencePreview.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="testMode"
                  checked={formData.testMode}
                  onChange={(e) => updateFormData({ testMode: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="testMode" className="font-normal">
                  Test mode (send to admins only)
                </Label>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Content</CardTitle>
              <CardDescription>
                Choose a template or write custom content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template">Template (Optional)</Label>
                <Select
                  value={formData.templateId || 'custom'}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      updateFormData({ templateId: null });
                    } else {
                      const template = templates.find(t => t.id === value);
                      if (template) {
                        updateFormData({
                          templateId: value,
                          subject: template.subject || '',
                          body: template.body,
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Content</SelectItem>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.channel === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line *</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => updateFormData({ subject: e.target.value })}
                    placeholder="Enter email subject"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="body">Message *</Label>
                <Textarea
                  id="body"
                  value={formData.body}
                  onChange={(e) => updateFormData({ body: e.target.value })}
                  placeholder={
                    formData.channel === 'sms' 
                      ? 'Enter SMS message (max 160 characters)'
                      : 'Enter your message content'
                  }
                  rows={10}
                  maxLength={formData.channel === 'sms' ? 160 : undefined}
                />
                {formData.channel === 'sms' && (
                  <p className="text-sm text-muted-foreground">
                    {formData.body.length} / 160 characters
                  </p>
                )}
              </div>

              {formData.channel === 'email' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.trackOpens}
                      onChange={(e) => updateFormData({ trackOpens: e.target.checked })}
                      className="rounded"
                    />
                    Track email opens
                  </Label>
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.trackClicks}
                      onChange={(e) => updateFormData({ trackClicks: e.target.checked })}
                      className="rounded"
                    />
                    Track link clicks
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Schedule Campaign</CardTitle>
              <CardDescription>
                Choose when to send your campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={formData.sendNow ? 'now' : 'scheduled'}
                onValueChange={(value) => {
                  updateFormData({
                    sendNow: value === 'now',
                    scheduledAt: value === 'now' ? null : formData.scheduledAt,
                  });
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="send-now" />
                  <Label htmlFor="send-now" className="font-normal">
                    Send immediately after creation
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="scheduled" id="send-scheduled" />
                  <Label htmlFor="send-scheduled" className="font-normal">
                    Schedule for later
                  </Label>
                </div>
              </RadioGroup>

              {!formData.sendNow && (
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Schedule Date & Time *</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={formData.scheduledAt || ''}
                    onChange={(e) => updateFormData({ scheduledAt: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Review Campaign</CardTitle>
              <CardDescription>
                Review your campaign details before sending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Campaign Information</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Name:</dt>
                    <dd className="font-medium">{formData.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Type:</dt>
                    <dd className="font-medium capitalize">{formData.type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Channel:</dt>
                    <dd className="font-medium capitalize">{formData.channel}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Content</h3>
                {formData.channel === 'email' && (
                  <div className="mb-2">
                    <span className="text-sm text-muted-foreground">Subject: </span>
                    <span className="font-medium">{formData.subject}</span>
                  </div>
                )}
                <div className="p-3 bg-muted rounded-lg text-sm">
                  {formData.body}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Schedule</h3>
                <p className="text-muted-foreground">
                  {formData.sendNow ? (
                    'Send immediately'
                  ) : (
                    `Scheduled for ${new Date(formData.scheduledAt!).toLocaleString()}`
                  )}
                </p>
              </div>

              {formData.testMode && (
                <Alert>
                  <AlertDescription>
                    <strong>Test Mode:</strong> This campaign will only be sent to administrators.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Campaigns
        </Button>
        <h1 className="text-3xl font-bold">Create New Campaign</h1>
        <p className="text-muted-foreground">
          Follow the steps to create and launch your campaign
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2
                      ${isActive ? 'border-primary bg-primary text-primary-foreground' : ''}
                      ${isCompleted ? 'border-primary bg-primary text-primary-foreground' : ''}
                      ${!isActive && !isCompleted ? 'border-muted-foreground text-muted-foreground' : ''}
                    `}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className="text-xs mt-1 text-center">{step.name}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`
                      h-0.5 flex-1 mx-2
                      ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-6">
        {renderStep()}
      </div>

      {/* Navigation */}
      <Card>
        <CardFooter className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => Math.max(1, s - 1))}
            disabled={currentStep === 1 || loading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {currentStep < 5 ? (
            <Button
              onClick={() => setCurrentStep(s => s + 1)}
              disabled={!canProceed() || loading}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Create Campaign
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
