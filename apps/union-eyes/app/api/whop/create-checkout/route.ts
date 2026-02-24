
import { NextResponse } from "next/server";
import { DEFAULT_REDIRECT_URL } from "../webhooks/utils/constants";
import { requireUser } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';

/**
 * API endpoint to create a Whop checkout session with properly structured metadata
 * This ensures the Clerk userId is included in the membership metadata and will
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

    // Determine plan duration based on planId
    const monthlyPlanId = process.env.WHOP_PLAN_ID_MONTHLY;
    const yearlyPlanId = process.env.WHOP_PLAN_ID_YEARLY;
    let planDuration = "monthly"; // Default

    if (planId === yearlyPlanId) {
      planDuration = "yearly";
    } else if (planId === monthlyPlanId) {
      planDuration = "monthly";
    }
    
    // Use the constant from constants.ts instead of hardcoded URL
    const defaultRedirectUrl = DEFAULT_REDIRECT_URL;
    
    // Validate redirectUrl - ensure it&apos;s a proper URL to prevent ERR_INVALID_URL errors
    let validRedirectUrl = defaultRedirectUrl;
    
    if (redirectUrl) {
      try {
        // If it&apos;s a relative URL, convert to absolute
        if (redirectUrl.startsWith('/')) {
          // Use the host from defaultRedirectUrl
          const baseUrl = new URL(defaultRedirectUrl).origin;
          validRedirectUrl = `${baseUrl}${redirectUrl}`;
        } else if (redirectUrl.includes('://')) {
          // Ensure absolute URL is valid by parsing it
          new URL(redirectUrl);
          validRedirectUrl = redirectUrl;
        } else {
          // If it&apos;s not a valid URL format, use default
          logger.warn('Invalid redirect URL format, using default', { redirectUrl });
          validRedirectUrl = defaultRedirectUrl;
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
          clerkUserId: userId,
          planDuration: planDuration
        },
        d2c: true // Direct to checkout
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Failed to create Whop checkout', undefined, { status: response.status, error: errorData });
      
      // Provide more specific error message based on the response
      const errorMessage = errorData.error?.message || errorData.message || "Unknown error from Whop API";
      
      return NextResponse.json(
        { 
          error: `Failed to create checkout: ${errorMessage}`,
          details: errorData
        },
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    logger.info('Whop checkout created', { userId, planId, checkoutUrl: data.purchase_url, sessionId: data.id });
    
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
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 
