/**
 * Affiliate Card Component
 * 
 * Displays union affiliate summary card with:
 * - Affiliate name and logo
 * - Member count and status
 * - Compliance indicator
 * - Quick stats
 * - Action buttons
 * 
 * @module components/federation/AffiliateCard
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  MapPin, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface AffiliateCardData {
  id: string;
  name: string;
  shortName: string;
  affiliateNumber: string;
  sector: string;
  memberCount: number;
  status: "active" | "pending" | "suspended" | "inactive";
  complianceStatus: "compliant" | "at-risk" | "overdue";
  location?: string;
  joinedDate: Date;
  logoUrl?: string;
}

export interface AffiliateCardProps {
  affiliate: AffiliateCardData;
  onViewDetails?: (affiliateId: string) => void;
  onContact?: (affiliateId: string) => void;
  className?: string;
}

export function AffiliateCard({
  affiliate,
  onViewDetails,
  onContact,
  className
}: AffiliateCardProps) {
  const getStatusVariant = (status: AffiliateCardData["status"]) => {
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "secondary";
      case "suspended":
        return "destructive";
      case "inactive":
        return "outline";
      default:
        return "outline";
    }
  };

  const getComplianceVariant = (status: AffiliateCardData["complianceStatus"]) => {
    switch (status) {
      case "compliant":
        return "success";
      case "at-risk":
        return "warning";
      case "overdue":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getComplianceIcon = (status: AffiliateCardData["complianceStatus"]) => {
    switch (status) {
      case "compliant":
        return CheckCircle2;
      case "at-risk":
      case "overdue":
        return AlertCircle;
      default:
        return CheckCircle2;
    }
  };

  const ComplianceIcon = getComplianceIcon(affiliate.complianceStatus);

  return (
    <Card className={cn("hover:shadow-lg transition-shadow", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {affiliate.logoUrl ? (
              <div className="w-12 h-12 rounded-md overflow-hidden border bg-white shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={affiliate.logoUrl}
                  alt={`${affiliate.shortName} logo`}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">
                {affiliate.shortName}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                #{affiliate.affiliateNumber}
              </p>
            </div>
          </div>
          <Badge variant={getStatusVariant(affiliate.status)} className="ml-2">
            {affiliate.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Members</p>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">
                {affiliate.memberCount.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Sector</p>
            <Badge variant="outline" className="text-xs">
              {affiliate.sector}
            </Badge>
          </div>
        </div>

        {/* Compliance Status */}
        <div className="p-3 rounded-md border bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Remittance Compliance</span>
            <Badge 
              variant={getComplianceVariant(affiliate.complianceStatus)}
              className="gap-1"
            >
              {/* eslint-disable-next-line react-hooks/static-components */}
              <ComplianceIcon className="h-3 w-3" />
              {affiliate.complianceStatus === "compliant" && "Compliant"}
              {affiliate.complianceStatus === "at-risk" && "At Risk"}
              {affiliate.complianceStatus === "overdue" && "Overdue"}
            </Badge>
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-2 text-sm text-muted-foreground">
          {affiliate.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{affiliate.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Joined {format(new Date(affiliate.joinedDate), "MMM yyyy")}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onViewDetails && onViewDetails(affiliate.id)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onContact && onContact(affiliate.id)}
        >
          <Mail className="h-4 w-4 mr-2" />
          Contact
        </Button>
      </CardFooter>
    </Card>
  );
}
