"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useState } from "react";
import { validateRedirectUrl } from "@/lib/utils/sanitize";
 
 
import { motion, AnimatePresence } from "framer-motion";

interface WhopPricingCardProps {
  title: string;
  price: string;
  description: string;
  buttonText: string;
  planId: string;
  redirectUrl?: string;
  billingCycle: "monthly" | "yearly";
  savingsPercentage: number;
  savingsAmount: string;
}

/**
 * Client component for Whop pricing cards
 * Uses our custom API endpoint to create checkouts with proper metadata
 * Designed with a clean, modern UI inspired by modern SaaS pricing cards
 * Includes animated price transitions and savings display
 */
export default function WhopPricingCard({ 
  title, 
  price, 
  description: _description, 
  buttonText, 
  planId,
  redirectUrl: _redirectUrl,
  billingCycle,
  savingsPercentage,
  savingsAmount
}: WhopPricingCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Always redirect to dashboard after payment
      const dashboardRedirect = "/dashboard";
      
      // Call our API endpoint to create a checkout with proper metadata
      const response = await fetch('/api/whop/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          // Always redirect to dashboard
          redirectUrl: dashboardRedirect
        }),
      });
      
      if (!response.ok) {
        const _errorData = await response.json();
setError('Failed to create checkout. Please try again.');
        return;
      }
      
      const data = await response.json();
      
      if (!data.checkoutUrl) {
setError('Failed to create checkout. Please try again.');
        return;
      }
      
      // Log the checkout URL for debugging
// Redirect to the checkout URL
      const safeUrl = validateRedirectUrl(data.checkoutUrl);
      if (!safeUrl) { setError('Untrusted checkout URL'); return; }
      window.location.href = safeUrl;
    } catch (_err) {
setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Benefits list
  const benefits = [
    "All Pro Plan features",
    "Unlimited storage & bandwidth",
    "Full e-commerce functionality",
    "Priority customer support",
    "Team collaboration tools"
  ];

  return (
    <Card className="rounded-2xl border shadow-sm overflow-hidden relative">
      {/* Savings tag for yearly billing */}
      {billingCycle === "yearly" && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute -top-0.5 right-6"
        >
          <div className="bg-linear-to-r from-purple-500 to-purple-700 text-white text-xs font-bold px-4 py-1.5 rounded-b-lg shadow-sm">
            Save {savingsPercentage}% ({savingsAmount})
          </div>
        </motion.div>
      )}
      
      <CardHeader className="px-6 py-6">
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        <CardDescription className="text-base text-gray-500 mt-1">Best for e-commerce and scaling businesses.</CardDescription>
      </CardHeader>
      
      <CardContent className="px-6 space-y-6 pb-0">
        <div>
          <AnimatePresence mode="wait">
            <motion.div 
              key={billingCycle}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-1 flex items-baseline"
            >
              <span className="text-5xl font-bold">{price}</span>
              <span className="text-gray-500 ml-2 text-base">
                /{billingCycle === "monthly" ? "month" : "year"}
              </span>
            </motion.div>
          </AnimatePresence>
          {billingCycle === "yearly" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center mt-1"
            >
              <span className="text-sm text-purple-600 font-medium flex items-center">
                <svg 
                  className="w-3.5 h-3.5 mr-1" 
                  fill="currentColor" 
                  viewBox="0 0 20 20" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                    clipRule="evenodd" 
                  />
                </svg>
                Billed annually
              </span>
            </motion.div>
          )}
        </div>
        
        <Button
          className="w-full py-4 text-base font-medium h-auto rounded-lg"
          onClick={handleCheckout}
          disabled={isLoading || !planId}
          variant="default"
        >
          {isLoading ? "Processing..." : buttonText}
        </Button>
        
        {error && (
          <div className="mt-3 text-sm text-red-600 text-center">
            {error}
          </div>
        )}
      </CardContent>
      
      <div className="px-6 pt-6 pb-6">
        <h3 className="font-semibold mb-4">Benefits</h3>
        <ul className="space-y-3">
          {benefits.map((benefit, index) => (
            <li key={index} className="flex items-center gap-2.5">
              <div className="shrink-0 w-4 h-4 text-purple-600">
                <Check className="h-4 w-4" />
              </div>
              <span className="text-sm text-gray-700">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
} 
