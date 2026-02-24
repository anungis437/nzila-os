/**
 * Benefit Comparison Component
 * 
 * Comprehensive comparison of benefits packages across CBAs.
 * Compares health insurance, vacation, pension, and other benefits with analytics.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Heart,
  Calendar,
  PiggyBank,
  Briefcase,
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';

interface BenefitComparison {
  id: string;
  clauseId: string;
  cbaId: string;
  cbaNumber: string;
  employerName: string;
  unionName: string;
  sector: string;
  jurisdiction: string;
  benefitCategory: 'health' | 'dental' | 'vision' | 'pension' | 'vacation' | 'sick_leave' | 'life_insurance' | 'disability' | 'other';
  benefitType: string;
  description: string;
  coverageLevel: 'full' | 'partial' | 'none';
  employerContribution: number;
  employeeContribution: number;
  waitingPeriod: number;
  eligibilityCriteria: string;
  notes: string;
  effectiveDate: string;
  comparisonScore: number;
}

interface BenefitScore {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
  rank: number;
  totalCBAs: number;
}

interface BenefitComparisonProps {
  organizationId?: string;
  sector?: string;
  jurisdiction?: string;
  cbaIds?: string[];
}

export function BenefitComparison({
  organizationId,
  sector,
  jurisdiction,
  cbaIds,
}: BenefitComparisonProps) {
  const [benefits, setBenefits] = useState<BenefitComparison[]>([]);
  const [scores, setScores] = useState<BenefitScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>(sector || 'all');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>(jurisdiction || 'all');
  const [viewMode, setViewMode] = useState<'comparison' | 'scores'>('comparison');
  const [comparisonMode, _setComparisonMode] = useState<'side-by-side' | 'matrix'>('side-by-side');

  const [sectors, setSectors] = useState<string[]>([]);
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);

  const benefitCategories = [
    { value: 'health', label: 'Health Insurance', icon: Heart },
    { value: 'dental', label: 'Dental', icon: Heart },
    { value: 'vision', label: 'Vision', icon: Heart },
    { value: 'pension', label: 'Pension', icon: PiggyBank },
    { value: 'vacation', label: 'Vacation', icon: Calendar },
    { value: 'sick_leave', label: 'Sick Leave', icon: Calendar },
    { value: 'life_insurance', label: 'Life Insurance', icon: Briefcase },
    { value: 'disability', label: 'Disability', icon: Briefcase },
    { value: 'other', label: 'Other Benefits', icon: Briefcase },
  ];

  useEffect(() => {
    fetchBenefitData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, selectedCategory, selectedSector, selectedJurisdiction, cbaIds]);

  const fetchBenefitData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (organizationId) params.append('organizationId', organizationId);
      if (selectedSector !== 'all') params.append('sector', selectedSector);
      if (selectedJurisdiction !== 'all') params.append('jurisdiction', selectedJurisdiction);
      if (selectedCategory !== 'all') params.append('benefitCategory', selectedCategory);
      if (cbaIds && cbaIds.length > 0) {
        cbaIds.forEach(id => params.append('cbaIds', id));
      }
      params.append('limit', '200');

      // Fetch benefits through clauses API
      const response = await fetch(`/api/clauses?${params.toString()}&clauseType=benefits_insurance`);
      if (!response.ok) throw new Error('Failed to fetch benefit data');

      const _data = await response.json();
      
      // Transform clause data to benefit comparisons
      // In a real implementation, this would come from benefit_comparisons table
      const benefitData: BenefitComparison[] = [];
      const scoreData: BenefitScore[] = [];

      setBenefits(benefitData);
      setScores(scoreData);

      // Extract unique values for filters
      const uniqueSectors = [...new Set(benefitData.map(b => b.sector))];
      const uniqueJurisdictions = [...new Set(benefitData.map(b => b.jurisdiction))];

      setSectors(uniqueSectors);
      setJurisdictions(uniqueJurisdictions);
    } catch (err) {
setError(err instanceof Error ? err.message : 'Failed to load benefit comparisons');
    } finally {
      setLoading(false);
    }
  };

  const getCoverageIcon = (level: BenefitComparison['coverageLevel']) => {
    switch (level) {
      case 'full':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'none':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getCoverageBadge = (level: BenefitComparison['coverageLevel']) => {
    const variants = {
      full: 'bg-green-500',
      partial: 'bg-yellow-500',
      none: 'bg-red-500',
    };
    
    return (
      <Badge className={variants[level]}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  const calculateBenefitScore = (benefit: BenefitComparison): number => {
    let score = 0;
    
    // Coverage level (40 points)
    if (benefit.coverageLevel === 'full') score += 40;
    else if (benefit.coverageLevel === 'partial') score += 20;
    
    // Employer contribution (30 points)
    score += Math.min(30, (benefit.employerContribution / 100) * 30);
    
    // Waiting period (15 points - lower is better)
    if (benefit.waitingPeriod === 0) score += 15;
    else if (benefit.waitingPeriod <= 30) score += 10;
    else if (benefit.waitingPeriod <= 90) score += 5;
    
    // Comparison score (15 points)
    score += (benefit.comparisonScore / 100) * 15;
    
    return Math.round(score);
  };

  const groupBenefitsByCBA = () => {
    const grouped = new Map<string, BenefitComparison[]>();
    
    benefits.forEach(benefit => {
      const key = benefit.cbaId;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(benefit);
    });
    
    return grouped;
  };

  const exportComparison = () => {
    // Generate CSV export
    const headers = ['Employer', 'Union', 'Benefit Type', 'Coverage', 'Employer %', 'Employee %', 'Waiting Period', 'Score'];
    const rows = benefits.map(b => [
      b.employerName,
      b.unionName,
      b.benefitType,
      b.coverageLevel,
      b.employerContribution,
      b.employeeContribution,
      b.waitingPeriod,
      calculateBenefitScore(b),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benefit-comparison-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedBenefits = groupBenefitsByCBA();

  return (
    <div className="space-y-4">
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Benefit Comparison
              </CardTitle>
              <CardDescription>
                Compare benefit packages across CBAs and analyze coverage
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportComparison}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'comparison' | 'scores')}>
                <TabsList>
                  <TabsTrigger value="comparison">Comparison</TabsTrigger>
                  <TabsTrigger value="scores">Scores</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filter by benefit type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Benefits</SelectItem>
                {benefitCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedJurisdiction} onValueChange={setSelectedJurisdiction}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by jurisdiction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jurisdictions</SelectItem>
                {jurisdictions.map(j => (
                  <SelectItem key={j} value={j}>{j}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSector('all');
                setSelectedJurisdiction('all');
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Benefit Category Overview */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {benefitCategories.map(category => {
          const count = benefits.filter(b => b.benefitCategory === category.value).length;
          const Icon = category.icon;
          
          return (
            <Card key={category.value}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">{category.label}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                  <p className="text-xs text-muted-foreground">CBAs</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison View */}
      {viewMode === 'comparison' && (
        <>
          {comparisonMode === 'side-by-side' ? (
            <div className="space-y-4">
              {Array.from(groupedBenefits.entries()).map(([cbaId, cbaBenefits]) => {
                if (cbaBenefits.length === 0) return null;
                
                const firstBenefit = cbaBenefits[0];
                const totalScore = cbaBenefits.reduce((sum, b) => sum + calculateBenefitScore(b), 0);
                const avgScore = Math.round(totalScore / cbaBenefits.length);
                
                return (
                  <Card key={cbaId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {firstBenefit.employerName} - {firstBenefit.unionName}
                          </CardTitle>
                          <CardDescription>
                            {firstBenefit.sector} â€¢ {firstBenefit.jurisdiction}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{avgScore}/100</div>
                          <div className="text-sm text-muted-foreground">Benefit Score</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Benefit Type</TableHead>
                              <TableHead>Coverage</TableHead>
                              <TableHead>Employer Contribution</TableHead>
                              <TableHead>Employee Contribution</TableHead>
                              <TableHead>Waiting Period</TableHead>
                              <TableHead className="text-right">Score</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cbaBenefits.map((benefit) => (
                              <TableRow key={benefit.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {getCoverageIcon(benefit.coverageLevel)}
                                    {benefit.benefitType}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getCoverageBadge(benefit.coverageLevel)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Progress value={benefit.employerContribution} className="w-20" />
                                    <span className="text-sm font-medium">
                                      {benefit.employerContribution}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">
                                    {benefit.employeeContribution}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {benefit.waitingPeriod === 0 ? (
                                    <Badge variant="secondary">Immediate</Badge>
                                  ) : (
                                    <span className="text-sm">{benefit.waitingPeriod} days</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Progress 
                                      value={calculateBenefitScore(benefit)} 
                                      className="w-16" 
                                    />
                                    <span className="text-sm font-bold">
                                      {calculateBenefitScore(benefit)}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {/* Additional Details */}
                      {cbaBenefits.some(b => b.notes) && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <h5 className="font-semibold text-sm mb-2">Additional Notes</h5>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {cbaBenefits
                              .filter(b => b.notes)
                              .map((b, i) => (
                                <li key={i}>â€¢ {b.benefitType}: {b.notes}</li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Matrix view - Coming soon
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground py-12">
                  <p>Matrix view coming soon</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Scores View */}
      {viewMode === 'scores' && (
        <Card>
          <CardContent className="pt-6">
            {scores.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No benefit scores available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scores.map((score) => (
                  <div key={score.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{score.category}</h4>
                        <p className="text-sm text-muted-foreground">
                          Rank {score.rank} of {score.totalCBAs} CBAs
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {score.percentage}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {score.score}/{score.maxScore}
                        </div>
                      </div>
                    </div>
                    <Progress value={score.percentage} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

