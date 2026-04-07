/**
 * Distribution Lists Management Page
 * 
 * Lists all distribution lists with subscriber counts and actions
 * Path: /dashboard/communications/distribution-lists
 * 
 * Phase 4: Communications & Organizing
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Plus, Search, RefreshCw } from 'lucide-react';

interface DistributionList {
  id: string;
  name: string;
  description: string | null;
  listType: string;
  subscriberCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function DistributionListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<DistributionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLists = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      const response = await fetch(`/api/communications/distribution-lists?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch distribution lists');
      }

      const json = await response.json();
      // withApi wraps in { success, data: { data, pagination }, timestamp }
      const payload = json.data ?? json;
      setLists(Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : []);
      setTotalPages(payload.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch distribution lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredLists = lists.filter(list =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    list.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Distribution Lists</h1>
          <p className="text-muted-foreground">
            Manage subscriber groups for targeted communications
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/communications/distribution-lists/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Create List
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Lists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lists.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Lists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.filter(l => l.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.reduce((sum, l) => sum + (l.subscriberCount || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search distribution lists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={fetchLists}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Distribution Lists</CardTitle>
          <CardDescription>
            {filteredLists.length} list(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Loading lists...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
              <Button variant="outline" onClick={fetchLists} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No distribution lists found</p>
              <Button onClick={() => router.push('/dashboard/communications/distribution-lists/new')} className="mt-4">
                Create Your First List
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>List Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subscribers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLists.map((list) => (
                    <TableRow
                      key={list.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/communications/distribution-lists/${list.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{list.name}</div>
                          {list.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {list.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {list.listType || 'manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {list.subscriberCount || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={list.isActive ? 'default' : 'secondary'}>
                          {list.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(list.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
