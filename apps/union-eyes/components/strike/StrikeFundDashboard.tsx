/**
 * Strike Fund Dashboard Component
 * Comprehensive strike fund management with picket tracking and stipend processing
 * Phase 3: Strike Administration
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Users,
  MapPin,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

interface StrikeFund {
  id: string;
  fund_name: string;
  strike_status: 'planned' | 'preparing' | 'active' | 'suspended' | 'resolved';
  total_fund_balance: number;
  total_disbursed: number;
  weekly_stipend_amount: number;
  minimum_picket_hours_per_week: number;
  eligible_members_count: number;
  active_strikers_count: number;
  strike_start_date: string;
  expected_duration_weeks?: number;
  burn_rate_weekly?: number;
  created_at: string;
}

interface PicketLine {
  id: string;
  location_name: string;
  address: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shift_schedule: any;
  active_picketers_count: number;
  total_hours_today: number;
  status: 'active' | 'inactive' | 'suspended';
}

interface StipendDisbursement {
  id: string;
  member_name: string;
  week_start_date: string;
  week_end_date: string;
  hours_worked: number;
  stipend_amount: number;
  payment_status: 'pending' | 'approved' | 'paid' | 'rejected';
  payment_date?: string;
}

interface StrikeFundDashboardProps {
  organizationId: string;
}

export function StrikeFundDashboard({ organizationId }: StrikeFundDashboardProps) {
  const [funds, setFunds] = useState<StrikeFund[]>([]);
  const [selectedFund, setSelectedFund] = useState<StrikeFund | null>(null);
  const [picketLines, setPicketLines] = useState<PicketLine[]>([]);
  const [recentDisbursements, setRecentDisbursements] = useState<StipendDisbursement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedFund) {
      fetchPicketLines(selectedFund.id);
      fetchRecentDisbursements(selectedFund.id);
    }
  }, [selectedFund]);

  const fetchStrikeFunds = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/strike/funds?organizationId=${organizationId}`);
      const data = await response.json();
      
      if (data.success) {
        setFunds(data.data);
        if (data.data.length > 0 && !selectedFund) {
          setSelectedFund(data.data[0]);
        }
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [organizationId, selectedFund]);

  useEffect(() => {
    fetchStrikeFunds();
  }, [fetchStrikeFunds]);

  const fetchPicketLines = async (fundId: string) => {
    try {
      const response = await fetch(`/api/strike/picket-lines?fundId=${fundId}`);
      const data = await response.json();
      
      if (data.success) {
        setPicketLines(data.data);
      }
    } catch (_error) {
}
  };

  const fetchRecentDisbursements = async (fundId: string) => {
    try {
      const response = await fetch(`/api/strike/disbursements?fundId=${fundId}&limit=10`);
      const data = await response.json();
      
      if (data.success) {
        setRecentDisbursements(data.data);
      }
    } catch (_error) {
}
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-gray-500',
      preparing: 'bg-yellow-500',
      active: 'bg-red-500',
      suspended: 'bg-orange-500',
      resolved: 'bg-green-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  const calculateWeeksRemaining = (fund: StrikeFund) => {
    if (!fund.burn_rate_weekly || fund.burn_rate_weekly === 0) return null;
    return Math.floor(fund.total_fund_balance / fund.burn_rate_weekly);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading strike funds...</div>;
  }

  if (funds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Strike Funds</CardTitle>
          <CardDescription>Create a strike fund to begin tracking strike activities.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Create Strike Fund</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fund Selector */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold">Strike Fund Dashboard</h2>
        <select
          value={selectedFund?.id || ''}
          onChange={(e) => {
            const fund = funds.find(f => f.id === e.target.value);
            setSelectedFund(fund || null);
          }}
          aria-label="Select strike fund"
          className="px-4 py-2 border rounded-md"
        >
          {funds.map((fund) => (
            <option key={fund.id} value={fund.id}>
              {fund.fund_name}
            </option>
          ))}
        </select>
      </div>

      {selectedFund && (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fund Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(selectedFund.total_fund_balance)}</div>
                <p className="text-xs text-muted-foreground">
                  {calculateWeeksRemaining(selectedFund) && 
                    `~${calculateWeeksRemaining(selectedFund)} weeks remaining`
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Strikers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedFund.active_strikers_count}</div>
                <p className="text-xs text-muted-foreground">
                  of {selectedFund.eligible_members_count} eligible
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weekly Stipend</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(selectedFund.weekly_stipend_amount)}</div>
                <p className="text-xs text-muted-foreground">
                  {selectedFund.minimum_picket_hours_per_week}h min required
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Badge className={getStatusColor(selectedFund.strike_status)}>
                  {selectedFund.strike_status.toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Started {new Date(selectedFund.strike_start_date).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Details */}
          <Tabs defaultValue="picket-lines" className="w-full">
            <TabsList>
              <TabsTrigger value="picket-lines">Picket Lines</TabsTrigger>
              <TabsTrigger value="disbursements">Stipend Disbursements</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="picket-lines" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Picket Lines</CardTitle>
                  <CardDescription>GPS-verified picket attendance tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  {picketLines.length === 0 ? (
                    <p className="text-muted-foreground">No picket lines configured.</p>
                  ) : (
                    <div className="space-y-4">
                      {picketLines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <MapPin className="h-6 w-6 text-red-500" />
                            <div>
                              <h4 className="font-semibold">{line.location_name}</h4>
                              <p className="text-sm text-muted-foreground">{line.address}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{line.active_picketers_count} active</p>
                            <p className="text-sm text-muted-foreground">{line.total_hours_today}h today</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="disbursements" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Stipend Disbursements</CardTitle>
                  <CardDescription>Weekly stipend payments to striking members</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentDisbursements.length === 0 ? (
                    <p className="text-muted-foreground">No disbursements yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentDisbursements.map((disbursement) => (
                        <div key={disbursement.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{disbursement.member_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(disbursement.week_start_date).toLocaleDateString()} - 
                              {new Date(disbursement.week_end_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(disbursement.stipend_amount)}</p>
                            <Badge variant={
                              disbursement.payment_status === 'paid' ? 'default' :
                              disbursement.payment_status === 'approved' ? 'secondary' :
                              disbursement.payment_status === 'rejected' ? 'destructive' : 'outline'
                            }>
                              {disbursement.payment_status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Fund Analytics</CardTitle>
                  <CardDescription>Financial projections and strike statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="font-medium">Total Disbursed:</span>
                      <span className="text-2xl font-bold">{formatCurrency(selectedFund.total_disbursed)}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="font-medium">Weekly Burn Rate:</span>
                      <span className="text-2xl font-bold">
                        {selectedFund.burn_rate_weekly ? formatCurrency(selectedFund.burn_rate_weekly) : 'N/A'}
                      </span>
                    </div>
                    {selectedFund.expected_duration_weeks && (
                      <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                        <span className="font-medium">Expected Duration:</span>
                        <span className="text-2xl font-bold">{selectedFund.expected_duration_weeks} weeks</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

