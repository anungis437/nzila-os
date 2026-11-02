"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { attendanceCsvCell, patchSessionAttendance } from "./attendance-client";
import { Check, X, Users, Calendar, CheckCircle2, XCircle, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Session {
  id: string;
  sessionCode: string;
  sessionName: string;
  startDate: string;
}

interface Registration {
  id: string;
  memberId: string;
  registrationStatus: string | null;
  attended: boolean;
  attendanceHours: string | null;
  completed: boolean;
}

interface AttendanceStats {
  total: number;
  attended: number;
  notAttended: number;
  completed: number;
}

interface AttendanceTrackerProps {
  organizationId: string;
}

export function AttendanceTracker({ organizationId }: AttendanceTrackerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const orgGeneration = useRef(0);
  const rosterGeneration = useRef(0);

  // Organization switches invalidate all previously loaded tenant data and
  // all in-flight responses, including requests that cannot be aborted.
  useEffect(() => {
    const generation = ++orgGeneration.current;
    ++rosterGeneration.current;
    setSessions([]);
    setSelectedSessionId("");
    setSelectedSession(null);
    setRegistrations([]);
    setStats(null);
    setSelectedRegistrations(new Set());
    setPage(1);
    setHasMore(false);
    if (!organizationId) return;
    void (async () => {
      try {
        const response = await fetch('/api/education/sessions?limit=100', { cache: 'no-store' });
        if (!response.ok) throw new Error('Session catalogue unavailable');
        const payload = await response.json();
        const rows: unknown = payload?.data?.data;
        if (!Array.isArray(rows)) throw new Error('Session catalogue response invalid');
        const valid = rows.filter((row): row is Session =>
          row && typeof row.id === 'string' && typeof row.sessionName === 'string' &&
          typeof row.sessionCode === 'string' && typeof row.startDate === 'string');
        if (generation === orgGeneration.current) setSessions(valid);
      } catch {
        if (generation === orgGeneration.current) toast.error('Failed to load sessions');
      }
    })();
  }, [organizationId]);

  const fetchAttendance = useCallback(async (sessionId: string) => {
    const generation = ++rosterGeneration.current;
    const orgAtRequest = orgGeneration.current;
    setSelectedRegistrations(new Set());
    setRegistrations([]);
    setStats(null);
    setHasMore(false);
    setSelectedSession(sessions.find(session => session.id === sessionId) ?? null);
    if (!sessionId) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/education/sessions/${encodeURIComponent(sessionId)}/attendance?page=${page}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Attendance roster unavailable');
      const payload = await response.json();
      if (payload?.data?.sessionId !== sessionId || !Array.isArray(payload?.data?.registrations) ||
        payload?.data?.pagination?.page !== page ||
        typeof payload?.data?.pagination?.hasMore !== 'boolean') {
        throw new Error('Attendance roster response invalid');
      }
      const records: Registration[] = payload.data.registrations;
      if (!records.every(row => row && typeof row.id === 'string' &&
        typeof row.memberId === 'string' && typeof row.attended === 'boolean' &&
        typeof row.completed === 'boolean')) {
        throw new Error('Attendance roster is incomplete');
      }
      if (generation !== rosterGeneration.current || orgAtRequest !== orgGeneration.current) return;
      setRegistrations(records);
      setHasMore(payload.data.pagination.hasMore);
      setStats({
        total: records.length,
        attended: records.filter(row => row.attended).length,
        notAttended: records.filter(row => !row.attended).length,
        completed: records.filter(row => row.completed).length,
      });
    } catch {
      if (generation === rosterGeneration.current && orgAtRequest === orgGeneration.current) {
        toast.error('Failed to load attendance records');
      }
    } finally {
      if (generation === rosterGeneration.current && orgAtRequest === orgGeneration.current) {
        setLoading(false);
      }
    }
  }, [sessions, page]);

  useEffect(() => {
    void fetchAttendance(selectedSessionId);
    return () => { ++rosterGeneration.current; };
  }, [selectedSessionId, fetchAttendance]);

  const handleToggleRegistration = (registrationId: string) => {
    setSelectedRegistrations(current => {
      const next = new Set(current);
      if (next.has(registrationId)) next.delete(registrationId);
      else next.add(registrationId);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedRegistrations(current =>
      current.size === registrations.length
        ? new Set()
        : new Set(registrations.map(row => row.id)));
  };

  const handleMarkAttendance = async (attended: boolean) => {
    if (!selectedSessionId || saving || selectedRegistrations.size === 0) return;
    const sessionId = selectedSessionId;
    const orgAtStart = orgGeneration.current;
    const ids = [...selectedRegistrations];
    let updated = 0;
    setSaving(true);
    try {
      // The server intentionally exposes a per-registration audited PATCH,
      // not a bulk POST. Never represent partial success as all-success.
      for (const registrationId of ids) {
        if (orgAtStart !== orgGeneration.current) break;
        try {
          await patchSessionAttendance(sessionId, registrationId, attended);
          updated++;
        } catch {
          // Continue independent records and report the exact partial count.
        }
      }
      if (orgAtStart === orgGeneration.current) {
        if (updated === ids.length) toast.success(`Attendance updated for ${updated} registrations`);
        else toast.error(`Only ${updated} of ${ids.length} attendance updates succeeded`);
        await fetchAttendance(sessionId);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSingleAttendance = async (registrationId: string, _memberId: string, attended: boolean) => {
    if (!selectedSessionId || saving) return;
    const sessionId = selectedSessionId;
    const orgAtStart = orgGeneration.current;
    setSaving(true);
    try {
      await patchSessionAttendance(sessionId, registrationId, attended);
      if (orgAtStart === orgGeneration.current) {
        toast.success('Attendance updated');
        await fetchAttendance(sessionId);
      }
    } catch {
      if (orgAtStart === orgGeneration.current) toast.error('Attendance update was not confirmed');
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    if (!selectedSession || registrations.length === 0) return;
    const headers = ['Member ID', 'Status', 'Attended', 'Completed', 'Attendance Hours'];
    const rows = registrations.map(row => [
      row.memberId,
      row.registrationStatus ?? 'Unknown',
      row.attended ? 'Yes' : 'No',
      row.completed ? 'Yes' : 'No',
      row.attendanceHours ?? '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(attendanceCsvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `attendance-${selectedSession.id}-page-${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string | null) => {
    const statusColors: Record<string, string> = {
      registered: "bg-blue-100 text-blue-800",
      confirmed: "bg-green-100 text-green-800",
      attended: "bg-purple-100 text-purple-800",
      completed: "bg-gray-100 text-gray-800",
      no_show: "bg-red-100 text-red-800",
      cancelled: "bg-orange-100 text-orange-800",
    };

    return (
      <Badge className={statusColors[status ?? ""] || "bg-gray-100 text-gray-800"}>
        {(status ?? "unknown").replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Attendance Tracker</h2>
        <p className="text-muted-foreground">Mark and manage session attendance</p>
      </div>

      {/* Session Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Session</CardTitle>
          <CardDescription>Choose a session to view and manage attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedSessionId} onValueChange={(id) => { setPage(1); setSelectedSessionId(id); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.sessionName} - {new Date(session.startDate).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Attendance Stats */}
      {selectedSession && stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Registrations on this page</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Attended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-2xl font-bold text-green-600">{stats.attended}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Not Attended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-2xl font-bold text-red-600">{stats.notAttended}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-2xl font-bold text-blue-600">{stats.completed}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedSession && registrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Actions</CardTitle>
            <CardDescription>
              {selectedRegistrations.size} member(s) selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <Button
                onClick={() => handleMarkAttendance(true)}
                disabled={saving || selectedRegistrations.size === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Mark Present ({selectedRegistrations.size})
              </Button>
              <Button
                onClick={() => handleMarkAttendance(false)}
                disabled={saving || selectedRegistrations.size === 0}
                variant="outline"
              >
                <X className="mr-2 h-4 w-4" />
                Mark Absent ({selectedRegistrations.size})
              </Button>
              <Button onClick={exportToCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSession && (
        <div className="flex items-center justify-between gap-3" aria-label="Attendance roster pagination">
          <span className="text-sm text-muted-foreground">Roster page {page}; exports include this page only.</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 1 || loading || saving}
              onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</Button>
            <Button variant="outline" disabled={!hasMore || loading || saving}
              onClick={() => setPage(current => current + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Attendance Roster */}
      {selectedSession && (
        <Card>
          <CardHeader>
            <CardTitle>Session Roster</CardTitle>
            <CardDescription>
              {selectedSession.sessionName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading attendance records...</div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No registrations found for this session.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRegistrations.size === registrations.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Attended</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((registration) => (
                    <TableRow key={registration.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRegistrations.has(registration.id)}
                          onCheckedChange={() => handleToggleRegistration(registration.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{registration.memberId}</TableCell>
                      <TableCell>{getStatusBadge(registration.registrationStatus)}</TableCell>
                      <TableCell className="text-center">
                        {registration.attended ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {registration.completed ? "Yes" : "No"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {!registration.attended && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={saving}
                              onClick={() =>
                                handleMarkSingleAttendance(
                                  registration.id,
                                  registration.memberId,
                                  true
                                )
                              }
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          {registration.attended && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleMarkSingleAttendance(
                                  registration.id,
                                  registration.memberId,
                                  false
                                )
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

