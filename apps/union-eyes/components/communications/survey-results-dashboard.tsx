/**
 * Survey Results Dashboard Component (Phase 5 - Week 2)
 * Visualize survey responses with charts and analytics
 * 
 * Features:
 * - Overview statistics (responses, completion rate, avg time)
 * - Question-by-question breakdown with charts
 * - Bar/pie charts for choice-based questions
 * - Line chart for rating distribution
 * - Export to CSV/Excel
 * - Date range filtering
 * - Individual response viewer
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Download,
  Users,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface SurveyResultsDashboardProps {
  surveyId: string;
  organizationId: string;
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  status: string;
  publishedAt?: string;
}

interface QuestionResult {
  question: {
    id: string;
    questionText: string;
    questionType: string;
    choices?: Array<{ id: string; text: string }>;
  };
  totalAnswers: number;
  answerBreakdown: {
    text?: Array<{ text: string; count: number }>;
    choices?: Array<{ choice: string; choiceText: string; count: number; percentage: number }>;
    rating?: {
      average: number;
      min: number;
      max: number;
      distribution: Array<{ value: number; count: number }>;
    };
    yesNo?: { yes: number; no: number };
  };
}

interface SurveyResults {
  survey: Survey;
  totalResponses: number;
  completedResponses: number;
  completionRate: number;
  averageTimeSpent: number;
  questionResults: QuestionResult[];
}

export function SurveyResultsDashboard({ surveyId, organizationId }: SurveyResultsDashboardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [dateRange, setDateRange] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  const loadResults = useCallback(async () => {
    try {
      const url = `/api/communications/surveys/${surveyId}/results?dateRange=${dateRange}`;
      const response = await fetch(url, {
        headers: {
          'X-Organization-ID': organizationId,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load results');

      const data = await response.json();
      setResults(data);
      setIsLoading(false);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load survey results',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId, dateRange, toast]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/communications/surveys/${surveyId}/export?format=csv`, {
        headers: {
          'X-Organization-ID': organizationId,
        },
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey-${surveyId}-responses.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Survey responses exported successfully',
      });
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to export responses',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/communications/surveys/${surveyId}/export?format=excel`, {
        headers: {
          'X-Organization-ID': organizationId,
        },
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey-${surveyId}-responses.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Survey responses exported successfully',
      });
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to export responses',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const renderQuestionChart = (result: QuestionResult) => {
    const { question, answerBreakdown } = result;

    // Single/Multiple Choice - Bar Chart
    if (question.questionType === 'single_choice' || question.questionType === 'multiple_choice') {
      if (!answerBreakdown.choices) return null;

      const data = {
        labels: answerBreakdown.choices.map((c) => c.choiceText),
        datasets: [
          {
            label: 'Responses',
            data: answerBreakdown.choices.map((c) => c.count),
            backgroundColor: [
              'rgba(59, 130, 246, 0.8)',
              'rgba(16, 185, 129, 0.8)',
              'rgba(251, 146, 60, 0.8)',
              'rgba(139, 92, 246, 0.8)',
              'rgba(236, 72, 153, 0.8)',
              'rgba(245, 158, 11, 0.8)',
            ],
          },
        ],
      };

      return (
        <div className="h-[300px]">
          <Bar
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const choice = answerBreakdown.choices![context.dataIndex];
                      return `${context.parsed.y} responses (${choice.percentage.toFixed(1)}%)`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { precision: 0 },
                },
              },
            }}
          />
        </div>
      );
    }

    // Yes/No - Pie Chart
    if (question.questionType === 'yes_no' && answerBreakdown.yesNo) {
      const data = {
        labels: ['Yes', 'No'],
        datasets: [
          {
            data: [answerBreakdown.yesNo.yes, answerBreakdown.yesNo.no],
            backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
          },
        ],
      };

      return (
        <div className="h-[300px] flex items-center justify-center">
          <Pie
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const total = answerBreakdown.yesNo!.yes + answerBreakdown.yesNo!.no;
                      const percentage = ((context.parsed / total) * 100).toFixed(1);
                      return `${context.label}: ${context.parsed} (${percentage}%)`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      );
    }

    // Rating - Line Chart
    if (question.questionType === 'rating' && answerBreakdown.rating) {
      const { rating } = answerBreakdown;
      
      const data = {
        labels: rating.distribution.map((d) => d.value.toString()),
        datasets: [
          {
            label: 'Number of Responses',
            data: rating.distribution.map((d) => d.count),
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      };

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{rating.average.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{rating.min}</div>
                <p className="text-xs text-muted-foreground">Minimum</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{rating.max}</div>
                <p className="text-xs text-muted-foreground">Maximum</p>
              </CardContent>
            </Card>
          </div>
          <div className="h-[250px]">
            <Line
              data={data}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                  },
                },
              }}
            />
          </div>
        </div>
      );
    }

    // Text/Textarea - Table view
    if (
      (question.questionType === 'text' || question.questionType === 'textarea') &&
      answerBreakdown.text
    ) {
      return (
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {answerBreakdown.text.slice(0, 50).map((answer, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <p className="text-sm">{answer.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {answer.count > 1 && `${answer.count} identical responses`}
                  </p>
                </CardContent>
              </Card>
            ))}
            {answerBreakdown.text.length > 50 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Showing first 50 of {answerBreakdown.text.length} unique responses
              </p>
            )}
          </div>
        </ScrollArea>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No results available</p>
      </div>
    );
  }

  const { survey, totalResponses, completedResponses, completionRate, averageTimeSpent, questionResults } = results;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{survey.title}</h2>
          <p className="text-muted-foreground">Survey Results & Analytics</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={isExporting}>
            <FileText className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses}</div>
            <p className="text-xs text-muted-foreground">
              {completedResponses} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {totalResponses - completedResponses} incomplete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(averageTimeSpent / 60)}:{String(averageTimeSpent % 60).padStart(2, '0')}
            </div>
            <p className="text-xs text-muted-foreground">Minutes:seconds</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questionResults.length}</div>
            <p className="text-xs text-muted-foreground">In this survey</p>
          </CardContent>
        </Card>
      </div>

      {/* Question Results */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Question Breakdown</h3>
        {questionResults.map((result, index) => (
          <Card key={result.question.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Question {index + 1}</Badge>
                    <Badge>{result.question.questionType.replace('_', ' ')}</Badge>
                  </div>
                  <CardTitle className="text-lg">{result.question.questionText}</CardTitle>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{result.totalAnswers}</div>
                  <p className="text-xs text-muted-foreground">Responses</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>{renderQuestionChart(result)}</CardContent>
          </Card>
        ))}
      </div>

      {totalResponses === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Eye className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Responses Yet</h3>
            <p className="text-sm text-muted-foreground text-center">
              Share your survey link to start collecting responses
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

