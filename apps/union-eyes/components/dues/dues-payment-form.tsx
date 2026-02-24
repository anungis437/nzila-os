'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/lib/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
 
 
import { Alert, AlertDescription } from '@/components/ui/alert';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface DuesPaymentFormProps {
  userId: string;
  currentBalance: number;
  overdueAmount: number;
  onPaymentComplete: () => void;
}

function PaymentForm({
  userId: _userId,
  currentBalance,
  overdueAmount,
  onPaymentComplete,
  clientSecret: _clientSecret,
}: DuesPaymentFormProps & { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentType, setPaymentType] = useState<'current' | 'overdue' | 'custom'>('current');
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const getPaymentAmount = () => {
    switch (paymentType) {
      case 'overdue':
        return overdueAmount;
      case 'custom':
        return parseFloat(customAmount) || 0;
      default:
        return currentBalance;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    const amount = getPaymentAmount();
    if (amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Confirm payment with Stripe
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Failed to submit payment');
        setProcessing(false);
        return;
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/dues/success`,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
        toast({
          title: 'Payment Failed',
          description: confirmError.message,
          variant: 'destructive',
        });
      } else {
        // Payment succeeded
        toast({
          title: 'Payment Successful',
          description: `${formatCurrency(amount)} has been paid`,
        });
        onPaymentComplete();
      }

    } catch (_error) {
setError('An unexpected error occurred');
      toast({
        title: 'Payment Failed',
        description: 'There was an error processing your payment',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Make a Payment</CardTitle>
        <CardDescription>
          Pay your union dues securely using credit card or ACH
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Label>Payment Amount</Label>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <RadioGroup value={paymentType} onValueChange={(val) => setPaymentType(val as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="current" id="current" />
                <Label htmlFor="current" className="font-normal">
                  Current Balance ({formatCurrency(currentBalance)})
                </Label>
              </div>
              
              {overdueAmount > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="overdue" id="overdue" />
                  <Label htmlFor="overdue" className="font-normal">
                    Overdue Amount ({formatCurrency(overdueAmount)})
                  </Label>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal">
                  Custom Amount
                </Label>
              </div>
            </RadioGroup>

            {paymentType === 'custom' && (
              <div className="ml-6">
                <Label htmlFor="customAmount">Enter Amount</Label>
                <Input
                  id="customAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <Label>Payment Method</Label>
            <div className="border rounded-lg p-4">
              <PaymentElement options={{
                layout: 'tabs',
                wallets: { applePay: 'auto', googlePay: 'auto' }
              }} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Amount to pay</p>
              <p className="text-2xl font-bold">{formatCurrency(getPaymentAmount())}</p>
            </div>
            <Button type="submit" size="lg" disabled={processing || getPaymentAmount() <= 0}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${formatCurrency(getPaymentAmount())}`
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function DuesPaymentForm(props: DuesPaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Don&apos;t initialize if balance is 0 or negative, or if we already have an error
    if (props.currentBalance <= 0 || initError) {
      setLoading(false);
      return;
    }

    const initializePayment = async () => {
      try {
        const response = await fetch('/api/dues/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: props.userId,
            amount: props.currentBalance,
          }),
        });

        if (!response.ok) {
          setInitError(true);
          throw new Error('Failed to initialize payment');
        }

        const { clientSecret } = await response.json();
        setClientSecret(clientSecret);
      } catch (_error) {
setInitError(true);
        toast({
          title: 'Error',
          description: 'Failed to initialize payment form',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
    // Only run once on mount or when userId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Make a Payment</CardTitle>
          <CardDescription>
            Pay your union dues securely using credit card or ACH
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show message if balance is zero or negative
  if (props.currentBalance <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Make a Payment</CardTitle>
          <CardDescription>
            Pay your union dues securely using credit card or ACH
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have no outstanding balance. No payment is required at this time.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!clientSecret) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Make a Payment</CardTitle>
          <CardDescription>
            Pay your union dues securely using credit card or ACH
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Unable to load payment form. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements 
      stripe={stripePromise} 
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#0066cc',
          },
        },
      }}
    >
      <PaymentForm {...props} clientSecret={clientSecret} />
    </Elements>
  );
}

