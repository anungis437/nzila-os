"use client";

/**
 * Automation Workflow Builder Component
 * 
 * Visual drag-and-drop style workflow builder for creating complex automated workflows
 * with triggers, conditions, actions, branching logic, and loops.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Trash2,
  Save,
  Play,
  GitBranch,
  Clock,
  Zap,
  Mail,
  MessageSquare,
  Smartphone,
  Database,
  Webhook,
  CheckCircle,
  ArrowDown,
  Settings,
  Copy,
} from 'lucide-react';

// Types
interface WorkflowStep {
  id: string;
  stepNumber: number;
  type: 'action' | 'condition' | 'delay' | 'loop' | 'branch';
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
  nextStepId?: string;
  branchSteps?: { condition: string; nextStepId: string }[];
}

interface AutomationWorkflow {
  name: string;
  description: string;
  category: string;
  triggerType: 'schedule' | 'event' | 'webhook' | 'manual';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  triggerConfig: Record<string, any>;
  isEnabled: boolean;
  steps: WorkflowStep[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: Record<string, any>;
}

// Pre-built workflow templates
const WORKFLOW_TEMPLATES = [
  {
    name: 'New Member Onboarding',
    description: 'Automated welcome sequence for new members',
    category: 'membership',
    triggerType: 'event' as const,
    triggerConfig: { event: 'member.created' },
    steps: [
      {
        type: 'action' as const,
        name: 'Send Welcome Email',
        config: {
          actionType: 'send_email',
          template: 'member_welcome',
          to: '{{member.email}}',
        },
      },
      {
        type: 'delay' as const,
        name: 'Wait 1 Day',
        config: { delayHours: 24 },
      },
      {
        type: 'action' as const,
        name: 'Create Onboarding Tasks',
        config: {
          actionType: 'create_task',
          title: 'Complete profile setup',
          assignedTo: '{{member.id}}',
        },
      },
      {
        type: 'delay' as const,
        name: 'Wait 3 Days',
        config: { delayHours: 72 },
      },
      {
        type: 'condition' as const,
        name: 'Check Profile Complete',
        config: {
          field: 'member.profile_complete',
          operator: 'equals',
          value: false,
        },
        branchSteps: [
          {
            condition: 'true',
            steps: [
              {
                type: 'action' as const,
                name: 'Send Reminder Email',
                config: {
                  actionType: 'send_email',
                  template: 'profile_reminder',
                },
              },
            ],
          },
        ],
      },
      {
        type: 'delay' as const,
        name: 'Wait 1 Week',
        config: { delayHours: 168 },
      },
      {
        type: 'action' as const,
        name: 'Send First Newsletter',
        config: {
          actionType: 'send_email',
          template: 'newsletter_first',
        },
      },
    ],
  },
  {
    name: 'Dues Payment Reminder',
    description: 'Automated reminder sequence for overdue dues',
    category: 'financial',
    triggerType: 'schedule' as const,
    triggerConfig: { cron: '0 9 * * 1' }, // Every Monday at 9am
    steps: [
      {
        type: 'action' as const,
        name: 'Query Overdue Members',
        config: {
          actionType: 'query_database',
          query: 'SELECT * FROM members WHERE dues_status = \'overdue\'',
        },
      },
      {
        type: 'loop' as const,
        name: 'For Each Member',
        config: { iterator: 'members' },
        steps: [
          {
            type: 'condition' as const,
            name: 'Check Days Overdue',
            config: {
              field: 'member.days_overdue',
              operator: 'greater_than',
              value: 30,
            },
            branchSteps: [
              {
                condition: 'true',
                steps: [
                  {
                    type: 'action' as const,
                    name: 'Send Final Notice',
                    config: {
                      actionType: 'send_email',
                      template: 'dues_final_notice',
                    },
                  },
                  {
                    type: 'action' as const,
                    name: 'Create Task for Treasurer',
                    config: {
                      actionType: 'create_task',
                      title: 'Review overdue account',
                    },
                  },
                ],
              },
              {
                condition: 'false',
                steps: [
                  {
                    type: 'action' as const,
                    name: 'Send Reminder Email',
                    config: {
                      actionType: 'send_email',
                      template: 'dues_reminder',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Grievance Workflow',
    description: 'Automated grievance processing and tracking',
    category: 'grievances',
    triggerType: 'event' as const,
    triggerConfig: { event: 'grievance.created' },
    steps: [
      {
        type: 'action' as const,
        name: 'Notify Shop Steward',
        config: {
          actionType: 'send_email',
          template: 'grievance_assignment',
          to: '{{steward.email}}',
        },
      },
      {
        type: 'action' as const,
        name: 'Create Task',
        config: {
          actionType: 'create_task',
          title: 'Review new grievance',
          assignedTo: '{{steward.id}}',
          dueInDays: 3,
        },
      },
      {
        type: 'delay' as const,
        name: 'Wait 3 Days',
        config: { delayHours: 72 },
      },
      {
        type: 'condition' as const,
        name: 'Check Status',
        config: {
          field: 'grievance.status',
          operator: 'equals',
          value: 'pending',
        },
        branchSteps: [
          {
            condition: 'true',
            steps: [
              {
                type: 'action' as const,
                name: 'Escalate to Chief Steward',
                config: {
                  actionType: 'update_record',
                  table: 'grievances',
                  updates: { assigned_to: 'chief_steward' },
                },
              },
              {
                type: 'action' as const,
                name: 'Send Escalation Email',
                config: {
                  actionType: 'send_email',
                  template: 'grievance_escalation',
                },
              },
            ],
          },
        ],
      },
    ],
  },
];

const STEP_TYPES = [
  { type: 'action', label: 'Action', icon: Zap, color: 'bg-blue-500' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'bg-purple-500' },
  { type: 'delay', label: 'Delay', icon: Clock, color: 'bg-yellow-500' },
  { type: 'loop', label: 'Loop', icon: Copy, color: 'bg-green-500' },
];

const ACTION_TYPES = [
  { type: 'send_email', label: 'Send Email', icon: Mail },
  { type: 'send_sms', label: 'Send SMS', icon: MessageSquare },
  { type: 'send_push_notification', label: 'Push Notification', icon: Smartphone },
  { type: 'create_task', label: 'Create Task', icon: CheckCircle },
  { type: 'update_record', label: 'Update Record', icon: Database },
  { type: 'trigger_webhook', label: 'Trigger Webhook', icon: Webhook },
  { type: 'query_database', label: 'Query Database', icon: Database },
];

const TRIGGER_TYPES = [
  { type: 'schedule', label: 'Schedule (Cron)', icon: Clock },
  { type: 'event', label: 'Event', icon: Zap },
  { type: 'webhook', label: 'Webhook', icon: Webhook },
  { type: 'manual', label: 'Manual', icon: Play },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals (=)' },
  { value: 'not_equals', label: 'Not Equals (â‰ )' },
  { value: 'greater_than', label: 'Greater Than (>)' },
  { value: 'less_than', label: 'Less Than (<)' },
  { value: 'contains', label: 'Contains (âˆ‹)' },
  { value: 'is_null', label: 'Is Null (âˆ…)' },
  { value: 'is_not_null', label: 'Is Not Null (â‰ âˆ…)' },
];

export default function AutomationWorkflowBuilder() {
  const [workflow, setWorkflow] = useState<AutomationWorkflow>({
    name: '',
    description: '',
    category: 'general',
    triggerType: 'schedule',
    triggerConfig: {},
    isEnabled: true,
    steps: [],
    variables: {},
  });

  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  // Add new step
  const addStep = (type: WorkflowStep['type']) => {
    const newStep: WorkflowStep = {
      // eslint-disable-next-line react-hooks/purity
      id: Math.random().toString(36).substr(2, 9),
      stepNumber: workflow.steps.length + 1,
      type,
      name: '',
      config: {},
    };
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] });
    setSelectedStep(newStep.id);
  };

  // Remove step
  const removeStep = (id: string) => {
    const updatedSteps = workflow.steps
      .filter(s => s.id !== id)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setWorkflow({ ...workflow, steps: updatedSteps });
    if (selectedStep === id) {
      setSelectedStep(null);
    }
  };

  // Update step
  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.map(s => s.id === id ? { ...s, ...updates } : s),
    });
  };

  // Move step
  const _moveStep = (id: string, direction: 'up' | 'down') => {
    const index = workflow.steps.findIndex(s => s.id === id);
    if ((direction === 'up' && index <= 0) || (direction === 'down' && index >= workflow.steps.length - 1)) {
      return;
    }

    const newSteps = [...workflow.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    
    // Update step numbers
    newSteps[index].stepNumber = index + 1;
    newSteps[targetIndex].stepNumber = targetIndex + 1;

    setWorkflow({ ...workflow, steps: newSteps });
  };

  // Load template
  const loadTemplate = (templateIndex: number) => {
    const template = WORKFLOW_TEMPLATES[templateIndex];
    setWorkflow({
      ...workflow,
      name: template.name,
      description: template.description,
      category: template.category,
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig,
      steps: template.steps.map((step, idx) => ({
        ...step,
        id: Math.random().toString(36).substr(2, 9),
        stepNumber: idx + 1,
      })) as WorkflowStep[],
    });
  };

  // Save workflow
  const saveWorkflow = () => {
// API call would go here
  };

  // Test workflow
  const testWorkflow = () => {
// API call would go here
  };

  // Get selected step
  const currentStep = workflow.steps.find(s => s.id === selectedStep);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automation Workflow Builder</h1>
          <p className="text-muted-foreground mt-1">
            Create complex automated workflows with triggers, conditions, and actions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testWorkflow}>
            <Play className="h-4 w-4 mr-2" />
            Test Workflow
          </Button>
          <Button onClick={saveWorkflow}>
            <Save className="h-4 w-4 mr-2" />
            Save Workflow
          </Button>
        </div>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Templates</CardTitle>
          <CardDescription>Load a pre-configured automation workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            {WORKFLOW_TEMPLATES.map((template, idx) => (
              <Card key={idx} className="cursor-pointer hover:bg-gray-50" onClick={() => loadTemplate(idx)}>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-1">{template.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                  <div className="flex gap-2">
                    <Badge variant="outline">{template.steps.length} steps</Badge>
                    <Badge variant="outline">{template.triggerType}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Panel: Workflow Configuration */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Workflow Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div>
              <Label>Workflow Name *</Label>
              <Input
                placeholder="e.g., New Member Onboarding"
                value={workflow.name}
                onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this workflow does"
                value={workflow.description}
                onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Category</Label>
              <select
                value={workflow.category}
                onChange={(e) => setWorkflow({ ...workflow, category: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="general">General</option>
                <option value="membership">Membership</option>
                <option value="financial">Financial</option>
                <option value="grievances">Grievances</option>
                <option value="training">Training</option>
                <option value="organizing">Organizing</option>
              </select>
            </div>

            <div className="border-t pt-4">
              <Label>Trigger Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {TRIGGER_TYPES.map(({ type, label, icon: Icon }) => (
                  <Button
                    key={type}
                    variant={workflow.triggerType === type ? 'default' : 'outline'}
                    size="sm"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={() => setWorkflow({ ...workflow, triggerType: type as any, triggerConfig: {} })}
                    className="justify-start"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Trigger Configuration */}
            <div>
              {workflow.triggerType === 'schedule' && (
                <>
                  <Label>Cron Expression</Label>
                  <Input
                    placeholder="e.g., 0 9 * * 1 (Every Monday 9am)"
                    value={workflow.triggerConfig.cron || ''}
                    onChange={(e) => setWorkflow({
                      ...workflow,
                      triggerConfig: { ...workflow.triggerConfig, cron: e.target.value },
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use cron syntax: minute hour day month weekday
                  </p>
                </>
              )}

              {workflow.triggerType === 'event' && (
                <>
                  <Label>Event Name</Label>
                  <select
                    value={workflow.triggerConfig.event || ''}
                    onChange={(e) => setWorkflow({
                      ...workflow,
                      triggerConfig: { ...workflow.triggerConfig, event: e.target.value },
                    })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">Select event...</option>
                    <option value="member.created">Member Created</option>
                    <option value="member.updated">Member Updated</option>
                    <option value="grievance.created">Grievance Created</option>
                    <option value="contract.expiring">Contract Expiring</option>
                    <option value="dues.overdue">Dues Overdue</option>
                  </select>
                </>
              )}

              {workflow.triggerType === 'webhook' && (
                <>
                  <Label>Webhook Path</Label>
                  <Input
                    placeholder="/webhooks/my-workflow"
                    value={workflow.triggerConfig.path || ''}
                    onChange={(e) => setWorkflow({
                      ...workflow,
                      triggerConfig: { ...workflow.triggerConfig, path: e.target.value },
                    })}
                  />
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label>Workflow Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Enable or disable this workflow
                </p>
              </div>
              <Switch
                checked={workflow.isEnabled}
                onCheckedChange={(checked) => setWorkflow({ ...workflow, isEnabled: checked })}
              />
            </div>

            <div className="border-t pt-4">
              <Label className="mb-2 block">Add Step</Label>
              <div className="grid grid-cols-2 gap-2">
                {STEP_TYPES.map(({ type, label, icon: _Icon, color }) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={() => addStep(type as any)}
                    className="justify-start"
                  >
                    <div className={`h-2 w-2 rounded-full ${color} mr-2`} />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Middle Panel: Workflow Steps */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Workflow Steps ({workflow.steps.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {workflow.steps.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Zap className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-muted-foreground mb-1">No steps yet</p>
                <p className="text-sm text-muted-foreground">Add steps to build your workflow</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workflow.steps.map((step, idx) => {
                  const StepIcon = STEP_TYPES.find(t => t.type === step.type)?.icon || Zap;
                  const stepColor = STEP_TYPES.find(t => t.type === step.type)?.color || 'bg-gray-500';
                  const isSelected = selectedStep === step.id;

                  return (
                    <div key={step.id}>
                      <Card
                        className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
                        onClick={() => setSelectedStep(step.id)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded ${stepColor} text-white`}>
                              <StepIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-500">
                                  Step {step.stepNumber}
                                </span>
                                <Badge variant="outline" className="capitalize">
                                  {step.type}
                                </Badge>
                              </div>
                              <p className="font-medium truncate">
                                {step.name || `Untitled ${step.type}`}
                              </p>
                              {step.config.actionType && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {ACTION_TYPES.find(a => a.type === step.config.actionType)?.label}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStep(step.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {idx < workflow.steps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <ArrowDown className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel: Step Configuration */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Step Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {!currentStep ? (
              <div className="text-center py-12 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>Select a step to configure</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Step Name</Label>
                  <Input
                    placeholder="e.g., Send Welcome Email"
                    value={currentStep.name}
                    onChange={(e) => updateStep(currentStep.id, { name: e.target.value })}
                  />
                </div>

                {/* Action Type Configuration */}
                {currentStep.type === 'action' && (
                  <>
                    <div>
                      <Label>Action Type</Label>
                      <select
                        value={currentStep.config.actionType || ''}
                        onChange={(e) => updateStep(currentStep.id, {
                          config: { actionType: e.target.value },
                        })}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="">Select action...</option>
                        {ACTION_TYPES.map(at => (
                          <option key={at.type} value={at.type}>{at.label}</option>
                        ))}
                      </select>
                    </div>

                    {currentStep.config.actionType === 'send_email' && (
                      <>
                        <div>
                          <Label>Email Template</Label>
                          <Input
                            placeholder="template_name"
                            value={currentStep.config.template || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, template: e.target.value },
                            })}
                          />
                        </div>
                        <div>
                          <Label>Recipient</Label>
                          <Input
                            placeholder="{{member.email}}"
                            value={currentStep.config.to || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, to: e.target.value },
                            })}
                          />
                        </div>
                      </>
                    )}

                    {currentStep.config.actionType === 'send_sms' && (
                      <>
                        <div>
                          <Label>Message</Label>
                          <Textarea
                            placeholder="SMS message content"
                            value={currentStep.config.message || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, message: e.target.value },
                            })}
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Recipient Phone</Label>
                          <Input
                            placeholder="{{member.phone}}"
                            value={currentStep.config.to || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, to: e.target.value },
                            })}
                          />
                        </div>
                      </>
                    )}

                    {currentStep.config.actionType === 'create_task' && (
                      <>
                        <div>
                          <Label>Task Title</Label>
                          <Input
                            placeholder="Task title"
                            value={currentStep.config.title || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, title: e.target.value },
                            })}
                          />
                        </div>
                        <div>
                          <Label>Assigned To</Label>
                          <Input
                            placeholder="{{steward.id}}"
                            value={currentStep.config.assignedTo || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, assignedTo: e.target.value },
                            })}
                          />
                        </div>
                        <div>
                          <Label>Due In (Days)</Label>
                          <Input
                            type="number"
                            placeholder="3"
                            value={currentStep.config.dueInDays || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, dueInDays: parseInt(e.target.value) },
                            })}
                          />
                        </div>
                      </>
                    )}

                    {currentStep.config.actionType === 'update_record' && (
                      <>
                        <div>
                          <Label>Table</Label>
                          <Input
                            placeholder="e.g., members"
                            value={currentStep.config.table || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, table: e.target.value },
                            })}
                          />
                        </div>
                        <div>
                          <Label>Updates (JSON)</Label>
                          <Textarea
                            placeholder='{"status": "active"}'
                            value={JSON.stringify(currentStep.config.updates || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const updates = JSON.parse(e.target.value);
                                updateStep(currentStep.id, {
                                  config: { ...currentStep.config, updates },
                                });
                              } catch {}
                            }}
                            rows={4}
                          />
                        </div>
                      </>
                    )}

                    {currentStep.config.actionType === 'trigger_webhook' && (
                      <>
                        <div>
                          <Label>Webhook URL</Label>
                          <Input
                            placeholder="https://api.example.com/webhook"
                            value={currentStep.config.url || ''}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, url: e.target.value },
                            })}
                          />
                        </div>
                        <div>
                          <Label>HTTP Method</Label>
                          <select
                            value={currentStep.config.method || 'POST'}
                            onChange={(e) => updateStep(currentStep.id, {
                              config: { ...currentStep.config, method: e.target.value },
                            })}
                            className="w-full border rounded-md px-3 py-2"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                          </select>
                        </div>
                      </>
                    )}

                    {currentStep.config.actionType === 'query_database' && (
                      <div>
                        <Label>SQL Query</Label>
                        <Textarea
                          placeholder="SELECT * FROM members WHERE..."
                          value={currentStep.config.query || ''}
                          onChange={(e) => updateStep(currentStep.id, {
                            config: { ...currentStep.config, query: e.target.value },
                          })}
                          rows={4}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Condition Type Configuration */}
                {currentStep.type === 'condition' && (
                  <>
                    <div>
                      <Label>Field Path</Label>
                      <Input
                        placeholder="e.g., member.status"
                        value={currentStep.config.field || ''}
                        onChange={(e) => updateStep(currentStep.id, {
                          config: { ...currentStep.config, field: e.target.value },
                        })}
                      />
                    </div>
                    <div>
                      <Label>Operator</Label>
                      <select
                        value={currentStep.config.operator || ''}
                        onChange={(e) => updateStep(currentStep.id, {
                          config: { ...currentStep.config, operator: e.target.value },
                        })}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="">Select operator...</option>
                        {CONDITION_OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Value</Label>
                      <Input
                        placeholder="Comparison value"
                        value={currentStep.config.value || ''}
                        onChange={(e) => updateStep(currentStep.id, {
                          config: { ...currentStep.config, value: e.target.value },
                        })}
                      />
                    </div>
                  </>
                )}

                {/* Delay Type Configuration */}
                {currentStep.type === 'delay' && (
                  <>
                    <div>
                      <Label>Delay Duration (Hours)</Label>
                      <Input
                        type="number"
                        placeholder="24"
                        value={currentStep.config.delayHours || ''}
                        onChange={(e) => updateStep(currentStep.id, {
                          config: { ...currentStep.config, delayHours: parseInt(e.target.value) },
                        })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentStep.config.delayHours ? 
                          `Wait ${currentStep.config.delayHours} hours (${(currentStep.config.delayHours / 24).toFixed(1)} days)` :
                          'Enter delay in hours'}
                      </p>
                    </div>
                  </>
                )}

                {/* Loop Type Configuration */}
                {currentStep.type === 'loop' && (
                  <>
                    <div>
                      <Label>Iterator Variable</Label>
                      <Input
                        placeholder="e.g., members"
                        value={currentStep.config.iterator || ''}
                        onChange={(e) => updateStep(currentStep.id, {
                          config: { ...currentStep.config, iterator: e.target.value },
                        })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Variable containing array to iterate over
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Workflow Summary */}
      {workflow.steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Steps</p>
                <p className="text-2xl font-bold">{workflow.steps.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actions</p>
                <p className="text-2xl font-bold">
                  {workflow.steps.filter(s => s.type === 'action').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conditions</p>
                <p className="text-2xl font-bold">
                  {workflow.steps.filter(s => s.type === 'condition').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delays</p>
                <p className="text-2xl font-bold">
                  {workflow.steps.filter(s => s.type === 'delay').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

