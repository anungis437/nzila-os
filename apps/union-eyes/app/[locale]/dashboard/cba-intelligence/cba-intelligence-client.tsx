"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SourceRegistryTable } from "@/components/cba-intelligence/source-registry-table";
import { IngestionMonitor } from "@/components/cba-intelligence/ingestion-monitor";
import { AgreementExplorer } from "@/components/cba-intelligence/agreement-explorer";
import { ReviewQueue } from "@/components/cba-intelligence/review-queue";
import { BenchmarkView } from "@/components/cba-intelligence/benchmark-view";
import { FreshnessDashboard } from "@/components/cba-intelligence/freshness-dashboard";
import { Database } from "lucide-react";

export function CbaIntelligenceClient() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Institutional Labor Continuity Intelligence</h1>
          <p className="text-muted-foreground">
            Governance-safe continuity operations for agreement sources, ingestion, review, and institutional memory support
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        This surface supports continuity interpretation and stewardship operations. It does not
        issue authoritative labor rulings. Escalate governance-sensitive conclusions to human
        steward, committee, or executive review.
      </div>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="ingestion">Ingestion</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
          <TabsTrigger value="freshness">Freshness</TabsTrigger>
        </TabsList>
        <TabsContent value="sources">
          <SourceRegistryTable />
        </TabsContent>
        <TabsContent value="ingestion">
          <IngestionMonitor />
        </TabsContent>
        <TabsContent value="agreements">
          <AgreementExplorer />
        </TabsContent>
        <TabsContent value="review">
          <ReviewQueue />
        </TabsContent>
        <TabsContent value="benchmark">
          <BenchmarkView />
        </TabsContent>
        <TabsContent value="freshness">
          <FreshnessDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
