"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Edit, History, Eye, Loader2 } from "lucide-react";
 
import { useState, useEffect, useCallback } from "react";

interface Bylaw {
  id: string;
  article: string;
  title: string;
  content: string;
  lastUpdated: string;
  version: number;
  status: "active" | "proposed" | "archived";
}

interface BylawsViewerProps {
  organizationId: string;
  canEdit?: boolean;
}

export default function BylawsViewer({ organizationId, canEdit = false }: BylawsViewerProps) {
  const [selectedBylaw, setSelectedBylaw] = useState<Bylaw | null>(null);
  const [bylaws, setBylaws] = useState<Bylaw[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBylaws = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/governance/bylaws?organizationId=${encodeURIComponent(organizationId)}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setBylaws(items.map((b: unknown, i: number) => ({
          id: String(b.id ?? i + 1),
          article: b.article ?? `Article ${String.fromCharCode(73 + i)}`,
          title: b.title ?? '',
          content: b.content ?? b.body ?? '',
          lastUpdated: b.lastUpdated ?? b.updated_at ?? b.last_updated ?? '',
          version: b.version ?? 1,
          status: b.status ?? 'active',
        })));
      }
    } catch {
      // API not available — empty state is shown
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchBylaws(); }, [fetchBylaws]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "proposed": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "archived": return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Bylaws List */}
      <div className="md:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bylaws Directory
            </CardTitle>
            <CardDescription>
              Organization governing documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bylaws.map((bylaw) => (
              <button
                key={bylaw.id}
                onClick={() => setSelectedBylaw(bylaw)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedBylaw?.id === bylaw.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-accent border-border"
                }`}
              >
                <div className="font-medium text-sm">{bylaw.article}</div>
                <div className="text-sm text-muted-foreground">{bylaw.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-xs ${getStatusColor(bylaw.status)}`}>
                    {bylaw.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    v{bylaw.version}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {canEdit && (
          <Button className="w-full">
            <Edit className="mr-2 h-4 w-4" />
            Propose Amendment
          </Button>
        )}
      </div>

      {/* Bylaw Content */}
      <div className="md:col-span-2">
        {selectedBylaw ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>{selectedBylaw.article}: {selectedBylaw.title}</CardTitle>
                  <CardDescription>
                    Last updated: {new Date(selectedBylaw.lastUpdated).toLocaleDateString()} • Version {selectedBylaw.version}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={getStatusColor(selectedBylaw.status)}>
                  {selectedBylaw.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <p>{selectedBylaw.content}</p>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm">
                  <History className="mr-2 h-4 w-4" />
                  View History
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Select a bylaw from the list to view its contents
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
