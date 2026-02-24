/**
 * Poll Creator Component (Phase 5 - Week 2)
 * Create quick polls for member feedback
 * 
 * Features:
 * - Poll question input
 * - Options list (add/remove/reorder)
 * - Settings (multiple votes, authentication, show results)
 * - Close date picker
 * - Save/publish flow
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, GripVertical, Save, Send, Calendar } from 'lucide-react';

interface PollCreatorProps {
  organizationId: string;
  pollId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

interface PollOption {
  id: string;
  text: string;
  order: number;
}

export function PollCreator({ organizationId, pollId, onSave, onCancel }: PollCreatorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Poll data
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<PollOption[]>([
    { id: 'opt1', text: '', order: 0 },
    { id: 'opt2', text: '', order: 1 },
  ]);

  // Settings
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [requireAuthentication, setRequireAuthentication] = useState(true);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(false);
  const [closesAt, setClosesAt] = useState('');

  const addOption = () => {
    const newOption: PollOption = {
      id: `opt${Date.now()}`,
      text: '',
      order: options.length,
    };
    setOptions([...options, newOption]);
  };

  const updateOption = (id: string, text: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, text } : opt)));
  };

  const deleteOption = (id: string) => {
    if (options.length <= 2) {
      toast({
        title: 'Error',
        description: 'Poll must have at least 2 options',
        variant: 'destructive',
      });
      return;
    }
    setOptions(options.filter((opt) => opt.id !== id).map((opt, i) => ({ ...opt, order: i })));
  };

  const _moveOption = (id: string, direction: 'up' | 'down') => {
    const index = options.findIndex((opt) => opt.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === options.length - 1) return;

    const newOptions = [...options];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newOptions[index], newOptions[newIndex]] = [newOptions[newIndex], newOptions[index]];

    setOptions(newOptions.map((opt, i) => ({ ...opt, order: i })));
  };

  const validatePoll = (): boolean => {
    if (!question.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Poll question is required',
        variant: 'destructive',
      });
      return false;
    }

    const validOptions = options.filter((opt) => opt.text.trim());
    if (validOptions.length < 2) {
      toast({
        title: 'Validation Error',
        description: 'Poll must have at least 2 options with text',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleSave = async (publish: boolean = false) => {
    if (!validatePoll()) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/communications/polls', {
        method: pollId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(pollId && { id: pollId }),
          organizationId,
          question,
          description,
          options: options
            .filter((opt) => opt.text.trim())
            .map((opt) => ({ id: opt.id, text: opt.text })),
          allowMultipleVotes,
          requireAuthentication,
          showResultsBeforeVote,
          closesAt: closesAt || null,
          status: publish ? 'active' : 'draft',
        }),
      });

      if (!response.ok) throw new Error('Failed to save poll');

      toast({
        title: 'Success',
        description: publish ? 'Poll published successfully' : 'Poll saved as draft',
      });

      if (onSave) onSave();
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to save poll',
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
          <h2 className="text-2xl font-bold">{pollId ? 'Edit Poll' : 'Create Quick Poll'}</h2>
          <p className="text-muted-foreground">Single-question poll for quick feedback</p>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isSaving}>
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: Poll Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Poll Question</CardTitle>
              <CardDescription>Ask a single, clear question</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Question *</Label>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What would you like to ask?"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {question.length} / 200 characters
                </p>
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide context or additional information..."
                  rows={3}
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Answer Options</CardTitle>
              <CardDescription>Add 2-10 options for voters to choose from</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <div className="cursor-move">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteOption(option.id)}
                    disabled={options.length <= 2}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={options.length >= 10}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Option
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Multiple votes</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow users to vote multiple times
                  </p>
                </div>
                <Switch
                  checked={allowMultipleVotes}
                  onCheckedChange={setAllowMultipleVotes}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require login</Label>
                  <p className="text-xs text-muted-foreground">
                    Users must be authenticated
                  </p>
                </div>
                <Switch
                  checked={requireAuthentication}
                  onCheckedChange={setRequireAuthentication}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show results first</Label>
                  <p className="text-xs text-muted-foreground">
                    Display results before voting
                  </p>
                </div>
                <Switch
                  checked={showResultsBeforeVote}
                  onCheckedChange={setShowResultsBeforeVote}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Close date (optional)</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to keep poll open indefinitely
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold">{question || 'Your question here'}</h4>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
                <div className="space-y-2 mt-4">
                  {options
                    .filter((opt) => opt.text.trim())
                    .map((option) => (
                      <div
                        key={option.id}
                        className="p-2 border rounded bg-background text-sm"
                      >
                        {option.text}
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

