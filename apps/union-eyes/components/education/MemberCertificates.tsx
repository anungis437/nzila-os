"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Award, AlertTriangle, CheckCircle2, XCircle, Calendar, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Certification {
  id: string;
  certificationName: string;
  certificationNumber: string;
  certificationCategory: string | null;
  issuingBody: string | null;
  issueDate: string;
  expiryDate: string | null;
  certificationStatus: string;
  courseName: string | null;
  courseCode: string | null;
  certificateUrl: string | null;
  verificationUrl: string | null;
  clcRegistryStatus: string | null;
  clcCertificationNumber: string | null;
  clcRegistryUrl: string | null;
  renewalRequired: boolean;
  renewalDeadline: string | null;
  continuingEducationHours: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
}

interface MemberCertificatesProps {
  memberId: string;
  organizationId: string;
}

export function MemberCertificates({ memberId, organizationId }: MemberCertificatesProps) {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0, expired: 0 });

  const fetchCertifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        organizationId,
        memberId,
        includeExpired: "true",
      });

      const response = await fetch(`/api/education/certifications?${params}`);
      if (!response.ok) throw new Error("Failed to fetch certifications");

      const data = await response.json();
      setCertifications(data.certifications);
      setStats(data.stats);
    } catch (_error) {
toast.error("Failed to load certifications");
    } finally {
      setLoading(false);
    }
  }, [memberId, organizationId]);

  useEffect(() => {
    fetchCertifications();
  }, [fetchCertifications]);

  const downloadCertificate = async (certificationId: string, _certificateNumber: string) => {
    try {
      const cert = certifications.find((c) => c.id === certificationId);
      if (!cert?.certificateUrl) {
        toast.error("Certificate file not available");
        return;
      }

      // Open certificate URL in new tab
      window.open(cert.certificateUrl, "_blank");
      toast.success("Certificate opened in new tab");
    } catch (_error) {
toast.error("Failed to download certificate");
    }
  };

  const getStatusBadge = (cert: Certification) => {
    if (cert.certificationStatus === "revoked") {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (cert.certificationStatus === "suspended") {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Suspended</Badge>;
    }
    if (cert.isExpired) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    if (cert.isExpiringSoon) {
      return <Badge variant="outline" className="border-orange-500 text-orange-700">Expiring Soon</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Active</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No expiry";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Filter certifications
  const filteredCertifications = certifications.filter((cert) => {
    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "active" && cert.certificationStatus !== "active") return false;
      if (statusFilter === "expiring" && !cert.isExpiringSoon) return false;
      if (statusFilter === "expired" && !cert.isExpired) return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        cert.certificationName.toLowerCase().includes(query) ||
        cert.certificationNumber.toLowerCase().includes(query) ||
        cert.courseName?.toLowerCase().includes(query) ||
        cert.courseCode?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading certifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{stats.active}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold text-orange-500">{stats.expiring}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{stats.expired}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search certifications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sm:w-64"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Certifications</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="expiring">Expiring Soon</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Certifications Grid */}
      {filteredCertifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No certifications found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCertifications.map((cert) => (
            <Card key={cert.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{cert.certificationName}</CardTitle>
                    <CardDescription className="text-xs">
                      {cert.certificationNumber}
                    </CardDescription>
                  </div>
                  {getStatusBadge(cert)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Course Info */}
                {cert.courseName && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">{cert.courseName}</p>
                    {cert.courseCode && (
                      <p className="text-xs text-gray-500">Code: {cert.courseCode}</p>
                    )}
                  </div>
                )}

                {/* Issuing Body */}
                {cert.issuingBody && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Issued by:</span> {cert.issuingBody}
                  </div>
                )}

                {/* Dates */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Issued: {formatDate(cert.issueDate)}</span>
                  </div>
                  {cert.expiryDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span
                        className={
                          cert.isExpired
                            ? "text-red-600 font-medium"
                            : cert.isExpiringSoon
                            ? "text-orange-600 font-medium"
                            : "text-gray-600"
                        }
                      >
                        Expires: {formatDate(cert.expiryDate)}
                        {cert.daysUntilExpiry !== null && cert.daysUntilExpiry > 0 && (
                          <span className="ml-1">({cert.daysUntilExpiry} days)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* CLC Badge */}
                {cert.clcRegistryStatus === "approved" && (
                  <Badge variant="outline" className="border-green-500 text-green-700">
                    CLC Approved
                    {cert.clcCertificationNumber && ` â€¢ ${cert.clcCertificationNumber}`}
                  </Badge>
                )}

                {/* Renewal Warning */}
                {cert.renewalRequired && cert.renewalDeadline && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-xs text-yellow-800">
                        <p className="font-medium">Renewal Required</p>
                        <p>Deadline: {formatDate(cert.renewalDeadline)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* CE Hours */}
                {cert.continuingEducationHours && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">CE Hours:</span> {cert.continuingEducationHours}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {cert.certificateUrl && (
                    <Button
                      size="sm"
                      onClick={() => downloadCertificate(cert.id, cert.certificationNumber)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  )}
                  {cert.verificationUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(cert.verificationUrl!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  {cert.clcRegistryUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(cert.clcRegistryUrl!, "_blank")}
                      title="View in CLC Registry"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default MemberCertificates;

