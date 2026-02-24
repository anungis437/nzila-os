'use client';


export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BudgetLineItemEditor from '@/components/financial/BudgetLineItemEditor';
import BudgetVsActualChart from '@/components/financial/BudgetVsActualChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BudgetDetailPage() {
  const params = useParams();
  const budgetId = params.id as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [budget, setBudget] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchBudget();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBudget = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/financial/budgets/${budgetId}`);
      if (!response.ok) throw new Error('Failed to fetch budget');
      
      const data = await response.json();
      setBudget(data.data.budget);
      setLineItems(data.data.lineItems || []);
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to load budget details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto py-10 text-center">Loading...</div>;
  }

  if (!budget) {
    return <div className="container mx-auto py-10 text-center">Budget not found</div>;
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{budget.budgetName}</h1>
            <p className="text-muted-foreground">
              Fiscal Year {budget.fiscalYear} • {budget.periodType}
            </p>
          </div>
        </div>
        <Badge>{budget.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Budget</div>
              <div className="text-2xl font-bold">
                ${parseFloat(budget.totalBudget).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Allocated</div>
              <div className="text-2xl font-bold">
                ${parseFloat(budget.totalAllocated).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Spent</div>
              <div className="text-2xl font-bold text-destructive">
                ${parseFloat(budget.totalSpent).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Remaining</div>
              <div className="text-2xl font-bold text-green-600">
                ${(parseFloat(budget.totalBudget) - parseFloat(budget.totalSpent)).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <BudgetVsActualChart lineItems={lineItems} />

      <BudgetLineItemEditor 
        budgetId={budgetId}
        lineItems={lineItems}
        onUpdate={fetchBudget}
      />
    </div>
  );
}
