export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Settings, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { testShopifyConnection } from '@/lib/services/rewards/shopify-service';
import { TestConnectionButton } from '@/components/rewards/admin/test-connection-button';

export const metadata: Metadata = {
  title: 'Shopify Configuration | Admin',
  description: 'Configure Shop Moi Ça integration for rewards redemption',
};

export default async function AdminShopifyPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const t = await getTranslations('rewards.admin.shopify');

  // Check environment configuration
  const shopifyEnabled = process.env.SHOPIFY_ENABLED === 'true';
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const hasStorefrontToken = !!process.env.SHOPIFY_STOREFRONT_TOKEN;
  const hasAdminToken = !!process.env.SHOPIFY_ADMIN_TOKEN;
  const hasWebhookSecret = !!process.env.SHOPIFY_WEBHOOK_SECRET;

  const isFullyConfigured = shopifyEnabled && shopDomain && hasStorefrontToken && hasAdminToken && hasWebhookSecret;

  // Test connection if fully configured
  let connectionStatus: 'success' | 'error' | 'unknown' = 'unknown';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shopInfo: any = null;

  if (isFullyConfigured) {
    try {
      shopInfo = await testShopifyConnection();
      connectionStatus = shopInfo ? 'success' : 'error';
    } catch (_error) {
      connectionStatus = 'error';
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div>
        <Link
          href="/dashboard/admin/rewards"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          ← {t('backToAdmin', { defaultValue: 'Back to Admin' })}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('title', { defaultValue: 'Shopify Configuration' })}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('description', {
            defaultValue: 'Configure Shop Moi Ça integration for member redemptions',
          })}
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('status.title', { defaultValue: 'Connection Status' })}
          </CardTitle>
          <CardDescription>
            {t('status.description', {
              defaultValue: 'Current state of Shopify integration',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {connectionStatus === 'success' ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : connectionStatus === 'error' ? (
                <XCircle className="h-6 w-6 text-destructive" />
              ) : (
                <RefreshCw className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {connectionStatus === 'success'
                    ? t('status.connected', { defaultValue: 'Connected' })
                    : connectionStatus === 'error'
                    ? t('status.error', { defaultValue: 'Connection Error' })
                    : t('status.notConfigured', { defaultValue: 'Not Configured' })}
                </p>
                {shopInfo && (
                  <p className="text-sm text-muted-foreground">
                    {shopInfo.name} ({shopInfo.domain})
                  </p>
                )}
              </div>
            </div>
            <TestConnectionButton />
          </div>

          {/* Configuration Checklist */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t('status.checklist', { defaultValue: 'Configuration Checklist' })}
            </p>
            <div className="space-y-2">
              <ConfigItem
                label="SHOPIFY_ENABLED"
                configured={shopifyEnabled}
                t={t}
              />
              <ConfigItem
                label="SHOPIFY_SHOP_DOMAIN"
                configured={!!shopDomain}
                value={shopDomain}
                t={t}
              />
              <ConfigItem
                label="SHOPIFY_STOREFRONT_TOKEN"
                configured={hasStorefrontToken}
                t={t}
              />
              <ConfigItem
                label="SHOPIFY_ADMIN_TOKEN"
                configured={hasAdminToken}
                t={t}
              />
              <ConfigItem
                label="SHOPIFY_WEBHOOK_SECRET"
                configured={hasWebhookSecret}
                t={t}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('webhooks.title', { defaultValue: 'Webhook Configuration' })}
          </CardTitle>
          <CardDescription>
            {t('webhooks.description', {
              defaultValue: 'Configure webhooks in your Shopify admin to receive order updates',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>
              {t('webhooks.instructionsTitle', { defaultValue: 'Setup Instructions' })}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                {t('webhooks.step1', {
                  defaultValue: '1. Go to Shopify Admin → Settings → Notifications',
                })}
              </p>
              <p>
                {t('webhooks.step2', {
                  defaultValue: '2. Scroll to Webhooks section and add the following:',
                })}
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <WebhookEndpoint
              topic="orders/paid"
              url={`${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/integrations/shopify/webhooks`}
              t={t}
            />
            <WebhookEndpoint
              topic="orders/fulfilled"
              url={`${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/integrations/shopify/webhooks`}
              t={t}
            />
            <WebhookEndpoint
              topic="refunds/create"
              url={`${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/integrations/shopify/webhooks`}
              t={t}
            />
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables Help */}
      {!isFullyConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('setup.title', { defaultValue: 'Setup Guide' })}
            </CardTitle>
            <CardDescription>
              {t('setup.description', {
                defaultValue: 'Add these environment variables to your .env file',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
              {`SHOPIFY_ENABLED=true
SHOPIFY_SHOP_DOMAIN=shop-moi-ca.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=your_storefront_token_here
SHOPIFY_ADMIN_TOKEN=your_admin_api_token_here
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here`}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfigItem({
  label,
  configured,
  value,
  t,
}: {
  label: string;
  configured: boolean;
  value?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-md">
      <div className="flex items-center gap-2">
        {configured ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-mono">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-muted-foreground">{value}</span>}
        <Badge variant={configured ? 'default' : 'secondary'}>
          {configured
            ? t('status.configured', { defaultValue: 'Configured' })
            : t('status.missing', { defaultValue: 'Missing' })}
        </Badge>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WebhookEndpoint({ topic, url, t }: { topic: string; url: string; t: any }) {
  return (
    <div className="p-3 border rounded-md space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{topic}</span>
        <Badge variant="outline">POST</Badge>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-x-auto">
          {url}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigator.clipboard.writeText(url)}
        >
          {t('webhooks.copy', { defaultValue: 'Copy' })}
        </Button>
      </div>
    </div>
  );
}
