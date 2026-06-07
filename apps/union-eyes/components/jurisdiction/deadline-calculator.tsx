/**
 * Deadline Calculator Component
 * Calculate deadlines based on jurisdiction rules
 * Phase 5D: Jurisdiction Framework
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, InfoIcon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DeadlineCalculatorProps {
  organizationId: string;
  ruleCategory: string;
  defaultStartDate?: Date;
  onDeadlineCalculated?: (result: DeadlineResult) => void;
  showDetailedBreakdown?: boolean;
}

interface DeadlineResult {
  deadlineDate: Date;
  deadlineDays: number;
  deadlineType: 'calendar' | 'business';
  ruleName: string;
  canExtend: boolean;
  maxExtensions: number;
  businessDaysCalculated?: number;
  holidaysExcluded?: number;
  weekendsExcluded?: number;
  breakdown?: Array<{
    date: Date;
    isBusinessDay: boolean;
    isHoliday: boolean;
    holidayName?: string;
  }>;
}

export function DeadlineCalculator({
  organizationId,
  ruleCategory,
  defaultStartDate,
  onDeadlineCalculated,
  showDetailedBreakdown = false
}: DeadlineCalculatorProps) {
  const [startDate, setStartDate] = useState<Date>(defaultStartDate || new Date());
  const [result, setResult] = useState<DeadlineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateDeadline = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jurisdiction/calculate-deadline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          ruleCategory,
          startDate: startDate.toISOString(),
          includeDetails: showDetailedBreakdown
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to calculate deadline');
      }

      const calculatedResult = {
        ...data.data,
        deadlineDate: new Date(data.data.deadlineDate),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        breakdown: data.data.breakdown?.map((d: any) => ({
          ...d,
          date: new Date(d.date)
        }))
      };

      setResult(calculatedResult);
      onDeadlineCalculated?.(calculatedResult);
    } catch (err) {
      setError(err.message || 'Failed to calculate deadline');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const daysUntilDeadline = result
    ? Math.ceil((result.deadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const isUrgent = daysUntilDeadline > 0 && daysUntilDeadline <= 7;
  const isPassed = daysUntilDeadline < 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deadline Calculator</CardTitle>
        <CardDescription>
          Calculate deadlines based on jurisdiction-specific labour law rules
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="start-date"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button
          onClick={calculateDeadline}
          disabled={loading || !organizationId}
          className="w-full"
        >
          {loading ? 'Calculating...' : 'Calculate Deadline'}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-3">
            <Alert
              variant={isPassed ? 'destructive' : isUrgent ? 'default' : 'default'}
              className={
                isPassed
                  ? ''
                  : isUrgent
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-green-500 bg-green-50'
              }
            >
              <CalendarIcon className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div className="font-semibold text-lg">
                  {format(result.deadlineDate, 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="text-sm">
                  {isPassed ? (
                    <span className="text-red-600 font-semibold">
                      Deadline passed {Math.abs(daysUntilDeadline)} days ago
                    </span>
                  ) : isUrgent ? (
                    <span className="text-yellow-700 font-semibold">
                      {daysUntilDeadline} days remaining (URGENT)
                    </span>
                  ) : (
                    <span className="text-green-700">
                      {daysUntilDeadline} days remaining
                    </span>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rule:</span>
                <span className="font-medium">{result.ruleName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deadline Type:</span>
                <span className="font-medium capitalize">{result.deadlineType} Days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Days:</span>
                <span className="font-medium">{result.deadlineDays} days</span>
              </div>
              {result.canExtend && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extensions:</span>
                  <span className="font-medium">
                    Up to {result.maxExtensions} extension(s) available
                  </span>
                </div>
              )}
              {result.businessDaysCalculated !== undefined && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Business Days:</span>
                    <span className="font-medium">{result.businessDaysCalculated} days</span>
                  </div>
                  {result.weekendsExcluded !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weekends Excluded:</span>
                      <span className="font-medium">{result.weekendsExcluded} days</span>
                    </div>
                  )}
                  {result.holidaysExcluded !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Holidays Excluded:</span>
                      <span className="font-medium">{result.holidaysExcluded} days</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {result.breakdown && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <InfoIcon className="h-4 w-4" />
                  Day-by-Day Breakdown
                </h4>
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Day</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.breakdown.map((day, index) => (
                        <tr
                          key={index}
                          className={cn(
                            'border-t',
                            day.isHoliday && 'bg-red-50',
                            !day.isBusinessDay && !day.isHoliday && 'bg-gray-50'
                          )}
                        >
                          <td className="p-2">{format(day.date, 'MMM d, yyyy')}</td>
                          <td className="p-2">{format(day.date, 'EEEE')}</td>
                          <td className="p-2">
                            {day.isHoliday ? (
                              <span className="text-red-600 font-medium">
                                {day.holidayName}
                              </span>
                            ) : day.isBusinessDay ? (
                              <span className="text-green-600">Business Day</span>
                            ) : (
                              <span className="text-gray-500">Weekend</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

