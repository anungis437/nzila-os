"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import WhopPricingCard from "./whop-pricing-card";
import { useState } from "react";
import { Check } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
 
 
 
import { motion, AnimatePresence } from "framer-motion";

interface PricingPageClientProps {
  userId: string | null;
  activePaymentProvider: string;
  whopRedirectUrl: string;
  whopMonthlyLink: string;
  whopYearlyLink: string;
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string;
  stripeMonthlyLink: string;
  stripeYearlyLink: string;
  monthlyPrice: string;
  yearlyPrice: string;
}

/**
 * Client component for the pricing page
 * Allows switching between monthly and yearly billing with a toggle
 * Displays a modern pricing card UI with animated transitions
 */
export default function PricingPageClient({
  userId,
  activePaymentProvider,
  whopRedirectUrl,
  whopMonthlyLink: _whopMonthlyLink,
  whopYearlyLink: _whopYearlyLink,
  whopMonthlyPlanId,
  whopYearlyPlanId,
  stripeMonthlyLink,
  stripeYearlyLink,
  monthlyPrice,
  yearlyPrice,
}: PricingPageClientProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  // Calculate yearly savings
  const monthlyCost = parseInt(monthlyPrice.replace(/[^0-9]/g, ''));
  const yearlyCost = parseInt(yearlyPrice.replace(/[^0-9]/g, ''));
  const annualMonthlyCost = monthlyCost * 12;
  const savings = annualMonthlyCost - yearlyCost;
  const savingsPercentage = Math.round((savings / annualMonthlyCost) * 100);
  const savingsAmount = `$${savings}`;

  return (
    <div className="container mx-auto py-16 max-w-5xl">
      <div className="text-center space-y-4 mb-10">
        <h1 className="text-5xl font-bold">Pick Your Plan</h1>
        <p className="text-xl text-muted-foreground mt-4">Choose between monthly or yearly billing</p>
        
        {/* Billing toggle */}
        <div className="flex justify-center mt-8">
          <ToggleGroup 
            type="single" 
            value={billingCycle}
            onValueChange={(value) => value && setBillingCycle(value as "monthly" | "yearly")}
            className="border rounded-full p-1.5 bg-white shadow-sm"
          >
            <ToggleGroupItem 
              value="monthly" 
              className="rounded-full px-10 py-2.5 text-base font-medium data-[state=on]:bg-black data-[state=on]:text-white transition-all"
            >
              Monthly
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="yearly" 
              className="rounded-full px-10 py-2.5 text-base font-medium data-[state=on]:bg-black data-[state=on]:text-white transition-all"
            >
              Yearly
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-md">
          {activePaymentProvider === "stripe" ? (
            // Stripe pricing card
            <PricingCard
              title="Business"
              price={billingCycle === "monthly" ? monthlyPrice : yearlyPrice}
              description={billingCycle === "monthly" ? "Billed monthly" : "Billed annually"}
              buttonText="Get Started"
              buttonLink={billingCycle === "monthly" ? stripeMonthlyLink : stripeYearlyLink}
              userId={userId}
              provider="stripe"
              billingCycle={billingCycle}
              savingsPercentage={savingsPercentage}
              savingsAmount={savingsAmount}
            />
          ) : (
            // Whop pricing card
            <WhopPricingCard
              title="Business"
              price={billingCycle === "monthly" ? monthlyPrice : yearlyPrice}
              description={billingCycle === "monthly" ? "Billed monthly" : "Billed yearly"}
              buttonText="Get Started"
              planId={billingCycle === "monthly" ? whopMonthlyPlanId : whopYearlyPlanId}
              redirectUrl={whopRedirectUrl}
              billingCycle={billingCycle}
              savingsPercentage={savingsPercentage}
              savingsAmount={savingsAmount}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface PricingCardProps {
  title: string;
  price: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  userId: string | null;
  provider: 'stripe' | 'whop';
  redirectUrl?: string;
  billingCycle: "monthly" | "yearly";
  savingsPercentage: number;
  savingsAmount: string;
}

function PricingCard({ 
  title, 
  price, 
  description: _description, 
  buttonText, 
  buttonLink, 
  userId, 
  provider, 
  redirectUrl,
  billingCycle,
  savingsPercentage,
  savingsAmount
}: PricingCardProps) {
  // Each provider expects different parameter names
  let finalButtonLink = buttonLink;
  
  if (userId) {
    if (provider === 'whop') {
      // Start with a clean URL by removing any existing parameters
      const baseUrl = buttonLink.split('?')[0];
      
      // Build parameters properly
      const params = new URLSearchParams();
      
      // Add d2c=true - CRITICAL for direct checkout without Whop account
      params.append('d2c', 'true');
      
      // Add redirect URL
      if (redirectUrl) {
        params.append('redirect', redirectUrl);
      }
      
      // Add userId both as a direct parameter and in metadata
      params.append('userId', userId);
      params.append('metadata[userId]', userId);
      
      // Construct the final URL
      finalButtonLink = `${baseUrl}?${params.toString()}`;
    } else {
      // For Stripe, keep the original 'ref' parameter
      finalButtonLink = `${buttonLink}${buttonLink.includes('?') ? '&' : '?'}ref=${userId}`;
    }
  }
  
  // Benefits list
  const benefits = [
    "AI-powered grievance management",
    "Unlimited members & storage",
    "Full claims & arbitration toolkit",
    "Priority support from labour specialists",
    "Multi-role team collaboration"
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
        <CardDescription className="text-base text-gray-500 mt-1">Built for unions of every size — from locals to national federations.</CardDescription>
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
          asChild
          variant="default"
        >
          <a
            href={finalButtonLink}
            className={cn("inline-flex items-center justify-center", finalButtonLink === "#" && "pointer-events-none opacity-50")}
          >
            {buttonText}
          </a>
        </Button>
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
