/**
 * Submit New Claim Page
 * Form for members to submit new claims
 */
"use client";


export const dynamic = 'force-dynamic';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload } from "lucide-react";

export default function NewClaimPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    claimType: '' as string,
    incidentDate: '',
    description: '',
    location: '',
    desiredOutcome: '',
    witnessesPresent: false,
    witnessDetails: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('../claims');
      } else {
        const data = await response.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? 'Failed to submit claim. Please try again.');
      }
    } catch (_error) {
      setError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Claims
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Submit New Claim</CardTitle>
          <CardDescription>Fill out the form below to submit your grievance or claim</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="claimType">Claim Type *</Label>
              <Select
                value={formData.claimType}
                onValueChange={(value) => setFormData({ ...formData, claimType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select claim type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grievance_discipline">Disciplinary Action (Grievance)</SelectItem>
                  <SelectItem value="grievance_schedule">Scheduling Dispute (Grievance)</SelectItem>
                  <SelectItem value="grievance_pay">Pay Dispute (Grievance)</SelectItem>
                  <SelectItem value="workplace_safety">Workplace Safety</SelectItem>
                  <SelectItem value="discrimination_age">Discrimination — Age</SelectItem>
                  <SelectItem value="discrimination_gender">Discrimination — Gender</SelectItem>
                  <SelectItem value="discrimination_race">Discrimination — Race</SelectItem>
                  <SelectItem value="discrimination_disability">Discrimination — Disability</SelectItem>
                  <SelectItem value="discrimination_other">Discrimination — Other</SelectItem>
                  <SelectItem value="harassment_sexual">Harassment — Sexual</SelectItem>
                  <SelectItem value="harassment_workplace">Harassment — Workplace</SelectItem>
                  <SelectItem value="harassment_verbal">Harassment — Verbal</SelectItem>
                  <SelectItem value="harassment_physical">Harassment — Physical</SelectItem>
                  <SelectItem value="wage_dispute">Wage Dispute</SelectItem>
                  <SelectItem value="contract_dispute">Contract Dispute</SelectItem>
                  <SelectItem value="retaliation">Retaliation</SelectItem>
                  <SelectItem value="wrongful_termination">Wrongful Termination</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="incidentDate">Incident Date *</Label>
              <Input
                id="incidentDate"
                type="date"
                value={formData.incidentDate}
                onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="Where did the incident occur?"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what happened in detail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                required
              />
            </div>

            <div>
              <Label htmlFor="desiredOutcome">Desired Outcome *</Label>
              <Textarea
                id="desiredOutcome"
                placeholder="What outcome are you seeking?"
                value={formData.desiredOutcome}
                onChange={(e) => setFormData({ ...formData, desiredOutcome: e.target.value })}
                rows={3}
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="witnessesPresent"
                  type="checkbox"
                  checked={formData.witnessesPresent}
                  onChange={(e) => setFormData({ ...formData, witnessesPresent: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="witnessesPresent">Were witnesses present?</Label>
              </div>
              {formData.witnessesPresent && (
                <div>
                  <Label htmlFor="witnessDetails">Witness Details</Label>
                  <Textarea
                    id="witnessDetails"
                    placeholder="List any witnesses (names and contact info if available)"
                    value={formData.witnessDetails}
                    onChange={(e) => setFormData({ ...formData, witnessDetails: e.target.value })}
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Supporting Documents</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">Upload any supporting documents or evidence</p>
                <Button type="button" variant="outline" size="sm">
                  Choose Files
                </Button>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? 'Submitting...' : 'Submit Claim'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
