
import { NextResponse } from "next/server";
import { DEFAULT_REDIRECT_URL } from "../webhooks/utils/constants";
import { requireUser } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';

/** The one origin an absolute post-payment redirect may name: the application's own. */
function trustedRedirectOrigin(defaultRedirectUrl: string): string | null {
  for (const candidate of [defaultRedirectUrl, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // A relative default carries no origin; try the next source.
    }
  }
  return null;
}
/**
 * API endpoint to create a Whop checkout session with properly structured metadata
 * This ensures the auth userId is included in the membership metadata and will
 * be present in webhook events
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - You must be logged in" },
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { planId, redirectUrl } = await req.json();
    
    if (!planId) {
      return NextResponse.json(
        { error: "Missing required parameter: planId" },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const apiKey = process.env.WHOP_API_KEY;
    if (!apiKey) {
      logger.error('WHOP_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: "Server configuration error: Missing API key" },
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Determine plan duration based on planId. Only the configured plans may be sold through this route: the plan
    // id is client-supplied and Whop would otherwise open a checkout for any plan the account owns.
    const monthlyPlanId = process.env.WHOP_PLAN_ID_MONTHLY;
    const yearlyPlanId = process.env.WHOP_PLAN_ID_YEARLY;
    let planDuration = "monthly"; // Default

    if (planId === yearlyPlanId) {
      planDuration = "yearly";
    } else if (planId === monthlyPlanId) {
      planDuration = "monthly";
    } else {
      return NextResponse.json(
        { error: "Unknown plan" },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Use the constant from constants.ts instead of hardcoded URL
    const defaultRedirectUrl = DEFAULT_REDIRECT_URL;
    
    // The post-payment redirect may only point back into this application: an absolute URL on any other origin
    // would turn a paid checkout into an open redirect, so it falls back to the default.
    let validRedirectUrl = defaultRedirectUrl;
    
    if (typeof redirectUrl === 'string' && redirectUrl) {
      try {
        const trustedOrigin = trustedRedirectOrigin(defaultRedirectUrl);
        if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
          validRedirectUrl = `${new URL(defaultRedirectUrl).origin}${redirectUrl}`;
        } else if (redirectUrl.includes('://')) {
          const parsed = new URL(redirectUrl);
          if (trustedOrigin && parsed.origin === trustedOrigin) {
            validRedirectUrl = redirectUrl;
          } else {
            logger.warn('Redirect URL is outside the application origin, using default', { redirectOrigin: parsed.origin });
          }
        } else {
          logger.warn('Invalid redirect URL format, using default', { redirectUrl });
        }
      } catch (error) {
        logger.error('Error validating redirect URL', error as Error, { redirectUrl });
        validRedirectUrl = defaultRedirectUrl;
      }
    }
    
    // Add a clean return parameter that doesn&apos;t include any auth parameters
    // This helps prevent cookie overloading issues
    if (validRedirectUrl.includes('?')) {
      // Already has query parameters, add payment success and cache buster
      validRedirectUrl = `${validRedirectUrl}&payment=success&cb=${Date.now().toString().slice(-4)}`;
    } else {
      // No existing parameters, add payment success and cache buster
      validRedirectUrl = `${validRedirectUrl}?payment=success&cb=${Date.now().toString().slice(-4)}`;
    }
    
    // Create a checkout session directly using fetch
    const response = await fetch("https://api.whop.com/api/v2/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        plan_id: planId,
        redirect_url: validRedirectUrl,
        metadata: {
          // Informational only. Checkout metadata must never establish membership or
          // authority; any downstream consumer has to map it to an authenticated principal.
          // `clerkUserId` is the pre-rename key, emitted unchanged until the (out-of-repo)
          // fulfilment consumer is confirmed to read `userId`.
          userId,
          clerkUserId: userId,
          planDuration: planDuration
        },
        d2c: true // Direct to checkout
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || errorData.message || 'Unknown error from Whop API';
      logger.error('Failed to create Whop checkout', undefined, { status: response.status, error: errorMessage });
      
      return NextResponse.json(
        { 
          error: 'Failed to create checkout',
        },
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    logger.info('Whop checkout created', { userId, planId, sessionId: data.id });
    
    // Return the checkout URL to redirect the user
    return NextResponse.json(
      { 
        checkoutUrl: data.purchase_url,
        sessionId: data.id,
        planDuration
      },
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    logger.error('Error creating Whop checkout', error as Error);
    return NextResponse.json(
      { 
        error: "Internal server error"
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 

