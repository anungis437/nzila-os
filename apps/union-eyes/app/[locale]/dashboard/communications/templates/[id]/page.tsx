/**
 * Template Detail & Editor Page
 * 
 * View and edit message templates
 * Path: /dashboard/communications/templates/[id]
 * 
 * Phase 4: Communications & Organizing
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  Mail,
  MessageSquare,
  Bell,
} from 'lucide-react';

interface Variable {
  name: string;
  description: string;
  required: boolean;
  default: string | null;
  example: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  type: 'email' | 'sms' | 'push';
  category: string;
  subject: string | null;
  body: string;
  preheader: string | null;
  htmlContent: string | null;
  plainTextContent: string | null;
  variables: Variable[];
  tags: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function TemplateDetailPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('communicationsTemplatesDetailPage');
  const { id: paramId } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Template>>({});
  const [newTag, setNewTag] = useState('');
  const [newVariable, setNewVariable] = useState<Variable>({
    name: '',
    description: '',
    required: false,
    default: null,
    example: null,
  });

  useEffect(() => {
    fetchTemplate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/communications/templates/${paramId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Template not found');
        }
        throw new Error('Failed to fetch template');
      }

      const json = await response.json();
      const data = json.data ?? json;
      setTemplate(data);
      setFormData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/communications/templates/${paramId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save template');
      }

      const updatedJson = await response.json();
      const updated = updatedJson.data ?? updatedJson;
      setTemplate(updated);
      setFormData(updated);
      setSuccessMessage('Template saved successfully');
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);

      const response = await fetch(`/api/communications/templates/${paramId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }

      router.push(`/${locale}/dashboard/communications/templates`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  const updateFormData = (updates: Partial<Template>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const addTag = () => {
    if (newTag.trim() && formData.tags && !formData.tags.includes(newTag.trim())) {
      updateFormData({ tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    if (formData.tags) {
      updateFormData({ tags: formData.tags.filter(t => t !== tag) });
    }
  };

  const addVariable = () => {
    if (newVariable.name.trim() && formData.variables) {
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
    if (formData.variables) {
      updateFormData({ variables: formData.variables.filter(v => v.name !== name) });
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5" />;
      case 'push':
        return <Bell className="h-5 w-5" />;
      default:
        return <Mail className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.push(`/${locale}/dashboard/communications/templates`)}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToTemplates')}
        </Button>
      </div>
    );
  }

  if (!template || !formData) {
    return null;
  }

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
          {t('backToTemplates')}
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-muted rounded-lg">
              {getChannelIcon(template.type)}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{template.name}</h1>
              {template.description && (
                <p className="text-muted-foreground">{template.description}</p>
              )}
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="capitalize">{template.type}</Badge>
                <Badge variant="outline" className="capitalize">{template.category}</Badge>
                <Badge variant={template.isActive ? 'default' : 'secondary'}>
                  {template.isActive ? t('activeStatus') : t('inactiveStatus')}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="mr-2 h-4 w-4" />
              {t('previewButton')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('savingStatus')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('saveChangesButton')}
                </>
              )}
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{t('templateSavedMessage')}</AlertDescription>
        </Alert>
      )}

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
          <CardTitle>{t('basicInformationTitle')}</CardTitle>
          <CardDescription>{t('basicInformationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('templateNameLabel')} *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder={t('templateNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t('categoryLabel')}</Label>
              <Select
                value={formData.category || ''}
                onValueChange={(value) => updateFormData({ category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="campaign">{t('categoryOptionCampaign')}</SelectItem>
                  <SelectItem value="transactional">{t('categoryOptionTransactional')}</SelectItem>
                  <SelectItem value="alert">{t('categoryOptionAlert')}</SelectItem>
                  <SelectItem value="newsletter">{t('categoryOptionNewsletter')}</SelectItem>
                  <SelectItem value="announcement">{t('categoryOptionAnnouncement')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => updateFormData({ description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive || false}
              onCheckedChange={(checked) => updateFormData({ isActive: checked })}
            />
            <Label htmlFor="isActive" className="font-normal">
              {t('activeTemplateLabel')}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t('templateContentTitle')}</CardTitle>
          <CardDescription>
            {template.type === 'email' && t('contentDescriptionEmail')}
            {template.type === 'sms' && t('contentDescriptionSms')}
            {template.type === 'push' && t('contentDescriptionPush')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {template.type === 'email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">{t('subjectLineLabel')} *</Label>
                <Input
                  id="subject"
                  value={formData.subject || ''}
                  onChange={(e) => updateFormData({ subject: e.target.value })}
                  placeholder={t('subjectLinePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preheader">{t('preheaderTextLabel')}</Label>
                <Input
                  id="preheader"
                  value={formData.preheader || ''}
                  onChange={(e) => updateFormData({ preheader: e.target.value })}
                  placeholder={t('preheaderPlaceholder')}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="body">
              {template.type === 'email' ? t('plainTextBodyLabel') : t('messageBodyLabel')} *
            </Label>
            <Textarea
              id="body"
              value={formData.body || ''}
              onChange={(e) => updateFormData({ body: e.target.value })}
              placeholder={
                template.type === 'sms'
                  ? t('smsBodyPlaceholder')
                  : t('messageBodyPlaceholder')
              }
              rows={10}
              maxLength={template.type === 'sms' ? 160 : undefined}
            />
            {template.type === 'sms' && (
              <p className="text-sm text-muted-foreground">
                {formData.body?.length || 0} / 160 {t('charactersLabel')}
              </p>
            )}
          </div>

          {template.type === 'email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="htmlContent">{t('htmlContentLabel')}</Label>
                <Textarea
                  id="htmlContent"
                  value={formData.htmlContent || ''}
                  onChange={(e) => updateFormData({ htmlContent: e.target.value })}
                  placeholder={t('htmlContentPlaceholder')}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t('htmlContentNote')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plainTextContent">{t('plainTextFallbackLabel')}</Label>
                <Textarea
                  id="plainTextContent"
                  value={formData.plainTextContent || ''}
                  onChange={(e) => updateFormData({ plainTextContent: e.target.value })}
                  placeholder={t('plainTextFallbackPlaceholder')}
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
          <CardTitle>{t('templateVariablesTitle')}</CardTitle>
          <CardDescription>
            {t('templateVariablesDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.variables && formData.variables.length > 0 && (
            <div className="space-y-2">
              {formData.variables.map((variable, index) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary">{'{{'}{variable.name}{'}}'}</Badge>
                        {variable.required && (
                          <Badge variant="destructive" className="text-xs">{t('requiredBadge')}</Badge>
                        )}
                      </div>
                      {variable.description && (
                        <p className="text-sm text-muted-foreground mb-1">
                          {variable.description}
                        </p>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {variable.default && <span>{t('defaultPrefix')} {variable.default}</span>}
                        {variable.example && <span>{t('examplePrefix')} {variable.example}</span>}
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
          )}

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('addVariableTitle')}</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="var-name" className="text-sm">{t('variableNameLabel')} *</Label>
                <Input
                  id="var-name"
                  value={newVariable.name}
                  onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                  placeholder={t('variableNamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="var-description" className="text-sm">{t('descriptionLabel')}</Label>
                <Input
                  id="var-description"
                  value={newVariable.description}
                  onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                  placeholder={t('variableDescriptionPlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="var-default" className="text-sm">{t('defaultValueLabel')}</Label>
                <Input
                  id="var-default"
                  value={newVariable.default || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, default: e.target.value || null })}
                  placeholder={t('defaultValuePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="var-example" className="text-sm">{t('exampleLabel')}</Label>
                <Input
                  id="var-example"
                  value={newVariable.example || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, example: e.target.value || null })}
                  placeholder={t('examplePlaceholder')}
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
                {t('requiredVariableLabel')}
              </Label>
            </div>

            <Button onClick={addVariable} disabled={!newVariable.name.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addVariableButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tagsTitle')}</CardTitle>
          <CardDescription>
            {t('tagsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.tags && formData.tags.length > 0 && (
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
              placeholder={t('tagInputPlaceholder')}
            />
            <Button onClick={addTag} disabled={!newTag.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addTagButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>{t('templateInfoTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('createdLabel')}:</span>
            <span>{new Date(template.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('lastUpdatedLabel')}:</span>
            <span>{new Date(template.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              {t('deleteDialogDescription', { name: template.name })}
              {template.isActive && (
                <div className="mt-2 text-amber-600">
                  ⚠️ {t('deleteActiveTemplateWarning')}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('cancelButton')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('deletingStatus')}
                </>
              ) : (
                t('deleteTemplateButton')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Modal */}
      {showPreview && (
        <AlertDialog open={showPreview} onOpenChange={setShowPreview}>
          <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('previewModalTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{formData.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              {formData.subject && (
                <div>
                  <div className="text-sm font-medium mb-1">{t('subjectLabel')}</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {formData.subject}
                  </div>
                </div>
              )}

              {formData.preheader && (
                <div>
                  <div className="text-sm font-medium mb-1">{t('preheaderLabel')}</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {formData.preheader}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-1">{t('bodyLabel')}</div>
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {formData.body}
                </div>
              </div>

              {formData.variables && formData.variables.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">{t('variablesLabel')}</div>
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
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('closeButton')}</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
