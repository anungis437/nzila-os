'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/lib/hooks/use-toast';

interface ExpenseRequestFormProps {
  budgetId?: string;
  onSuccess?: () => void;
}

export default function ExpenseRequestForm({ budgetId, onSuccess }: ExpenseRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    expenseDate: new Date().toISOString().split('T')[0],
    accountCode: '',
    budgetId: budgetId || '',
    vendorName: '',
    description: '',
    amount: '',
    taxAmount: '0.00',
    category: '',
    paymentMethod: 'personal_card',
    reimbursementRequired: true,
    receiptUrl: '',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!formData.accountCode || !formData.description || !formData.amount) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/financial/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create expense request');
      }

      const data = await response.json();

      toast({
        title: 'Success',
        description: `Expense request ${data.data.expense.requestNumber} created successfully`,
      });

      // Reset form
      setFormData({
        expenseDate: new Date().toISOString().split('T')[0],
        accountCode: '',
        budgetId: budgetId || '',
        vendorName: '',
        description: '',
        amount: '',
        taxAmount: '0.00',
        category: '',
        paymentMethod: 'personal_card',
        reimbursementRequired: true,
        receiptUrl: '',
        notes: '',
      });

      if (onSuccess) onSuccess();

    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Expense Request</CardTitle>
        <CardDescription>
          Request reimbursement or submit corporate expense for approval
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="expenseDate">Expense Date *</Label>
            <Input
              id="expenseDate"
              type="date"
              value={formData.expenseDate}
              onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="accountCode">Account Code *</Label>
            <Input
              id="accountCode"
              value={formData.accountCode}
              onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
              placeholder="e.g., 5000-100"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Please provide a detailed description of the expense..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="vendorName">Vendor/Merchant</Label>
            <Input
              id="vendorName"
              value={formData.vendorName}
              onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
              placeholder="e.g., Office Depot"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office_supplies">Office Supplies</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="meals">Meals & Entertainment</SelectItem>
                <SelectItem value="professional_services">Professional Services</SelectItem>
                <SelectItem value="utilities">Utilities</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="taxAmount">Tax Amount</Label>
            <Input
              id="taxAmount"
              type="number"
              step="0.01"
              value={formData.taxAmount}
              onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-2">
            <Label>Total</Label>
            <Input
              value={`$${(parseFloat(formData.amount || '0') + parseFloat(formData.taxAmount || '0')).toFixed(2)}`}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="paymentMethod">Payment Method *</Label>
          <Select
            value={formData.paymentMethod}
            onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
          >
            <SelectTrigger id="paymentMethod">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal_card">Personal Credit Card</SelectItem>
              <SelectItem value="corporate_card">Corporate Credit Card</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="check">Check</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="receiptUrl">Receipt URL</Label>
          <Input
            id="receiptUrl"
            type="url"
            value={formData.receiptUrl}
            onChange={(e) => setFormData({ ...formData, receiptUrl: e.target.value })}
            placeholder="https://..."
          />
          <p className="text-xs text-muted-foreground">
            Upload receipt to storage and paste URL here
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional information..."
            rows={2}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSubmit} disabled={loading}>
            Save as Draft
          </Button>
          <Button 
            onClick={async () => {
              await handleSubmit();
              // Auto-submit after creating
            }} 
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
