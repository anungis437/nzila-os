'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Heart,
  TrendingUp,
  Users,
  DollarSign,
  Share2,
  Check,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface DonationCampaign {
  id: string;
  title: string;
  slug: string;
  description: string;
  goalAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string | null;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  imageUrl: string | null;
  allowRecurring: boolean;
  allowAnonymous: boolean;
  showDonorNames: boolean;
  suggestedAmounts: number[];
  recentDonors: Array<{
    name: string;
    amount: number;
    timestamp: string;
    isAnonymous: boolean;
  }>;
}

interface DonationPageProps {
  campaignSlug: string;
}

function CheckoutForm({ campaignId, amount, isRecurring }: { campaignId: string; amount: number; isRecurring: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/campaigns/thank-you`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'An error occurred');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Record donation in database
        await fetch('/api/donations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            amount,
            isRecurring,
            stripePaymentIntentId: paymentIntent.id,
          }),
        });

        window.location.href = `/campaigns/thank-you?amount=${amount}`;
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {message && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {message}
        </div>
      )}
      <Button type="submit" disabled={!stripe || isProcessing} className="w-full mt-6" size="lg">
        {isProcessing ? 'Processing...' : `Donate $${amount}`}
      </Button>
    </form>
  );
}

export function PublicDonationPage({ campaignSlug }: DonationPageProps) {
  const [campaign, setCampaign] = useState<DonationCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    fetchCampaign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignSlug]);

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignSlug}`);
      if (!response.ok) throw new Error('Campaign not found');
      const data = await response.json();
      setCampaign(data);
      
      // Set default suggested amount
      if (data.suggestedAmounts?.length > 0) {
        setSelectedAmount(data.suggestedAmounts[1] || data.suggestedAmounts[0]);
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const handleDonateClick = async () => {
    const amount = selectedAmount || parseFloat(customAmount);
    if (!amount || amount <= 0) return;

    try {
      // Create payment intent
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount * 100, // Convert to cents
          campaignId: campaign?.id,
          isRecurring,
        }),
      });

      const data = await response.json();
      setClientSecret(data.clientSecret);
      setShowCheckout(true);
    } catch (_error) {
}
  };

  const progressPercentage = campaign
    ? Math.min((campaign.currentAmount / campaign.goalAmount) * 100, 100)
    : 0;

  const daysRemaining = campaign?.endDate
    ? Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Skeleton className="h-64 w-full mb-8" />
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Skeleton className="h-48 w-full" />
          </div>
          <div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Campaign Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The campaign you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Button onClick={() => window.location.href = '/campaigns'}>
          View All Campaigns
        </Button>
      </div>
    );
  }

  const donationAmount = selectedAmount || parseFloat(customAmount) || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      {campaign.imageUrl && (
        <div
          className="h-64 bg-cover bg-center relative"
          style={{ backgroundImage: `url(${campaign.imageUrl})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Left Column - Campaign Info */}
          <div className="md:col-span-2">
            <div className="mb-6">
              <h1 className="text-4xl font-bold mb-3">{campaign.title}</h1>
              <p className="text-lg text-muted-foreground">{campaign.description}</p>
            </div>

            {/* Progress Card */}
            <Card className="p-6 mb-8">
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <div className="text-3xl font-bold">
                    ${campaign.currentAmount.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">
                    of ${campaign.goalAmount.toLocaleString()} goal
                  </div>
                </div>
                <Progress value={progressPercentage} className="h-3" />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{Math.round(progressPercentage)}%</div>
                  <div className="text-sm text-muted-foreground">Funded</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{campaign.recentDonors.length}</div>
                  <div className="text-sm text-muted-foreground">Donors</div>
                </div>
                {daysRemaining !== null && (
                  <div>
                    <div className="text-2xl font-bold">{daysRemaining}</div>
                    <div className="text-sm text-muted-foreground">Days Left</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Donors */}
            {campaign.showDonorNames && campaign.recentDonors.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recent Donors
                </h2>
                <div className="space-y-3">
                  {campaign.recentDonors.slice(0, 10).map((donor, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Heart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {donor.isAnonymous ? 'Anonymous' : donor.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(donor.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-primary">
                        ${donor.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right Column - Donation Form */}
          <div>
            <Card className="p-6 sticky top-4">
              {!showCheckout ? (
                <>
                  <h2 className="text-2xl font-bold mb-6">Make a Donation</h2>

                  {/* Suggested Amounts */}
                  {campaign.suggestedAmounts && campaign.suggestedAmounts.length > 0 && (
                    <div className="mb-6">
                      <label className="text-sm font-medium mb-3 block">
                        Select Amount
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {campaign.suggestedAmounts.map((amount) => (
                          <Button
                            key={amount}
                            variant={selectedAmount === amount ? 'default' : 'outline'}
                            onClick={() => {
                              setSelectedAmount(amount);
                              setCustomAmount('');
                            }}
                            className="h-16 text-lg"
                          >
                            ${amount}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Amount */}
                  <div className="mb-6">
                    <label className="text-sm font-medium mb-2 block">
                      Or Enter Custom Amount
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setSelectedAmount(null);
                        }}
                        placeholder="Enter amount"
                        className="w-full pl-10 pr-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Recurring Option */}
                  {campaign.allowRecurring && (
                    <div className="mb-6">
                      <label className="flex items-center gap-3 p-4 border rounded-md cursor-pointer hover:bg-accent transition-colors">
                        <input
                          type="checkbox"
                          checked={isRecurring}
                          onChange={(e) => setIsRecurring(e.target.checked)}
                          className="h-5 w-5"
                        />
                        <div className="flex-1">
                          <div className="font-medium">Make this monthly</div>
                          <div className="text-sm text-muted-foreground">
                            Sustain our cause with recurring support
                          </div>
                        </div>
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </label>
                    </div>
                  )}

                  {/* Donate Button */}
                  <Button
                    size="lg"
                    className="w-full mb-4"
                    onClick={handleDonateClick}
                    disabled={donationAmount <= 0}
                  >
                    <Heart className="h-5 w-5 mr-2" />
                    Donate ${donationAmount.toFixed(2)}
                    {isRecurring && '/month'}
                  </Button>

                  {/* Share */}
                  <Button variant="outline" className="w-full" onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: campaign.title,
                        text: campaign.description,
                        url: window.location.href,
                      });
                    }
                  }}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Campaign
                  </Button>

                  {/* Security Note */}
                  <div className="mt-6 text-xs text-muted-foreground text-center">
                    <Check className="h-4 w-4 inline mr-1" />
                    Secure payment powered by Stripe
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-6">Complete Your Donation</h2>
                  <div className="mb-6 p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Amount:</span>
                      <span className="text-xl font-bold">${donationAmount.toFixed(2)}</span>
                    </div>
                    {isRecurring && (
                      <div className="text-sm text-muted-foreground">
                        Billed monthly until cancelled
                      </div>
                    )}
                  </div>

                  {clientSecret && (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <CheckoutForm
                        campaignId={campaign.id}
                        amount={donationAmount}
                        isRecurring={isRecurring}
                      />
                    </Elements>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full mt-4"
                    onClick={() => setShowCheckout(false)}
                  >
                    â† Back
                  </Button>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

