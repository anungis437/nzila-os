/**
 * LRO Satisfaction Ratings Page
 * Steward-facing dashboard for viewing LRO performance metrics
 */
"use client";

import { useEffect, useState } from "react";
import { RepRatingsDashboard, type LroPerformanceData } from "@/components/satisfaction/rep-ratings-dashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LroRatingsPage() {
  const [rankings, setRankings] = useState<LroPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRankings() {
      try {
        const res = await fetch('/api/satisfaction/rankings');
        if (res.ok) {
          const json = await res.json();
          // withApi wraps response as { success, data: { rankings: [...] } }
          const data = json?.data?.rankings ?? json?.data ?? json?.rankings ?? [];
          setRankings(Array.isArray(data) ? data : []);
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }

    fetchRankings();
  }, []);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/stewards">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LRO Satisfaction Ratings</h1>
          <p className="text-muted-foreground">
            Member feedback on representative performance
          </p>
        </div>
      </div>

      <RepRatingsDashboard rankings={rankings} isLoading={loading} />
    </div>
  );
}
