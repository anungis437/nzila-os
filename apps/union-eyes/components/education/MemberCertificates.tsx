"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Award, AlertTriangle, CheckCircle2, XCircle, Calendar, ExternalLink } from "lucide-react";
import { fetchAllRows } from "@/lib/client/crud-lists";
import {
  certificationState,
  daysBetween,
  formatDay,
  humanizeCode,
  readCertification,
  safeHttpsUrl,
  todayDay,
  type Certification,
  type CertificationState,
} from "./education-data";

/**
 * `memberId` is part of the page's contract but is not sent anywhere: the certifications route decides whose records the signed-in caller
 * may read (a member reads their own), and nothing the browser sends can widen that.
 */
interface MemberCertificatesProps {
  memberId: string;
  organizationId: string;
}

type View = { state: "loading" } | { state: "error"; reason: string } | { state: "ready"; certifications: Certification[] };

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function loadCertifications(): Promise<Certification[]> {
  const rows = await fetchAllRows<unknown>("/api/education/certifications");
  return rows.map(readCertification);
}

export function MemberCertificates({ organizationId }: MemberCertificatesProps) {
  const locale = useLocale();
  const [view, setView] = useState<View>({ state: "loading" });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const request = useRef(0);

  // The latest request wins: a slow answer to an earlier request (or to another organization) is never shown.
  const load = useCallback(() => {
    const id = ++request.current;
    loadCertifications().then(
      (certifications) => {
        if (id === request.current) setView({ state: "ready", certifications });
      },
      (error: unknown) => {
        if (id === request.current) setView({ state: "error", reason: reasonOf(error) });
      },
    );
  }, []);

  useEffect(() => {
    load();
    return () => {
      request.current += 1;
    };
  }, [organizationId, load]);

  const retry = () => {
    setView({ state: "loading" });
    load();
  };

  if (view.state === "loading") {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-busy="true">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading certifications...</p>
        </div>
      </div>
    );
  }

  if (view.state === "error") {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 p-4 text-sm">
        <p className="font-medium text-destructive">Your certifications could not be loaded.</p>
        <p className="text-muted-foreground">{view.reason}</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  }

  const today = todayDay();
  const rows = view.certifications.map((cert) => ({ cert, state: certificationState(cert, today) }));
  const count = (state: CertificationState) => rows.filter((row) => row.state === state).length;
  const query = searchQuery.trim().toLowerCase();
  const visible = rows.filter(({ cert, state }) => {
    if (statusFilter !== "all" && state !== statusFilter) return false;
    if (!query) return true;
    return cert.name.toLowerCase().includes(query) || (cert.number ?? "").toLowerCase().includes(query);
  });

  const badgeOf = (state: CertificationState) => {
    switch (state) {
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      case "suspended":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Suspended</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-blue-500 text-blue-700">Pending verification</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "expiring":
        return <Badge variant="outline" className="border-orange-500 text-orange-700">Expiring Soon</Badge>;
      default:
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
    }
  };

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
              <span className="text-2xl font-bold" data-testid="stat-total">{rows.length}</span>
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
              <span className="text-2xl font-bold text-green-600" data-testid="stat-active">{count("active")}</span>
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
              <span className="text-2xl font-bold text-orange-500" data-testid="stat-expiring">{count("expiring")}</span>
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
              <span className="text-2xl font-bold text-red-600" data-testid="stat-expired">{count("expired")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="space-y-1 sm:w-64">
          <Label htmlFor="certification-search" className="sr-only">Search certifications</Label>
          <Input
            id="certification-search"
            placeholder="Search certifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:w-56">
          <Label htmlFor="certification-status" className="sr-only">Filter by status</Label>
          <select
            id="certification-status"
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Certifications</option>
            <option value="active">Active Only</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
            <option value="pending">Pending verification</option>
          </select>
        </div>
      </div>

      {/* Certifications Grid */}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {rows.length === 0 ? (
              <p className="text-gray-600">No certifications are recorded for you yet.</p>
            ) : (
              <p className="text-gray-600">No certification matches these filters.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map(({ cert, state }) => {
            const certificateUrl = safeHttpsUrl(cert.certificateUrl);
            const badgeUrl = safeHttpsUrl(cert.digitalBadgeUrl);
            const daysLeft = cert.expiryDate !== null ? daysBetween(today, cert.expiryDate) : null;
            return (
              <Card key={cert.id} className="hover:shadow-lg transition-shadow" data-testid="certification-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{cert.name}</CardTitle>
                      {cert.number !== null && <CardDescription className="text-xs">{cert.number}</CardDescription>}
                    </div>
                    {badgeOf(state)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cert.type !== null && <p className="text-sm text-gray-600">{humanizeCode(cert.type)}</p>}

                  {cert.issuer !== null && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Issued by:</span> {cert.issuer}
                    </div>
                  )}

                  {/* Dates */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>Issued: {formatDay(cert.issueDate, locale, "long")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span
                        className={
                          state === "expired"
                            ? "text-red-600 font-medium"
                            : state === "expiring"
                            ? "text-orange-600 font-medium"
                            : "text-gray-600"
                        }
                      >
                        {cert.expiryDate === null ? "No expiry date" : `Expires: ${formatDay(cert.expiryDate, locale, "long")}`}
                        {daysLeft !== null && daysLeft > 0 && state !== "revoked" && <span className="ml-1">({daysLeft} days)</span>}
                      </span>
                    </div>
                  </div>

                  {state === "pending" && (
                    <p className="text-xs text-muted-foreground">This certification is waiting for verification by your union.</p>
                  )}

                  {cert.clcRegistered && (
                    <Badge variant="outline" className="border-green-500 text-green-700">
                      CLC Registered
                      {cert.clcRegistrationNumber !== null && ` • ${cert.clcRegistrationNumber}`}
                    </Badge>
                  )}

                  {cert.renewalRequired && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div className="text-xs text-yellow-800">
                          <p className="font-medium">Renewal Required</p>
                          {cert.renewalDate !== null && <p>Renew by: {formatDay(cert.renewalDate, locale)}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {(certificateUrl !== null || badgeUrl !== null) && (
                    <div className="flex gap-2 pt-2">
                      {certificateUrl !== null && (
                        <Button asChild size="sm" className="flex-1">
                          <a href={certificateUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                            <Download className="h-4 w-4 mr-1" />
                            Open certificate
                          </a>
                        </Button>
                      )}
                      {badgeUrl !== null && (
                        <Button asChild size="sm" variant="outline">
                          <a href={badgeUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Digital badge
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MemberCertificates;
