/**
 * Upgrade Plan Popup Component
 * Appears when a user has reached their credit limit
 * Encourages users to upgrade their plan for more credits
 */
"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { SelectProfile } from "@/db/schema/domains/member";
import { validateRedirectUrl } from "@/lib/utils/sanitize";

interface UpgradePlanPopupProps {
  profile: SelectProfile;
  monthlyPlanId: string;
  yearlyPlanId: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function UpgradePlanPopup({ 
  profile, 
  monthlyPlanId, 
  yearlyPlanId,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange
}: UpgradePlanPopupProps) {
  // Local state for dialog when not controlled externally
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const onOpenChange = externalOnOpenChange || ((open: boolean) => {
    setInternalIsOpen(open);
    if (!open) {
      // Track that user manually closed the popup
      setManuallyDismissed(true);
      try {
        // Store in localStorage that user dismissed the popup this session
        const dismissKey = `upgrade_popup_dismissed_${profile.userId}`;
        localStorage.setItem(dismissKey, 'true');
        
        // Remove active popup flag if this is the active popup
        const activePopup = localStorage.getItem('active_popup');
        if (activePopup === 'upgrade_plan') {
          localStorage.removeItem('active_popup');
        }
      } catch (_error) {
}
    }
  });
  
  // When the popup opens, set it as the active popup
  useEffect(() => {
    if (isOpen) {
      try {
        localStorage.setItem('active_popup', 'upgrade_plan');
      } catch (_error) {
}
    }
  }, [isOpen]);
  
  // Pricing details
  const monthlyPrice = "$30";
  const yearlyPrice = "$249";
  const yearlyPriceMonthly = "$20";
  
  useEffect(() => {
    // Only auto-show if using internal state (not externally controlled)
    if (externalIsOpen === undefined) {
      // Check if another popup is already active
      try {
        const activePopup = localStorage.getItem('active_popup');
        if (activePopup) {
          // Another popup is active, don&apos;t show this one
          return;
        }
      } catch (_error) {
}
      
      // Check if user has already dismissed the popup this session
      try {
        const dismissKey = `upgrade_popup_dismissed_${profile.userId}`;
        const hasBeenDismissed = localStorage.getItem(dismissKey) === 'true';
        if (hasBeenDismissed) {
          setManuallyDismissed(true);
          return;
        }
      } catch (_error) {
}

      // Don&apos;t show if already manually dismissed this session
      if (manuallyDismissed) {
        return;
      }
      
      // Calculate credit usage
      const usedCredits = profile.usedCredits ?? 0;
      const usageCredits = profile.usageCredits ?? 0;
      const hasReachedLimit = usedCredits >= usageCredits;
      
      // Show popup if user has reached limit
      if (hasReachedLimit) {
        const timer = setTimeout(() => {
          // Check again right before showing that no other popup became active
          try {
            const activePopup = localStorage.getItem('active_popup');
            if (activePopup) {
              return;
            }
            
            // Set this as the active popup
            localStorage.setItem('active_popup', 'upgrade_plan');
            setInternalIsOpen(true);
          } catch (_error) {
}
        }, 800);
        
        return () => clearTimeout(timer);
      }
    }
  }, [profile.usedCredits, profile.usageCredits, externalIsOpen, profile.userId, manuallyDismissed]);
  
  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get the correct plan ID based on billing cycle
      const planId = yearly ? yearlyPlanId : monthlyPlanId;
      
      if (!planId) {
setError("Configuration issue detected. Please visit the pricing page to complete your purchase.");
        return;
      }
      
      // Use the dashboard as the redirect URL
      const cleanRedirectUrl = "/dashboard?payment=success";
// Call the API endpoint to create a checkout session
      const response = await fetch('/api/whop/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          redirectUrl: cleanRedirectUrl
        }),
      });
      
      if (!response.ok) {
        const _errorData = await response.json();
setError('Failed to create checkout. Please try again later.');
        return;
      }
      
      const data = await response.json();
      
      if (!data.checkoutUrl) {
setError('Failed to create checkout. Please try again.');
        return;
      }
// Store information in localStorage to help with state persistence across redirects
      try {
        localStorage.setItem('checkout_started', 'true');
        localStorage.setItem('checkout_timestamp', new Date().toISOString());
        localStorage.setItem('checkout_plan_type', yearly ? 'yearly' : 'monthly');
      } catch (_error) {
}
      
      // Redirect to the checkout URL
      const safeUrl = validateRedirectUrl(data.checkoutUrl);
      if (!safeUrl) { setError('Untrusted checkout URL'); return; }
      window.location.href = safeUrl;
    } catch (_error) {
setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Safe values for display
  const usedCredits = profile.usedCredits ?? 0;
  const usageCredits = profile.usageCredits ?? 0;
  
  // Benefits list
  const benefits = [
    "1,000 credits per billing cycle",
    "Automatic credit renewals",
    "Access to all premium features",
    "Priority support"
  ];
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {isOpen && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-40" />}
      <DialogContent className="fixed left-[50%] top-[50%] z-50 w-100 translate-x-[-50%] translate-y-[-50%] border-none p-0 shadow-lg rounded-xl bg-transparent [&>button]:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative rounded-xl overflow-hidden bg-white shadow-xl border border-gray-100"
        >
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-50 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
          
          {/* Header */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-purple-100 w-8 h-8 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Upgrade to Pro</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              You&apos;ve used all your credits ({usedCredits}/{usageCredits}). Get more with Pro.
            </p>
            
            {/* Credit usage progress bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full w-full" />
            </div>
          </div>
          
          {/* Pricing toggle */}
          <div className="px-6 pb-4 pt-2">
            <div className="flex items-center justify-center mb-5 bg-gray-50 rounded-lg p-2.5">
              <span className={`text-sm mr-3 ${!yearly ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                Monthly
              </span>
              <Switch 
                checked={yearly} 
                onCheckedChange={setYearly} 
                className="data-[state=checked]:bg-purple-600"
              />
              <span className={`text-sm ml-3 flex items-center ${yearly ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                Yearly
                <span className="ml-1.5 text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">
                  Save 33%
                </span>
              </span>
            </div>
            
            {/* Price display */}
            <div className="text-center mb-3">
              <div className="flex items-baseline justify-center">
                <span className="text-3xl font-bold">{yearly ? yearlyPriceMonthly : monthlyPrice}</span>
                <span className="text-gray-500 text-sm ml-1">/month</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {yearly 
                  ? `Billed annually at ${yearlyPrice}`
                  : "Billed monthly, cancel anytime"}
              </p>
            </div>
          
            {/* Features list */}
            <ul className="space-y-2.5 mb-5">
              {benefits.map((benefit, i) => (
                <li 
                  key={i}
                  className="flex items-start text-sm text-gray-600"
                >
                  <div className="rounded-full bg-purple-100 p-0.5 mr-2 mt-0.5 shrink-0">
                    <Check className="w-3 h-3 text-purple-600" />
                  </div>
                  {benefit}
                </li>
              ))}
            </ul>
            
            {/* Checkout button */}
            <Button 
              className="w-full py-2.5 bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              size="lg"
              onClick={handleCheckout}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : `Get Pro ${yearly ? 'Yearly' : 'Monthly'}`}
            </Button>
            
            {error && (
              <div className="mt-3 text-xs text-red-600 text-center">
                {error}
              </div>
            )}
            
            <p className="text-xs text-gray-400 text-center mt-3">
              Next free renewal: {profile.nextCreditRenewal 
                ? new Date(profile.nextCreditRenewal).toLocaleDateString()
                : 'Not scheduled'}
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
} 
