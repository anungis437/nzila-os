/**
 * Distribution List Manager Component
 * 
 * Create and manage newsletter distribution lists:
 * - Manual subscriber selection
 * - Dynamic list criteria (roles, status, tags)
 * - Import from CSV
 * - Subscriber management
 * - List statistics
 * 
 * Version: 1.0.0
 * Created: December 6, 2025
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
 
import {
  Users,
  Plus,
  Search,
  Download,
  Trash2,
  MoreVertical,
  Filter as _Filter,
  Mail,
  Edit,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/hooks/use-toast';

interface DistributionList {
  id: string;
  name: string;
  description?: string;
  listType: 'manual' | 'dynamic' | 'segment';
  filterCriteria?: ListFilterCriteria;
  subscriberCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListFilterCriteria {
  roles?: string[];
  statuses?: string[];
  tags?: string[];
  joinedAfter?: string;
  joinedBefore?: string;
}

interface Subscriber {
  id: string;
  profileId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: 'subscribed' | 'unsubscribed' | 'bounced';
  subscribedAt: string;
}

interface Profile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
}

export function DistributionListManager() {
  const { toast } = useToast();

  const [lists, setLists] = useState<DistributionList[]>([]);
  const [selectedList, setSelectedList] = useState<DistributionList | null>(
    null
  );
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(
    new Set()
  );

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addSubscribersOpen, setAddSubscribersOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [listType, setListType] = useState<'manual' | 'dynamic' | 'segment'>(
    'manual'
  );
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/communications/distribution-lists');

      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }

      const data = await response.json();
      setLists(data.lists || []);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load distribution lists',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSubscribers = useCallback(async (listId: string) => {
    try {
      const response = await fetch(
        `/api/communications/distribution-lists/${listId}/subscribers`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch subscribers');
      }

      const data = await response.json();
      setSubscribers(data.subscribers || []);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load subscribers',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    if (selectedList) {
      fetchSubscribers(selectedList.id);
    }
  }, [selectedList, fetchSubscribers]);

  const fetchAvailableProfiles = async () => {
    try {
      const response = await fetch('/api/profiles?limit=1000');

      if (!response.ok) {
        throw new Error('Failed to fetch profiles');
      }

      const data = await response.json();
      setAvailableProfiles(data.profiles || []);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load member profiles',
        variant: 'destructive',
      });
    }
  };

  const handleCreateList = async () => {
    if (!listName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a list name',
        variant: 'destructive',
      });
      return;
    }

    try {
      const filterCriteria: ListFilterCriteria | undefined =
        listType === 'dynamic'
          ? {
              roles: filterRoles.length > 0 ? filterRoles : undefined,
              statuses: filterStatuses.length > 0 ? filterStatuses : undefined,
            }
          : undefined;

      const response = await fetch('/api/communications/distribution-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName,
          description: listDescription,
          listType,
          filterCriteria,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create list');
      }

      const data = await response.json();

      toast({
        title: 'Success',
        description: 'Distribution list created successfully',
      });

      setLists((prev) => [data.list, ...prev]);
      setSelectedList(data.list);
      setCreateDialogOpen(false);
      resetForm();
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to create distribution list',
        variant: 'destructive',
      });
    }
  };

  const handleAddSubscribers = async () => {
    if (!selectedList || selectedProfiles.size === 0) return;

    try {
      const response = await fetch(
        `/api/communications/distribution-lists/${selectedList.id}/subscribers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileIds: Array.from(selectedProfiles),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add subscribers');
      }

      toast({
        title: 'Success',
        description: `Added ${selectedProfiles.size} subscriber(s)`,
      });

      fetchSubscribers(selectedList.id);
      fetchLists(); // Update subscriber count
      setAddSubscribersOpen(false);
      setSelectedProfiles(new Set());
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to add subscribers',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveSubscriber = async (subscriberId: string) => {
    if (!selectedList) return;

    try {
      const response = await fetch(
        `/api/communications/distribution-lists/${selectedList.id}/subscribers/${subscriberId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove subscriber');
      }

      toast({
        title: 'Success',
        description: 'Subscriber removed',
      });

      setSubscribers((prev) => prev.filter((s) => s.id !== subscriberId));
      fetchLists(); // Update subscriber count
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to remove subscriber',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      const response = await fetch(
        `/api/communications/distribution-lists/${listId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }

      toast({
        title: 'Success',
        description: 'Distribution list deleted',
      });

      setLists((prev) => prev.filter((l) => l.id !== listId));
      if (selectedList?.id === listId) {
        setSelectedList(null);
      }
      setDeleteConfirm(null);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to delete list',
        variant: 'destructive',
      });
    }
  };

  const handleExportList = async () => {
    if (!selectedList) return;

    try {
      const response = await fetch(
        `/api/communications/distribution-lists/${selectedList.id}/export`
      );

      if (!response.ok) {
        throw new Error('Failed to export list');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedList.name}_subscribers.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'List exported successfully',
      });
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to export list',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setListName('');
    setListDescription('');
    setListType('manual');
    setFilterRoles([]);
    setFilterStatuses([]);
  };

  const filteredSubscribers = subscribers.filter(
    (sub) =>
      searchQuery === '' ||
      sub.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'subscribed':
        return 'bg-green-100 text-green-800';
      case 'unsubscribed':
        return 'bg-gray-100 text-gray-800';
      case 'bounced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Distribution Lists
          </h2>
          <p className="text-sm text-gray-600">
            Manage subscriber groups for targeted campaigns
          </p>
        </div>

        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create List
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lists Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Your Lists</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : lists.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">No lists yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lists.map((list) => (
                  <Card
                    key={list.id}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedList?.id === list.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedList(list)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">
                            {list.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {list.listType}
                            </Badge>
                            <span className="text-xs text-gray-600">
                              {list.subscriberCount} members
                            </span>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                // Edit list
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(list.id);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* List Details & Subscribers */}
        <Card className="lg:col-span-2">
          {selectedList ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedList.name}</CardTitle>
                    <CardDescription>
                      {selectedList.description || 'No description'}
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportList}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        fetchAvailableProfiles();
                        setAddSubscribersOpen(true);
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Members
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search subscribers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Subscribers Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Subscribed</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscribers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <Mail className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">
                              No subscribers yet
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSubscribers.map((subscriber) => (
                          <TableRow key={subscriber.id}>
                            <TableCell className="font-medium">
                              {subscriber.email}
                            </TableCell>
                            <TableCell>
                              {subscriber.firstName && subscriber.lastName
                                ? `${subscriber.firstName} ${subscriber.lastName}`
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={getStatusColor(subscriber.status)}
                              >
                                {subscriber.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(
                                subscriber.subscribedAt
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() =>
                                  handleRemoveSubscriber(subscriber.id)
                                }
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-96">
              <div className="text-center">
                <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Select a list
                </h3>
                <p className="text-gray-600">
                  Choose a distribution list to view and manage subscribers
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Create List Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Distribution List</DialogTitle>
            <DialogDescription>
              Create a new subscriber group for your newsletter campaigns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="list-name">List Name *</Label>
              <Input
                id="list-name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="e.g., All Members, Active Union Reps"
              />
            </div>

            <div>
              <Label htmlFor="list-description">Description</Label>
              <Textarea
                id="list-description"
                value={listDescription}
                onChange={(e) => setListDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div>
              <Label>List Type</Label>
              <Select
                value={listType}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onValueChange={(value: any) => setListType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">
                    Manual - Add members individually
                  </SelectItem>
                  <SelectItem value="dynamic">
                    Dynamic - Auto-update based on criteria
                  </SelectItem>
                  <SelectItem value="segment">
                    Segment - Filtered subset of members
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {listType === 'dynamic' && (
              <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                <h4 className="font-semibold text-sm">Filter Criteria</h4>
                <p className="text-xs text-gray-600">
                  Members matching these criteria will be automatically added
                </p>

                {/* Role filter - simplified for demo */}
                <div>
                  <Label>Member Roles</Label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {['member', 'union_rep', 'admin'].map((role) => (
                      <label key={role} className="flex items-center gap-2">
                        <Checkbox
                          checked={filterRoles.includes(role)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilterRoles([...filterRoles, role]);
                            } else {
                              setFilterRoles(
                                filterRoles.filter((r) => r !== role)
                              );
                            }
                          }}
                        />
                        <span className="text-sm capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList}>Create List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subscribers Dialog */}
      <Dialog open={addSubscribersOpen} onOpenChange={setAddSubscribersOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add Subscribers</DialogTitle>
            <DialogDescription>
              Select members to add to {selectedList?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Search members..."
              className="w-full"
            />

            <div className="border rounded-lg max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProfiles.has(profile.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedProfiles);
                            if (checked) {
                              newSet.add(profile.id);
                            } else {
                              newSet.delete(profile.id);
                            }
                            setSelectedProfiles(newSet);
                          }}
                        />
                      </TableCell>
                      <TableCell>{profile.email}</TableCell>
                      <TableCell>
                        {profile.firstName && profile.lastName
                          ? `${profile.firstName} ${profile.lastName}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{profile.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-gray-600">
              {selectedProfiles.size} member(s) selected
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddSubscribersOpen(false);
                setSelectedProfiles(new Set());
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSubscribers}
              disabled={selectedProfiles.size === 0}
            >
              Add {selectedProfiles.size} Subscriber(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Distribution List</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this list? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteList(deleteConfirm)}
            >
              Delete List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

