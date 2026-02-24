/**
 * Welcome Message Popup Component
 * Appears for first-time users
 * Explains the number of credits they get and other plan benefits
 * Only shows once within 10 minutes of account creation
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { X, PartyPopper, Check, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { SelectProfile } from "@/db/schema/domains/member";
import Link from "next/link";
import confetti from 'canvas-confetti';

interface WelcomeMessagePopupProps {
  profile: SelectProfile;
}

export default function WelcomeMessagePopup({ profile }: WelcomeMessagePopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const confettiShown = useRef(false);
  
  // Prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // When the popup opens, set it as the active popup
  useEffect(() => {
    if (isOpen) {
      try {
        localStorage.setItem('active_popup', 'welcome_message');
      } catch (_error) {
}
    }
  }, [isOpen]);
  
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    // Check if another popup is already active
    try {
      const activePopup = localStorage.getItem('active_popup');
      // Don&apos;t show if another popup is active (especially payment_success)
      if (activePopup) {
        return;
      }
    } catch (_error) {
}
    
    // Check if we've already shown this welcome message
    const welcomeKey = `welcome_shown_${profile.userId}`;
    const hasShownWelcome = localStorage.getItem(welcomeKey);
    
    // Check if the profile was created recently (within 10 minutes)
    const isNewUser = profile.createdAt && 
      (new Date().getTime() - new Date(profile.createdAt).getTime() < 10 * 60 * 1000);
    
    // Check if the URL has a payment=success parameter
    const url = new URL(window.location.href);
    const isPaymentSuccess = url.searchParams.get('payment') === 'success';
// Show the popup if:
    // 1. We haven&apos;t shown it before AND the user is new, OR
    // 2. Payment was successful (paid user should see confirmation regardless of timing)
    // Note: For payment success, the payment success popup has higher priority
    if ((!hasShownWelcome && isNewUser) && !isPaymentSuccess) {
const timer = setTimeout(() => {
        // Check again right before showing that no other popup became active
        try {
          const activePopup = localStorage.getItem('active_popup');
          if (activePopup) {
            return;
          }
          
          // Set this as the active popup
          localStorage.setItem('active_popup', 'welcome_message');
          setIsOpen(true);
          
          if (!confettiShown.current) {
            // eslint-disable-next-line react-hooks/immutability
            triggerConfetti();
            confettiShown.current = true;
          }
        } catch (_error) {
}
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [profile.userId, profile.createdAt]);
  
  // Handle closing the popup
  const handleClose = () => {
    setIsOpen(false);
    
    // Remove the active popup flag
    try {
      const activePopup = localStorage.getItem('active_popup');
      if (activePopup === 'welcome_message') {
        localStorage.removeItem('active_popup');
      }
    } catch (_error) {
}
    
    // Remember that we've shown it by saving to localStorage
    try {
      const welcomeKey = `welcome_shown_${profile.userId}`;
      localStorage.setItem(welcomeKey, new Date().toISOString());
} catch (_error) {
}
  };
  
  // Trigger confetti animation
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (_error) {
}
  };
  
  // Get the appropriate number of credits based on plan
  const isFree = profile.membership === "free";
  const creditCount = isFree ? (profile.usageCredits ?? 5) : (profile.usageCredits ?? 1000);
  const planType = isFree ? "Free" : "Pro";
  const renewalPeriod = "4 weeks";
  
  // Benefits list - adjust based on plan type
  const planBenefits = isFree ? [
    `${creditCount} free credits every ${renewalPeriod}`,
    "Access to basic features",
    "Automatic credit renewals",
    "Upgrade to Pro anytime for more credits"
  ] : [
    `${creditCount} credits every billing cycle`,
    "Access to all premium features",
    "Priority support",
    "Advanced analytics"
  ];
  
  // Format renewal date for display
  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const nextRenewalDate = profile.nextCreditRenewal 
    ? formatDate(profile.nextCreditRenewal)
    : "in 4 weeks";
  
  // Don&apos;t render anything until mounted to prevent hydration issues
  if (!isMounted) {
    return null;
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {isOpen && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-40" />}
      <DialogContent className="fixed left-[50%] top-[50%] z-50 w-[400px] translate-x-[-50%] translate-y-[-50%] border-none p-0 shadow-lg rounded-xl bg-transparent [&>button]:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative rounded-xl overflow-hidden bg-white shadow-xl border border-gray-100"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label="Close welcome message"
            className="absolute top-3 right-3 z-50 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
          
          {/* Header with emoji decorations */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-center mb-3">
              <span className="text-2xl mr-2">Ã°Å¸Å½â€°</span>
              <h3 className="text-xl font-bold text-gray-900">Welcome!</h3>
              <span className="text-2xl ml-2">Ã°Å¸Å½Å </span>
            </div>
            <p className="text-sm text-gray-600 mb-3 text-center">
              Thanks for joining! We&apos;re excited to have you here.
            </p>
          </div>
          
          {/* Content */}
          <div className="px-6 pb-5">
            {/* Credit information */}
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-800 flex items-center justify-center">
                <PartyPopper className="w-4 h-4 mr-2 text-purple-500" />
                Your {planType} Plan is Active!
              </h4>
              
              <div className="flex justify-between items-center mt-3 bg-white rounded-md p-3 border border-purple-100">
                <div className="flex items-center">
                  <Gift className="w-5 h-5 text-purple-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Credits</span>
                </div>
                <span className="text-lg font-bold text-purple-600">{creditCount}</span>
              </div>
              
              <p className="text-xs text-center text-gray-500 mt-2">
                Next renewal: {nextRenewalDate}
              </p>
            </div>
            
            {/* What&apos;s included list */}
            <div className="mb-5">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Your {planType} Plan Includes:</h5>
              <ul className="space-y-2.5">
                {planBenefits.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start text-sm text-gray-600"
                  >
                    <div className="rounded-full bg-purple-100 p-0.5 mr-2 mt-0.5 shrink-0">
                      <Check className="w-3 h-3 text-purple-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button 
                className="w-full bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                onClick={handleClose}
              >
                Let&apos;s Get Started
              </Button>
              
              {isFree && (
                <Link href="/pricing" className="w-full">
                  <Button 
                    variant="outline"
                    className="w-full border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    View Pro Plans
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
} 
