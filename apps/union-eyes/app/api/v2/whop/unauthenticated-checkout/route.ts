import { NextResponse } from 'next/server';
/**
 * POST /api/whop/unauthenticated-checkout
 * Migrated to withApi() framework
 */
import { DEFAULT_REDIRECT_URL } from "@/app/api/whop/webhooks/utils/constants";
import crypto from "crypto";
import { logger } from '@/lib/logger';
 
 
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Whop'],
      summary: 'POST unauthenticated-checkout',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        const { planId, _redirectUrl, email } = await request.json();
        // Validate required parameters
        if (!planId) {
          return NextResponse.json(
            { error: "Missing required parameter: planId" },
            { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        if (!email) {
          return NextResponse.json(
            { error: "Missing required parameter: email" },
            { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { error: "Invalid email format" },
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
        // Generate a unique token for this purchase that can be used later to claim it
        const token = crypto.randomUUID();
        // Always redirect to signup page regardless of any provided redirectUrl
        // This ensures consistent authentication flow for frictionless payments
        const baseUrl = new URL(DEFAULT_REDIRECT_URL).origin;
        const signupUrl = `${baseUrl}/signup`;
        // Add email and token to redirect URL
        const validRedirectUrl = `${signupUrl}?payment=success&email=${encodeURIComponent(email)}&token=${token}&cb=${Date.now().toString().slice(-4)}`;
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
              email: email,
              token: token,
              planDuration: planDuration,
              isUnauthenticated: true
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
        logger.info('Unauthenticated Whop checkout created', { email, planId, checkoutUrl: data.purchase_url, sessionId: data.id });
        // Return the checkout URL to redirect the user
        return NextResponse.json(
          { 
            checkoutUrl: data.purchase_url,
            sessionId: data.id,
            planDuration,
            token
          },
          { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
  },
);
