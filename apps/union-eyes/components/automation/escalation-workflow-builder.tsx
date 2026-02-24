"use client";

/**
 * Escalation Workflow Builder Component
 * 
 * Visual builder for creating multi-step escalation workflows with time delays,
 * escalation levels, and conditional routing.
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
  Plus, 
  Trash2, 
  Save,
  ArrowDown,
  ArrowUp,
  Clock,
  Users,
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  AlertTriangle,
  CheckCircle,
  TrendingUp
} from 'lucide-react';

// Types
interface EscalationLevel {
  id: string;
  level: number;
  name: string;
  delayMinutes: number;
  delayHours: number;
  delayDays: number;
  recipients: string[];
  recipientType: 'user' | 'role' | 'email';
  actions: EscalationAction[];
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  autoEscalate: boolean;
  escalationCondition?: string;
}

interface EscalationAction {
  id: string;
  type: 'send_email' | 'send_sms' | 'send_push_notification' | 'create_task' | 'trigger_webhook';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
}

interface EscalationWorkflow {
  name: string;
  description: string;
  category: string;
  isEnabled: boolean;
  levels: EscalationLevel[];
  autoResolveOnAction: boolean;
  maxEscalationLevel?: number;
}

// Pre-built escalation workflow templates
const ESCALATION_TEMPLATES = [
  {
    name: 'Grievance Escalation',
    description: 'Multi-level escalation for unresolved grievances',
    category: 'grievances',
    levels: [
      {
        level: 1,
        name: 'Shop Steward',
        delayMinutes: 0,
        delayHours: 0,
        delayDays: 1,
        recipients: ['shop_stewards'],
        recipientType: 'role' as const,
        severity: 'medium' as const,
        actions: [
          {
            type: 'send_email' as const,
            config: { template: 'grievance_assignment', includeDetails: true },
          },
        ],
        autoEscalate: true,
        escalationCondition: 'no_response_24h',
      },
      {
        level: 2,
        name: 'Chief Steward',
        delayMinutes: 0,
        delayHours: 0,
        delayDays: 2,
        recipients: ['chief_stewards'],
        recipientType: 'role' as const,
        severity: 'high' as const,
        actions: [
          {
            type: 'send_email' as const,
            config: { template: 'grievance_escalation_level2', urgent: true },
          },
          {
            type: 'send_sms' as const,
            config: { message: 'Urgent: Grievance requires immediate attention' },
          },
        ],
        autoEscalate: true,
        escalationCondition: 'no_resolution_48h',
      },
      {
        level: 3,
        name: 'Union President',
        delayMinutes: 0,
        delayHours: 0,
        delayDays: 3,
        recipients: ['union_president'],
        recipientType: 'role' as const,
        severity: 'critical' as const,
        actions: [
          {
            type: 'send_email' as const,
            config: { template: 'grievance_escalation_critical', urgent: true },
          },
          {
            type: 'send_sms' as const,
            config: { message: 'CRITICAL: Grievance escalated to presidential review' },
          },
          {
            type: 'create_task' as const,
            config: { title: 'Critical grievance review', priority: 'urgent' },
          },
        ],
        autoEscalate: false,
      },
    ],
  },
  {
    name: 'Contract Expiration',
    description: 'Escalating alerts for contract negotiations',
    category: 'contract_management',
    levels: [
      {
        level: 1,
        name: 'Bargaining Committee',
        delayMinutes: 0,
        delayHours: 0,
        delayDays: 90,
        recipients: ['bargaining_committee'],
        recipientType: 'role' as const,
        severity: 'low' as const,
        actions: [
          {
            type: 'send_email' as const,
            config: { template: 'contract_90_day_notice' },
          },
        ],
        autoEscalate: true,
      },
      {
        level: 2,
        name: 'Executive Board',
        delayMinutes: 0,
        delayHours: 0,
        delayDays: 60,
        recipients: ['executive_board'],
        recipientType: 'role' as const,
        severity: 'medium' as const,
        actions: [
          {
            type: 'send_email' as const,
            config: { template: 'contract_60_day_notice', urgent: true },
          },
          {
            type: 'create_task' as const,
            config: { title: 'Schedule bargaining sessions', priority: 'high' },
          },
        ],
        autoEscalate: true,
      },
      {
        level: 3,
        name: 'All Members',
        delayMinutes: 0,
        delayHours: 0,
        delayDays: 30,
        recipients: ['all_members'],
        recipientType: 'role' as const,
        severity: 'high' as const,
        actions: [
          {
            type: 'send_email' as const,
            config: { template: 'contract_30_day_critical', urgent: true },
          },
          {
            type: 'send_push_notification' as const,
            config: { title: 'Contract expiring in 30 days', urgent: true },
          },
        ],
        autoEscalate: false,
      },
    ],
  },
];

const ACTION_TYPES = [
  { type: 'send_email', label: 'Send Email', icon: Mail },
  { type: 'send_sms', label: 'Send SMS', icon: MessageSquare },
  { type: 'send_push_notification', label: 'Push Notification', icon: Smartphone },
  { type: 'create_task', label: 'Create Task', icon: CheckCircle },
  { type: 'trigger_webhook', label: 'Trigger Webhook', icon: Bell },
];

const SEVERITY_LEVELS = [
  { value: 'info', label: 'Info', color: 'bg-gray-500' },
  { value: 'low', label: 'Low', color: 'bg-blue-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

const RECIPIENT_TYPES = [
  { value: 'user', label: 'Specific Users' },
  { value: 'role', label: 'User Role' },
  { value: 'email', label: 'Email Addresses' },
];

export default function EscalationWorkflowBuilder() {
  const [workflow, setWorkflow] = useState<EscalationWorkflow>({
    name: '',
    description: '',
    category: 'general',
    isEnabled: true,
    levels: [],
    autoResolveOnAction: false,
  });

  // Add new escalation level
  const addLevel = () => {
    const newLevel: EscalationLevel = {
      id: Math.random().toString(36).substr(2, 9),
      level: workflow.levels.length + 1,
      name: '',
      delayMinutes: 0,
      delayHours: 0,
      delayDays: 0,
      recipients: [],
      recipientType: 'role',
      actions: [],
      severity: 'medium',
      autoEscalate: true,
    };
    setWorkflow({ ...workflow, levels: [...workflow.levels, newLevel] });
  };

  // Remove escalation level
  const removeLevel = (id: string) => {
    const updatedLevels = workflow.levels
      .filter(l => l.id !== id)
      .map((l, idx) => ({ ...l, level: idx + 1 }));
    setWorkflow({ ...workflow, levels: updatedLevels });
  };

  // Update escalation level
  const updateLevel = (id: string, updates: Partial<EscalationLevel>) => {
    setWorkflow({
      ...workflow,
      levels: workflow.levels.map(l => l.id === id ? { ...l, ...updates } : l),
    });
  };

  // Move level up
  const moveLevelUp = (id: string) => {
    const index = workflow.levels.findIndex(l => l.id === id);
    if (index <= 0) return;

    const newLevels = [...workflow.levels];
    [newLevels[index - 1], newLevels[index]] = [newLevels[index], newLevels[index - 1]];
    
    // Update level numbers
    newLevels[index - 1].level = index;
    newLevels[index].level = index + 1;

    setWorkflow({ ...workflow, levels: newLevels });
  };

  // Move level down
  const moveLevelDown = (id: string) => {
    const index = workflow.levels.findIndex(l => l.id === id);
    if (index >= workflow.levels.length - 1) return;

    const newLevels = [...workflow.levels];
    [newLevels[index], newLevels[index + 1]] = [newLevels[index + 1], newLevels[index]];
    
    // Update level numbers
    newLevels[index].level = index + 1;
    newLevels[index + 1].level = index + 2;

    setWorkflow({ ...workflow, levels: newLevels });
  };

  // Add action to level
  const addAction = (levelId: string) => {
    const newAction: EscalationAction = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'send_email',
      config: {},
    };

    updateLevel(levelId, {
      actions: [...(workflow.levels.find(l => l.id === levelId)?.actions || []), newAction],
    });
  };

  // Remove action from level
  const removeAction = (levelId: string, actionId: string) => {
    const level = workflow.levels.find(l => l.id === levelId);
    if (!level) return;

    updateLevel(levelId, {
      actions: level.actions.filter(a => a.id !== actionId),
    });
  };

  // Update action
  const updateAction = (levelId: string, actionId: string, updates: Partial<EscalationAction>) => {
    const level = workflow.levels.find(l => l.id === levelId);
    if (!level) return;

    updateLevel(levelId, {
      actions: level.actions.map(a => a.id === actionId ? { ...a, ...updates } : a),
    });
  };

  // Load template
  const loadTemplate = (templateIndex: number) => {
    const template = ESCALATION_TEMPLATES[templateIndex];
    setWorkflow({
      ...workflow,
      name: template.name,
      description: template.description,
      category: template.category,
      levels: template.levels.map((level, idx) => ({
        ...level,
        id: Math.random().toString(36).substr(2, 9),
        level: idx + 1,
        actions: level.actions.map(action => ({
          ...action,
          id: Math.random().toString(36).substr(2, 9),
        })),
      })),
    });
  };

  // Save workflow
  const saveWorkflow = () => {
// API call would go here
  };

  // Calculate total delay for a level
  const calculateTotalDelay = (level: EscalationLevel) => {
    const totalMinutes = level.delayMinutes + (level.delayHours * 60) + (level.delayDays * 24 * 60);
    
    if (totalMinutes === 0) return 'Immediate';
    if (totalMinutes < 60) return `${totalMinutes} minutes`;
    if (totalMinutes < 1440) return `${Math.floor(totalMinutes / 60)} hours`;
    return `${Math.floor(totalMinutes / 1440)} days`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Escalation Workflow Builder</h1>
          <p className="text-muted-foreground mt-1">
            Create multi-level escalation workflows with automatic progression
          </p>
        </div>
        <Button onClick={saveWorkflow}>
          <Save className="h-4 w-4 mr-2" />
          Save Workflow
        </Button>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Templates</CardTitle>
          <CardDescription>Load a pre-configured escalation workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {ESCALATION_TEMPLATES.map((template, idx) => (
              <Card key={idx} className="cursor-pointer hover:bg-gray-50" onClick={() => loadTemplate(idx)}>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-1">{template.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                  <Badge variant="outline">{template.levels.length} levels</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Workflow Name *</Label>
              <Input
                placeholder="e.g., Grievance Escalation"
                value={workflow.name}
                onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
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
                <option value="grievances">Grievances</option>
                <option value="contract_management">Contract Management</option>
                <option value="financial">Financial</option>
                <option value="training">Training</option>
                <option value="membership">Membership</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="Describe when and how this escalation workflow should be used"
              value={workflow.description}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-resolve on Action</Label>
              <p className="text-sm text-muted-foreground">
                Automatically mark issue as resolved when any action is taken
              </p>
            </div>
            <Switch
              checked={workflow.autoResolveOnAction}
              onCheckedChange={(checked) => setWorkflow({ ...workflow, autoResolveOnAction: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Workflow Enabled</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable this escalation workflow
              </p>
            </div>
            <Switch
              checked={workflow.isEnabled}
              onCheckedChange={(checked) => setWorkflow({ ...workflow, isEnabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Escalation Levels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Escalation Levels</CardTitle>
              <CardDescription>Define the progression of escalation steps</CardDescription>
            </div>
            <Button onClick={addLevel}>
              <Plus className="h-4 w-4 mr-2" />
              Add Level
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {workflow.levels.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p className="text-muted-foreground">No escalation levels yet</p>
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              <p className="text-sm text-muted-foreground">Click "Add Level" to create your first escalation step</p>
            </div>
          ) : (
            workflow.levels.map((level, idx) => {
              const SeverityLevel = SEVERITY_LEVELS.find(s => s.value === level.severity);

              return (
                <div key={level.id}>
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={SeverityLevel?.color}>
                            Level {level.level}
                          </Badge>
                          <Input
                            placeholder="Level name (e.g., Shop Steward)"
                            value={level.name}
                            onChange={(e) => updateLevel(level.id, { name: e.target.value })}
                            className="w-64"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveLevelUp(level.id)}
                            disabled={idx === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveLevelDown(level.id)}
                            disabled={idx === workflow.levels.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLevel(level.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Delay Configuration */}
                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4" />
                          Escalation Delay
                        </Label>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Input
                              type="number"
                              placeholder="Days"
                              value={level.delayDays}
                              onChange={(e) => updateLevel(level.id, { delayDays: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Days</p>
                          </div>
                          <div>
                            <Input
                              type="number"
                              placeholder="Hours"
                              value={level.delayHours}
                              onChange={(e) => updateLevel(level.id, { delayHours: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Hours</p>
                          </div>
                          <div>
                            <Input
                              type="number"
                              placeholder="Minutes"
                              value={level.delayMinutes}
                              onChange={(e) => updateLevel(level.id, { delayMinutes: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Minutes</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Total delay: <strong>{calculateTotalDelay(level)}</strong>
                        </p>
                      </div>

                      {/* Severity & Recipients */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Severity Level</Label>
                          <select
                            value={level.severity}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onChange={(e) => updateLevel(level.id, { severity: e.target.value as any })}
                            className="w-full border rounded-md px-3 py-2"
                          >
                            {SEVERITY_LEVELS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label>Recipient Type</Label>
                          <select
                            value={level.recipientType}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onChange={(e) => updateLevel(level.id, { recipientType: e.target.value as any })}
                            className="w-full border rounded-md px-3 py-2"
                          >
                            {RECIPIENT_TYPES.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Recipients */}
                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4" />
                          Recipients
                        </Label>
                        <Input
                          placeholder={
                            level.recipientType === 'role' 
                              ? 'Enter roles (comma-separated)'
                              : level.recipientType === 'email'
                              ? 'Enter email addresses (comma-separated)'
                              : 'Enter user IDs (comma-separated)'
                          }
                          value={level.recipients.join(', ')}
                          onChange={(e) => updateLevel(level.id, { 
                            recipients: e.target.value.split(',').map(r => r.trim()).filter(Boolean) 
                          })}
                        />
                      </div>

                      {/* Auto-escalation */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Auto-Escalate to Next Level</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically escalate if no action is taken
                          </p>
                        </div>
                        <Switch
                          checked={level.autoEscalate}
                          onCheckedChange={(checked) => updateLevel(level.id, { autoEscalate: checked })}
                        />
                      </div>

                      {level.autoEscalate && (
                        <div>
                          <Label>Escalation Condition</Label>
                          <Input
                            placeholder="e.g., no_response_24h"
                            value={level.escalationCondition || ''}
                            onChange={(e) => updateLevel(level.id, { escalationCondition: e.target.value })}
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Label>Actions</Label>
                          <Button size="sm" variant="outline" onClick={() => addAction(level.id)}>
                            <Plus className="h-3 w-3 mr-1" />
                            Add Action
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {level.actions.map((action) => {
                            const ActionIcon = ACTION_TYPES.find(a => a.type === action.type)?.icon || Bell;

                            return (
                              <Card key={action.id}>
                                <CardContent className="pt-4">
                                  <div className="flex items-start gap-3">
                                    <ActionIcon className="h-5 w-5 mt-1 text-gray-600" />
                                    <div className="flex-1 space-y-2">
                                      <select
                                        value={action.type}
                                        onChange={(e) => updateAction(level.id, action.id, { 
                                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                          type: e.target.value as any,
                                          config: {},
                                        })}
                                        className="w-full border rounded-md px-3 py-2"
                                      >
                                        {ACTION_TYPES.map(at => (
                                          <option key={at.type} value={at.type}>{at.label}</option>
                                        ))}
                                      </select>

                                      {/* Action-specific configuration */}
                                      {action.type === 'send_email' && (
                                        <Input
                                          placeholder="Email template name"
                                          value={action.config.template || ''}
                                          onChange={(e) => updateAction(level.id, action.id, {
                                            config: { ...action.config, template: e.target.value },
                                          })}
                                        />
                                      )}

                                      {action.type === 'send_sms' && (
                                        <Textarea
                                          placeholder="SMS message content"
                                          value={action.config.message || ''}
                                          onChange={(e) => updateAction(level.id, action.id, {
                                            config: { ...action.config, message: e.target.value },
                                          })}
                                          rows={2}
                                        />
                                      )}

                                      {action.type === 'send_push_notification' && (
                                        <>
                                          <Input
                                            placeholder="Notification title"
                                            value={action.config.title || ''}
                                            onChange={(e) => updateAction(level.id, action.id, {
                                              config: { ...action.config, title: e.target.value },
                                            })}
                                          />
                                          <Input
                                            placeholder="Notification body"
                                            value={action.config.body || ''}
                                            onChange={(e) => updateAction(level.id, action.id, {
                                              config: { ...action.config, body: e.target.value },
                                            })}
                                          />
                                        </>
                                      )}

                                      {action.type === 'create_task' && (
                                        <>
                                          <Input
                                            placeholder="Task title"
                                            value={action.config.title || ''}
                                            onChange={(e) => updateAction(level.id, action.id, {
                                              config: { ...action.config, title: e.target.value },
                                            })}
                                          />
                                          <select
                                            value={action.config.priority || 'medium'}
                                            onChange={(e) => updateAction(level.id, action.id, {
                                              config: { ...action.config, priority: e.target.value },
                                            })}
                                            className="w-full border rounded-md px-3 py-2"
                                          >
                                            <option value="low">Low Priority</option>
                                            <option value="medium">Medium Priority</option>
                                            <option value="high">High Priority</option>
                                            <option value="urgent">Urgent</option>
                                          </select>
                                        </>
                                      )}

                                      {action.type === 'trigger_webhook' && (
                                        <>
                                          <Input
                                            placeholder="Webhook URL"
                                            value={action.config.url || ''}
                                            onChange={(e) => updateAction(level.id, action.id, {
                                              config: { ...action.config, url: e.target.value },
                                            })}
                                          />
                                          <select
                                            value={action.config.method || 'POST'}
                                            onChange={(e) => updateAction(level.id, action.id, {
                                              config: { ...action.config, method: e.target.value },
                                            })}
                                            className="w-full border rounded-md px-3 py-2"
                                          >
                                            <option value="GET">GET</option>
                                            <option value="POST">POST</option>
                                            <option value="PUT">PUT</option>
                                            <option value="PATCH">PATCH</option>
                                          </select>
                                        </>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeAction(level.id, action.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}

                          {level.actions.length === 0 && (
                            <div className="text-center py-4 border-2 border-dashed rounded-lg">
                              <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                              <p className="text-sm text-muted-foreground">No actions configured</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Show arrow between levels */}
                  {idx < workflow.levels.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Workflow Summary */}
      {workflow.levels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Levels:</span>
                <span className="font-medium">{workflow.levels.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Actions:</span>
                <span className="font-medium">
                  {workflow.levels.reduce((sum, l) => sum + l.actions.length, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maximum Escalation Time:</span>
                <span className="font-medium">
                  {calculateTotalDelay(workflow.levels[workflow.levels.length - 1])}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-Escalation Enabled:</span>
                <span className="font-medium">
                  {workflow.levels.filter(l => l.autoEscalate).length} of {workflow.levels.length} levels
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

