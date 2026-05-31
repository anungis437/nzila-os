"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
 
import { PenTool, UserCheck, Shield, Plus, Edit, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface Signatory {
  id: string;
  name: string;
  role: string;
  title: string;
  authority: "full" | "limited" | "financial-only";
  activeFrom: string;
  activeTo?: string;
  status: "active" | "inactive" | "pending";
  documents: string[];
}

interface SignatoryManagerProps {
  organizationId: string;
  canManage?: boolean;
}

export default function SignatoryManager({ organizationId, canManage = false }: SignatoryManagerProps) {
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignatories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/governance/signatories?organizationId=${encodeURIComponent(organizationId)}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSignatories(items.map((s: any, i: number) => ({
          id: String(s.id ?? i + 1),
          name: s.name ?? s.full_name ?? '',
          role: s.role ?? '',
          title: s.title ?? s.role ?? '',
          authority: s.authority ?? 'limited',
          activeFrom: s.activeFrom ?? s.active_from ?? '',
          activeTo: s.activeTo ?? s.active_to,
          status: s.status ?? 'active',
          documents: s.documents ?? [],
        })));
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchSignatories(); }, [fetchSignatories]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const getAuthorityColor = (authority: string) => {
    switch (authority) {
      case "full": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "limited": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "financial-only": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "pending": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "inactive": return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <PenTool className="h-6 w-6" />
            Signatory Manager
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage authorized signatories for union documents
          </p>
        </div>
        {canManage && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Signatory
          </Button>
        )}
      </div>

      {/* Signatories List */}
      <div className="grid gap-4 md:grid-cols-2">
        {signatories.map((signatory) => (
          <Card key={signatory.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{signatory.name}</CardTitle>
                    <CardDescription>{signatory.title}</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className={getStatusColor(signatory.status)}>
                  {signatory.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Authority Level */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Authority Level
                  </span>
                  <Badge variant="outline" className={getAuthorityColor(signatory.authority)}>
                    {signatory.authority.replace(/-/g, " ").toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Authorized Documents */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Authorized Documents</span>
                <div className="flex flex-wrap gap-1">
                  {signatory.documents.map((doc) => (
                    <Badge key={doc} variant="secondary" className="text-xs">
                      {doc}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Active Period */}
              <div className="text-xs text-muted-foreground">
                Active from {new Date(signatory.activeFrom).toLocaleDateString()}
                {signatory.activeTo && ` to ${new Date(signatory.activeTo).toLocaleDateString()}`}
              </div>

              {/* Actions */}
              {canManage && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    View History
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
