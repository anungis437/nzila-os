/**
 * System Administration Dashboard
 * 
 * Manage system settings, integrations, and data governance
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Database, Link as LinkIcon, Users, AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';

interface SystemStats {
  totalUsers: number;
  activeIntegrations: number;
  dataRetentionPolicies: number;
  pendingApprovals: number;
}

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSync: string;
  provider: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeIntegrations: 0,
    dataRetentionPolicies: 0,
    pendingApprovals: 0,
  });
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const integrationsData = await api.get('/admin/integrations');
      
      // Calculate stats from available data
      const integrationsList = (integrationsData as unknown as { integrations?: Integration[] })?.integrations || [];
      setStats({
        totalUsers: 0, // TODO: Fetch from user management endpoint
        activeIntegrations: integrationsList.filter((i: Integration) => i.status === 'active').length,
        dataRetentionPolicies: 0, // TODO: Fetch from governance endpoint
        pendingApprovals: 0, // TODO: Fetch from approvals endpoint
      });
      setIntegrations(integrationsList);
    } catch (error) {
      logger.error('Error fetching admin data', { error });
      alert('Error loading admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Administration</h1>
          <p className="text-muted-foreground">
            Manage system settings, integrations, and data governance
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Integrations</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.activeIntegrations}
              </p>
            </div>
            <LinkIcon className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Retention Policies</p>
              <p className="text-2xl font-bold">{stats.dataRetentionPolicies}</p>
            </div>
            <Database className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Approvals</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pendingApprovals}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="governance">Data Governance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <Card>
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Integrations</h2>
                <Button onClick={() => router.push('/admin/integrations/new')}>
                  Add Integration
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow
                    key={integration.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/integrations/${integration.id}`)}
                  >
                    <TableCell className="font-medium">{integration.name}</TableCell>
                    <TableCell className="uppercase">{integration.type}</TableCell>
                    <TableCell className="capitalize">{integration.provider}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(integration.status)}>
                        {integration.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(integration.lastSync).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Configure</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">User Management</h3>
            <p className="text-muted-foreground">
              User management interface will be implemented here
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="governance">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Data Governance</h3>
            <p className="text-muted-foreground">
              Data retention policies and compliance rules will be managed here
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Security Settings</h3>
            <p className="text-muted-foreground">
              Security configuration and access control will be managed here
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Audit Logs</h3>
            <p className="text-muted-foreground">
              System audit trail will be displayed here
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
