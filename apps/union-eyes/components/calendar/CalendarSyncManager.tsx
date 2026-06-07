/**
 * Calendar Sync Manager Component
 * 
 * Interface for connecting and managing external calendar sync
 * with Google Calendar and Microsoft Outlook.
 * 
 * @module components/calendar/CalendarSyncManager
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface ExternalConnection {
  id: string;
  provider: 'google' | 'microsoft';
  providerAccountId: string;
  syncEnabled: boolean;
  syncDirection: 'import' | 'export' | 'both';
  syncStatus: 'synced' | 'syncing' | 'failed' | 'pending';
  lastSyncAt: string | null;
  lastSyncError: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calendarMappings: Record<string, any>;
  createdAt: string;
}

interface CalendarSyncManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarSyncManager({ open, onOpenChange }: CalendarSyncManagerProps) {
  const [connections, setConnections] = useState<ExternalConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchConnections();
    }
  }, [open]);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/calendar-sync/connections');
      const data = await response.json();
      setConnections(data.connections || []);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider: 'google' | 'microsoft') => {
    try {
      // Redirect to OAuth flow
      window.location.href = `/api/calendar-sync/${provider}/auth`;
    } catch (_error) {
alert(`Failed to connect ${provider}`);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this calendar?')) {
      return;
    }

    try {
      await fetch(`/api/calendar-sync/connections/${connectionId}`, {
        method: 'DELETE',
      });
      
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch (_error) {
alert('Failed to disconnect calendar');
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);

    try {
      // Get connection details to find calendar mappings
      const connection = connections.find(c => c.id === connectionId);
      if (!connection) return;

      // Trigger sync for each mapped calendar
      const mappings = connection.calendarMappings || {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const promises = Object.entries(mappings).map(([externalCalendarId, mapping]: [string, any]) => {
        return fetch(`/api/calendar-sync/connections/${connectionId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            localCalendarId: mapping.localCalendarId,
            externalCalendarId,
          }),
        });
      });

      await Promise.all(promises);
      
      // Refresh connections to get updated sync status
      await fetchConnections();
    } catch (_error) {
alert('Failed to sync calendar');
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleSync = async (connectionId: string, enabled: boolean) => {
    try {
      await fetch(`/api/calendar-sync/connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled: enabled }),
      });

      setConnections(prev =>
        prev.map(c => (c.id === connectionId ? { ...c, syncEnabled: enabled } : c))
      );
    } catch (_error) {
alert('Failed to update sync settings');
    }
  };

  const handleChangeSyncDirection = async (
    connectionId: string,
    direction: 'import' | 'export' | 'both'
  ) => {
    try {
      await fetch(`/api/calendar-sync/connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncDirection: direction }),
      });

      setConnections(prev =>
        prev.map(c => (c.id === connectionId ? { ...c, syncDirection: direction } : c))
      );
    } catch (_error) {
alert('Failed to update sync direction');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <CloudOff className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getProviderLogo = (provider: string) => {
    const logos: Record<string, string> = {
      google: 'https://www.google.com/favicon.ico',
      microsoft: 'https://www.microsoft.com/favicon.ico',
    };
    return logos[provider] || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendar Sync</DialogTitle>
          <DialogDescription>
            Connect your Google Calendar or Microsoft Outlook to sync events automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connect New Calendar */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Connect Calendar</h3>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => handleConnect('google')}
                className="flex-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getProviderLogo('google')}
                  alt="Google"
                  className="h-4 w-4 mr-2"
                />
                Connect Google Calendar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConnect('microsoft')}
                className="flex-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getProviderLogo('microsoft')}
                  alt="Microsoft"
                  className="h-4 w-4 mr-2"
                />
                Connect Outlook Calendar
              </Button>
            </div>
          </div>

          {/* Connected Calendars */}
          {connections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Connected Calendars</h3>
              
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading connections...
                </div>
              ) : (
                <div className="space-y-4">
                  {connections.map(connection => (
                    <div
                      key={connection.id}
                      className="p-4 border rounded-lg space-y-4"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getProviderLogo(connection.provider)}
                            alt={connection.provider}
                            className="h-6 w-6"
                          />
                          <div>
                            <div className="font-semibold capitalize">
                              {connection.provider} Calendar
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {connection.providerAccountId}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {getStatusIcon(connection.syncStatus)}
                          <Badge
                            variant={
                              connection.syncStatus === 'synced'
                                ? 'default'
                                : connection.syncStatus === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {connection.syncStatus}
                          </Badge>
                        </div>
                      </div>

                      {/* Sync Controls */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`sync-${connection.id}`}>Auto-sync</Label>
                          <Switch
                            id={`sync-${connection.id}`}
                            checked={connection.syncEnabled}
                            onCheckedChange={(checked) =>
                              handleToggleSync(connection.id, checked)
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Sync Direction</Label>
                          <Select
                            value={connection.syncDirection}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onValueChange={(value: any) =>
                              handleChangeSyncDirection(connection.id, value)
                            }
                            disabled={!connection.syncEnabled}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="import">
                                Import only (from {connection.provider})
                              </SelectItem>
                              <SelectItem value="export">
                                Export only (to {connection.provider})
                              </SelectItem>
                              <SelectItem value="both">
                                Two-way sync
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Last Sync Info */}
                      {connection.lastSyncAt && (
                        <div className="text-xs text-muted-foreground">
                          Last synced:{' '}
                          {new Date(connection.lastSyncAt).toLocaleString()}
                        </div>
                      )}

                      {connection.lastSyncError && (
                        <div className="text-xs text-destructive">
                          Error: {connection.lastSyncError}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(connection.id)}
                          disabled={syncing === connection.id}
                        >
                          {syncing === connection.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Sync Now
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(connection.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && connections.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No calendars connected yet</p>
              <p className="text-sm mt-2">
                Connect your Google or Outlook calendar to get started
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

