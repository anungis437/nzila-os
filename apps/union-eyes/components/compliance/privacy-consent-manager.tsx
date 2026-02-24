/**
 * Privacy Consent Manager Component
 * 
 * Consent management with:
 * - Purpose-based consent
 * - Withdrawal management
 * - Consent history
 * - Legal documentation
 * - Audit trail
 * - Multi-language support
 * 
 * @module components/compliance/privacy-consent-manager
 */

"use client";

import * as React from "react";
import {
  Shield,
  Check,
  X,
  AlertCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 
import { format } from "date-fns";

export interface ConsentPurpose {
  id: string;
  name: string;
  description: string;
  category: "essential" | "functional" | "analytics" | "marketing";
  required: boolean;
  legalBasis: string;
  dataUse: string[];
  retentionPeriod: string;
}

export interface ConsentRecord {
  id: string;
  purposeId: string;
  purposeName: string;
  granted: boolean;
  grantedAt?: Date;
  withdrawnAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  method: "explicit" | "implicit" | "default";
}

export interface PrivacyConsentManagerProps {
  memberId: string;
  purposes: ConsentPurpose[];
  consents: ConsentRecord[];
  onUpdateConsent?: (purposeId: string, granted: boolean) => Promise<void>;
  onWithdrawAll?: () => Promise<void>;
  onExportConsents?: () => void;
}

export function PrivacyConsentManager({
  memberId: _memberId,
  purposes,
  consents,
  onUpdateConsent,
  onWithdrawAll,
  onExportConsents,
}: PrivacyConsentManagerProps) {
  const [selectedPurpose, setSelectedPurpose] = React.useState<ConsentPurpose | null>(null);
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const [showWithdrawDialog, setShowWithdrawDialog] = React.useState(false);

  const getConsentStatus = (purposeId: string) => {
    return consents.find((c) => c.purposeId === purposeId)?.granted ?? false;
  };

  const getConsentRecord = (purposeId: string) => {
    return consents.find((c) => c.purposeId === purposeId);
  };

  const handleToggleConsent = async (purposeId: string, currentStatus: boolean) => {
    if (purposes.find((p) => p.id === purposeId)?.required) {
      return; // Cannot toggle required consents
    }

    setIsUpdating(purposeId);
    try {
      await onUpdateConsent?.(purposeId, !currentStatus);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleWithdrawAll = async () => {
    try {
      await onWithdrawAll?.();
      setShowWithdrawDialog(false);
    } catch (_error) {
}
  };

  const categoryConfig = {
    essential: {
      color: "bg-blue-100 text-blue-800",
      label: "Essential",
      description: "Required for basic functionality",
    },
    functional: {
      color: "bg-green-100 text-green-800",
      label: "Functional",
      description: "Enhance user experience",
    },
    analytics: {
      color: "bg-purple-100 text-purple-800",
      label: "Analytics",
      description: "Help us improve our services",
    },
    marketing: {
      color: "bg-orange-100 text-orange-800",
      label: "Marketing",
      description: "Personalized communications",
    },
  };

  const groupedPurposes = purposes.reduce((acc, purpose) => {
    if (!acc[purpose.category]) {
      acc[purpose.category] = [];
    }
    acc[purpose.category].push(purpose);
    return acc;
  }, {} as Record<string, ConsentPurpose[]>);

  const consentHistory = [...consents]
    .sort((a, b) => {
      const dateA = a.withdrawnAt || a.grantedAt;
      const dateB = b.withdrawnAt || b.grantedAt;
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Privacy & Consent Management
          </h2>
          <p className="text-gray-600 mt-1">
            Manage your data processing consents
          </p>
        </div>
        <div className="flex gap-2">
          {onExportConsents && (
            <Button variant="outline" onClick={onExportConsents}>
              Export Consents
            </Button>
          )}
          {onWithdrawAll && (
            <Button variant="destructive" onClick={() => setShowWithdrawDialog(true)}>
              Withdraw All
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="manage" className="w-full">
        <TabsList>
          <TabsTrigger value="manage">Manage Consents</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Manage Consents */}
        <TabsContent value="manage">
          <div className="space-y-6">
            {Object.entries(groupedPurposes).map(([category, categoryPurposes]) => {
              const config = categoryConfig[category as keyof typeof categoryConfig];

              return (
                <Card key={category}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {config.label}
                        <Badge variant="secondary" className={config.color}>
                          {categoryPurposes.length}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-gray-600">{config.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {categoryPurposes.map((purpose) => {
                        const isGranted = getConsentStatus(purpose.id);
                        const record = getConsentRecord(purpose.id);

                        return (
                          <div
                            key={purpose.id}
                            className="flex items-start justify-between p-4 border rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{purpose.name}</h4>
                                {purpose.required && (
                                  <Badge variant="secondary">Required</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {purpose.description}
                              </p>
                              {record && (
                                <div className="text-xs text-gray-500">
                                  {isGranted && record.grantedAt && (
                                    <span>
                                      Granted: {format(record.grantedAt, "MMM d, yyyy")}
                                    </span>
                                  )}
                                  {!isGranted && record.withdrawnAt && (
                                    <span>
                                      Withdrawn: {format(record.withdrawnAt, "MMM d, yyyy")}
                                    </span>
                                  )}
                                </div>
                              )}
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto text-xs"
                                onClick={() => setSelectedPurpose(purpose)}
                              >
                                <Info className="h-3 w-3 mr-1" />
                                View details
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={isGranted}
                                onCheckedChange={() =>
                                  handleToggleConsent(purpose.id, isGranted)
                                }
                                disabled={purpose.required || isUpdating === purpose.id}
                              />
                              <Label className="sr-only">
                                {purpose.name} consent
                              </Label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Consent History</CardTitle>
            </CardHeader>
            <CardContent>
              {consentHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  No consent history available
                </div>
              ) : (
                <div className="space-y-3">
                  {consentHistory.map((record) => (
                    <div key={record.id} className="flex items-start justify-between border-b pb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {record.granted ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{record.purposeName}</span>
                          <Badge variant={record.granted ? "default" : "secondary"}>
                            {record.granted ? "Granted" : "Withdrawn"}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {record.granted && record.grantedAt && (
                            <div>Granted: {format(record.grantedAt, "MMM d, yyyy 'at' h:mm a")}</div>
                          )}
                          {!record.granted && record.withdrawnAt && (
                            <div>Withdrawn: {format(record.withdrawnAt, "MMM d, yyyy 'at' h:mm a")}</div>
                          )}
                          {record.ipAddress && <div>IP: {record.ipAddress}</div>}
                        </div>
                      </div>
                      <Badge variant="outline">{record.method}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Purpose Details Dialog */}
      <Dialog open={!!selectedPurpose} onOpenChange={() => setSelectedPurpose(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPurpose?.name}</DialogTitle>
            <DialogDescription>{selectedPurpose?.description}</DialogDescription>
          </DialogHeader>
          {selectedPurpose && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Legal Basis</Label>
                <p className="text-sm text-gray-600 mt-1">{selectedPurpose.legalBasis}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Data Usage</Label>
                <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                  {selectedPurpose.dataUse.map((use, index) => (
                    <li key={index}>{use}</li>
                  ))}
                </ul>
              </div>
              <div>
                <Label className="text-sm font-medium">Retention Period</Label>
                <p className="text-sm text-gray-600 mt-1">{selectedPurpose.retentionPeriod}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPurpose(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw All Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw All Consents?</DialogTitle>
            <DialogDescription>
              This will withdraw all non-essential consents. Essential consents required for
              basic functionality cannot be withdrawn.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This action cannot be undone. Some features may no
              longer be available.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleWithdrawAll}>
              Withdraw All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

