/**
 * A/B Testing Admin Dashboard
 * 
 * SPRINT 8: Advanced Features
 * 
 * Manage and monitor A/B tests for marketing optimization
 */


export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FlaskConical,
  Play,
  Pause,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Plus,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

// Mock data for demonstration (in production, fetch from database)
const mockTests = [
  {
    id: 'test-1',
    name: 'Pilot Application Email Subject',
    description: 'Testing different subject lines for pilot approval emails',
    type: 'email-subject',
    status: 'active',
    startDate: new Date('2026-02-01'),
    currentSampleSize: 847,
    targetSampleSize: 1000,
    confidence: 92.5,
    variants: [
      {
        id: 'v1',
        name: 'Control (Direct)',
        impressions: 423,
        conversions: 87,
        conversionRate: 20.57,
        isControl: true,
      },
      {
        id: 'v2',
        name: 'Benefit-Focused',
        impressions: 424,
        conversions: 112,
        conversionRate: 26.42,
        isControl: false,
      },
    ],
  },
  {
    id: 'test-2',
    name: 'Landing Page CTA Button',
    description: 'Testing different call-to-action button text',
    type: 'cta-text',
    status: 'completed',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-02-10'),
    currentSampleSize: 1243,
    targetSampleSize: 1000,
    confidence: 97.8,
    winnerId: 'v2',
    variants: [
      {
        id: 'v1',
        name: 'Control (Apply Now)',
        impressions: 621,
        conversions: 93,
        conversionRate: 14.98,
        isControl: true,
      },
      {
        id: 'v2',
        name: 'Start Your Transformation',
        impressions: 622,
        conversions: 121,
        conversionRate: 19.45,
        isControl: false,
      },
    ],
  },
  {
    id: 'test-3',
    name: 'Testimonial Page Hero Message',
    description: 'Testing hero messages on testimonials landing page',
    type: 'landing-page',
    status: 'draft',
    currentSampleSize: 0,
    targetSampleSize: 800,
    confidence: 95.0,
    variants: [
      {
        id: 'v1',
        name: 'Control (Stories from Organizers)',
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
        isControl: true,
      },
      {
        id: 'v2',
        name: 'Real Impact, Real Stories',
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
        isControl: false,
      },
      {
        id: 'v3',
        name: 'From Union Leaders Like You',
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
        isControl: false,
      },
    ],
  },
];

export default function ABTestingDashboardPage() {
  const activeTests = mockTests.filter((t) => t.status === 'active').length;
  const completedTests = mockTests.filter((t) => t.status === 'completed').length;
  const draftTests = mockTests.filter((t) => t.status === 'draft').length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">A/B Testing</h1>
            <p className="mt-2 text-gray-600">
              Optimize marketing messages through data-driven experimentation
            </p>
          </div>
          <Link href="/admin/ab-testing/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Test
            </Button>
          </Link>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Active Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <FlaskConical className="h-8 w-8 text-blue-600" />
                <p className="text-3xl font-bold text-gray-900">{activeTests}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <p className="text-3xl font-bold text-gray-900">{completedTests}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-gray-400" />
                <p className="text-3xl font-bold text-gray-900">{draftTests}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Improvement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <p className="text-3xl font-bold text-green-600">+18.2%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tests Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active">Active ({activeTests})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedTests})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({draftTests})</TabsTrigger>
            <TabsTrigger value="all">All Tests ({mockTests.length})</TabsTrigger>
          </TabsList>

          {/* Active Tests */}
          <TabsContent value="active" className="space-y-6">
            {mockTests
              .filter((t) => t.status === 'active')
              .map((test) => (
                <TestCard key={test.id} test={test} />
              ))}
          </TabsContent>

          {/* Completed Tests */}
          <TabsContent value="completed" className="space-y-6">
            {mockTests
              .filter((t) => t.status === 'completed')
              .map((test) => (
                <TestCard key={test.id} test={test} />
              ))}
          </TabsContent>

          {/* Draft Tests */}
          <TabsContent value="draft" className="space-y-6">
            {mockTests
              .filter((t) => t.status === 'draft')
              .map((test) => (
                <TestCard key={test.id} test={test} />
              ))}
          </TabsContent>

          {/* All Tests */}
          <TabsContent value="all" className="space-y-6">
            {mockTests.map((test) => (
              <TestCard key={test.id} test={test} />
            ))}
          </TabsContent>
        </Tabs>

        {/* Quick Tips */}
        <Card>
          <CardHeader>
            <CardTitle>A/B Testing Best Practices</CardTitle>
            <CardDescription>Guidelines for effective experimentation</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Test one variable at a time</strong> - Isolate what drives the change
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Wait for statistical significance</strong> - Don&apos;t stop tests early (aim for 95%+ confidence)
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Define success metrics upfront</strong> - Know what conversion means for each test
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Document and share learnings</strong> - Help the labor movement learn from your tests
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Test Card Component
 */
function TestCard({ test }: { test: typeof mockTests[0] }) {
  const progress = (test.currentSampleSize / test.targetSampleSize) * 100;
  const bestVariant = test.variants.reduce((best, current) =>
    current.conversionRate > best.conversionRate ? current : best
  );
  const control = test.variants.find((v) => v.isControl);
  const improvement =
    control && bestVariant.id !== control.id
      ? ((bestVariant.conversionRate - control.conversionRate) / control.conversionRate) * 100
      : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CardTitle>{test.name}</CardTitle>
              <Badge
                variant={
                  test.status === 'active'
                    ? 'default'
                    : test.status === 'completed'
                    ? 'secondary'
                    : 'outline'
                }
              >
                {test.status}
              </Badge>
              {test.status === 'completed' && test.winnerId && (
                <Badge variant="default" className="bg-green-600">
                  Winner Detected
                </Badge>
              )}
            </div>
            <CardDescription>{test.description}</CardDescription>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span>Type: {test.type}</span>
              <span>|</span>
              <span>Started: {test.startDate?.toLocaleDateString()}</span>
              {test.endDate && (
                <>
                  <span>|</span>
                  <span>Ended: {test.endDate.toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          {test.status === 'active' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
              <Button variant="outline" size="sm">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Complete
              </Button>
            </div>
          )}

          {test.status === 'draft' && (
            <Button size="sm">
              <Play className="h-4 w-4 mr-1" />
              Start Test
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress */}
        {test.status !== 'draft' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Sample Size Progress</p>
              <p className="text-sm text-gray-600">
                {test.currentSampleSize} / {test.targetSampleSize} ({progress.toFixed(0)}%)
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Variants */}
        <div className="space-y-4">
          {test.variants.map((variant) => (
            <div key={variant.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{variant.name}</h4>
                  {variant.isControl && (
                    <Badge variant="outline" className="text-xs">
                      Control
                    </Badge>
                  )}
                  {test.winnerId === variant.id && (
                    <Badge className="bg-green-600 text-xs">Winner</Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{variant.conversionRate.toFixed(2)}%</p>
                  <p className="text-xs text-gray-600">conversion rate</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Impressions</p>
                  <p className="text-lg font-semibold text-gray-900">{variant.impressions}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Conversions</p>
                  <p className="text-lg font-semibold text-gray-900">{variant.conversions}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">vs Control</p>
                  {variant.isControl ? (
                    <p className="text-lg font-semibold text-gray-500">-</p>
                  ) : control ? (
                    <p
                      className={`text-lg font-semibold ${
                        variant.conversionRate > control.conversionRate
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {((variant.conversionRate - control.conversionRate) / control.conversionRate * 100).toFixed(1)}%
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Statistical Significance */}
        {test.status !== 'draft' && test.confidence > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Statistical Confidence</p>
                <p className="text-xs text-gray-600 mt-1">
                  {test.confidence >= 95 ? 'Results are statistically significant' : 'Continue test for significance'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{test.confidence.toFixed(1)}%</p>
                {improvement > 0 && (
                  <p className="text-sm text-green-600 font-medium">+{improvement.toFixed(1)}% improvement</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Details
          </Button>
          {test.status === 'completed' && test.winnerId && (
            <Button variant="default" size="sm">
              Deploy Winner
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
