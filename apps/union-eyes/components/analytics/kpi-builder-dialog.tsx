'use client';

/**
 * KPI Builder Dialog
 * Q1 2025 - Advanced Analytics
 * 
 * Form to create and configure custom KPIs
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { readApiError } from '@/lib/client/api-envelope';

const kpiSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  metricType: z.string().min(1, 'Metric type is required'),
  dataSource: z.string().min(1, 'Data source is required'),
  visualizationType: z.enum(['line', 'bar', 'pie', 'gauge', 'number']),
  targetValue: z.string().optional(),
  warningThreshold: z.string().optional(),
  criticalThreshold: z.string().optional()
});

type KPIFormValues = z.infer<typeof kpiSchema>;

interface KPIBuilderDialogProps {
  /** Called after a KPI was created, so the caller can read the list again. */
  onCreated?: () => void;
}

export function KPIBuilderDialog({ onCreated }: KPIBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<KPIFormValues>({
    resolver: zodResolver(kpiSchema),
    defaultValues: {
      name: '',
      description: '',
      metricType: 'claims_volume',
      dataSource: 'claims',
      visualizationType: 'number'
    }
  });

  async function onSubmit(values: KPIFormValues) {
    setIsSubmitting(true);
    try {
      // Nothing evaluates a KPI's thresholds or sends an alert (the target route refuses alertEnabled: true), so no alert is requested.
      const response = await fetch('/api/analytics/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          calculation: {
            aggregation: 'count',
            groupBy: 'day',
            filters: {}
          },
          targetValue: values.targetValue ? Number(values.targetValue) : undefined,
          warningThreshold: values.warningThreshold
            ? Number(values.warningThreshold)
            : undefined,
          criticalThreshold: values.criticalThreshold
            ? Number(values.criticalThreshold)
            : undefined,
          alertEnabled: false
        })
      });

      if (!response.ok) throw new Error(await readApiError(response, 'Failed to create KPI'));

      toast({
        title: 'KPI Created',
        description: 'Your custom KPI has been created successfully'
      });
      setOpen(false);
      form.reset();
      onCreated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create KPI',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create KPI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom KPI</DialogTitle>
          <DialogDescription>
            Configure a custom KPI to track specific metrics for your organization
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>KPI Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Monthly Claims Volume" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this KPI measures..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Data Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="metricType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metric Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select metric type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="claims_volume">Claims Volume</SelectItem>
                        <SelectItem value="resolution_time">Resolution Time</SelectItem>
                        <SelectItem value="member_growth">Member Growth</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Source *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select data source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="claims">Claims</SelectItem>
                        <SelectItem value="members">Members</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                        <SelectItem value="custom_query">Custom Query</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Visualization */}
            <FormField
              control={form.control}
              name="visualizationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visualization Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visualization" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="gauge">Gauge</SelectItem>
                      <SelectItem value="line">Line Chart</SelectItem>
                      <SelectItem value="bar">Bar Chart</SelectItem>
                      <SelectItem value="pie">Pie Chart</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>How this KPI will be displayed</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Thresholds */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="targetValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Value</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warningThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warning Threshold</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="80" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="criticalThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Critical Threshold</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="120" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create KPI'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

