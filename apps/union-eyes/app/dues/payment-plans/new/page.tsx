/**
 * New Payment Plan Page
 * 
 * Create a payment plan for a member with arrears
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Calculator, Save } from 'lucide-react';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/index';

interface Member {
  id: string;
  name: string;
  memberId: string;
  email: string;
  arrearsAmount: number;
}

export default function NewPaymentPlanPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-6">Loading...</div>}>
      <NewPaymentPlanContent />
    </Suspense>
  );
}

function NewPaymentPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get('memberId');
  const prefilledAmount = searchParams.get('amount');

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    memberId: memberId || '',
    totalAmount: prefilledAmount || '',
    monthlyPayment: '',
    startDate: '',
    duration: '6', // months
    notes: '',
  });
  const [calculatedEndDate, setCalculatedEndDate] = useState('');

  useEffect(() => {
    if (memberId) {
      fetchMember();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  useEffect(() => {
    calculateEndDate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startDate, formData.duration]);

  const fetchMember = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await api.members.get(memberId || '') as Record<string, any>;
      setMember({
        id: data.id,
        name: data.fullName || data.name,
        memberId: data.memberId || memberId || '',
        email: data.email,
        arrearsAmount: data.arrearsAmount || parseFloat(prefilledAmount || '0'),
      });
    } catch (error) {
      logger.error('Error fetching member:', error);
      alert('Error loading member data.');
    } finally {
      setLoading(false);
    }
  };

  const calculateEndDate = () => {
    if (formData.startDate && formData.duration) {
      const start = new Date(formData.startDate);
      start.setMonth(start.getMonth() + parseInt(formData.duration));
      setCalculatedEndDate(start.toISOString().split('T')[0]);
    }
  };

  const calculateMonthlyPayment = () => {
    const total = parseFloat(formData.totalAmount);
    const months = parseInt(formData.duration);
    if (total && months) {
      const monthly = (total / months).toFixed(2);
      updateField('monthlyPayment', monthly);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.dues.paymentPlans.create(formData);
      alert('Payment plan created successfully!');
      router.push('/dues/payment-plans');
    } catch (error) {
      logger.error('Error creating payment plan:', error);
      alert('Error creating payment plan. Please try again.');
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
          <h1 className="text-3xl font-bold">New Payment Plan</h1>
          <p className="text-muted-foreground">
            Create a payment plan to help member catch up on dues
          </p>
        </div>
      </div>

      {member && (
        <Alert>
          <AlertDescription>
            Creating payment plan for <strong>{member.name}</strong> ({member.memberId})
            - Arrears: <strong className="text-red-600">${member.arrearsAmount.toFixed(2)}</strong>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Member Selection */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Member Information</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="memberId">Member</Label>
              <Select
                value={formData.memberId}
                onValueChange={(value) => updateField('memberId', value)}
                disabled={!!memberId}
              >
                <SelectTrigger id="memberId">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEM-456">Jane Doe (MEM-456)</SelectItem>
                  <SelectItem value="MEM-789">Bob Johnson (MEM-789)</SelectItem>
                  <SelectItem value="MEM-101">Sarah Williams (MEM-101)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Payment Details */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total Amount Owed</Label>
                <div className="flex gap-2">
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    value={formData.totalAmount}
                    onChange={(e) => updateField('totalAmount', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={calculateMonthlyPayment}
                    title="Calculate monthly payment"
                  >
                    <Calculator className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyPayment">Monthly Payment</Label>
                <Input
                  id="monthlyPayment"
                  type="number"
                  step="0.01"
                  value={formData.monthlyPayment}
                  onChange={(e) => updateField('monthlyPayment', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (Months)</Label>
                <Select
                  value={formData.duration}
                  onValueChange={(value) => updateField('duration', value)}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 months</SelectItem>
                    <SelectItem value="6">6 months</SelectItem>
                    <SelectItem value="9">9 months</SelectItem>
                    <SelectItem value="12">12 months</SelectItem>
                    <SelectItem value="18">18 months</SelectItem>
                    <SelectItem value="24">24 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Estimated End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={calculatedEndDate}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {formData.totalAmount && formData.monthlyPayment && formData.duration && (
              <Alert>
                <AlertDescription>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Amount</p>
                      <p className="font-bold text-lg">
                        ${parseFloat(formData.totalAmount).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Payment</p>
                      <p className="font-bold text-lg text-green-600">
                        ${parseFloat(formData.monthlyPayment).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Number of Payments</p>
                      <p className="font-bold text-lg">{formData.duration}</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional notes or conditions for this payment plan..."
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
            Create Payment Plan
          </Button>
        </div>
      </form>
    </div>
  );
}
