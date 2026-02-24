/**
 * Subscription Cancellation Popup Component
 * Appears when a user has canceled their subscription
 * Explains that they'll keep credits until the end of their billing cycle
 */
"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { SelectProfile } from "@/db/schema/domains/member";
import Link from "next/link";

interface CancellationPopupProps {
  profile: SelectProfile;
}

export default function CancellationPopup({ profile }: CancellationPopupProps) {
  // Use localStorage to track if we've shown this popup before
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    // Check if another popup is already active
    try {
      const activePopup = localStorage.getItem('active_popup');
      if (activePopup) {
        // Another popup is active, don&apos;t show this one
        return;
      }
    } catch (_error) {
}
    
    // Check if we've already shown this cancellation
    const cancelationKey = `cancellation_shown_${profile.userId}`;
    const hasShownCancellation = localStorage.getItem(cancelationKey);
    
    if (!hasShownCancellation) {
      // If we haven&apos;t shown it, show the popup now
      const timer = setTimeout(() => {
        // Check again right before showing that no other popup became active
        try {
          const activePopup = localStorage.getItem('active_popup');
          if (activePopup) {
            return;
          }
          
          // Set this as the active popup
          localStorage.setItem('active_popup', 'cancellation');
          setIsOpen(true);
        } catch (_error) {
}
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [profile.userId]);
  
  // Handle closing the popup
  const handleClose = () => {
    setIsOpen(false);
    
    // Remove the active popup flag
    try {
      const activePopup = localStorage.getItem('active_popup');
      if (activePopup === 'cancellation') {
        localStorage.removeItem('active_popup');
      }
    } catch (_error) {
}
    
    // Remember that we've shown it
    try {
      const cancelationKey = `cancellation_shown_${profile.userId}`;
      localStorage.setItem(cancelationKey, new Date().toISOString());
    } catch (_error) {
}
  };

  // Format dates for display
  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Calculate relevant information
  const billingCycleEnd = profile.billingCycleEnd ? new Date(profile.billingCycleEnd) : null;
  const hasActiveBillingCycle = billingCycleEnd && new Date() < billingCycleEnd;
  const remainingCredits = (profile.usageCredits || 0) - (profile.usedCredits || 0);
  
  // Benefits list based on whether they still have an active billing cycle
  const whatToExpect = hasActiveBillingCycle 
    ? [
        "Keep all Pro features until billing cycle ends",
        `Maintain access to all ${remainingCredits} remaining credits`,
        "Transition to free plan (5 credits) after billing cycle ends",
        "Resubscribe anytime to regain full access"
      ]
    : [
        "Transitioned to free plan with 5 credits",
        "Free plan includes 5 credits every 4 weeks",
        "Resubscribe anytime to regain full access"
      ];
  
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
            className="absolute top-3 right-3 z-50 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
          
          {/* Header */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-purple-100 w-8 h-8 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Subscription Canceled</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Here&apos;s what happens next with your account.
            </p>
          </div>
          
          {/* Content */}
          <div className="px-6 pb-5">
            {hasActiveBillingCycle && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-800 flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-purple-500" />
                  Pro Benefits Active Until
                </h4>
                
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Credits remaining:</span>
                  <span className="font-medium">{remainingCredits}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Access until:</span>
                  <span className="font-medium">{formatDate(profile.billingCycleEnd)}</span>
                </div>
              </div>
            )}
            
            {/* What to expect list */}
            <div className="mb-5">
              <ul className="space-y-2.5">
                {whatToExpect.map((item, i) => (
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
                Got it
              </Button>
              
              <Link href="/pricing" className="w-full">
                <Button 
                  variant="outline"
                  className="w-full border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  View Plans
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
} 
