"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
 
import { FileText, Plus, Edit2, Trash2, Eye, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface Policy {
  id: string;
  title: string;
  category: "hr" | "health-safety" | "grievance" | "communications" | "financial";
  description: string;
  status: "active" | "draft" | "under-review" | "archived";
  lastUpdated: string;
  updatedBy: string;
}

interface PolicyManagerProps {
  organizationId: string;
  canManage?: boolean;
}

export default function PolicyManager({ organizationId, canManage = false }: PolicyManagerProps) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/governance/policies/rules?organizationId=${encodeURIComponent(organizationId)}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPolicies(items.map((p: unknown, i: number) => ({
          id: String(p.id ?? i + 1),
          title: p.title ?? p.name ?? '',
          category: p.category ?? 'hr',
          description: p.description ?? '',
          status: p.status ?? 'active',
          lastUpdated: p.lastUpdated ?? p.updated_at ?? '',
          updatedBy: p.updatedBy ?? p.updated_by ?? '',
        })));
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      hr: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      "health-safety": "bg-red-500/10 text-red-700 border-red-500/20",
      grievance: "bg-purple-500/10 text-purple-700 border-purple-500/20",
      communications: "bg-green-500/10 text-green-700 border-green-500/20",
      financial: "bg-amber-500/10 text-amber-700 border-amber-500/20"
    };
    return colors[category as keyof typeof colors] || colors.hr;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "draft": return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      case "under-review": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "archived": return "bg-slate-500/10 text-slate-700 border-slate-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Policy Manager</h2>
          <p className="text-muted-foreground mt-1">
            Manage organizational policies and procedures
          </p>
        </div>
        {canManage && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Policy
          </Button>
        )}
      </div>

      {/* Policies Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {policies.map((policy) => (
          <Card key={policy.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <Badge variant="outline" className={getStatusColor(policy.status)}>
                  {policy.status}
                </Badge>
              </div>
              <CardTitle className="text-lg mt-2">{policy.title}</CardTitle>
              <CardDescription>{policy.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <Badge variant="outline" className={getCategoryColor(policy.category)}>
                  {policy.category.replace("-", " & ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </Badge>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Updated {new Date(policy.lastUpdated).toLocaleDateString()} by {policy.updatedBy}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="mr-1 h-3 w-3" />
                  View
                </Button>
                {canManage && (
                  <>
                    <Button variant="outline" size="sm">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
