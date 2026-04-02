"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SourceRegistryTable,
  IngestionMonitor,
  AgreementExplorer,
  ReviewQueue,
  BenchmarkView,
  FreshnessDashboard,
} from "@/components/cba-intelligence";
import { useFeatureFlag } from "@/lib/hooks/use-feature-flags";
import { Database } from "lucide-react";

export default function CbaIntelligencePage() {
  const enabled = useFeatureFlag("cba_intelligence");

  if (!enabled) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Database className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
        <p>CBA Intelligence is not enabled for your organization.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">CBA Intelligence</h1>
        <p className="text-muted-foreground mt-2">
          Canadian public collective bargaining agreement intelligence — source
          registry, ingestion pipeline, agreement exploration, and benchmarking
        </p>
      </div>

      <Tabs defaultValue="sources">
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
