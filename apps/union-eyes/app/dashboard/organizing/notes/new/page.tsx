/**
 * Create New Field Note Page
 * 
 * Form for creating a new field note about a member interaction
 * 
 * Phase 4: Communications & Organizing - Organizer Workflows UI
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, X } from 'lucide-react';
import { logger } from '@/lib/logger';

interface NoteForm {
  memberId: string;
  noteType: string;
  subject: string;
  content: string;
  sentiment: string;
  engagementLevel: number | null;
  followUpDate: string;
  interactionDate: string;
  tags: string[];
  isPrivate: boolean;
  isConfidential: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export default function NewFieldNotePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<NoteForm>({
    memberId: '',
    noteType: 'contact',
    subject: '',
    content: '',
    sentiment: '',
    engagementLevel: null,
    followUpDate: '',
    interactionDate: new Date().toISOString().split('T')[0],
    tags: [],
    isPrivate: false,
    isConfidential: false,
    metadata: {},
  });

  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateFormData = (updates: Partial<NoteForm>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      updateFormData({ tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateFormData({ tags: formData.tags.filter((t) => t !== tagToRemove) });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.memberId.trim()) {
      setError('Member ID is required');
      return;
    }
    if (!formData.content.trim()) {
      setError('Note content is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/organizing/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        body: JSON.stringify({
          ...formData,
          engagementLevel: formData.engagementLevel || null,
          followUpDate: formData.followUpDate || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create note');
      }

      const note = await response.json();
      router.push(`/dashboard/organizing/notes/${note.id}`);
    } catch (err) {
      logger.error('Error creating note:', err);
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Field Note</h1>
            <p className="text-gray-600 mt-1">Record a member interaction</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Note'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Who and when</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="memberId">Member ID *</Label>
              <Input
                id="memberId"
                placeholder="Enter member user ID"
                value={formData.memberId}
                onChange={(e) => updateFormData({ memberId: e.target.value })}
              />
              <p className="text-sm text-gray-500">
                The Clerk user ID of the member this note is about
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interactionDate">Interaction Date *</Label>
              <Input
                id="interactionDate"
                type="date"
                value={formData.interactionDate}
                onChange={(e) => updateFormData({ interactionDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="noteType">Note Type *</Label>
              <Select 
                value={formData.noteType} 
                onValueChange={(value) => updateFormData({ noteType: value })}
              >
                <SelectTrigger id="noteType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="grievance">Grievance</SelectItem>
                  <SelectItem value="organizing">Organizing</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="workplace">Workplace</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sentiment">Sentiment</Label>
              <Select 
                value={formData.sentiment} 
                onValueChange={(value) => updateFormData({ sentiment: value })}
              >
                <SelectTrigger id="sentiment">
                  <SelectValue placeholder="Select sentiment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="concerned">Concerned</SelectItem>
                  <SelectItem value="engaged">Engaged</SelectItem>
                  <SelectItem value="disengaged">Disengaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note Content */}
      <Card>
        <CardHeader>
          <CardTitle>Note Content</CardTitle>
          <CardDescription>What happened during this interaction</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Brief summary (optional)"
              value={formData.subject}
              onChange={(e) => updateFormData({ subject: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Note Content *</Label>
            <Textarea
              id="content"
              placeholder="Describe the interaction, key points discussed, member concerns, etc."
              rows={8}
              value={formData.content}
              onChange={(e) => updateFormData({ content: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="engagementLevel">Engagement Level (1-5)</Label>
            <Select 
              value={formData.engagementLevel?.toString() || ''} 
              onValueChange={(value) => updateFormData({ engagementLevel: value ? parseInt(value) : null })}
            >
              <SelectTrigger id="engagementLevel">
                <SelectValue placeholder="Select engagement level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Not rated</SelectItem>
                <SelectItem value="1">1 - Very Low</SelectItem>
                <SelectItem value="2">2 - Low</SelectItem>
                <SelectItem value="3">3 - Moderate</SelectItem>
                <SelectItem value="4">4 - High</SelectItem>
                <SelectItem value="5">5 - Very High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up */}
      <Card>
        <CardHeader>
          <CardTitle>Follow-up</CardTitle>
          <CardDescription>Set a reminder to follow up with this member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up Date</Label>
            <Input
              id="followUpDate"
              type="date"
              value={formData.followUpDate}
              onChange={(e) => updateFormData({ followUpDate: e.target.value })}
            />
            <p className="text-sm text-gray-500">
              When should you check in with this member again?
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>Categorize this note for easier searching</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-2 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex space-x-2">
            <Input
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              Add Tag
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
          <CardDescription>Control who can see this note</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isPrivate">Private Note</Label>
              <p className="text-sm text-gray-500">Only you can see this note</p>
            </div>
            <Switch
              id="isPrivate"
              checked={formData.isPrivate}
              onCheckedChange={(checked) => updateFormData({ isPrivate: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isConfidential">Confidential</Label>
              <p className="text-sm text-gray-500">Restricted to authorized users only</p>
            </div>
            <Switch
              id="isConfidential"
              checked={formData.isConfidential}
              onCheckedChange={(checked) => updateFormData({ isConfidential: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
