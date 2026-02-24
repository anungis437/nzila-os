/**
 * New Case Form
 * 
 * Create a new grievance or case
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/index';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';

interface CaseFormData {
  memberId: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  incidentDate: string;
  location: string;
  witnesses: string;
  desiredOutcome: string;
}

export default function NewCasePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CaseFormData>({
    memberId: '',
    type: 'disciplinary',
    priority: 'medium',
    title: '',
    description: '',
    incidentDate: '',
    location: '',
    witnesses: '',
    desiredOutcome: '',
  });

  const updateField = (field: keyof CaseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await api.cases.create(formData);
      alert('Case created successfully!');
      router.push('/cases');
    } catch (error) {
      logger.error('Error creating case', error);
      alert('Error creating case. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Open New Case</h1>
          <p className="text-muted-foreground">
            Create a grievance or member case
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {/* Member Selection */}
          <div className="space-y-2">
            <Label htmlFor="memberId">Member *</Label>
            <Select value={formData.memberId} onValueChange={(v) => updateField('memberId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mem-1">John Smith</SelectItem>
                <SelectItem value="mem-2">Jane Doe</SelectItem>
                <SelectItem value="mem-3">Bob Johnson</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Case Type & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Case Type *</Label>
              <Select value={formData.type} onValueChange={(v) => updateField('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disciplinary">Disciplinary Action</SelectItem>
                  <SelectItem value="workplace_safety">Workplace Safety</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="termination">Termination</SelectItem>
                  <SelectItem value="wages">Wages/Benefits</SelectItem>
                  <SelectItem value="discrimination">Discrimination</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select value={formData.priority} onValueChange={(v) => updateField('priority', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Case Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Brief description of the issue"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Detailed Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Provide a detailed account of the situation, including relevant facts and context..."
              rows={6}
              required
            />
          </div>

          {/* Incident Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="incidentDate">Incident Date *</Label>
              <Input
                id="incidentDate"
                type="date"
                value={formData.incidentDate}
                onChange={(e) => updateField('incidentDate', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="Where did this occur?"
              />
            </div>
          </div>

          {/* Witnesses */}
          <div className="space-y-2">
            <Label htmlFor="witnesses">Witnesses</Label>
            <Textarea
              id="witnesses"
              value={formData.witnesses}
              onChange={(e) => updateField('witnesses', e.target.value)}
              placeholder="List any witnesses (one per line)"
              rows={3}
            />
          </div>

          {/* Desired Outcome */}
          <div className="space-y-2">
            <Label htmlFor="desiredOutcome">Desired Outcome</Label>
            <Textarea
              id="desiredOutcome"
              value={formData.desiredOutcome}
              onChange={(e) => updateField('desiredOutcome', e.target.value)}
              placeholder="What resolution is the member seeking?"
              rows={4}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            Create Case
          </Button>
        </div>
      </form>
    </div>
  );
}
