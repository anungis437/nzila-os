/**
 * Legislative Brief Export Page
 * 
 * Generate PDF briefs for union advocacy based on movement insights.
 */


export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { movementTrends } from '@/db/schema/domains/marketing';
import { gte } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Shield } from 'lucide-react';
import { generateLegislativeBrief } from '@/lib/movement-insights/aggregation-service';
import { MovementTrend } from '@/types/marketing';
 
import Link from 'next/link';

interface ExportPageProps {
  params: {
    locale: string;
  };
  searchParams: {
    focusArea?: string;
    jurisdiction?: string;
    timeframe?: string;
  };
}

export default async function LegislativeBriefExportPage({
  params,
  searchParams,
}: ExportPageProps) {
  const { locale } = params;
  const { focusArea = 'Workplace Dispute Resolution', jurisdiction, timeframe: _timeframe = 'quarter' } = searchParams;

  // Get relevant trends
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trends = await db
    .select()
    .from(movementTrends)
    .where(
      gte(movementTrends.createdAt, thirtyDaysAgo)
    )
    .orderBy(movementTrends.createdAt);

  // Note: jurisdiction column doesn't exist on movementTrends; filtering removed
  const filteredTrends = trends as unknown as MovementTrend[];

  // Generate brief
  const brief = generateLegislativeBrief(filteredTrends, focusArea);

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">Legislative Brief</h1>
          <p className="text-muted-foreground mt-2">
            Export anonymized insights for advocacy and policy work
          </p>
        </div>

        <Button asChild>
          <Link href={`/${locale}/dashboard/movement-insights`}>
            Back to Insights
          </Link>
        </Button>
      </div>

      {/* Brief Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{brief.title}</CardTitle>
              <CardDescription className="mt-2">
                {brief.summary}
              </CardDescription>
            </div>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Findings */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Key Findings</h3>
            <ul className="space-y-2">
              {brief.keyFindings.map((finding, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="mt-0.5">
                    {index + 1}
                  </Badge>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          {brief.recommendations.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {brief.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Badge variant="default" className="mt-0.5">
                      {index + 1}
                    </Badge>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Source */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 mt-0.5" />
              <div>
                <strong>Data Source:</strong> {brief.dataSource}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customization Options */}
      <Card>
        <CardHeader>
          <CardTitle>Customize Brief</CardTitle>
          <CardDescription>
            Filter insights by focus area, jurisdiction, or timeframe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Focus Area</label>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={focusArea === 'Workplace Dispute Resolution' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  Workplace Disputes
                </Badge>
                <Badge 
                  variant={focusArea === 'Healthcare' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  Healthcare
                </Badge>
                <Badge 
                  variant={focusArea === 'Education' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  Education
                </Badge>
                <Badge 
                  variant={focusArea === 'Public Sector' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  Public Sector
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Jurisdiction</label>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={!jurisdiction ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  All Canada
                </Badge>
                <Badge 
                  variant={jurisdiction === 'ON' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  Ontario
                </Badge>
                <Badge 
                  variant={jurisdiction === 'BC' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  BC
                </Badge>
                <Badge 
                  variant={jurisdiction === 'QC' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  Quebec
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            How to Use This Brief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>For Union Leadership:</strong> Use these insights in strategic planning,
            contract negotiations, and member communications.
          </p>
          <p>
            <strong>For CLC Advocacy:</strong> Reference anonymized data in legislative
            submissions, policy papers, and public reports.
          </p>
          <p>
            <strong>For Media Relations:</strong> Cite cross-union trends to demonstrate
            systemic workplace issues requiring policy solutions.
          </p>
          <p className="text-muted-foreground">
            <strong>Note:</strong> All data is anonymized. No individual organization or member can
            be identified. Minimum 5 unions and 10 cases required for all metrics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
