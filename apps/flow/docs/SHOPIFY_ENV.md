# Shopify Integration — Environment Variables

## Required

| Variable | Description | Example |
|---|---|---|
| `SHOPIFY_SHOP_DOMAIN` | Your myshopify.com domain (without protocol) | `my-store.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Admin API access token from a custom app | `shpat_xxxxxxxxxxxxxxxxxxxx` |

## Optional

| Variable | Description | Default |
|---|---|---|
| `SHOPIFY_WEBHOOK_SECRET` | Webhook HMAC signing secret from Shopify | — |
| `SHOPIFY_API_VERSION` | Admin REST API version | `2024-01` |
| `ORG_ID` | Organisation ID for multi-tenant credential lookup | — |

## Setup Steps

1. **Create a Shopify Custom App**
   - Shopify Admin → Settings → Apps and sales channels → Develop apps
   - Create app → Configure Admin API scopes:
     - `read_products`, `write_products`
     - `read_orders`
     - `read_customers`
   - Install the app and copy the **Admin API access token**

2. **Configure environment**
   ```env
   SHOPIFY_SHOP_DOMAIN=my-store.myshopify.com
   SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxx
   SHOPIFY_WEBHOOK_SECRET=whsec_xxxxxxxxx
   ```

3. **Register webhooks** (optional, for real-time sync)
   - Shopify Admin → Settings → Notifications → Webhooks
   - Add webhook for each topic pointing to `https://your-domain/api/shopify/webhook`
   - Topics: `customers/create`, `customers/update`, `orders/create`, `orders/updated`
   - Copy the signing secret to `SHOPIFY_WEBHOOK_SECRET`

## Database Credentials (multi-tenant)

For production multi-tenant setups, Shopify credentials are stored in the
`commerce_shopify_credentials` table per organisation. The `ShopifySyncService.fromOrg(orgId)`
factory method resolves credentials automatically.

## API Rate Limits

Shopify Admin REST API uses a leaky bucket algorithm:
- **Bucket size**: 40 requests
- **Leak rate**: 2 requests/second
- **Best practice**: Keep calls under 2/s sustained; the client adds `limit=250` where possible to minimise calls
