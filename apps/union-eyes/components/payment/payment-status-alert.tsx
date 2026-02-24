"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/nextjs";
import { checkPaymentFailedAction } from "@/actions/profiles-actions";

/**
 * Payment status alert component that uses server actions to check payment status
 * Only shows when payment has failed and user is not on the pricing page
 */
export function PaymentStatusAlert() {
  const [hasPaymentFailed, setHasPaymentFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const { userId } = useAuth();
  
  // Don&apos;t show on pricing page to avoid redundancy
  const isVisible = pathname !== "/pricing";
  
  // Check payment status on initial load and set up a less frequent check
  useEffect(() => {
    if (!userId || !isVisible) return;
    
    const checkPaymentStatus = async () => {
      try {
        setIsLoading(true);
        // Use server action (more efficient than API route)
        const { paymentFailed } = await checkPaymentFailedAction();
        setHasPaymentFailed(paymentFailed);
      } catch (_error) {
} finally {
        setIsLoading(false);
      }
    };
    
    // Initial check
    checkPaymentStatus();
    
    // Set up a less frequent check (every 5 minutes instead of every minute)
    const intervalId = setInterval(checkPaymentStatus, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [userId, isVisible]);
  
  // Show nothing while loading or if no payment issues
  if (isLoading || !hasPaymentFailed || !isVisible) {
    return null;
  }
  
  return (
    <Alert variant="destructive" className="mb-4 container mx-auto mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Payment Failed</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          Your subscription payment has failed. Your account has been temporarily downgraded to the free plan.
        </div>
        <div className="shrink-0">
          <Button variant="outline" asChild>
            <Link href="/pricing">
              Update Payment Method
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
} 
