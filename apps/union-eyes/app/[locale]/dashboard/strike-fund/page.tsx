'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Clock,
  Search,
  Plus,
  TrendingDown,
  Users,
  DollarSign,
  AlertTriangle,
  Eye,
  Activity,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

interface StrikeFund {
  id: string;
  fundName: string;
  fundCode: string;
  fundType: string;
  strikeStatus: string;
  currentBalance: number;
  weeklyBurnRate: number;
  estimatedWeeksRemaining: number;
  eligibleMembersCount: number;
  activeMembersCount: number;
  strikeStartDate?: string;
  strikeEndDate?: string;
  organizationName?: string;
}

export default function StrikeFundDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [funds, setFunds] = useState<StrikeFund[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Summary metrics
  const totalFunds = funds.length;
  const activeStrikes = funds.filter(f => f.strikeStatus === 'active').length;
  const totalBalance = funds.reduce((sum, f) => sum + f.currentBalance, 0);
  const totalStipendRecipients = funds.reduce((sum, f) => sum + f.activeMembersCount, 0);

  // Fetch funds
  useEffect(() => {
    const fetchFunds = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/strike/funds');
        
        if (!response.ok) {
          throw new Error('Failed to fetch strike funds');
        }
        
        const data = await response.json();
        setFunds(data.funds || []);
      } catch (_error) {
} finally {
        setLoading(false);
      }
    };

    fetchFunds();
  }, []);

  // Filter and search funds
  const filteredFunds = funds.filter(fund => {
    const matchesSearch = 
      fund.fundName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fund.fundCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (fund.organizationName && fund.organizationName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || fund.strikeStatus === filterStatus;
    const matchesType = filterType === 'all' || fund.fundType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Status badge configuration
  const getStatusBadge = (status: string) => {
    const config = {
      inactive: { label: 'Inactive', variant: 'secondary' as const, color: 'text-gray-600' },
      preparing: { label: 'Preparing', variant: 'default' as const, color: 'text-yellow-600' },
      active: { label: 'Active Strike', variant: 'destructive' as const, color: 'text-red-600' },
      suspended: { label: 'Suspended', variant: 'outline' as const, color: 'text-orange-600' },
      resolved: { label: 'Resolved', variant: 'default' as const, color: 'text-green-600' },
    };
    
    return config[status as keyof typeof config] || config.inactive;
  };

  // Type badge configuration
  const getTypeBadge = (type: string) => {
    const config = {
      general: { label: 'General', color: 'bg-blue-100 text-blue-800' },
      local: { label: 'Local', color: 'bg-purple-100 text-purple-800' },
      emergency: { label: 'Emergency', color: 'bg-red-100 text-red-800' },
      hardship: { label: 'Hardship', color: 'bg-orange-100 text-orange-800' },
    };
    
    return config[type as keyof typeof config] || config.general;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate depletion warning
  const getDepletionWarning = (weeksRemaining: number) => {
    if (weeksRemaining <= 4) return { level: 'critical', text: 'Critical - Fund nearing depletion', color: 'text-red-600' };
    if (weeksRemaining <= 8) return { level: 'warning', text: 'Warning - Monitor fund closely', color: 'text-orange-600' };
    return { level: 'healthy', text: 'Healthy fund balance', color: 'text-green-600' };
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Strike Fund Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Financial support for members during labor disputes
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardDescription className="h-4 bg-gray-200 animate-pulse rounded w-20" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 animate-pulse rounded w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Strike Fund Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Financial support for members during labor disputes
          </p>
        </div>
        
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Strike Fund
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Funds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              {totalFunds}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Strikes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-red-600" />
              {activeStrikes}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-600" />
              {formatCurrency(totalBalance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stipend Recipients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-600" />
              {totalStipendRecipients}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Strike Funds</CardTitle>
          <CardDescription>Manage and monitor strike fund operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by fund name, code, or organization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border rounded-md bg-background"
            >
              <option value="all">All Statuses</option>
              <option value="inactive">Inactive</option>
              <option value="preparing">Preparing</option>
              <option value="active">Active Strike</option>
              <option value="suspended">Suspended</option>
              <option value="resolved">Resolved</option>
            </select>
            
            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border rounded-md bg-background"
            >
              <option value="all">All Types</option>
              <option value="general">General</option>
              <option value="local">Local</option>
              <option value="emergency">Emergency</option>
              <option value="hardship">Hardship</option>
            </select>
          </div>

          {/* Fund List */}
          {filteredFunds.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || filterStatus !== 'all' || filterType !== 'all'
                  ? 'No matching strike funds found'
                  : 'No strike funds created yet'
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterStatus !== 'all' || filterType !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first strike fund to get started'
                }
              </p>
              {!searchTerm && filterStatus === 'all' && filterType === 'all' && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Strike Fund
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFunds.map((fund) => {
                const statusBadge = getStatusBadge(fund.strikeStatus);
                const typeBadge = getTypeBadge(fund.fundType);
                const depletionWarning = getDepletionWarning(fund.estimatedWeeksRemaining);
                
                return (
                  <Card key={fund.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold">{fund.fundName}</h3>
                            <Badge variant={statusBadge.variant}>
                              {statusBadge.label}
                            </Badge>
                            <span className={`text-xs px-2 py-1 rounded-full ${typeBadge.color}`}>
                              {typeBadge.label}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Fund Code: {fund.fundCode}
                            {fund.organizationName && ` â€¢ ${fund.organizationName}`}
                          </div>
                        </div>
                        
                        <Link href={`/dashboard/strike-fund/${fund.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </Link>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        {/* Current Balance */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Current Balance</div>
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(fund.currentBalance)}
                          </div>
                        </div>

                        {/* Burn Rate */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Weekly Burn Rate</div>
                          <div className="flex items-center gap-1">
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="text-2xl font-bold text-red-600">
                              {formatCurrency(fund.weeklyBurnRate)}
                            </span>
                          </div>
                        </div>

                        {/* Weeks Remaining */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Est. Weeks Remaining</div>
                          <div className="flex items-center gap-2">
                            <Clock className={`h-4 w-4 ${depletionWarning.color}`} />
                            <span className={`text-2xl font-bold ${depletionWarning.color}`}>
                              {fund.estimatedWeeksRemaining}
                            </span>
                          </div>
                          <div className={`text-xs ${depletionWarning.color} mt-1`}>
                            {depletionWarning.text}
                          </div>
                        </div>

                        {/* Active Members */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Active Members</div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-blue-600" />
                            <span className="text-2xl font-bold">
                              {fund.activeMembersCount}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              / {fund.eligibleMembersCount}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Strike Timeline */}
                      {(fund.strikeStartDate || fund.strikeEndDate) && (
                        <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {fund.strikeStartDate && (
                            <span>Started: {new Date(fund.strikeStartDate).toLocaleDateString()}</span>
                          )}
                          {fund.strikeEndDate && (
                            <span>Ended: {new Date(fund.strikeEndDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}

                      {/* Critical Warning */}
                      {depletionWarning.level === 'critical' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-semibold text-red-900">Critical Fund Status</p>
                            <p className="text-red-700">
                              This fund will be depleted in approximately {fund.estimatedWeeksRemaining} weeks.
                              Immediate action required to replenish funds or adjust disbursements.
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
