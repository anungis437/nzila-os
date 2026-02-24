/**
 * SMS Template Editor Component (Phase 5 - Week 1)
 * Create and edit reusable SMS templates with variable substitution
 * 
 * Features:
 * - Template creation/editing form
 * - Variable picker (${variable} insertion)
 * - Real-time character counter with segment calculation
 * - Template preview with rendered example
 * - Category selection
 * - Save/cancel actions
 */

'use client';

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Save, X, Plus, AlertCircle, MessageSquare } from 'lucide-react';

interface SmsTemplateEditorProps {
  organizationId: string;
  templateId?: string;
  initialData?: {
    name: string;
    description?: string;
    messageTemplate: string;
    variables?: string[];
    category?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave?: (template: any) => void;
  onCancel?: () => void;
}

const TEMPLATE_CATEGORIES = [
  { value: 'notification', label: 'Notification' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'alert', label: 'Alert' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'custom', label: 'Custom' },
];

const COMMON_VARIABLES = [
  { value: 'firstName', label: 'First Name', example: 'John' },
  { value: 'lastName', label: 'Last Name', example: 'Smith' },
  { value: 'memberNumber', label: 'Member Number', example: '12345' },
  { value: 'claimId', label: 'Claim ID', example: '#98765' },
  { value: 'eventDate', label: 'Event Date', example: 'Dec 15, 2025' },
  { value: 'eventName', label: 'Event Name', example: 'General Meeting' },
  { value: 'duesAmount', label: 'Dues Amount', example: '$45.00' },
  { value: 'unionName', label: 'Union Name', example: 'Local 123' },
];

const SMS_SINGLE_SEGMENT = 160;
const SMS_MULTI_SEGMENT = 153;

export function SmsTemplateEditor({
  organizationId,
  templateId,
  initialData,
  onSave,
  onCancel,
}: SmsTemplateEditorProps) {
  const { toast } = useToast();
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [messageTemplate, setMessageTemplate] = useState(initialData?.messageTemplate || '');
  const [category, setCategory] = useState(initialData?.category || 'custom');
  const [variables, setVariables] = useState<string[]>(initialData?.variables || []);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate SMS segments
  const calculateSegments = (text: string): number => {
    const length = text.length;
    if (length === 0) return 0;
    if (length <= SMS_SINGLE_SEGMENT) return 1;
    return Math.ceil(length / SMS_MULTI_SEGMENT);
  };

  const segments = calculateSegments(messageTemplate);
  const estimatedCost = segments * 0.0075;
  const charLimit = segments === 1 ? SMS_SINGLE_SEGMENT : segments * SMS_MULTI_SEGMENT;
  const remainingChars = charLimit - messageTemplate.length;

  // Extract variables from template
  useEffect(() => {
    const regex = /\$\{(\w+)\}/g;
    const matches = messageTemplate.match(regex);
    if (matches) {
      const extractedVars = matches.map((match) => match.slice(2, -1));
      const uniqueVars = Array.from(new Set(extractedVars));
      setVariables(uniqueVars);
    } else {
      setVariables([]);
    }
  }, [messageTemplate]);

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message-template') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = messageTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + `\${${variable}}` + after;

    setMessageTemplate(newText);

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variable.length + 3;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Render preview with example data
  const renderPreview = () => {
    let preview = messageTemplate;
    COMMON_VARIABLES.forEach((v) => {
      preview = preview.replace(new RegExp(`\\$\\{${v.value}\\}`, 'g'), v.example);
    });
    return preview;
  };

  // Save template
  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Template name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!messageTemplate.trim()) {
      toast({
        title: 'Error',
        description: 'Message template is required',
        variant: 'destructive',
      });
      return;
    }

    if (messageTemplate.length > 1600) {
      toast({
        title: 'Error',
        description: 'Message template is too long (max 1600 characters)',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/communications/sms/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name,
          description,
          messageTemplate,
          variables,
          category,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      const { template } = await response.json();

      toast({
        title: 'Success',
        description: 'SMS template saved successfully',
      });

      onSave?.(template);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to save template. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {templateId ? 'Edit SMS Template' : 'Create SMS Template'}
          </h2>
          <p className="text-muted-foreground">
            Create reusable SMS templates with variable substitution
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Template Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
              <CardDescription>Basic information about the template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Claim Status Update"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this template for?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Message Template */}
          <Card>
            <CardHeader>
              <CardTitle>Message Template</CardTitle>
              <CardDescription>
                Use variables like ${'{'}firstName{'}'} for dynamic content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message-template">Message *</Label>
                <Textarea
                  id="message-template"
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Hello ${firstName}, your claim ${claimId} has been updated..."
                  rows={6}
                  className="font-mono text-sm"
                />
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className={remainingChars < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                      {messageTemplate.length} / {charLimit} characters
                    </span>
                    <Badge variant={segments > 3 ? 'destructive' : 'secondary'}>
                      {segments} segment{segments !== 1 ? 's' : ''} (~${estimatedCost.toFixed(4)})
                    </Badge>
                  </div>
                </div>
                {remainingChars < 0 && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Message exceeds maximum length
                  </div>
                )}
              </div>

              {/* Variable Picker */}
              <div className="space-y-2">
                <Label>Insert Variable</Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_VARIABLES.map((v) => (
                    <Button
                      key={v.value}
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(v.value)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {v.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Detected Variables */}
              {variables.length > 0 && (
                <div className="space-y-2">
                  <Label>Detected Variables</Label>
                  <div className="flex flex-wrap gap-2">
                    {variables.map((v) => (
                      <Badge key={v} variant="secondary">
                        ${'{'}
                        {v}
                        {'}'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Preview
              </CardTitle>
              <CardDescription>How the message will appear to recipients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Example Message:
                </div>
                <div className="rounded-md bg-background p-3 text-sm whitespace-pre-wrap">
                  {renderPreview() || 'Enter a message to see preview...'}
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Characters:</span>
                  <span className="font-medium">{messageTemplate.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>SMS Segments:</span>
                  <span className="font-medium">{segments}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost per message:</span>
                  <span className="font-medium">~${estimatedCost.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Variables used:</span>
                  <span className="font-medium">{variables.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <strong>Keep it concise:</strong> SMS messages under 160 characters cost less
                  (1 segment vs. multiple).
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <strong>Use variables:</strong> Personalize messages with member data like
                  ${'{'}firstName{'}'}.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <strong>Include opt-out:</strong> Members can reply STOP to unsubscribe
                  (automatic).
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <strong>Test first:</strong> Send a test message to yourself before bulk
                  sending.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

