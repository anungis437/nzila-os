"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Award, Plus, Download, AlertTriangle, CheckCircle2, XCircle, Search, Filter, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface _Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Course {
  id: string;
  courseName: string;
  courseCode: string;
  certificationName: string | null;
  certificationValidityPeriod: number | null;
}

interface Certification {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  certificationName: string;
  certificationNumber: string;
  issueDate: string;
  expiryDate: string | null;
  certificationStatus: string;
  courseName: string | null;
  certificateUrl: string | null;
  renewalRequired: boolean;
  renewalDeadline: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
}

interface CertificationManagerProps {
  organizationId: string;
}

export function CertificationManager({ organizationId }: CertificationManagerProps) {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0, expired: 0 });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCertifications, setSelectedCertifications] = useState<Set<string>>(new Set());
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);

  // Issue certificate form state
  const [issueForm, setIssueForm] = useState({
    memberId: "",
    certificationName: "",
    certificationCategory: "",
    issuingBody: "",
    courseId: "",
    issueDate: new Date().toISOString().split("T")[0],
    expiryDate: "",
    renewalRequired: false,
    continuingEducationHours: "",
  });

  const fetchCertifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        organizationId,
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
  }, [organizationId]);

  const fetchCourses = useCallback(async () => {
    try {
      const params = new URLSearchParams({ organizationId });
      const response = await fetch(`/api/education/courses?${params}`);
      if (!response.ok) throw new Error("Failed to fetch courses");

      const data = await response.json();
      setCourses(data.courses);
    } catch (_error) {
}
  }, [organizationId]);

  useEffect(() => {
    fetchCertifications();
    fetchCourses();
  }, [fetchCertifications, fetchCourses]);

  const handleIssueCertification = async () => {
    try {
      if (!issueForm.memberId || !issueForm.certificationName || !issueForm.issueDate) {
        toast.error("Please fill in all required fields");
        return;
      }

      const response = await fetch("/api/education/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          memberId: issueForm.memberId,
          certificationName: issueForm.certificationName,
          certificationCategory: issueForm.certificationCategory || null,
          issuingBody: issueForm.issuingBody || null,
          courseId: issueForm.courseId || null,
          issueDate: issueForm.issueDate,
          expiryDate: issueForm.expiryDate || null,
          renewalRequired: issueForm.renewalRequired,
          continuingEducationHours: issueForm.continuingEducationHours
            ? parseFloat(issueForm.continuingEducationHours)
            : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to issue certification");

      const _data = await response.json();
      toast.success("Certification issued successfully");
      setIsIssueDialogOpen(false);
      resetIssueForm();
      fetchCertifications();
    } catch (_error) {
toast.error("Failed to issue certification");
    }
  };

  const _handleGenerateCertificates = async () => {
    if (selectedCertifications.size === 0) {
      toast.error("Please select certifications to generate PDFs for");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const certId of Array.from(selectedCertifications)) {
      try {
        const cert = certifications.find((c) => c.id === certId);
        if (!cert) continue;

        // Generate certificate (this would need registrationId)
        // For manual certifications, we&apos;d need a different approach
        toast.info(`Generating certificate for ${cert.firstName} ${cert.lastName}...`);
        successCount++;
      } catch (_error) {
failCount++;
      }
    }

    toast.success(`Generated ${successCount} certificates`);
    if (failCount > 0) {
      toast.error(`Failed to generate ${failCount} certificates`);
    }
    setSelectedCertifications(new Set());
  };

  const handleSendRenewalReminders = async () => {
    if (selectedCertifications.size === 0) {
      toast.error("Please select certifications to send reminders for");
      return;
    }

    try {
      const response = await fetch('/api/education/certifications/renewal-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificationIds: Array.from(selectedCertifications),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send renewal reminders');
      }

      const data = await response.json();
      toast.success(`Sent ${data.sent || selectedCertifications.size} renewal reminder emails`);
      setSelectedCertifications(new Set());
    } catch (_error) {
toast.error('Failed to send renewal reminders');
    }
  };

  const handleRevokeCertification = async (certificationId: string) => {
    const reason = window.prompt("Enter reason for revocation:");
    if (!reason) return;

    try {
      const response = await fetch(
        `/api/education/certifications?id=${certificationId}&reason=${encodeURIComponent(reason)}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to revoke certification");

      toast.success("Certification revoked successfully");
      fetchCertifications();
    } catch (_error) {
toast.error("Failed to revoke certification");
    }
  };

  const resetIssueForm = () => {
    setIssueForm({
      memberId: "",
      certificationName: "",
      certificationCategory: "",
      issuingBody: "",
      courseId: "",
      issueDate: new Date().toISOString().split("T")[0],
      expiryDate: "",
      renewalRequired: false,
      continuingEducationHours: "",
    });
  };

  const toggleCertificationSelection = (certId: string) => {
    const newSelected = new Set(selectedCertifications);
    if (newSelected.has(certId)) {
      newSelected.delete(certId);
    } else {
      newSelected.add(certId);
    }
    setSelectedCertifications(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCertifications.size === filteredCertifications.length) {
      setSelectedCertifications(new Set());
    } else {
      setSelectedCertifications(new Set(filteredCertifications.map((c) => c.id)));
    }
  };

  const getStatusBadge = (cert: Certification) => {
    if (cert.certificationStatus === "revoked") {
      return <Badge variant="destructive">Revoked</Badge>;
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
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
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
        cert.firstName.toLowerCase().includes(query) ||
        cert.lastName.toLowerCase().includes(query) ||
        cert.memberNumber.toLowerCase().includes(query)
      );
    }

    return true;
  });

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
            <CardTitle className="text-sm font-medium text-gray-600">Expiring Soon (90 days)</CardTitle>
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

      {/* Actions and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search certifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Certifications</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="expiring">Expiring Soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchCertifications}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Issue Certification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Issue New Certification</DialogTitle>
              <DialogDescription>
                Issue a manual certification to a member (not course-based)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="memberId">Member ID *</Label>
                <Input
                  id="memberId"
                  value={issueForm.memberId}
                  onChange={(e) => setIssueForm({ ...issueForm, memberId: e.target.value })}
                  placeholder="Enter member ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certificationName">Certification Name *</Label>
                <Input
                  id="certificationName"
                  value={issueForm.certificationName}
                  onChange={(e) => setIssueForm({ ...issueForm, certificationName: e.target.value })}
                  placeholder="e.g., OSHA 30-Hour Construction"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="certificationCategory">Category</Label>
                  <Select
                    value={issueForm.certificationCategory}
                    onValueChange={(value) => setIssueForm({ ...issueForm, certificationCategory: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safety">Safety & Health</SelectItem>
                      <SelectItem value="technical">Technical Skills</SelectItem>
                      <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
                      <SelectItem value="professional">Professional Development</SelectItem>
                      <SelectItem value="regulatory">Regulatory Compliance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issuingBody">Issuing Body</Label>
                  <Input
                    id="issuingBody"
                    value={issueForm.issuingBody}
                    onChange={(e) => setIssueForm({ ...issueForm, issuingBody: e.target.value })}
                    placeholder="e.g., OSHA, Union Local"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="courseId">Related Course (Optional)</Label>
                <Select
                  value={issueForm.courseId}
                  onValueChange={(value) => setIssueForm({ ...issueForm, courseId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.courseName} ({course.courseCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date *</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={issueForm.issueDate}
                    onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={issueForm.expiryDate}
                    onChange={(e) => setIssueForm({ ...issueForm, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="continuingEducationHours">CE Hours</Label>
                <Input
                  id="continuingEducationHours"
                  type="number"
                  step="0.5"
                  value={issueForm.continuingEducationHours}
                  onChange={(e) =>
                    setIssueForm({ ...issueForm, continuingEducationHours: e.target.value })
                  }
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="renewalRequired"
                  checked={issueForm.renewalRequired}
                  onCheckedChange={(checked) =>
                    setIssueForm({ ...issueForm, renewalRequired: checked as boolean })
                  }
                />
                <Label htmlFor="renewalRequired" className="cursor-pointer">
                  Renewal Required
                </Label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleIssueCertification} className="flex-1">
                  Issue Certification
                </Button>
                <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bulk Actions */}
      {selectedCertifications.size > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                {selectedCertifications.size} certification(s) selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleSendRenewalReminders}>
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Send Reminders
                </Button>
                <Button size="sm" onClick={() => setSelectedCertifications(new Set())}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certifications Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading certifications...</p>
          </div>
        </div>
      ) : filteredCertifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No certifications found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedCertifications.size === filteredCertifications.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Certification</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCertifications.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCertifications.has(cert.id)}
                      onCheckedChange={() => toggleCertificationSelection(cert.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {cert.firstName} {cert.lastName}
                      </p>
                      <p className="text-xs text-gray-500">#{cert.memberNumber}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{cert.certificationName}</p>
                      {cert.courseName && (
                        <p className="text-xs text-gray-500">{cert.courseName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{cert.certificationNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(cert.issueDate)}</TableCell>
                  <TableCell className="text-sm">
                    {cert.expiryDate ? (
                      <div>
                        <p className={cert.isExpired ? "text-red-600" : cert.isExpiringSoon ? "text-orange-600" : ""}>
                          {formatDate(cert.expiryDate)}
                        </p>
                        {cert.daysUntilExpiry !== null && cert.daysUntilExpiry > 0 && (
                          <p className="text-xs text-gray-500">{cert.daysUntilExpiry}d remaining</p>
                        )}
                      </div>
                    ) : (
                      "No expiry"
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(cert)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {cert.certificateUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(cert.certificateUrl!, "_blank")}
                          title="Download Certificate"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {cert.certificationStatus === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeCertification(cert.id)}
                          title="Revoke Certification"
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

