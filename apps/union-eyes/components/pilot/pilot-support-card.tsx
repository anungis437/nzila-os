/**
 * Pilot Support Card
 *
 * Where a pilot organization writes for help. Only what the product actually has is shown: its support mailbox. Nothing records a pilot owner, a milestone date or
 * an escalation route, so none is displayed.
 *
 * @module components/pilot/pilot-support-card
 */

"use client";

import * as React from "react";
import { LifeBuoy, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PilotSupportCardProps {
  /** The product's support mailbox (lib/support-contact). */
  supportEmail: string;
  className?: string;
}

export function PilotSupportCard({ supportEmail, className }: PilotSupportCardProps) {
  return (
    <Card className={cn("p-5 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <LifeBuoy className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Support</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Write to the support team with any question about your pilot.
      </p>

      <div className="flex items-start gap-3">
        <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-muted-foreground block">Support email</span>
          <a href={`mailto:${supportEmail}`} className="text-sm font-medium text-primary hover:underline">
            {supportEmail}
          </a>
        </div>
      </div>

      <div className="pt-2 border-t">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a href={`mailto:${supportEmail}?subject=Pilot%20Support%20Request`}>
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Contact Support
          </a>
        </Button>
      </div>
    </Card>
  );
}
