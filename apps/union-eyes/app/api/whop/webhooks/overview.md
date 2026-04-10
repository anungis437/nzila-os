Payment Success Flow
User subscribes and successfully pays on Whop
Whop sends a webhook event to route.ts
route.ts sees it's a payment success event and calls payment-handlers.ts
payment-handlers.ts uses user-utils.ts to find the user's Entra ID
payment-handlers.ts uses plan-utils.ts to figure out if it's a monthly or yearly plan
payment-handlers.ts prepares all the subscription details (PRO status, 1000 credits, billing dates)
payment-handlers.ts calls profiles-queries.ts to update the user's profile in the database
payment-handlers.ts calls path-utils.ts to refresh the dashboard and other pages
User sees their PRO status and new credits immediately

Cancellation Flow
User cancels their subscription on Whop
Whop sends a webhook event to route.ts
route.ts sees it's a membership cancellation and calls membership-handlers.ts
membership-handlers.ts uses user-utils.ts to find the user's Entra ID
membership-handlers.ts checks if the user's billing period has already ended:
If not ended: Marks as "canceled" but keeps PRO features until billing period ends
If already ended: Immediately downgrades to FREE and resets credits to 5
membership-handlers.ts calls profiles-queries.ts to update the user's profile
membership-handlers.ts calls path-utils.ts to refresh the dashboard
User sees their updated status (either "Canceled - Access until [date]" or downgraded to FREE)
The whop-actions.ts file provides server actions for other parts of the app to check subscription status, but isn't directly part of the webhook flow. The webhooks update the database directly through profiles-queries.ts without going through the actions files.
