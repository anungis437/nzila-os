/**
 * Campaign Creation Wizard
 *
 * Multi-step form that saves a DRAFT campaign (POST /api/communications/campaigns). It posts only the fields that route accepts and only the
 * enum values its table allows; the audience is chosen from the organization's saved member segments and the content from its templates. There is
 * no sender in this release (UE-ACTION-CAMPAIGN-SEND), so the form offers no way to send or schedule, and the page says so.
 * Path: /dashboard/communications/campaigns/new
 */

'use client';

export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { logger } from '@/lib/logger';
import { ApiShapeError, envelopeRow, readApiError } from '@/lib/client/api-envelope';
import { fetchAllRows } from '@/lib/client/crud-lists';
import { asRecord, optionalString, requiredString } from '@/lib/client/row-fields';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  Save,
  Users,
} from 'lucide-react';

// The values of the campaign_type and campaign_channel enums that this wizard can describe. A sequence or a triggered campaign needs steps or a trigger
// it has no way to define, so they are not offered.
type CampaignType = 'broadcast' | 'transactional';
type CampaignChannel = 'email' | 'sms' | 'push' | 'multi_channel';

interface TemplateOption {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
}

interface SegmentOption {
  id: string;
  name: string;
}

interface CampaignForm {
  name: string;
  description: string;
  type: CampaignType;
  channel: CampaignChannel;
  segmentId: string | null;
  templateId: string | null;
  subject: string;
  body: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

/** A list the page reads: not answered yet, answered, or failed (with the server's message when it gave one). */
type Loaded<T> = { state: 'loading' } | { state: 'ready'; rows: T[] } | { state: 'error'; message: string };

const NO_SEGMENT = 'none';
const CUSTOM_CONTENT = 'custom';

// A template the list route returns is an unarchived one (it filters archived rows out), so every row is offered.
function templateFrom(value: unknown): TemplateOption {
  const row = asRecord(value, 'template');
  return { id: requiredString(row, 'id'), name: requiredString(row, 'name'), type: requiredString(row, 'type'), subject: optionalString(row, 'subject'), body: optionalString(row, 'body') ?? '' };
}

function segmentFrom(value: unknown): SegmentOption {
  const row = asRecord(value, 'segment');
  return { id: requiredString(row, 'id'), name: requiredString(row, 'name') };
}

async function loadOptions<T>(path: string, map: (value: unknown) => T): Promise<Loaded<T>> {
  try {
    return { state: 'ready', rows: (await fetchAllRows<unknown>(path)).map(map) };
  } catch (err) {
    logger.error(`Failed to read ${path}`, err);
    return { state: 'error', message: err instanceof Error && !(err instanceof ApiShapeError) ? err.message : '' };
  }
}

/** The body of the create: only fields the route accepts. Status, send time and schedule are the table's own (a draft, not sent). */
function draftBody(form: CampaignForm): Record<string, unknown> {
  const body: Record<string, unknown> = { name: form.name.trim(), type: form.type, channel: form.channel, body: form.body };
  if (form.description.trim()) body.description = form.description.trim();
  if (form.segmentId) body.segmentId = form.segmentId;
  if (form.templateId) body.templateId = form.templateId;
  if (form.channel === 'email') {
    body.subject = form.subject.trim();
    // The table's default settings have tracking on; a body that carries settings replaces that object, so it is sent only when a switch was turned off.
    if (!form.trackOpens || !form.trackClicks) body.settings = { trackOpens: form.trackOpens, trackClicks: form.trackClicks };
  }
  return body;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('communicationsCampaignsNewPage');
  const steps = [
    { id: 1, name: t('stepBasicInfo'), icon: Mail },
    { id: 2, name: t('stepAudience'), icon: Users },
    { id: 3, name: t('stepContent'), icon: MessageSquare },
    { id: 4, name: t('stepReview'), icon: Check },
  ];
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Loaded<TemplateOption>>({ state: 'loading' });
  const [segments, setSegments] = useState<Loaded<SegmentOption>>({ state: 'loading' });

  const [form, setForm] = useState<CampaignForm>({
    name: '',
    description: '',
    type: 'broadcast',
    channel: 'email',
    segmentId: null,
    templateId: null,
    subject: '',
    body: '',
    trackOpens: true,
    trackClicks: true,
  });

  useEffect(() => {
    let current = true;
    void loadOptions('/api/members/segments', segmentFrom).then((result) => {
      if (current) setSegments(result);
    });
    void loadOptions('/api/communications/templates', templateFrom).then((result) => {
      if (current) setTemplates(result);
    });
    return () => {
      current = false;
    };
  }, []);

  const update = (updates: Partial<CampaignForm>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/communications/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftBody(form)),
      });
      if (!response.ok) throw new Error(await readApiError(response, t('createCampaignError')));

      // The route answers { success, data: { data: record } }; the saved draft is opened by the id it was given.
      const created = envelopeRow(await response.json());
      if (typeof created.id !== 'string') throw new ApiShapeError('no id');
      router.push(`/${locale}/dashboard/communications/campaigns/${created.id}`);
    } catch (err) {
      setError(err instanceof Error && !(err instanceof ApiShapeError) ? err.message : t('createCampaignError'));
    } finally {
      setSaving(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return form.name.trim() !== '';
      case 3:
        return form.body.trim() !== '' && (form.channel !== 'email' || form.subject.trim() !== '');
      default:
        return true;
    }
  };

  const typeLabel = (type: CampaignType) => (type === 'broadcast' ? t('typeOptionBroadcast') : t('typeOptionTransactional'));
  const channelLabel = (channel: CampaignChannel) =>
    channel === 'email'
      ? t('channelOptionEmail')
      : channel === 'sms'
        ? t('channelOptionSms')
        : channel === 'push'
          ? t('channelOptionPush')
          : t('channelOptionMulti');

  const channelTemplates = templates.state === 'ready' ? templates.rows.filter((template) => template.type === form.channel) : [];
  const chosenSegment = segments.state === 'ready' ? segments.rows.find((segment) => segment.id === form.segmentId) : undefined;

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
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder={t('campaignNamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder={t('campaignDescriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('campaignTypeLabel')} *</Label>
                <RadioGroup
                  value={form.type}
                  onValueChange={(value) => update({ type: value as CampaignType })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="broadcast" id="type-broadcast" />
                    <Label htmlFor="type-broadcast" className="font-normal">
                      {t('typeOptionBroadcast')}
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
                  value={form.channel}
                  onValueChange={(value) => update({ channel: value as CampaignChannel, templateId: null })}
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
              <div className="space-y-2">
                <Label htmlFor="segment">{t('segmentLabel')}</Label>
                <Select
                  value={form.segmentId ?? NO_SEGMENT}
                  onValueChange={(value) => update({ segmentId: value === NO_SEGMENT ? null : value })}
                  disabled={segments.state !== 'ready'}
                >
                  <SelectTrigger id="segment">
                    <SelectValue placeholder={t('selectSegmentPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SEGMENT}>{t('segmentOptionNone')}</SelectItem>
                    {segments.state === 'ready' &&
                      segments.rows.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id}>
                          {segment.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {segments.state === 'loading' && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" />}
                {segments.state === 'error' && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {t('segmentsLoadError')}
                      {segments.message ? `: ${segments.message}` : ''}
                    </AlertDescription>
                  </Alert>
                )}
                {segments.state === 'ready' && segments.rows.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('segmentsNone')}</p>
                )}
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
                  value={form.templateId ?? CUSTOM_CONTENT}
                  onValueChange={(value) => {
                    if (value === CUSTOM_CONTENT) {
                      update({ templateId: null });
                      return;
                    }
                    const template = channelTemplates.find((candidate) => candidate.id === value);
                    if (template) update({ templateId: template.id, subject: template.subject ?? '', body: template.body });
                  }}
                  disabled={templates.state !== 'ready'}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder={t('selectTemplatePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUSTOM_CONTENT}>{t('customContentOption')}</SelectItem>
                    {channelTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.state === 'loading' && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" />}
                {templates.state === 'error' && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {t('fetchTemplatesError')}
                      {templates.message ? `: ${templates.message}` : ''}
                    </AlertDescription>
                  </Alert>
                )}
                {templates.state === 'ready' && channelTemplates.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('templatesNone')}</p>
                )}
              </div>

              {form.channel === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="subject">{t('subjectLineLabel')} *</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => update({ subject: e.target.value })}
                    placeholder={t('subjectLinePlaceholder')}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="body">{t('messageLabel')} *</Label>
                <Textarea
                  id="body"
                  value={form.body}
                  onChange={(e) => update({ body: e.target.value })}
                  placeholder={
                    form.channel === 'sms'
                      ? t('smsMessagePlaceholder')
                      : t('messageBodyPlaceholder')
                  }
                  rows={10}
                  maxLength={form.channel === 'sms' ? 160 : undefined}
                />
                {form.channel === 'sms' && (
                  <p className="text-sm text-muted-foreground">
                    {form.body.length} / 160 {t('charactersLabel')}
                  </p>
                )}
              </div>

              {form.channel === 'email' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.trackOpens}
                      onChange={(e) => update({ trackOpens: e.target.checked })}
                      className="rounded"
                    />
                    {t('trackOpensLabel')}
                  </Label>
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.trackClicks}
                      onChange={(e) => update({ trackClicks: e.target.checked })}
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
                    <dd className="font-medium">{form.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('typeLabel')}:</dt>
                    <dd className="font-medium">{typeLabel(form.type)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('channelLabel')}:</dt>
                    <dd className="font-medium">{channelLabel(form.channel)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('audienceLabel')}:</dt>
                    <dd className="font-medium">{chosenSegment ? chosenSegment.name : t('audienceNotSet')}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('contentLabel')}</h3>
                {form.channel === 'email' && (
                  <div className="mb-2">
                    <span className="text-sm text-muted-foreground">{t('subjectLabel')}: </span>
                    <span className="font-medium">{form.subject}</span>
                  </div>
                )}
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {form.body}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('sendingLabel')}</h3>
                <CapabilityUnavailable locale={locale} capability="UE-ACTION-CAMPAIGN-SEND" />
              </div>

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
          onClick={() => router.push(`/${locale}/dashboard/communications/campaigns`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToCampaignsButton')}
        </Button>
        <h1 className="text-3xl font-bold">{t('createCampaignTitle')}</h1>
        <p className="text-muted-foreground">
          {t('createCampaignDescription')}
        </p>
        <Alert className="mt-4">
          <AlertDescription>{t('draftNotice')}</AlertDescription>
        </Alert>
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
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1 || saving}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('previousButton')}
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed() || saving}
            >
              {t('nextButton')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('creatingStatus')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
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
