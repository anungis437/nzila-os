'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, Edit } from 'lucide-react';
 
import { useToast } from '@/lib/hooks/use-toast';

interface Vendor {
  id: string;
  vendorNumber: string;
  vendorName: string;
  vendorType?: string;
  email?: string;
  phone?: string;
  status: string;
  currentBalance: string;
  ytdSpending: string;
  paymentTerms: string;
}

interface VendorListProps {
  organizationId: string;
}

export default function VendorList({ organizationId: _organizationId }: VendorListProps) {
  const t = useTranslations('vendorList');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchVendors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/financial/vendors?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch vendors');
      
      const data = await response.json();
      setVendors(data.data.vendors || []);
    } catch (_error) {
      toast({
        title: t('errorTitle'),
        description: t('loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive',
      archived: 'outline',
    };
    const isKnown = (['active','inactive','suspended','archived'] as const).includes(status as 'active');
    return <Badge variant={variants[status] || 'outline'}>{isKnown ? t(`statuses.${status}` as 'statuses.active') : status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button onClick={() => window.location.href = '/dashboard/financial/vendors/new'}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addVendor')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('searchFilter')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allStatuses')}</SelectItem>
                <SelectItem value="active">{t('statuses.active')}</SelectItem>
                <SelectItem value="inactive">{t('statuses.inactive')}</SelectItem>
                <SelectItem value="suspended">{t('statuses.suspended')}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchVendors}>{t('search')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('directoryTitle')}</CardTitle>
          <CardDescription>
            {t(vendors.length === 1 ? 'found' : 'foundPlural', { count: vendors.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.vendorNumber')}</TableHead>
                  <TableHead>{t('table.name')}</TableHead>
                  <TableHead>{t('table.type')}</TableHead>
                  <TableHead>{t('table.contact')}</TableHead>
                  <TableHead>{t('table.paymentTerms')}</TableHead>
                  <TableHead>{t('table.ytdSpending')}</TableHead>
                  <TableHead>{t('table.balance')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-mono">{vendor.vendorNumber}</TableCell>
                    <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                    <TableCell className="capitalize">{vendor.vendorType?.replace('_', ' ') || '—'}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {vendor.email && <div>{vendor.email}</div>}
                        {vendor.phone && <div className="text-muted-foreground">{vendor.phone}</div>}
                        {!vendor.email && !vendor.phone && '—'}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {vendor.paymentTerms.replace('_', ' ')}
                    </TableCell>
                    <TableCell>${parseFloat(vendor.ytdSpending).toLocaleString()}</TableCell>
                    <TableCell 
                      className={parseFloat(vendor.currentBalance) > 0 ? 'text-destructive font-semibold' : ''}
                    >
                      ${parseFloat(vendor.currentBalance).toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = `/dashboard/financial/vendors/${vendor.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = `/dashboard/financial/vendors/${vendor.id}/edit`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
