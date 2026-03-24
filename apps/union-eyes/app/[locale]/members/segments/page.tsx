/**
 * Member Segments Page
 * 
 * Create and manage dynamic member segments for targeted communications and reporting
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/index';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Plus, Filter, Trash2, Play } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Segment {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  filters: SegmentFilter[];
  createdAt: string;
  lastUsed: string | null;
}

interface SegmentFilter {
  field: string;
  operator: string;
  value: string;
}

export default function MemberSegmentsPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    filters: [] as SegmentFilter[],
  });
  const [currentFilter, setCurrentFilter] = useState<SegmentFilter>({
    field: 'status',
    operator: 'equals',
    value: 'active',
  });
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const data = await api.memberSegments.list();
      setSegments(data as Segment[]);
    } catch (error) {
      logger.error('Error fetching segments:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFilter = () => {
    setNewSegment((prev) => ({
      ...prev,
      filters: [...prev.filters, currentFilter],
    }));
    setCurrentFilter({
      field: 'status',
      operator: 'equals',
      value: '',
    });
    previewSegment([...newSegment.filters, currentFilter]);
  };

  const removeFilter = (index: number) => {
    const updated = newSegment.filters.filter((_, i) => i !== index);
    setNewSegment((prev) => ({
      ...prev,
      filters: updated,
    }));
    previewSegment(updated);
  };

  const previewSegment = async (filters: SegmentFilter[]) => {
    try {
      const result = await api.memberSegments.preview(filters);
      setPreviewCount(result.count);
    } catch (error) {
      logger.error('Error previewing segment:', error);
    }
  };

  const createSegment = async () => {
    try {
      await api.memberSegments.create(newSegment);
      setIsCreating(false);
      fetchSegments();
      setNewSegment({ name: '', description: '', filters: [] });
      setPreviewCount(null);
    } catch (error) {
      logger.error('Error creating segment:', error);
    }
  };

  const deleteSegment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return;

    try {
      await api.memberSegments.delete(id);
      fetchSegments();
    } catch (error) {
      logger.error('Error deleting segment:', error);
    }
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      'status': 'Status',
      'classification': 'Classification',
      'local': 'Local',
      'arrears': 'Arrears Amount',
      'joined-date': 'Join Date',
      'seniority': 'Seniority',
    };
    return labels[field] || field;
  };

  if (loading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Member Segments</h1>
          <p className="text-muted-foreground">
            Create dynamic groups for targeted communications and reporting
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Segment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create New Segment</DialogTitle>
              <DialogDescription>
                Define filters to create a dynamic member segment
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Segment Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Segment Name</Label>
                  <Input
                    id="name"
                    value={newSegment.name}
                    onChange={(e) => setNewSegment((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Active Full-Time Members"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newSegment.description}
                    onChange={(e) => setNewSegment((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this segment"
                  />
                </div>
              </div>

              {/* Filter Builder */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="h-4 w-4" />
                  <h3 className="font-semibold">Filters</h3>
                </div>

                {/* Current Filters */}
                {newSegment.filters.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {newSegment.filters.map((filter, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <Badge>{getFieldLabel(filter.field)}</Badge>
                        <span className="text-sm">{filter.operator}</span>
                        <Badge variant="outline">{filter.value}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFilter(index)}
                          className="ml-auto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Filter Form */}
                <div className="grid grid-cols-4 gap-2">
                  <Select
                    value={currentFilter.field}
                    onValueChange={(value) => setCurrentFilter((prev) => ({ ...prev, field: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="classification">Classification</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="arrears">Arrears</SelectItem>
                      <SelectItem value="joined-date">Join Date</SelectItem>
                      <SelectItem value="seniority">Seniority</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={currentFilter.operator}
                    onValueChange={(value) => setCurrentFilter((prev) => ({ ...prev, operator: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="not-equals">Not Equals</SelectItem>
                      <SelectItem value="greater-than">Greater Than</SelectItem>
                      <SelectItem value="less-than">Less Than</SelectItem>
                      <SelectItem value="after">After</SelectItem>
                      <SelectItem value="before">Before</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    value={currentFilter.value}
                    onChange={(e) => setCurrentFilter((prev) => ({ ...prev, value: e.target.value }))}
                    placeholder="Value"
                  />

                  <Button onClick={addFilter} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </Card>

              {/* Preview */}
              {previewCount !== null && (
                <Card className="p-4 bg-blue-50">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold">Preview</p>
                      <p className="text-sm text-muted-foreground">
                        This segment would include approximately <strong>{previewCount} members</strong>
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={createSegment} disabled={!newSegment.name || newSegment.filters.length === 0}>
                  Create Segment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Segments Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Segment Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Filters</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {segments.map((segment) => (
              <TableRow key={segment.id}>
                <TableCell>
                  <p className="font-medium">{segment.name}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground">{segment.description}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{segment.memberCount}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {segment.filters.map((filter, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {getFieldLabel(filter.field)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {segment.lastUsed ? (
                    <span className="text-sm">
                      {new Date(segment.lastUsed).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/members?segment=${segment.id}`)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSegment(segment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {segments.length === 0 && (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No Segments Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create segments to organize and target specific groups of members
          </p>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create First Segment
          </Button>
        </Card>
      )}
    </div>
  );
}
