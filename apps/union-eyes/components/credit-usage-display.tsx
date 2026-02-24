"use client";

import { useEffect, useState } from "react";
import { getCreditStatus } from "@/actions/credits-actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, RefreshCwIcon } from "lucide-react";

/**
 * CreditUsageDisplay component
 * Shows the user's credit usage with a purple progress bar and renewal date
 * Styled to match the design language of the sidebar and whop-pricing-card
 */
export function CreditUsageDisplay() {
  const [creditStatus, setCreditStatus] = useState<{
    total: number;
    used: number;
    remaining: number;
    nextBillingDate: Date | null;
    nextCreditRenewal: Date | null;
    membership?: string;
    error?: string;
  }>({
    total: 0,
    used: 0,
    remaining: 0,
    nextBillingDate: null,
    nextCreditRenewal: null
  });
  
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadCreditStatus = async () => {
      try {
        setLoading(true);
        const status = await getCreditStatus();
        setCreditStatus(status);
      } catch (_error) {
} finally {
        setLoading(false);
      }
    };
    
    loadCreditStatus();
  }, []);
  
  // Calculate percentage used
  const percentUsed = creditStatus.total > 0
    ? Math.min(100, Math.round((creditStatus.used / creditStatus.total) * 100))
    : 0;
    
  // Format credit renewal date - prioritize nextCreditRenewal over billing date
  const renewalDate = creditStatus.nextCreditRenewal || creditStatus.nextBillingDate;
  const formattedDate = renewalDate 
    ? new Date(renewalDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'No renewal date';
  
  // Format membership type with proper capitalization
  const membershipType = creditStatus.membership 
    ? creditStatus.membership.charAt(0).toUpperCase() + creditStatus.membership.slice(1) 
    : 'Free';
  
  // Custom progress bar colors using the purple from whop-pricing-card
  const progressClasses = "h-2.5 rounded-full bg-linear-to-r from-purple-500 to-purple-700";

  return (
    <Card className="border-white/60 bg-white/80 shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-semibold text-gray-800">Usage Credits</CardTitle>
          <span className={`text-xs px-2 py-0.5 rounded-full ${membershipType === 'Pro' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
            {membershipType} Plan
          </span>
        </div>
        <CardDescription className="text-xs text-gray-500">
          Premium feature usage
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {loading ? (
          <div className="flex justify-center py-2">
            <RefreshCwIcon className="h-4 w-4 animate-spin text-purple-600" />
          </div>
        ) : (
          <>
            <div className="grid gap-2 mb-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium">{creditStatus.used}</span> of <span className="font-medium">{creditStatus.total}</span> used
                </div>
                <div className="text-purple-600 font-medium">
                  {creditStatus.remaining} left
                </div>
              </div>
              <div className="h-2.5 w-full bg-gray-100 rounded-full">
                <div 
                  className={progressClasses}
                  style={{ width: `${percentUsed}%` }} 
                />
              </div>
            </div>
            
            {creditStatus.error && (
              <div className="text-xs text-destructive mt-1">
                {creditStatus.error}
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="border-t border-gray-100 pt-2 pb-2 px-4 text-xs flex items-center text-gray-600">
        <CalendarIcon className="mr-1.5 h-3 w-3 text-purple-600" />
        <span>
          Resets <strong>{formattedDate}</strong>
        </span>
      </CardFooter>
    </Card>
  );
} 
