/**
 * Feature Flags Admin Panel
 * 
 * Manage feature flags through a UI
 * Access at: /admin/feature-flags
 */

"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Search } from 'lucide-react';
import type { FeatureFlag } from '@/lib/feature-flags';

export function FeatureFlagsAdmin() {
  const t = useTranslations('featureFlagsAdmin');
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/feature-flags');
      const data = await response.json();
      setFlags(data);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const toggleFlag = async (name: string, enabled: boolean) => {
    try {
      await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, enabled }),
      });
      
      // Update local state
      setFlags(flags.map(f => 
        f.name === name ? { ...f, enabled } : f
      ));
    } catch {
      // Error handled silently
    }
  };

  const filteredFlags = flags.filter(flag => {
    const matchesSearch = flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         flag.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || flag.type === filterType;
    return matchesSearch && matchesType;
  });

  const groupedFlags = {
    all: filteredFlags,
    boolean: filteredFlags.filter(f => f.type === 'boolean'),
    percentage: filteredFlags.filter(f => f.type === 'percentage'),
    org: filteredFlags.filter(f => f.type === 'tenant'), // DB flag-type value (legacy column)
    user: filteredFlags.filter(f => f.type === 'user'),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={fetchFlags} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('refresh')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('stats.totalFlags')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('stats.enabled')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {flags.filter(f => f.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('stats.disabled')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {flags.filter(f => !f.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('stats.rollouts')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {flags.filter(f => f.type === 'percentage' && f.enabled).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flags List */}
      <Tabs defaultValue="all" onValueChange={setFilterType}>
        <TabsList>
          <TabsTrigger value="all">
            {t('tabs.all')} ({groupedFlags.all.length})
          </TabsTrigger>
          <TabsTrigger value="boolean">
            {t('tabs.boolean')} ({groupedFlags.boolean.length})
          </TabsTrigger>
          <TabsTrigger value="percentage">
            {t('tabs.percentage')} ({groupedFlags.percentage.length})
          </TabsTrigger>
          <TabsTrigger value="org">
            {t('tabs.organization')} ({groupedFlags.org.length})
          </TabsTrigger>
        </TabsList>

        {Object.entries(groupedFlags).map(([type, typeFlags]) => (
          <TabsContent key={type} value={type} className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">{t('loading')}</p>
                </CardContent>
              </Card>
            ) : typeFlags.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    {t('noFlags')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              typeFlags.map((flag) => (
                <FlagCard
                  key={flag.name}
                  flag={flag}
                  onToggle={toggleFlag}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function FlagCard({
  flag,
  onToggle,
}: {
  flag: FeatureFlag;
  onToggle: (name: string, enabled: boolean) => void;
}) {
  const t = useTranslations('featureFlagsAdmin');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{flag.name}</CardTitle>
              <Badge variant="outline">{flag.type}</Badge>
              {flag.enabled && (
                <Badge variant="default" className="bg-green-500">
                  {t('flagCard.enabled')}
                </Badge>
              )}
            </div>
            {flag.description && (
              <CardDescription>{flag.description}</CardDescription>
            )}
          </div>
          <Switch
            checked={flag.enabled}
            onCheckedChange={(enabled) => onToggle(flag.name, enabled)}
          />
        </div>
      </CardHeader>
      
      {/* allowedOrgs mapped from DB allowedOrganizations column */}
      {(flag.percentage !== null || flag.allowedOrgs || flag.tags) && (
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {flag.percentage !== null && flag.percentage !== undefined && (
              <div>
                <dt className="font-medium text-muted-foreground">{t('flagCard.rolloutPercentage')}</dt>
                <dd className="mt-1">
                  <Badge variant="secondary">{flag.percentage}%</Badge>
                </dd>
              </div>
            )}
            
            {flag.allowedOrgs && flag.allowedOrgs.length > 0 && (
              <div>
                <dt className="font-medium text-muted-foreground">{t('flagCard.allowedOrganizations')}</dt>
                <dd className="mt-1">{flag.allowedOrgs.length} {t('flagCard.organizations')}</dd>
              </div>
            )}
            
            {flag.tags && flag.tags.length > 0 && (
              <div className="col-span-2">
                <dt className="font-medium text-muted-foreground">{t('flagCard.tags')}</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {flag.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      )}
    </Card>
  );
}

