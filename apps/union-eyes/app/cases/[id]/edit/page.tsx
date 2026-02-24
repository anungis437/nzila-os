/**
 * Edit Case Page
 * 
 * Edit existing grievance/case information
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { ArrowLeft, Save } from 'lucide-react';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/index';

interface CaseFormData {
  memberId: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  status: string;
  incidentDate: string;
  location: string;
  witnesses: string;
  desiredOutcome: string;
  assignedTo: string;
}

export default function EditCasePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<CaseFormData>({
    memberId: '',
    type: '',
    priority: '',
    title: '',
    description: '',
    status: '',
    incidentDate: '',
    location: '',
    witnesses: '',
    desiredOutcome: '',
    assignedTo: '',
  });

  useEffect(() => {
    fetchCase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchCase = async () => {
    try {
      const _data = await api.cases.get(params.id);
      
      // Mock data
      setFormData({
        memberId: 'MEM-123',
        type: 'disciplinary',
        priority: 'high',
        title: 'Unfair Suspension',
        description: 'Member was suspended without proper investigation...',
        status: 'investigation',
        incidentDate: '2024-02-01',
        location: 'Production Floor A',
        witnesses: 'John Doe, Jane Smith',
        desiredOutcome: 'Reinstatement with back pay',
        assignedTo: 'steward-1',
      });
    } catch (error) {
      logger.error('Error fetching case', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof CaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.cases.update(params.id, formData);
      alert('Case updated successfully!');
      router.push(`/cases/${params.id}`);
    } catch (error) {
      logger.error('Error updating case', error);
      alert('Error updating case. Please try again.');
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Case</h1>
          <p className="text-muted-foreground">Update case information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Case Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => updateField('type', value)}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disciplinary">Disciplinary Action</SelectItem>
                    <SelectItem value="safety">Workplace Safety</SelectItem>
                    <SelectItem value="harassment">Harassment</SelectItem>
                    <SelectItem value="termination">Termination</SelectItem>
                    <SelectItem value="wages">Wages & Benefits</SelectItem>
                    <SelectItem value="discrimination">Discrimination</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => updateField('priority', value)}
                >
                  <SelectTrigger id="priority">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateField('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intake">Intake</SelectItem>
                    <SelectItem value="investigation">Investigation</SelectItem>
                    <SelectItem value="arbitration">Arbitration</SelectItem>
                    <SelectItem value="mediation">Mediation</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(value) => updateField('assignedTo', value)}
                >
                  <SelectTrigger id="assignedTo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steward-1">Chief Steward - John Doe</SelectItem>
                    <SelectItem value="steward-2">Steward - Jane Smith</SelectItem>
                    <SelectItem value="steward-3">Steward - Bob Johnson</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Case Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Brief description of the case"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detailed Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Detailed description of the case..."
                rows={6}
                required
              />
            </div>
          </div>
        </Card>

        {/* Incident Details */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Incident Details</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incidentDate">Incident Date</Label>
                <Input
                  id="incidentDate"
                  type="date"
                  value={formData.incidentDate}
                  onChange={(e) => updateField('incidentDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="Where did the incident occur?"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="witnesses">Witnesses</Label>
              <Textarea
                id="witnesses"
                value={formData.witnesses}
                onChange={(e) => updateField('witnesses', e.target.value)}
                placeholder="List any witnesses (names, contact information)"
                rows={3}
              />
            </div>
          </div>
        </Card>

        {/* Resolution */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Resolution</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="desiredOutcome">Desired Outcome</Label>
              <Textarea
                id="desiredOutcome"
                value={formData.desiredOutcome}
                onChange={(e) => updateField('desiredOutcome', e.target.value)}
                placeholder="What resolution are we seeking?"
                rows={4}
              />
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
