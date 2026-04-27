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
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

export default function NewCampaignPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('communicationsCampaignsNewPage');
  const steps = [
    { id: 1, name: t('stepBasicInfo'), icon: Mail },
    { id: 2, name: t('stepAudience'), icon: Users },
    { id: 3, name: t('stepContent'), icon: MessageSquare },
    { id: 4, name: t('stepSchedule'), icon: Calendar },
    { id: 5, name: t('stepReview'), icon: Check },
  ];
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

      const response = await fetch(`/api/communications/templates?${params}`);
      if (!response.ok) throw new Error(t('fetchTemplatesError'));

      const data = await response.json();
      setTemplates(data.data ?? []);
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

      // If sendNow, mark campaign status so it can be processed
      if (formData.sendNow) {
        Object.assign(campaignData, {
          sendImmediately: true,
          status: 'sending',
        });
      }

      const response = await fetch('/api/communications/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('createCampaignError'));
      }

      await response.json();

      // Redirect to campaigns list (detail page not yet built)
      router.push(`/${locale}/dashboard/communications/campaigns`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createCampaignError'));
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
              <CardTitle>{t('campaignBasicsTitle')}</CardTitle>
              <CardDescription>
                {t('campaignBasicsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('campaignNameLabel')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  placeholder={t('campaignNamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder={t('campaignDescriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('campaignTypeLabel')} *</Label>
                <RadioGroup
                  value={formData.type}
                  onValueChange={(value) => updateFormData({ type: value as CampaignForm['type'] })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="campaign" id="type-campaign" />
                    <Label htmlFor="type-campaign" className="font-normal">
                      {t('typeOptionCampaign')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="announcement" id="type-announcement" />
                    <Label htmlFor="type-announcement" className="font-normal">
                      {t('typeOptionAnnouncement')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="alert" id="type-alert" />
                    <Label htmlFor="type-alert" className="font-normal">
                      {t('typeOptionAlert')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="transactional" id="type-transactional" />
                    <Label htmlFor="type-transactional" className="font-normal">
                      {t('typeOptionTransactional')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>{t('channelLabel')} *</Label>
                <RadioGroup
                  value={formData.channel}
                  onValueChange={(value) => updateFormData({ channel: value as CampaignForm['channel'] })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="email" id="channel-email" />
                    <Label htmlFor="channel-email" className="font-normal flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t('channelOptionEmail')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sms" id="channel-sms" />
                    <Label htmlFor="channel-sms" className="font-normal flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {t('channelOptionSms')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="push" id="channel-push" />
                    <Label htmlFor="channel-push" className="font-normal flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      {t('channelOptionPush')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="multi_channel" id="channel-multi" />
                    <Label htmlFor="channel-multi" className="font-normal">
                      {t('channelOptionMulti')}
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
              <CardTitle>{t('selectAudienceTitle')}</CardTitle>
              <CardDescription>
                {t('selectAudienceDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  {t('segmentIntegrationNote')}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="segment">{t('segmentLabel')}</Label>
                <Select
                  value={formData.segmentId || 'all'}
                  onValueChange={(value) => updateFormData({ segmentId: value === 'all' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectSegmentPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('segmentOptionAll')}</SelectItem>
                    <SelectItem value="active">{t('segmentOptionActive')}</SelectItem>
                    <SelectItem value="inactive">{t('segmentOptionInactive')}</SelectItem>
                    <SelectItem value="new">{t('segmentOptionNew')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {audiencePreview !== null && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('estimatedAudienceLabel')}</span>
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
                  {t('testModeLabel')}
                </Label>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle>{t('campaignContentTitle')}</CardTitle>
              <CardDescription>
                {t('campaignContentDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template">{t('templateLabel')}</Label>
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
                    <SelectValue placeholder={t('selectTemplatePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">{t('customContentOption')}</SelectItem>
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
                  <Label htmlFor="subject">{t('subjectLineLabel')} *</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => updateFormData({ subject: e.target.value })}
                    placeholder={t('subjectLinePlaceholder')}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="body">{t('messageLabel')} *</Label>
                <Textarea
                  id="body"
                  value={formData.body}
                  onChange={(e) => updateFormData({ body: e.target.value })}
                  placeholder={
                    formData.channel === 'sms' 
                      ? t('smsMessagePlaceholder')
                      : t('messageBodyPlaceholder')
                  }
                  rows={10}
                  maxLength={formData.channel === 'sms' ? 160 : undefined}
                />
                {formData.channel === 'sms' && (
                  <p className="text-sm text-muted-foreground">
                    {formData.body.length} / 160 {t('charactersLabel')}
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
                    {t('trackOpensLabel')}
                  </Label>
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.trackClicks}
                      onChange={(e) => updateFormData({ trackClicks: e.target.checked })}
                      className="rounded"
                    />
                    {t('trackClicksLabel')}
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
              <CardTitle>{t('scheduleCampaignTitle')}</CardTitle>
              <CardDescription>
                {t('scheduleCampaignDescription')}
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
                    {t('sendNowOption')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="scheduled" id="send-scheduled" />
                  <Label htmlFor="send-scheduled" className="font-normal">
                    {t('scheduleForLaterOption')}
                  </Label>
                </div>
              </RadioGroup>

              {!formData.sendNow && (
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">{t('scheduleDateTimeLabel')} *</Label>
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
              <CardTitle>{t('reviewCampaignTitle')}</CardTitle>
              <CardDescription>
                {t('reviewCampaignDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">{t('campaignInformationLabel')}</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('nameLabel')}:</dt>
                    <dd className="font-medium">{formData.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('typeLabel')}:</dt>
                    <dd className="font-medium">
                      {formData.type === 'campaign'
                        ? t('typeOptionCampaign')
                        : formData.type === 'announcement'
                          ? t('typeOptionAnnouncement')
                          : formData.type === 'alert'
                            ? t('typeOptionAlert')
                            : t('typeOptionTransactional')}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('channelLabel')}:</dt>
                    <dd className="font-medium">
                      {formData.channel === 'email'
                        ? t('channelOptionEmail')
                        : formData.channel === 'sms'
                          ? t('channelOptionSms')
                          : formData.channel === 'push'
                            ? t('channelOptionPush')
                            : t('channelOptionMulti')}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('contentLabel')}</h3>
                {formData.channel === 'email' && (
                  <div className="mb-2">
                    <span className="text-sm text-muted-foreground">{t('subjectLabel')}: </span>
                    <span className="font-medium">{formData.subject}</span>
                  </div>
                )}
                <div className="p-3 bg-muted rounded-lg text-sm">
                  {formData.body}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('scheduleLabel')}</h3>
                <p className="text-muted-foreground">
                  {formData.sendNow ? (
                    t('sendImmediatelyLabel')
                  ) : (
                    `${t('scheduledForLabel')} ${new Date(formData.scheduledAt!).toLocaleString()}`
                  )}
                </p>
              </div>

              {formData.testMode && (
                <Alert>
                  <AlertDescription>
                    <strong>{t('testModeLabel')}:</strong> {t('testModeDescription')}
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
          {t('backToCampaignsButton')}
        </Button>
        <h1 className="text-3xl font-bold">{t('createCampaignTitle')}</h1>
        <p className="text-muted-foreground">
          {t('createCampaignDescription')}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
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
                {index < steps.length - 1 && (
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
            {t('previousButton')}
          </Button>

          {currentStep < 5 ? (
            <Button
              onClick={() => setCurrentStep(s => s + 1)}
              disabled={!canProceed() || loading}
            >
              {t('nextButton')}
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
                  {t('creatingStatus')}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t('createCampaignButton')}
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
