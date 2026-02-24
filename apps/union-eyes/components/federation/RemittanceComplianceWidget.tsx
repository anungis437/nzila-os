/**
 * Remittance Compliance Widget Component
 * 
 * Displays affiliate-level remittance compliance with:
 * - List of all affiliates with compliance status
 * - Color-coded indicators
 * - Days overdue counter
 * - Last payment date
 * - Quick action buttons
 * - Sorting and filtering
 * 
 * @module components/federation/RemittanceComplianceWidget
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { 
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  Eye,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface AffiliateCompliance {
  affiliateId: string;
  affiliateName: string;
  affiliateNumber: string;
  complianceStatus: "compliant" | "at-risk" | "overdue";
  lastPaymentDate?: Date;
  nextDueDate: Date;
  daysOverdue?: number;
  amountDue: number;
  amountPaid: number;
  paymentStatus: "paid" | "partial" | "unpaid";
}

export interface RemittanceComplianceWidgetProps {
  federationId: string;
}

export function RemittanceComplianceWidget({
  federationId
}: RemittanceComplianceWidgetProps) {
  const { toast } = useToast();
  const [affiliates, setAffiliates] = React.useState<AffiliateCompliance[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  React.useEffect(() => {
    loadComplianceData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId]);

  async function loadComplianceData() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/federation/remittance/compliance?federationId=${federationId}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to load compliance data");
      }

      const data = await response.json();
      if (data.success) {
        setAffiliates(data.affiliates);
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load compliance data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function sendReminder(affiliateId: string, affiliateName: string) {
    try {
      const response = await fetch(
        `/api/federation/remittance/send-reminder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ federationId, affiliateId })
        }
      );
      
      if (!response.ok) throw new Error("Failed to send reminder");
      
      toast({
        title: "Reminder Sent",
        description: `Payment reminder sent to ${affiliateName}`
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to send reminder",
        variant: "destructive"
      });
    }
  }

  const filteredAffiliates = React.useMemo(() => {
    let filtered = affiliates;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(a => a.complianceStatus === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.affiliateName.toLowerCase().includes(query) ||
        a.affiliateNumber.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [affiliates, statusFilter, searchQuery]);

  const getStatusBadge = (status: AffiliateCompliance["complianceStatus"]) => {
    switch (status) {
      case "compliant":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Compliant
          </Badge>
        );
      case "at-risk":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            At Risk
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Overdue
          </Badge>
        );
    }
  };

  const getPaymentStatusBadge = (status: AffiliateCompliance["paymentStatus"]) => {
    switch (status) {
      case "paid":
        return <Badge variant="success">Paid</Badge>;
      case "partial":
        return <Badge variant="secondary">Partial</Badge>;
      case "unpaid":
        return <Badge variant="destructive">Unpaid</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Tracking</CardTitle>
        <CardDescription>
          Monitor remittance compliance by affiliate
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search affiliates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-45">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="compliant">Compliant</SelectItem>
              <SelectItem value="at-risk">At Risk</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Affiliate List */}
        {filteredAffiliates.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No affiliates found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAffiliates.map((affiliate) => (
              <div
                key={affiliate.affiliateId}
                className={cn(
                  "p-4 rounded-lg border transition-colors",
                  affiliate.complianceStatus === "overdue" &&
                    "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
                  affiliate.complianceStatus === "at-risk" &&
                    "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20",
                  affiliate.complianceStatus === "compliant" &&
                    "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Affiliate Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {affiliate.affiliateName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        #{affiliate.affiliateNumber}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span>Last Payment:</span>
                        {affiliate.lastPaymentDate ? (
                          <span className="font-medium">
                            {format(new Date(affiliate.lastPaymentDate), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="font-medium">Never</span>
                        )}
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <span>Next Due:</span>
                        <span className="font-medium">
                          {format(new Date(affiliate.nextDueDate), "MMM d, yyyy")}
                        </span>
                      </div>
                      {affiliate.daysOverdue !== undefined && affiliate.daysOverdue > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-medium">
                            {affiliate.daysOverdue} days overdue
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Amount Due</div>
                      <div className="font-semibold">
                        ${affiliate.amountDue.toLocaleString()}
                      </div>
                      {affiliate.paymentStatus === "partial" && (
                        <div className="text-xs text-muted-foreground">
                          ${affiliate.amountPaid.toLocaleString()} paid
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {getStatusBadge(affiliate.complianceStatus)}
                      {getPaymentStatusBadge(affiliate.paymentStatus)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      title="View details"
                    >
                      <a href={`/federation/affiliates/${affiliate.affiliateId}/remittance`}>
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    {affiliate.complianceStatus !== "compliant" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendReminder(affiliate.affiliateId, affiliate.affiliateName)}
                        title="Send reminder"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
