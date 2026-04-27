/**
 * Create New Field Note Page
 * 
 * Form for creating a new field note about a member interaction
 * 
 * Phase 4: Communications & Organizing - Organizer Workflows UI
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export const dynamic = 'force-dynamic';
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
  const t = useTranslations('organizingNotesNewPage');
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
            <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
            <p className="text-gray-600 mt-1">{t('pageDescription')}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.back()}>
            {t('cancelButton')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? t('savingButton') : t('saveNoteButton')}
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
          <CardTitle>{t('basicInformationTitle')}</CardTitle>
          <CardDescription>{t('basicInformationDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="memberId">{t('memberIdLabel')}</Label>
              <Input
                id="memberId"
                placeholder={t('memberIdPlaceholder')}
                value={formData.memberId}
                onChange={(e) => updateFormData({ memberId: e.target.value })}
              />
              <p className="text-sm text-gray-500">
                {t('memberIdHelper')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interactionDate">{t('interactionDateLabel')}</Label>
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
              <Label htmlFor="noteType">{t('noteTypeLabel')}</Label>
              <Select 
                value={formData.noteType} 
                onValueChange={(value) => updateFormData({ noteType: value })}
              >
                <SelectTrigger id="noteType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">{t('noteTypeContact')}</SelectItem>
                  <SelectItem value="grievance">{t('noteTypeGrievance')}</SelectItem>
                  <SelectItem value="organizing">{t('noteTypeOrganizing')}</SelectItem>
                  <SelectItem value="meeting">{t('noteTypeMeeting')}</SelectItem>
                  <SelectItem value="personal">{t('noteTypePersonal')}</SelectItem>
                  <SelectItem value="workplace">{t('noteTypeWorkplace')}</SelectItem>
                  <SelectItem value="follow_up">{t('noteTypeFollowUp')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sentiment">{t('sentimentLabel')}</Label>
              <Select
                value={formData.sentiment}
                onValueChange={(value) => updateFormData({ sentiment: value })}
              >
                <SelectTrigger id="sentiment">
                  <SelectValue placeholder={t('sentimentPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('sentimentNone')}</SelectItem>
                  <SelectItem value="positive">{t('sentimentPositive')}</SelectItem>
                  <SelectItem value="neutral">{t('sentimentNeutral')}</SelectItem>
                  <SelectItem value="negative">{t('sentimentNegative')}</SelectItem>
                  <SelectItem value="concerned">{t('sentimentConcerned')}</SelectItem>
                  <SelectItem value="engaged">{t('sentimentEngaged')}</SelectItem>
                  <SelectItem value="disengaged">{t('sentimentDisengaged')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t('noteContentTitle')}</CardTitle>
          <CardDescription>{t('noteContentDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">{t('subjectLabel')}</Label>
            <Input
              id="subject"
              placeholder={t('subjectPlaceholder')}
              value={formData.subject}
              onChange={(e) => updateFormData({ subject: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">{t('contentLabel')}</Label>
            <Textarea
              id="content"
              placeholder={t('contentPlaceholder')}
              rows={8}
              value={formData.content}
              onChange={(e) => updateFormData({ content: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="engagementLevel">{t('engagementLevelLabel')}</Label>
            <Select 
              value={formData.engagementLevel?.toString() || ''} 
              onValueChange={(value) => updateFormData({ engagementLevel: value ? parseInt(value) : null })}
            >
              <SelectTrigger id="engagementLevel">
                  <SelectValue placeholder={t('engagementLevelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('engagementNotRated')}</SelectItem>
                <SelectItem value="1">{t('engagementVeryLow')}</SelectItem>
                <SelectItem value="2">{t('engagementLow')}</SelectItem>
                <SelectItem value="3">{t('engagementModerate')}</SelectItem>
                <SelectItem value="4">{t('engagementHigh')}</SelectItem>
                <SelectItem value="5">{t('engagementVeryHigh')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up */}
      <Card>
        <CardHeader>
          <CardTitle>{t('followUpTitle')}</CardTitle>
          <CardDescription>{t('followUpDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="followUpDate">{t('followUpDateLabel')}</Label>
            <Input
              id="followUpDate"
              type="date"
              value={formData.followUpDate}
              onChange={(e) => updateFormData({ followUpDate: e.target.value })}
            />
            <p className="text-sm text-gray-500">
              {t('followUpDateHelper')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tagsTitle')}</CardTitle>
          <CardDescription>{t('tagsDesc')}</CardDescription>
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
              placeholder={t('addTagPlaceholder')}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              {t('addTagButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('privacyTitle')}</CardTitle>
          <CardDescription>{t('privacyDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isPrivate">{t('privateNoteLabel')}</Label>
              <p className="text-sm text-gray-500">{t('privateNoteHelper')}</p>
            </div>
            <Switch
              id="isPrivate"
              checked={formData.isPrivate}
              onCheckedChange={(checked) => updateFormData({ isPrivate: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isConfidential">{t('confidentialLabel')}</Label>
              <p className="text-sm text-gray-500">{t('confidentialHelper')}</p>
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
