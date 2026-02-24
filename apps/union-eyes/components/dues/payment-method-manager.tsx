'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  bankName?: string;
  isDefault: boolean;
}

interface PaymentMethodManagerProps {
  userId: string;
  autoPayEnabled: boolean;
  onUpdate: () => void;
}

export default function PaymentMethodManager({ 
  userId, 
  autoPayEnabled: initialAutoPay,
  onUpdate 
}: PaymentMethodManagerProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [autoPayEnabled, setAutoPayEnabled] = useState(initialAutoPay);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadPaymentMethods = useCallback(async () => {
    try {
      const response = await fetch(`/api/dues/payment-methods?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to load payment methods');
      const data = await response.json();
      setPaymentMethods(data);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load payment methods',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  const handleAddPaymentMethod = async () => {
    toast({
      title: 'Coming Soon',
      description: 'Add payment method functionality will be implemented',
    });
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    try {
      const response = await fetch(`/api/dues/payment-methods/${methodId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete payment method');
      
      toast({
        title: 'Success',
        description: 'Payment method removed',
      });
      
      loadPaymentMethods();
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to delete payment method',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      const response = await fetch(`/api/dues/payment-methods/${methodId}/set-default`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to set default payment method');
      
      toast({
        title: 'Success',
        description: 'Default payment method updated',
      });
      
      loadPaymentMethods();
      onUpdate();
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to update default payment method',
        variant: 'destructive',
      });
    }
  };

  const handleAutoPayToggle = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/dues/autopay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, enabled }),
      });
      
      if (!response.ok) throw new Error('Failed to update autopay');
      
      setAutoPayEnabled(enabled);
      toast({
        title: 'Success',
        description: `AutoPay ${enabled ? 'enabled' : 'disabled'}`,
      });
      
      onUpdate();
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to update AutoPay setting',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="text-center p-12">Loading payment methods...</div>;
  }

  return (
    <div className="space-y-6">
      {/* AutoPay Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AutoPay Settings</CardTitle>
          <CardDescription>
            Automatically pay your dues on the due date
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable AutoPay</Label>
              <p className="text-sm text-muted-foreground">
                Your default payment method will be charged automatically
              </p>
            </div>
            <Switch
              checked={autoPayEnabled}
              onCheckedChange={handleAutoPayToggle}
              disabled={paymentMethods.length === 0}
            />
          </div>
          
          {paymentMethods.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add a payment method to enable AutoPay
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>
              Manage your saved payment methods
            </CardDescription>
          </div>
          <Button onClick={handleAddPaymentMethod}>
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </Button>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No payment methods saved</p>
              <Button onClick={handleAddPaymentMethod} variant="outline" className="mt-4">
                Add Your First Payment Method
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {method.type === 'card' 
                            ? `${method.brand} ****${method.last4}`
                            : `${method.bankName} ****${method.last4}`
                          }
                        </p>
                        {method.isDefault && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </div>
                      {method.type === 'card' && method.expiryMonth && method.expiryYear && (
                        <p className="text-sm text-muted-foreground">
                          Expires {method.expiryMonth}/{method.expiryYear}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Set as Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePaymentMethod(method.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

