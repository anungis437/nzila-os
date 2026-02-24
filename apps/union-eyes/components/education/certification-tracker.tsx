/**
 * Certification Tracker Component
 * 
 * Certificate management with:
 * - Active certifications
 * - Expiration tracking
 * - Renewal reminders
 * - Requirements display
 * - Certificate downloads
 * - History timeline
 * 
 * @module components/education/certification-tracker
 */

"use client";

import * as React from "react";
import {
  Award,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, differenceInDays, isPast, isFuture } from "date-fns";

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issuedDate: Date;
  expiryDate?: Date;
  status: "active" | "expiring-soon" | "expired" | "in-progress";
  certificateUrl?: string;
  requirements: {
    completed: number;
    total: number;
    items: {
      name: string;
      completed: boolean;
      completedDate?: Date;
    }[];
  };
  credentialId?: string;
  category: string;
}

export interface CertificationTrackerProps {
  certifications: Certification[];
  onDownload?: (certificationId: string) => void;
  onRenew?: (certificationId: string) => void;
  onViewDetails?: (certificationId: string) => void;
}

export function CertificationTracker({
  certifications,
  onDownload,
  onRenew,
  onViewDetails,
}: CertificationTrackerProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");

  const getStatusInfo = (cert: Certification) => {
    if (cert.status === "in-progress") {
      return {
        color: "bg-blue-100 text-blue-800",
        label: "In Progress",
        icon: Clock,
      };
    }

    if (!cert.expiryDate) {
      return {
        color: "bg-green-100 text-green-800",
        label: "Active",
        icon: CheckCircle,
      };
    }

    const daysUntilExpiry = differenceInDays(cert.expiryDate, new Date());

    if (isPast(cert.expiryDate)) {
      return {
        color: "bg-red-100 text-red-800",
        label: "Expired",
        icon: AlertTriangle,
      };
    }

    if (daysUntilExpiry <= 30) {
      return {
        color: "bg-orange-100 text-orange-800",
        label: "Expiring Soon",
        icon: AlertTriangle,
      };
    }

    return {
      color: "bg-green-100 text-green-800",
      label: "Active",
      icon: CheckCircle,
    };
  };

  const filteredCertifications = certifications.filter((cert) => {
    if (selectedStatus === "all") return true;
    if (selectedStatus === "active") return cert.status === "active";
    if (selectedStatus === "expiring") return cert.status === "expiring-soon";
    if (selectedStatus === "expired") return cert.status === "expired";
    if (selectedStatus === "in-progress") return cert.status === "in-progress";
    return true;
  });

  const groupedByCategory = filteredCertifications.reduce((acc, cert) => {
    if (!acc[cert.category]) {
      acc[cert.category] = [];
    }
    acc[cert.category].push(cert);
    return acc;
  }, {} as Record<string, Certification[]>);

  const stats = {
    total: certifications.length,
    active: certifications.filter((c) => c.status === "active").length,
    expiringSoon: certifications.filter((c) => c.status === "expiring-soon").length,
    expired: certifications.filter((c) => c.status === "expired").length,
    inProgress: certifications.filter((c) => c.status === "in-progress").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Award className="h-6 w-6" />
          Certification Tracker
        </h2>
        <p className="text-gray-600 mt-1">
          Manage and track your professional certifications
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{stats.expiringSoon}</div>
              <div className="text-sm text-gray-600">Expiring Soon</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{stats.expired}</div>
              <div className="text-sm text-gray-600">Expired</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {stats.expiringSoon > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{stats.expiringSoon} certification{stats.expiringSoon > 1 ? "s" : ""}</strong>{" "}
            expiring within 30 days. Review renewal requirements.
          </AlertDescription>
        </Alert>
      )}

      {stats.expired > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{stats.expired} certification{stats.expired > 1 ? "s have" : " has"}</strong>{" "}
            expired. Renew immediately to maintain compliance.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Tabs defaultValue="all" onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
          <TabsTrigger value="expiring">Expiring ({stats.expiringSoon})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({stats.expired})</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress ({stats.inProgress})</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="mt-6">
          {filteredCertifications.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-gray-600">
                <Award className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No certifications found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByCategory).map(([category, certs]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-4">{category}</h3>
                  <div className="grid gap-4">
                    {certs.map((cert) => {
                      const statusInfo = getStatusInfo(cert);
                      const StatusIcon = statusInfo.icon;
                      const completionPercentage =
                        (cert.requirements.completed / cert.requirements.total) * 100;

                      return (
                        <Card key={cert.id}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Award className="h-5 w-5 text-gray-600" />
                                  <h4 className="font-semibold text-lg">{cert.name}</h4>
                                  <Badge className={statusInfo.color}>
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {statusInfo.label}
                                  </Badge>
                                </div>

                                <p className="text-sm text-gray-600 mb-3">
                                  Issued by {cert.issuer}
                                </p>

                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                  <div>
                                    <span className="text-gray-600">Issued:</span>{" "}
                                    {format(cert.issuedDate, "MMM d, yyyy")}
                                  </div>
                                  {cert.expiryDate && (
                                    <div>
                                      <span className="text-gray-600">Expires:</span>{" "}
                                      {format(cert.expiryDate, "MMM d, yyyy")}
                                      {isFuture(cert.expiryDate) && (
                                        <span className="text-gray-500 ml-1">
                                          ({differenceInDays(cert.expiryDate, new Date())} days)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {cert.credentialId && (
                                    <div>
                                      <span className="text-gray-600">Credential ID:</span>{" "}
                                      {cert.credentialId}
                                    </div>
                                  )}
                                </div>

                                {cert.status === "in-progress" && (
                                  <div className="mb-4">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                      <span className="text-gray-600">Progress</span>
                                      <span className="font-medium">
                                        {cert.requirements.completed} / {cert.requirements.total}{" "}
                                        requirements
                                      </span>
                                    </div>
                                    <Progress value={completionPercentage} className="h-2" />
                                  </div>
                                )}

                                {cert.requirements.items.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-medium mb-2">Requirements:</h5>
                                    <ul className="space-y-1">
                                      {cert.requirements.items.slice(0, 3).map((req, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm">
                                          {req.completed ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <Clock className="h-4 w-4 text-gray-400" />
                                          )}
                                          <span
                                            className={req.completed ? "text-gray-600" : ""}
                                          >
                                            {req.name}
                                          </span>
                                          {req.completedDate && (
                                            <span className="text-xs text-gray-500">
                                              ({format(req.completedDate, "MMM yyyy")})
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                      {cert.requirements.items.length > 3 && (
                                        <li className="text-sm text-gray-500">
                                          + {cert.requirements.items.length - 3} more
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col gap-2 ml-4">
                                {cert.certificateUrl && onDownload && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDownload(cert.id)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
                                )}
                                {(cert.status === "expiring-soon" || cert.status === "expired") &&
                                  onRenew && (
                                    <Button size="sm" onClick={() => onRenew(cert.id)}>
                                      Renew
                                    </Button>
                                  )}
                                {onViewDetails && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onViewDetails(cert.id)}
                                  >
                                    Details
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

