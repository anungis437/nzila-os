/**
 * Payment Success Popup Component
 * Appears after a successful payment
 * Displays the user's new plan details and credits
 * Shows confetti celebration animation
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check, Gift, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { SelectProfile } from "@/db/schema/domains/member";
import { useRouter, useSearchParams } from "next/navigation";
import confetti from 'canvas-confetti';
import { getProfileByUserIdAction } from "@/actions/profiles-actions";
import { useAuth } from "@clerk/nextjs";

interface PaymentSuccessPopupProps {
  profile: SelectProfile;
}

export default function PaymentSuccessPopup({ profile: initialProfile }: PaymentSuccessPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const confettiShown = useRef(false);
  const [profile, setProfile] = useState(() => {
    // Initialize with optimistic UI state if payment=success is in URL
    if (typeof window !== 'undefined' && window.location.search.includes('payment=success')) {
      return {
        ...initialProfile,
        membership: "pro",
        usageCredits: 1000,
        usedCredits: 0
      };
    }
    return initialProfile;
  });
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useAuth();
  
  // Function to refresh profile data using server action
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshProfileData = async () => {
    try {
      setIsLoading(true);

      if (!userId) {
return;
      }
// Use the server action instead of fetch
      const result = await getProfileByUserIdAction(userId);
      
      if (result.isSuccess && result.data) {
if (result.data.membership === 'pro') {
setProfile(result.data);
          return true;
        } else {
// If we've tried a few times but database still shows free, use optimistic UI
          if (retryCount >= 2) {
setProfile({
              ...result.data,
              membership: "pro",
              usageCredits: 1000,
              usedCredits: 0
            });
            return true;
          }
          return false;
        }
      } else {
return false;
      }
    } catch (_error) {
return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Set this popup as the active popup when shown to prevent other popups
  useEffect(() => {
    if (isOpen) {
      try {
        // Set active popup flag in localStorage to prevent other popups from showing
        localStorage.setItem('active_popup', 'payment_success');
      } catch (_error) {
}
    }
    
    // Clean up when this popup closes
    return () => {
      if (!isOpen) {
        try {
          // Only clear if this popup was the active one
          const activePopup = localStorage.getItem('active_popup');
          if (activePopup === 'payment_success') {
            localStorage.removeItem('active_popup');
          }
        } catch (_error) {
}
      }
    };
  }, [isOpen]);
  
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    // Check if we have a payment success URL parameter
    const paymentStatus = searchParams.get('payment');
    
    if (paymentStatus === 'success' && !confettiShown.current) {
// Check if another popup is already active
      try {
        // Payment success popup takes highest priority, so we&apos;ll force-close any other popup
        localStorage.setItem('active_popup', 'payment_success');
      } catch (_error) {
}
      
      // First refresh the profile data to make sure we have the latest
      const checkProfileUpdate = async () => {
        const success = await refreshProfileData();
        
        // If successful or we've tried enough times, show popup
        if (success || retryCount >= 3) {
          // Show the popup with a small delay for animation
          const timer = setTimeout(() => {
            setIsOpen(true);
            if (!confettiShown.current) {
              triggerConfetti();
              confettiShown.current = true;
            }
          }, 800);
          
          return () => clearTimeout(timer);
        } else {
          // Retry with exponential backoff
          setRetryCount(prev => prev + 1);
          const backoffMs = 2000 * Math.pow(1.5, retryCount);
const timer = setTimeout(checkProfileUpdate, backoffMs);
          return () => clearTimeout(timer);
        }
      };
      
      checkProfileUpdate();
    }
  }, [searchParams, userId, retryCount, refreshProfileData]);
  
  // Handle closing the popup
  const handleClose = () => {
    setIsOpen(false);
    
    // Remove the active popup flag
    try {
      const activePopup = localStorage.getItem('active_popup');
      if (activePopup === 'payment_success') {
        localStorage.removeItem('active_popup');
      }
    } catch (_error) {
}
    
    // Remove the payment parameter from URL for a cleaner experience
    // Using replace with current pathname to remove query parameters
    const currentPath = window.location.pathname;
    router.replace(currentPath);
  };
  
  // Trigger confetti animation
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (_error) {
}
  };
  
  // Get plan details - use optimistic UI if the database is lagging
  const planType = profile.planDuration === "yearly" ? "Pro Yearly" : "Pro Monthly";
  const creditCount = profile.membership === "pro" ? (profile.usageCredits ?? 1000) : 1000;
  
  // Format renewal date for display
  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
    
  const nextCreditRenewal = profile.nextCreditRenewal 
    ? formatDate(profile.nextCreditRenewal)
    : "N/A";
  
  // Pro plan benefits
  const planBenefits = [
    `${creditCount} credits every billing cycle`,
    "Access to all premium features",
    "Priority support",
    "Advanced analytics and exports"
  ];
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {isOpen && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-40" />}
      <DialogContent className="fixed left-[50%] top-[50%] z-50 w-[420px] translate-x-[-50%] translate-y-[-50%] border-none p-0 shadow-lg rounded-xl bg-transparent [&>button]:hidden">
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
            aria-label="Close payment success dialog"
            className="absolute top-3 right-3 z-50 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
          
          {/* Header with success confirmation - now white instead of purple */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-center mb-3">
              <div className="bg-purple-100 w-8 h-8 rounded-full flex items-center justify-center mr-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Payment Successful!</h3>
            </div>
            <p className="text-sm text-gray-600 text-center">
              Thank you for upgrading to {planType}
            </p>
          </div>
          
          {/* Content */}
          <div className="px-6 py-5">
            {/* Credit information */}
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-800 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                  Your Pro Plan is Active!
                </h4>
                
                {/* Refresh button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={refreshProfileData}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 text-purple-500 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="sr-only">Refresh</span>
                </Button>
              </div>
              
              <div className="flex justify-between items-center mt-3 bg-white rounded-md p-3 border border-purple-100">
                <div className="flex items-center">
                  <Gift className="w-5 h-5 text-purple-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Credits</span>
                </div>
                <span className="text-lg font-bold text-purple-600">{creditCount}</span>
              </div>
              
              <div className="mt-3 text-xs text-gray-600 bg-white p-2 rounded border border-purple-100">
                <span className="block font-medium mb-1">Credits renew on</span>
                {nextCreditRenewal}
              </div>
            </div>
            
            {/* What&apos;s included list */}
            <div className="mb-5">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Your Pro Plan Includes:</h5>
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
            
            <Button 
              className="w-full bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              onClick={handleClose}
            >
              Get Started with Pro
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
} 
