# Zoho Integration — Environment Variables

All Zoho-related env vars required for the Shop Quoter integration.

## Required

| Variable | Description | Example |
|---|---|---|
| `ZOHO_CLIENT_ID` | OAuth 2.0 Client ID from Zoho API Console | `1000.XXXX...` |
| `ZOHO_CLIENT_SECRET` | OAuth 2.0 Client Secret from Zoho API Console | `abcdef1234...` |
| `ZOHO_ORG_ID` | Nzila org ID used as the scope for synced records | `org-uuid-here` |
| `ZOHO_REDIRECT_URI` | OAuth redirect URI registered in Zoho API Console | `https://app.example.com/api/zoho/callback` |

## Optional

| Variable | Description | Default |
|---|---|---|
| `ZOHO_WEBHOOK_TOKEN` | Secret token for validating incoming webhook requests | _(empty — webhook token validation disabled)_ |
| `ZOHO_API_SERVER` | Zoho API base URL (varies by data center) | `https://www.zohoapis.com` |
| `ZOHO_ACCOUNTS_SERVER` | Zoho accounts server for OAuth token exchange | `https://accounts.zoho.com` |

## Setup Steps

1. Go to [Zoho API Console](https://api-console.zoho.com/) and create a Server-based Application.
2. Set the redirect URI to your app's callback endpoint.
3. Copy `Client ID` and `Client Secret` into your `.env`.
4. Generate an authorization code by visiting:
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.ALL&client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=YOUR_REDIRECT_URI&access_type=offline
   ```
5. Exchange the code for tokens via the OAuth client in code, or manually via:
   ```
   curl -X POST https://accounts.zoho.com/oauth/v2/token \
     -d "grant_type=authorization_code&client_id=...&client_secret=...&redirect_uri=...&code=..."
   ```

## Webhook Setup

1. In Zoho CRM, go to **Settings → Developer Space → Webhooks**.
2. Create a webhook pointing to `https://your-domain.com/api/zoho/webhook`.
3. Set the token to match `ZOHO_WEBHOOK_TOKEN`.
4. Select modules: **Contacts** and **Deals**.
5. Select events: **Create**, **Edit**, **Delete**.

## Data Center Mapping

| Region | API Server | Accounts Server |
|---|---|---|
| US | `https://www.zohoapis.com` | `https://accounts.zoho.com` |
| EU | `https://www.zohoapis.eu` | `https://accounts.zoho.eu` |
| IN | `https://www.zohoapis.in` | `https://accounts.zoho.in` |
| AU | `https://www.zohoapis.com.au` | `https://accounts.zoho.com.au` |
| CN | `https://www.zohoapis.com.cn` | `https://accounts.zoho.com.cn` |
| JP | `https://www.zohoapis.jp` | `https://accounts.zoho.jp` |
