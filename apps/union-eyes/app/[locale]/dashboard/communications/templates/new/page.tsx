/**
 * Template Creation Page
 * 
 * Create new message templates
 * Path: /dashboard/communications/templates/new
 * 
 * Phase 4: Communications & Organizing
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Save,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Mail,
  MessageSquare,
  Bell,
  Eye,
} from 'lucide-react';

interface Variable {
  name: string;
  description: string;
  required: boolean;
  default: string | null;
  example: string | null;
}

interface TemplateForm {
  name: string;
  description: string;
  type: 'email' | 'sms' | 'push';
  category: string;
  subject: string;
  body: string;
  preheader: string;
  htmlContent: string;
  plainTextContent: string;
  variables: Variable[];
  tags: string[];
  isActive: boolean;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('communicationsTemplateNewPage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState<TemplateForm>({
    name: '',
    description: '',
    type: 'email',
    category: 'campaign',
    subject: '',
    body: '',
    preheader: '',
    htmlContent: '',
    plainTextContent: '',
    variables: [],
    tags: [],
    isActive: true,
  });

  const [newTag, setNewTag] = useState('');
  const [newVariable, setNewVariable] = useState<Variable>({
    name: '',
    description: '',
    required: false,
    default: null,
    example: null,
  });

  const updateFormData = (updates: Partial<TemplateForm>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      updateFormData({ tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    updateFormData({ tags: formData.tags.filter(t => t !== tag) });
  };

  const addVariable = () => {
    if (newVariable.name.trim()) {
      const exists = formData.variables.some(v => v.name === newVariable.name);
      if (!exists) {
        updateFormData({ variables: [...formData.variables, { ...newVariable }] });
        setNewVariable({
          name: '',
          description: '',
          required: false,
          default: null,
          example: null,
        });
      }
    }
  };

  const removeVariable = (name: string) => {
    updateFormData({ variables: formData.variables.filter(v => v.name !== name) });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validation
      if (!formData.name.trim()) {
        throw new Error(t('errors.nameRequired'));
      }

      if (!formData.body.trim()) {
        throw new Error(t('errors.bodyRequired'));
      }

      if (formData.type === 'email' && !formData.subject.trim()) {
        throw new Error(t('errors.subjectRequired'));
      }

      const response = await fetch('/api/communications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('errors.createFailed'));
      }

      const json = await response.json();
      const template = json.data ?? json;
      router.push(`/${locale}/dashboard/communications/templates/${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const _getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'push':
        return <Bell className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/dashboard/communications/templates`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backButton')}
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="mr-2 h-4 w-4" />
              {t('actions.preview')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('actions.creating')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('actions.createTemplate')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('basic.title')}</CardTitle>
          <CardDescription>{t('basic.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('basic.nameLabel')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              placeholder={t('basic.namePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('basic.descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              placeholder={t('basic.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('basic.channelTypeLabel')}</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(value) => updateFormData({ type: value as TemplateForm['type'] })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="type-email" />
                <Label htmlFor="type-email" className="font-normal flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('channels.email')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sms" id="type-sms" />
                <Label htmlFor="type-sms" className="font-normal flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('channels.sms')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="push" id="type-push" />
                <Label htmlFor="type-push" className="font-normal flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {t('channels.push')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t('basic.categoryLabel')}</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => updateFormData({ category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign">{t('categories.campaign')}</SelectItem>
                <SelectItem value="transactional">{t('categories.transactional')}</SelectItem>
                <SelectItem value="alert">{t('categories.alert')}</SelectItem>
                <SelectItem value="newsletter">{t('categories.newsletter')}</SelectItem>
                <SelectItem value="announcement">{t('categories.announcement')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => updateFormData({ isActive: checked })}
            />
            <Label htmlFor="isActive" className="font-normal">
              {t('basic.activeImmediately')}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t('content.title')}</CardTitle>
          <CardDescription>
            {formData.type === 'email' && t('content.descriptions.email')}
            {formData.type === 'sms' && t('content.descriptions.sms')}
            {formData.type === 'push' && t('content.descriptions.push')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.type === 'email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">{t('content.subjectLineLabel')}</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => updateFormData({ subject: e.target.value })}
                  placeholder={t('content.subjectLinePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preheader">{t('content.preheaderLabel')}</Label>
                <Input
                  id="preheader"
                  value={formData.preheader}
                  onChange={(e) => updateFormData({ preheader: e.target.value })}
                  placeholder={t('content.preheaderPlaceholder')}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="body">
              {formData.type === 'email' ? t('content.plainTextBodyLabel') : t('content.messageBodyLabel')}
            </Label>
            <Textarea
              id="body"
              value={formData.body}
              onChange={(e) => updateFormData({ body: e.target.value })}
              placeholder={
                formData.type === 'sms'
                  ? t('content.smsBodyPlaceholder')
                  : t('content.messageBodyPlaceholder')
              }
              rows={10}
              maxLength={formData.type === 'sms' ? 160 : undefined}
            />
            {formData.type === 'sms' && (
              <p className="text-sm text-muted-foreground">
                {t('content.charactersCount', { count: formData.body.length })}
              </p>
            )}
          </div>

          {formData.type === 'email' && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="htmlContent">{t('content.htmlContentLabel')}</Label>
                <Textarea
                  id="htmlContent"
                  value={formData.htmlContent}
                  onChange={(e) => updateFormData({ htmlContent: e.target.value })}
                  placeholder={t('content.htmlContentPlaceholder')}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t('content.htmlContentHelp')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plainTextContent">{t('content.plainTextFallbackLabel')}</Label>
                <Textarea
                  id="plainTextContent"
                  value={formData.plainTextContent}
                  onChange={(e) => updateFormData({ plainTextContent: e.target.value })}
                  placeholder={t('content.plainTextFallbackPlaceholder')}
                  rows={6}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Variables */}
      <Card>
        <CardHeader>
          <CardTitle>{t('variables.title')}</CardTitle>
          <CardDescription>
            {t('variables.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.variables.length > 0 && (
            <>
              <div className="space-y-2">
                {formData.variables.map((variable, index) => (
                  <div key={index} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">{'{{'}{variable.name}{'}}'}</Badge>
                          {variable.required && (
                            <Badge variant="destructive" className="text-xs">{t('variables.required')}</Badge>
                          )}
                        </div>
                        {variable.description && (
                          <p className="text-sm text-muted-foreground mb-1">
                            {variable.description}
                          </p>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {variable.default && <span>{t('variables.defaultValue', { value: variable.default })}</span>}
                          {variable.example && <span>{t('variables.exampleValue', { value: variable.example })}</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariable(variable.name)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
            </>
          )}

          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('variables.addVariableTitle')}</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="var-name" className="text-sm">{t('variables.variableNameLabel')}</Label>
                <Input
                  id="var-name"
                  value={newVariable.name}
                  onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                  placeholder={t('variables.variableNamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="var-description" className="text-sm">{t('basic.descriptionLabel')}</Label>
                <Input
                  id="var-description"
                  value={newVariable.description}
                  onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                  placeholder={t('variables.variableDescriptionPlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="var-default" className="text-sm">{t('variables.defaultValueLabel')}</Label>
                <Input
                  id="var-default"
                  value={newVariable.default || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, default: e.target.value || null })}
                  placeholder={t('variables.defaultValuePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="var-example" className="text-sm">{t('variables.exampleLabel')}</Label>
                <Input
                  id="var-example"
                  value={newVariable.example || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, example: e.target.value || null })}
                  placeholder={t('variables.examplePlaceholder')}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="var-required"
                checked={newVariable.required}
                onCheckedChange={(checked) => setNewVariable({ ...newVariable, required: checked })}
              />
              <Label htmlFor="var-required" className="text-sm font-normal">
                {t('variables.requiredVariableLabel')}
              </Label>
            </div>

            <Button onClick={addVariable} disabled={!newVariable.name.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('variables.addVariableButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tags.title')}</CardTitle>
          <CardDescription>
            {t('tags.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="gap-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              placeholder={t('tags.placeholder')}
            />
            <Button onClick={addTag} disabled={!newTag.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('tags.addTagButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-2xl max-h-[80vh] overflow-y-auto m-4">
            <CardHeader>
              <CardTitle>{t('preview.title')}</CardTitle>
              <CardDescription>{formData.description || t('preview.noDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.subject && (
                <div>
                  <div className="text-sm font-medium mb-1">{t('preview.subject')}</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {formData.subject}
                  </div>
                </div>
              )}

              {formData.preheader && (
                <div>
                  <div className="text-sm font-medium mb-1">{t('preview.preheader')}</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {formData.preheader}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-1">{t('preview.body')}</div>
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {formData.body || t('preview.noContentYet')}
                </div>
              </div>

              {formData.variables.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">{t('preview.variables')}</div>
                  <div className="space-y-2">
                    {formData.variables.map((variable, index) => (
                      <div key={index} className="p-2 bg-muted rounded text-sm">
                        <Badge variant="secondary">{'{{'}{variable.name}{'}}'}</Badge>
                        {variable.description && (
                          <span className="text-muted-foreground ml-2">
                            - {variable.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                {t('preview.closeButton')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
