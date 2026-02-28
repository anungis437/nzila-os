"use client";

/**
 * Alert Rule Builder Component
 * 
 * Visual workflow builder for creating configurable alert rules with conditions,
 * triggers, and actions. Provides drag-drop interface for building complex alerting logic.
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Trash2,
  Save,
  Play,
  AlertCircle,
  Bell,
  Clock,
  Zap,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';

// Sample alert rule templates
const ALERT_TEMPLATES = [
  {
    id: 'contract-expiration',
    name: 'Contract Expiration Alert',
    category: 'contract_management',
    description: 'Alert bargaining team when contracts are approaching expiration',
    triggerType: 'schedule' as const,
    triggerConfig: { schedule: '0 6 * * *' },
    severity: 'high' as const,
    conditions: [
      {
        fieldPath: 'contract.expiration_date',
        operator: 'between' as const,
        value: ['NOW()', 'NOW() + INTERVAL \'90 days\''],
      }
    ],
    actions: [
      {
        actionType: 'send_email' as const,
        actionConfig: {
          emailSubject: 'Contract Expiring Soon: {{contract.title}}',
          emailTemplate: 'contract_expiration_warning',
        }
      }
    ]
  },
  {
    id: 'dues-arrears',
    name: 'Dues Arrears Alert',
    category: 'financial',
    description: 'Alert when members fall behind on dues payments',
    triggerType: 'event' as const,
    triggerConfig: { event: 'payment_failed' },
    severity: 'medium' as const,
    conditions: [
      {
        fieldPath: 'member.dues_balance',
        operator: 'less_than' as const,
        value: 0,
      },
      {
        fieldPath: 'member.arrears_months',
        operator: 'greater_than_or_equal' as const,
        value: 3,
      }
    ],
    actions: [
      {
        actionType: 'send_email' as const,
        actionConfig: {
          emailSubject: 'Dues Payment Reminder',
          emailTemplate: 'dues_arrears_reminder',
        }
      },
      {
        actionType: 'send_sms' as const,
        actionConfig: {
          smsTemplate: 'Your union dues are {{arrears_months}} months overdue. Please contact us to arrange payment.',
        }
      }
    ]
  },
  {
    id: 'training-expiry',
    name: 'Certification Expiry Alert',
    category: 'training',
    description: 'Alert members when certifications are expiring',
    triggerType: 'schedule' as const,
    triggerConfig: { schedule: '0 6 * * *' },
    severity: 'medium' as const,
    conditions: [
      {
        fieldPath: 'certification.expiration_date',
        operator: 'between' as const,
        value: ['NOW()', 'NOW() + INTERVAL \'30 days\''],
      }
    ],
    actions: [
      {
        actionType: 'send_email' as const,
        actionConfig: {
          emailSubject: 'Certification Expiring Soon',
          emailTemplate: 'certification_expiry_warning',
        }
      }
    ]
  },
  {
    id: 'grievance-deadline',
    name: 'Grievance Deadline Alert',
    category: 'grievances',
    description: 'Alert stewards of approaching grievance deadlines',
    triggerType: 'schedule' as const,
    triggerConfig: { schedule: '0 8 * * *' },
    severity: 'critical' as const,
    conditions: [
      {
        fieldPath: 'grievance.deadline',
        operator: 'between' as const,
        value: ['NOW()', 'NOW() + INTERVAL \'3 days\''],
      }
    ],
    actions: [
      {
        actionType: 'send_email' as const,
        actionConfig: {
          emailSubject: 'URGENT: Grievance Deadline Approaching',
          emailTemplate: 'grievance_deadline_urgent',
        }
      },
      {
        actionType: 'send_sms' as const,
        actionConfig: {
          smsTemplate: 'URGENT: Grievance #{{grievance.number}} deadline in {{days_remaining}} days',
        }
      },
      {
        actionType: 'create_task' as const,
        actionConfig: {
          taskTitle: 'Complete Grievance: {{grievance.title}}',
          taskDescription: 'Deadline: {{grievance.deadline}}',
        }
      }
    ]
  }
];

const TRIGGER_TYPES = [
  { value: 'schedule', label: 'Schedule (Cron)', icon: Clock },
  { value: 'event', label: 'System Event', icon: Zap },
  { value: 'threshold', label: 'Threshold', icon: AlertCircle },
  { value: 'manual', label: 'Manual Trigger', icon: Play },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals (=)', symbol: '=' },
  { value: 'not_equals', label: 'Not Equals (â‰ )', symbol: 'â‰ ' },
  { value: 'greater_than', label: 'Greater Than (>)', symbol: '>' },
  { value: 'greater_than_or_equal', label: 'Greater Than or Equal (â‰¥)', symbol: 'â‰¥' },
  { value: 'less_than', label: 'Less Than (<)', symbol: '<' },
  { value: 'less_than_or_equal', label: 'Less Than or Equal (â‰¤)', symbol: 'â‰¤' },
  { value: 'contains', label: 'Contains', symbol: 'âˆ‹' },
  { value: 'not_contains', label: 'Not Contains', symbol: 'âˆŒ' },
  { value: 'starts_with', label: 'Starts With', symbol: 'âŠ¢' },
  { value: 'ends_with', label: 'Ends With', symbol: 'âŠ£' },
  { value: 'in', label: 'In List', symbol: 'âˆˆ' },
  { value: 'not_in', label: 'Not In List', symbol: 'âˆ‰' },
  { value: 'is_null', label: 'Is Null', symbol: 'âˆ…' },
  { value: 'is_not_null', label: 'Is Not Null', symbol: 'â‰ âˆ…' },
  { value: 'between', label: 'Between', symbol: 'â†”' },
  { value: 'regex_match', label: 'Regex Match', symbol: '~' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: Mail, color: 'bg-blue-500' },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare, color: 'bg-green-500' },
  { value: 'send_push_notification', label: 'Push Notification', icon: Smartphone, color: 'bg-purple-500' },
  { value: 'create_task', label: 'Create Task', icon: CheckCircle, color: 'bg-orange-500' },
  { value: 'trigger_webhook', label: 'Trigger Webhook', icon: Zap, color: 'bg-yellow-500' },
  { value: 'escalate', label: 'Escalate', icon: AlertCircle, color: 'bg-red-500' },
];

const SEVERITY_LEVELS = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500', textColor: 'text-red-700' },
  { value: 'high', label: 'High', color: 'bg-orange-500', textColor: 'text-orange-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700' },
  { value: 'low', label: 'Low', color: 'bg-blue-500', textColor: 'text-blue-700' },
  { value: 'info', label: 'Info', color: 'bg-gray-500', textColor: 'text-gray-700' },
];

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once (then disable)' },
  { value: 'every_occurrence', label: 'Every Occurrence' },
  { value: 'daily_digest', label: 'Daily Digest' },
  { value: 'hourly_digest', label: 'Hourly Digest' },
  { value: 'rate_limited', label: 'Rate Limited' },
];

interface Condition {
  id: string;
  fieldPath: string;
  operator: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  conditionGroup: number;
  isOrCondition: boolean;
}

interface Action {
  id: string;
  actionType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actionConfig: any;
  orderIndex: number;
}

export default function AlertRuleBuilder() {
  const params = useParams<{ locale?: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const localePrefix = params?.locale ? `/${params.locale}` : '';
  const [ruleName, setRuleName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [triggerType, setTriggerType] = useState('schedule');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [severity, setSeverity] = useState('medium');
  const [frequency, setFrequency] = useState('every_occurrence');
  const [rateLimitMinutes, setRateLimitMinutes] = useState(60);
  const [isEnabled, setIsEnabled] = useState(true);
  const [recipientEmails, setRecipientEmails] = useState('');
  const [recipientPhones, setRecipientPhones] = useState('');
  
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [currentStep, setCurrentStep] = useState<'basic' | 'trigger' | 'conditions' | 'actions' | 'review'>('basic');
  const [isSaving, setIsSaving] = useState(false);

  // Add condition
  const addCondition = () => {
    const newCondition: Condition = {
      id: `cond-${Date.now()}`,
      fieldPath: '',
      operator: 'equals',
      value: '',
      conditionGroup: 1,
      isOrCondition: false,
    };
    setConditions([...conditions, newCondition]);
  };

  // Remove condition
  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  // Update condition
  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  // Add action
  const addAction = () => {
    const newAction: Action = {
      id: `act-${Date.now()}`,
      actionType: 'send_email',
      actionConfig: {},
      orderIndex: actions.length,
    };
    setActions([...actions, newAction]);
  };

  // Remove action
  const removeAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  // Update action
  const updateAction = (id: string, updates: Partial<Action>) => {
    setActions(actions.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  // Load template
  const loadTemplate = (templateId: string) => {
    const template = ALERT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setRuleName(template.name);
    setDescription(template.description);
    setCategory(template.category);
    setTriggerType(template.triggerType);
    setTriggerConfig(template.triggerConfig);
    setSeverity(template.severity);
    
    setConditions(template.conditions.map((c, i) => ({
      id: `cond-${i}`,
      fieldPath: c.fieldPath,
      operator: c.operator,
      value: c.value,
      conditionGroup: 1,
      isOrCondition: false,
    })));

    setActions(template.actions.map((a, i) => ({
      id: `act-${i}`,
      actionType: a.actionType,
      actionConfig: a.actionConfig,
      orderIndex: i,
    })));
  };

  // Save alert rule
  const saveAlertRule = async () => {
    const alertRule = {
      name: ruleName,
      description: description || undefined,
      category: category || undefined,
      triggerType,
      triggerConfig,
      severity,
      frequency,
      rateLimitMinutes: frequency === 'rate_limited' ? rateLimitMinutes : undefined,
      isEnabled,
      conditions: conditions.map((c, i) => ({
        fieldPath: c.fieldPath,
        operator: c.operator,
        value: c.value,
        conditionGroup: c.conditionGroup,
        isOrCondition: c.isOrCondition,
        orderIndex: i,
      })),
      actions: actions.map((a, i) => ({
        actionType: a.actionType,
        actionConfig: a.actionConfig,
        orderIndex: i,
      })),
    };
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertRule),
      });

      if (!response.ok) {
        throw new Error('Failed to save alert rule');
      }
      const responseData = await response.json();
      const createdRuleId = responseData?.data?.rule?.id;

      if (createdRuleId) {
        const emailRecipients = recipientEmails
          .split(/[\n,]/)
          .map((value) => value.trim())
          .filter(Boolean);
        const smsRecipients = recipientPhones
          .split(/[\n,]/)
          .map((value) => value.trim())
          .filter(Boolean);

        await Promise.all([
          ...emailRecipients.map((email) =>
            fetch('/api/admin/alerts/recipients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                alertRuleId: createdRuleId,
                recipientType: 'email',
                recipientValue: email,
                deliveryMethods: ['email'],
              }),
            })
          ),
          ...smsRecipients.map((phone) =>
            fetch('/api/admin/alerts/recipients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                alertRuleId: createdRuleId,
                recipientType: 'sms',
                recipientValue: phone,
                deliveryMethods: ['sms'],
              }),
            })
          ),
        ]);
      }

      toast({
        title: 'Alert rule created',
        description: 'The alert rule is now active.',
      });
      router.push(`${localePrefix}/admin/alerts`);
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save alert rule',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test alert rule
  const testAlertRule = () => {
    toast({
      title: 'Test run queued',
      description: 'Save the rule before running a test execution.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Alert Rule Builder</h1>
          <p className="text-muted-foreground mt-1">
            Create configurable alert rules with conditions, triggers, and actions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testAlertRule}>
            <Play className="h-4 w-4 mr-2" />
            Test Rule
          </Button>
          <Button onClick={saveAlertRule} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Rule'}
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {['basic', 'trigger', 'conditions', 'actions', 'review'].map((step, index) => (
              <div key={step} className="flex items-center">
                <button
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={() => setCurrentStep(step as any)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep === step
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-primary'
                  }`}
                >
                  {index + 1}
                </button>
                <span className={`ml-2 font-medium ${currentStep === step ? 'text-primary' : 'text-gray-600'}`}>
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </span>
                {index < 4 && <ChevronRight className="h-5 w-5 mx-4 text-gray-400" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template Selector */}
      {currentStep === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle>Start from a Template (Optional)</CardTitle>
            <CardDescription>Choose a pre-built alert template or create from scratch</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {ALERT_TEMPLATES.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => loadTemplate(template.id)}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      {template.name}
                      <Badge variant="outline">{template.severity}</Badge>
                    </CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Information */}
      {currentStep === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Define the alert rule name and general settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule Name *</Label>
                <Input
                  id="rule-name"
                  placeholder="e.g., Contract Expiration Alert"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g., contract_management"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe when and why this alert should fire..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full ${level.color} mr-2`} />
                          {level.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {frequency === 'rate_limited' && (
                <div className="space-y-2">
                  <Label htmlFor="rate-limit">Rate Limit (minutes)</Label>
                  <Input
                    id="rate-limit"
                    type="number"
                    value={rateLimitMinutes}
                    onChange={(e) => setRateLimitMinutes(parseInt(e.target.value))}
                    min={1}
                  />
                </div>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipient-emails">Alert Emails</Label>
                <Input
                  id="recipient-emails"
                  placeholder="ops@example.org, admin@example.org"
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient-phones">Alert SMS Numbers</Label>
                <Input
                  id="recipient-phones"
                  placeholder="+14165550123"
                  value={recipientPhones}
                  onChange={(e) => setRecipientPhones(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
                <Label htmlFor="is-enabled">Rule Enabled</Label>
              </div>
              <Button onClick={() => setCurrentStep('trigger')}>
                Next: Configure Trigger
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trigger Configuration */}
      {currentStep === 'trigger' && (
        <Card>
          <CardHeader>
            <CardTitle>Trigger Configuration</CardTitle>
            <CardDescription>Define when this alert rule should be evaluated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {TRIGGER_TYPES.map((trigger) => {
                const Icon = trigger.icon;
                return (
                  <Card
                    key={trigger.value}
                    className={`cursor-pointer transition-colors ${
                      triggerType === trigger.value ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                    onClick={() => setTriggerType(trigger.value)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-6 w-6 ${triggerType === trigger.value ? 'text-primary' : 'text-gray-600'}`} />
                        <span className="font-medium">{trigger.label}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {triggerType === 'schedule' && (
              <div className="space-y-2">
                <Label htmlFor="cron">Cron Expression</Label>
                <Input
                  id="cron"
                  placeholder="0 6 * * * (Daily at 6 AM)"
                  value={triggerConfig.schedule || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, schedule: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  {/* eslint-disable-next-line react/no-unescaped-entities */}
                  Format: minute hour day month weekday (e.g., "0 6 * * *" = daily at 6 AM)
                </p>
              </div>
            )}

            {triggerType === 'event' && (
              <div className="space-y-2">
                <Label htmlFor="event">Event Name</Label>
                <Select
                  value={triggerConfig.event || ''}
                  onValueChange={(value) => setTriggerConfig({ ...triggerConfig, event: value })}
                >
                  <SelectTrigger id="event">
                    <SelectValue placeholder="Select an event..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment_failed">Payment Failed</SelectItem>
                    <SelectItem value="member_created">Member Created</SelectItem>
                    <SelectItem value="grievance_filed">Grievance Filed</SelectItem>
                    <SelectItem value="contract_signed">Contract Signed</SelectItem>
                    <SelectItem value="training_completed">Training Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {triggerType === 'threshold' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="metric">Metric</Label>
                  <Input
                    id="metric"
                    placeholder="e.g., member.dues_balance"
                    value={triggerConfig.threshold?.metric || ''}
                    onChange={(e) => setTriggerConfig({ 
                      ...triggerConfig, 
                      threshold: { ...triggerConfig.threshold, metric: e.target.value }
                    })}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="threshold-operator">Operator</Label>
                    <Select
                      value={triggerConfig.threshold?.operator || 'greater_than'}
                      onValueChange={(value) => setTriggerConfig({ 
                        ...triggerConfig, 
                        threshold: { ...triggerConfig.threshold, operator: value }
                      })}
                    >
                      <SelectTrigger id="threshold-operator">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.slice(0, 6).map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="threshold-value">Value</Label>
                    <Input
                      id="threshold-value"
                      placeholder="e.g., 0"
                      value={triggerConfig.threshold?.value || ''}
                      onChange={(e) => setTriggerConfig({ 
                        ...triggerConfig, 
                        threshold: { ...triggerConfig.threshold, value: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('basic')}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep('conditions')}>
                Next: Add Conditions
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conditions */}
      {currentStep === 'conditions' && (
        <Card>
          <CardHeader>
            <CardTitle>Conditions</CardTitle>
            <CardDescription>Define the conditions that must be met for the alert to fire</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {conditions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No conditions added yet</p>
                <p className="text-sm">Add conditions to control when this alert fires</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <Card key={condition.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 grid md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Field Path</Label>
                            <Input
                              placeholder="e.g., member.dues_balance"
                              value={condition.fieldPath}
                              onChange={(e) => updateCondition(condition.id, { fieldPath: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Operator</Label>
                            <Select
                              value={condition.operator}
                              onValueChange={(value) => updateCondition(condition.id, { operator: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_OPERATORS.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.symbol} {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Value</Label>
                            <Input
                              placeholder="Comparison value"
                              value={condition.value}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCondition(condition.id)}
                          className="mt-8"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                      {index < conditions.length - 1 && (
                        <div className="mt-4 flex items-center gap-2">
                          <Select
                            value={condition.isOrCondition ? 'or' : 'and'}
                            onValueChange={(value) => updateCondition(condition.id, { isOrCondition: value === 'or' })}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="and">AND</SelectItem>
                              <SelectItem value="or">OR</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">next condition</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={addCondition} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('trigger')}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep('actions')}>
                Next: Add Actions
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {currentStep === 'actions' && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Define what happens when the alert fires</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {actions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No actions added yet</p>
                <p className="text-sm">Add actions to execute when conditions are met</p>
              </div>
            ) : (
              <div className="space-y-3">
                {actions.map((action) => {
                  const actionType = ACTION_TYPES.find(t => t.value === action.actionType);
                  const Icon = actionType?.icon || Bell;

                  return (
                    <Card key={action.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg ${actionType?.color || 'bg-gray-500'}`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <Select
                              value={action.actionType}
                              onValueChange={(value) => updateAction(action.id, { actionType: value, actionConfig: {} })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {action.actionType === 'send_email' && (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label>Email Subject</Label>
                                  <Input
                                    placeholder="Alert: {{rule.name}}"
                                    value={action.actionConfig.emailSubject || ''}
                                    onChange={(e) => updateAction(action.id, {
                                      actionConfig: { ...action.actionConfig, emailSubject: e.target.value }
                                    })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Email Template</Label>
                                  <Select
                                    value={action.actionConfig.emailTemplate || ''}
                                    onValueChange={(value) => updateAction(action.id, {
                                      actionConfig: { ...action.actionConfig, emailTemplate: value }
                                    })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select template..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="default">Default Alert</SelectItem>
                                      <SelectItem value="contract_expiration">Contract Expiration</SelectItem>
                                      <SelectItem value="dues_arrears">Dues Arrears</SelectItem>
                                      <SelectItem value="grievance_deadline">Grievance Deadline</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}

                            {action.actionType === 'send_sms' && (
                              <div className="space-y-2">
                                <Label>SMS Message</Label>
                                <Textarea
                                  placeholder="Enter SMS message (use {{variables}} for dynamic content)"
                                  value={action.actionConfig.smsTemplate || ''}
                                  onChange={(e) => updateAction(action.id, {
                                    actionConfig: { ...action.actionConfig, smsTemplate: e.target.value }
                                  })}
                                  rows={3}
                                />
                              </div>
                            )}

                            {action.actionType === 'trigger_webhook' && (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label>Webhook URL</Label>
                                  <Input
                                    placeholder="https://example.com/webhook"
                                    value={action.actionConfig.webhookUrl || ''}
                                    onChange={(e) => updateAction(action.id, {
                                      actionConfig: { ...action.actionConfig, webhookUrl: e.target.value }
                                    })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Method</Label>
                                  <Select
                                    value={action.actionConfig.webhookMethod || 'POST'}
                                    onValueChange={(value) => updateAction(action.id, {
                                      actionConfig: { ...action.actionConfig, webhookMethod: value }
                                    })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="GET">GET</SelectItem>
                                      <SelectItem value="POST">POST</SelectItem>
                                      <SelectItem value="PUT">PUT</SelectItem>
                                      <SelectItem value="DELETE">DELETE</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAction(action.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <Button variant="outline" onClick={addAction} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('conditions')}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep('review')}>
                Next: Review
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review */}
      {currentStep === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>Review Alert Rule</CardTitle>
            <CardDescription>Review your configuration before saving</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Basic Information</h3>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Name:</span> {ruleName || <span className="text-muted-foreground">Not set</span>}</p>
                <p><span className="font-medium">Category:</span> {category || <span className="text-muted-foreground">Not set</span>}</p>
                <p><span className="font-medium">Severity:</span> <Badge className={SEVERITY_LEVELS.find(s => s.value === severity)?.color}>{severity}</Badge></p>
                <p><span className="font-medium">Frequency:</span> {frequency}</p>
                <p><span className="font-medium">Status:</span> {isEnabled ? <CheckCircle className="inline h-4 w-4 text-green-600" /> : <XCircle className="inline h-4 w-4 text-red-600" />} {isEnabled ? 'Enabled' : 'Disabled'}</p>
                <p>
                  <span className="font-medium">Alert Emails:</span>{' '}
                  {recipientEmails || <span className="text-muted-foreground">Not set</span>}
                </p>
                <p>
                  <span className="font-medium">Alert SMS:</span>{' '}
                  {recipientPhones || <span className="text-muted-foreground">Not set</span>}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Trigger</h3>
              <div className="text-sm">
                <p><span className="font-medium">Type:</span> {triggerType}</p>
                {triggerType === 'schedule' && <p><span className="font-medium">Schedule:</span> {triggerConfig.schedule || <span className="text-muted-foreground">Not set</span>}</p>}
                {triggerType === 'event' && <p><span className="font-medium">Event:</span> {triggerConfig.event || <span className="text-muted-foreground">Not set</span>}</p>}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Conditions ({conditions.length})</h3>
              {conditions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conditions added</p>
              ) : (
                <div className="space-y-2">
                  {conditions.map((condition, index) => (
                    <div key={condition.id} className="text-sm">
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {condition.fieldPath} {CONDITION_OPERATORS.find(op => op.value === condition.operator)?.symbol} {JSON.stringify(condition.value)}
                      </code>
                      {index < conditions.length - 1 && (
                        <span className="ml-2 font-medium text-primary">{condition.isOrCondition ? 'OR' : 'AND'}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Actions ({actions.length})</h3>
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions added</p>
              ) : (
                <div className="space-y-2">
                  {actions.map((action, index) => {
                    const actionType = ACTION_TYPES.find(t => t.value === action.actionType);
                    return (
                      <div key={action.id} className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{index + 1}.</span>
                        <Badge variant="outline">{actionType?.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('actions')}>
                Back
              </Button>
              <Button onClick={saveAlertRule} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Alert Rule'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

