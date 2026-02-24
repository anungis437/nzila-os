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
        throw new Error('Template name is required');
      }

      if (!formData.body.trim()) {
        throw new Error('Template body is required');
      }

      if (formData.type === 'email' && !formData.subject.trim()) {
        throw new Error('Email subject is required');
      }

      const response = await fetch('/api/messaging/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create template');
      }

      const template = await response.json();
      router.push(`/dashboard/communications/templates/${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
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
          onClick={() => router.push('/dashboard/communications/templates')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Templates
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Create New Template</h1>
            <p className="text-muted-foreground">
              Build a reusable message template for your campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Template
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
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Template name, type, and settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              placeholder="e.g., Welcome Email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              placeholder="Brief description of this template"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Channel Type *</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(value) => updateFormData({ type: value as TemplateForm['type'] })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="type-email" />
                <Label htmlFor="type-email" className="font-normal flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sms" id="type-sms" />
                <Label htmlFor="type-sms" className="font-normal flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="push" id="type-push" />
                <Label htmlFor="type-push" className="font-normal flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Push Notification
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => updateFormData({ category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
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
              Make this template active immediately
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Template Content</CardTitle>
          <CardDescription>
            {formData.type === 'email' && 'Email subject, body, and optional HTML content'}
            {formData.type === 'sms' && 'SMS message body (max 160 characters)'}
            {formData.type === 'push' && 'Push notification title and body'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.type === 'email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => updateFormData({ subject: e.target.value })}
                  placeholder="Enter email subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preheader">Preheader Text</Label>
                <Input
                  id="preheader"
                  value={formData.preheader}
                  onChange={(e) => updateFormData({ preheader: e.target.value })}
                  placeholder="Preview text that appears after the subject line"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="body">
              {formData.type === 'email' ? 'Plain Text Body' : 'Message Body'} *
            </Label>
            <Textarea
              id="body"
              value={formData.body}
              onChange={(e) => updateFormData({ body: e.target.value })}
              placeholder={
                formData.type === 'sms'
                  ? 'Enter SMS message (max 160 characters)'
                  : 'Enter message content. Use {{variableName}} for placeholders.'
              }
              rows={10}
              maxLength={formData.type === 'sms' ? 160 : undefined}
            />
            {formData.type === 'sms' && (
              <p className="text-sm text-muted-foreground">
                {formData.body.length} / 160 characters
              </p>
            )}
          </div>

          {formData.type === 'email' && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="htmlContent">HTML Content (Optional)</Label>
                <Textarea
                  id="htmlContent"
                  value={formData.htmlContent}
                  onChange={(e) => updateFormData({ htmlContent: e.target.value })}
                  placeholder="<html><body>Enter HTML email content...</body></html>"
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  If provided, this HTML content will be used instead of plain text for HTML-capable email clients
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plainTextContent">Plain Text Fallback (Optional)</Label>
                <Textarea
                  id="plainTextContent"
                  value={formData.plainTextContent}
                  onChange={(e) => updateFormData({ plainTextContent: e.target.value })}
                  placeholder="Plain text version for email clients that don&apos;t support HTML"
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
          <CardTitle>Template Variables</CardTitle>
          <CardDescription>
            Define placeholder variables that can be replaced with actual data when sending.
            Use {'{{variableName}}'} in your template body.
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
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        {variable.description && (
                          <p className="text-sm text-muted-foreground mb-1">
                            {variable.description}
                          </p>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {variable.default && <span>Default: {variable.default}</span>}
                          {variable.example && <span>Example: {variable.example}</span>}
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
            <h4 className="text-sm font-medium">Add Variable</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="var-name" className="text-sm">Variable Name *</Label>
                <Input
                  id="var-name"
                  value={newVariable.name}
                  onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                  placeholder="e.g., firstName"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="var-description" className="text-sm">Description</Label>
                <Input
                  id="var-description"
                  value={newVariable.description}
                  onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                  placeholder="e.g., Member's first name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="var-default" className="text-sm">Default Value</Label>
                <Input
                  id="var-default"
                  value={newVariable.default || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, default: e.target.value || null })}
                  placeholder="Optional default"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="var-example" className="text-sm">Example</Label>
                <Input
                  id="var-example"
                  value={newVariable.example || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, example: e.target.value || null })}
                  placeholder="e.g., John"
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
                Required variable
              </Label>
            </div>

            <Button onClick={addVariable} disabled={!newVariable.name.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Variable
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Add tags to organize and categorize templates
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
              placeholder="Enter tag name"
            />
            <Button onClick={addTag} disabled={!newTag.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tag
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-2xl max-h-[80vh] overflow-y-auto m-4">
            <CardHeader>
              <CardTitle>Template Preview</CardTitle>
              <CardDescription>{formData.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.subject && (
                <div>
                  <div className="text-sm font-medium mb-1">Subject</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {formData.subject}
                  </div>
                </div>
              )}

              {formData.preheader && (
                <div>
                  <div className="text-sm font-medium mb-1">Preheader</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {formData.preheader}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-1">Body</div>
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {formData.body || 'No content yet'}
                </div>
              </div>

              {formData.variables.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Variables</div>
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
                Close Preview
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
