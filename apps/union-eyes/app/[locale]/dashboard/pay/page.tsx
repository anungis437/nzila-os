"use client";


export const dynamic = 'force-dynamic';
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { validateRedirectUrl } from "@/lib/utils/sanitize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Pay Page Component for Frictionless Payment Flow
 * 
 * This page allows users to purchase a subscription without creating an account first.
 * They simply enter their email and are taken to checkout.
 * After payment, they can create an account later and their payment will be linked.
 */
export default function PayPage() {
  const t = useTranslations("payPage");
  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Pricing data — must match main pricing page ($30/$249)
  const pricingData = {
    monthly: {
      price: "$30",
      planId: process.env.NEXT_PUBLIC_WHOP_PLAN_ID_MONTHLY ?? "plan_Fd5UBpraUWKMH",
      savingsPercentage: 0,
      savingsAmount: "$0"
    },
    yearly: {
      price: "$249",
      planId: process.env.NEXT_PUBLIC_WHOP_PLAN_ID_YEARLY ?? "plan_VVfTQzyslIKtq",
      savingsPercentage: 31,
      savingsAmount: "$111"
    }
  };

  // Validate email
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Handle email change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setIsValidEmail(validateEmail(newEmail));
  };

  // Handle checkout process
  const handleCheckout = async () => {
    try {
      if (!isValidEmail) {
        setError(t("errors.invalidEmail"));
        return;
      }

      setIsLoading(true);
      setError(null);
      
      // Get the current plan ID based on billing cycle
      const planId = billingCycle === "monthly" 
        ? pricingData.monthly.planId 
        : pricingData.yearly.planId;
      
      // Call our API endpoint to create checkout with email
      // Let the server determine the correct redirect URL for consistency
      const response = await fetch('/api/whop/unauthenticated-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          email, // Include email for unauthenticated checkout
        }),
      });
      
      if (!response.ok) {
        const _errorData = await response.json();
        setError(t("errors.checkoutFailed"));
        return;
      }
      
      const data = await response.json();
      
      if (!data.checkoutUrl) {
        setError(t("errors.checkoutFailed"));
        return;
      }
      
      // Log the checkout URL for debugging
// Redirect to the checkout URL
      const safeUrl = validateRedirectUrl(data.checkoutUrl);
      if (!safeUrl) { setError(t("errors.untrustedCheckoutUrl")); return; }
      window.location.href = safeUrl;
    } catch (_err) {
      setError(t("errors.unexpected"));
    } finally {
      setIsLoading(false);
    }
  };

  // Benefits list
  const benefits = [
    t("benefits.aiCredits"),
    t("benefits.aiTriage"),
    t("benefits.precedentResearch"),
    t("benefits.claimsToolkit"),
    t("benefits.teamCollaboration"),
    t("benefits.prioritySupport")
  ];

  // Current pricing data based on selected billing cycle
  const currentPlan = billingCycle === "monthly" ? pricingData.monthly : pricingData.yearly;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            {t("header.title")}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {t("header.subtitle")}
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                billingCycle === "monthly"
                  ? "bg-white shadow-sm text-gray-800"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setBillingCycle("monthly")}
            >
              {t("billing.monthly")}
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                billingCycle === "yearly"
                  ? "bg-white shadow-sm text-gray-800"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setBillingCycle("yearly")}
            >
              {t("billing.yearly")}
            </button>
          </div>
        </div>

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
                {t("pricing.save", {
                  percentage: currentPlan.savingsPercentage,
                  amount: currentPlan.savingsAmount,
                })}
              </div>
            </motion.div>
          )}
          
          <CardHeader className="px-6 py-6">
            <CardTitle className="text-2xl font-bold">{t("pricing.planTitle")}</CardTitle>
            <CardDescription className="text-base text-gray-500 mt-1">
              {t("pricing.planDescription")}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-6 space-y-6">
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
                  <span className="text-5xl font-bold">{currentPlan.price}</span>
                  <span className="text-gray-500 ml-2 text-base">
                    /{billingCycle === "monthly" ? t("pricing.month") : t("pricing.year")}
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
                    {t("pricing.billedAnnually")}
                  </span>
                </motion.div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  {t("form.emailLabel")}
                </Label>
                <Input 
                  id="email"
                  type="email"
                  placeholder={t("form.emailPlaceholder")}
                  value={email}
                  onChange={handleEmailChange}
                  className="w-full"
                />
                {email && !isValidEmail && (
                  <p className="text-xs text-red-500">{t("errors.invalidEmail")}</p>
                )}
              </div>
            </div>
            
            <Button
              className="w-full py-4 text-base font-medium h-auto rounded-lg"
              onClick={handleCheckout}
              disabled={isLoading || !isValidEmail || !email}
              variant="default"
            >
              {isLoading ? t("actions.processing") : t("actions.upgrade")}
            </Button>
            
            {error && (
              <div className="mt-3 text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            <div className="pt-4">
              <h3 className="font-semibold mb-4">{t("benefits.title")}</h3>
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
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          {t("footer.disclaimer")}
        </p>
      </div>
    </div>
  );
} 
