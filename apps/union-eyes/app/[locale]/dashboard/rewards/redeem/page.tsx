export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getBalance } from '@/lib/services/rewards/wallet-service';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, ShoppingCart } from 'lucide-react';
import { RedemptionForm } from '@/components/rewards/redemption-form';

export const metadata: Metadata = {
  title: 'Redeem Credits | Recognition & Rewards',
  description: 'Redeem your reward credits for products and services',
};

export default async function RedeemCreditsPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const t = await getTranslations('rewards');

  // Fetch current balance
  const balance = await getBalance(orgId, userId);

  // Check if Shopify is enabled
  const shopifyEnabled = process.env.SHOPIFY_ENABLED === 'true';

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('redeem.title', { defaultValue: 'Redeem Your Credits' })}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('redeem.description', {
            defaultValue: 'Convert your reward credits into products and services',
          })}
        </p>
      </div>

      {/* Balance Display */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>
          {t('redeem.balanceTitle', { defaultValue: 'Available Balance' })}
        </AlertTitle>
        <AlertDescription>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(t as any)('redeem.balanceMessage', {
            defaultValue: 'You have {balance} credits available to redeem',
            values: { balance: balance.toLocaleString() },
          })}
        </AlertDescription>
      </Alert>

      {/* Redemption Options */}
      {shopifyEnabled ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <CardTitle>
                {t('redeem.shopify.title', { defaultValue: 'Shop Moi Ça Store' })}
              </CardTitle>
            </div>
            <CardDescription>
              {t('redeem.shopify.description', {
                defaultValue: 'Browse our curated collection of products and redeem your credits',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RedemptionForm 
              balance={balance} 
              mode="shopify" 
              userId={userId}
              orgId={orgId}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('redeem.manual.title', { defaultValue: 'Request Redemption' })}
            </CardTitle>
            <CardDescription>
              {t('redeem.manual.description', {
                defaultValue: 'Submit a redemption request and our team will process it',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RedemptionForm 
              balance={balance} 
              mode="manual" 
              userId={userId}
              orgId={orgId}
            />
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('redeem.howItWorks.title', { defaultValue: 'How It Works' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
            <li>
              {t('redeem.howItWorks.step1', {
                defaultValue: 'Select the amount of credits you want to redeem',
              })}
            </li>
            <li>
              {t('redeem.howItWorks.step2', {
                defaultValue: 'Credits are deducted from your balance immediately',
              })}
            </li>
            <li>
              {t('redeem.howItWorks.step3', {
                defaultValue: 'Complete checkout in the Shop Moi Ça store',
              })}
            </li>
            <li>
              {t('redeem.howItWorks.step4', {
                defaultValue: 'Track your order status in your transaction history',
              })}
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
