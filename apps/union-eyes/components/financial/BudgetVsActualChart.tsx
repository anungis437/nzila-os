'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface BudgetLineItem {
  id: string;
  accountCode: string;
  accountName: string;
  allocatedAmount: string;
  spentAmount: string;
  committedAmount: string;
  remainingAmount: string;
}

interface BudgetVsActualChartProps {
  lineItems: BudgetLineItem[];
}

export default function BudgetVsActualChart({ lineItems }: BudgetVsActualChartProps) {
  const chartData = lineItems.map(item => ({
    name: item.accountName.length > 20 
      ? item.accountName.substring(0, 20) + '...' 
      : item.accountName,
    allocated: parseFloat(item.allocatedAmount),
    spent: parseFloat(item.spentAmount),
    committed: parseFloat(item.committedAmount),
    variance: parseFloat(item.remainingAmount),
  }));

  const totalAllocated = lineItems.reduce((sum, item) => sum + parseFloat(item.allocatedAmount), 0);
  const totalSpent = lineItems.reduce((sum, item) => sum + parseFloat(item.spentAmount), 0);
  const totalCommitted = lineItems.reduce((sum, item) => sum + parseFloat(item.committedAmount), 0);
  const totalVariance = totalAllocated - totalSpent - totalCommitted;
  const _utilizationPercent = totalAllocated > 0 ? ((totalSpent + totalCommitted) / totalAllocated) * 100 : 0;

  const overBudgetItems = lineItems.filter(item => parseFloat(item.remainingAmount) < 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAllocated.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Allocated across {lineItems.length} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalAllocated > 0 ? ((totalSpent / totalAllocated) * 100).toFixed(1) : 0}% of budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Committed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCommitted.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Pending approvals/payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            {totalVariance >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalVariance < 0 ? 'text-destructive' : 'text-green-500'}`}>
              ${Math.abs(totalVariance).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalVariance >= 0 ? 'Under budget' : 'Over budget'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Budget vs. Actual by Account</CardTitle>
          <CardDescription>
            Comparison of allocated budget against spent and committed amounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No budget line items to display
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="allocated" fill="hsl(var(--primary))" name="Allocated" />
                <Bar dataKey="spent" fill="hsl(var(--destructive))" name="Spent" />
                <Bar dataKey="committed" fill="hsl(var(--secondary))" name="Committed" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {overBudgetItems.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Over-Budget Alerts</CardTitle>
            </div>
            <CardDescription>
              {overBudgetItems.length} account{overBudgetItems.length !== 1 ? 's' : ''} over budget
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {overBudgetItems.map(item => (
                <li key={item.id} className="flex justify-between items-center">
                  <span className="font-medium">{item.accountName}</span>
                  <span className="text-destructive font-semibold">
                    ${Math.abs(parseFloat(item.remainingAmount)).toLocaleString()} over
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
