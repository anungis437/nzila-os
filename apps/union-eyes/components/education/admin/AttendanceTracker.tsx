"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Session {
  id: string;
  sessionCode: string;
  sessionName: string;
  courseId: string;
  courseName: string;
  startDate: string;
  endDate: string;
  enrolledCount: number;
  attendedCount: number;
}

interface Registration {
  id: string;
  memberId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  registrationStatus: string;
  registrationDate: string;
  attended: boolean;
  attendanceDates?: string[];
  attendanceHours?: number;
  completed: boolean;
  completionDate?: string;
  completionPercentage?: number;
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
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/education/sessions?organizationId=${organizationId}&sessionStatus=registration_open,in_progress,completed`
      );
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (_error) {
toast.error("Failed to load sessions");
    }
  }, [organizationId]);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Fetch attendance when session changes
  useEffect(() => {
    if (selectedSessionId) {
      fetchAttendance(selectedSessionId);
    }
  }, [selectedSessionId]);

  const fetchAttendance = async (sessionId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/education/sessions/${sessionId}/attendance`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch attendance");
      }

      const data = await response.json();
      setSelectedSession(data.session);
      setRegistrations(data.registrations || []);
      setStats(data.stats);
    } catch (_error) {
toast.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRegistration = (registrationId: string) => {
    const newSelected = new Set(selectedRegistrations);
    if (newSelected.has(registrationId)) {
      newSelected.delete(registrationId);
    } else {
      newSelected.add(registrationId);
    }
    setSelectedRegistrations(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRegistrations.size === registrations.length) {
      setSelectedRegistrations(new Set());
    } else {
      setSelectedRegistrations(new Set(registrations.map((r) => r.id)));
    }
  };

  const handleMarkAttendance = async (attended: boolean) => {
    if (selectedRegistrations.size === 0) {
      toast.error("Please select at least one member");
      return;
    }

    try {
      const response = await fetch(
        `/api/education/sessions/${selectedSessionId}/attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationIds: Array.from(selectedRegistrations),
            attended,
            attendanceDate,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark attendance");
      }

      const data = await response.json();
      toast.success(data.message || "Attendance marked successfully");
      setSelectedRegistrations(new Set());
      fetchAttendance(selectedSessionId);
    } catch (_error) {
toast.error("Failed to mark attendance");
    }
  };

  const handleMarkSingleAttendance = async (registrationId: string, memberId: string, attended: boolean) => {
    try {
      const response = await fetch(
        `/api/education/sessions/${selectedSessionId}/attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId,
            attended,
            attendanceDate,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark attendance");
      }

      toast.success("Attendance marked successfully");
      fetchAttendance(selectedSessionId);
    } catch (_error) {
toast.error("Failed to mark attendance");
    }
  };

  const exportToCSV = () => {
    if (!selectedSession || registrations.length === 0) return;

    const headers = ["Member Number", "Name", "Email", "Status", "Attended", "Completion %"];
    const rows = registrations.map((reg) => [
      reg.memberNumber,
      `${reg.firstName} ${reg.lastName}`,
      reg.email,
      reg.registrationStatus,
      reg.attended ? "Yes" : "No",
      reg.completionPercentage || "0",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${selectedSession.sessionCode}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      registered: "bg-blue-100 text-blue-800",
      confirmed: "bg-green-100 text-green-800",
      attended: "bg-purple-100 text-purple-800",
      completed: "bg-gray-100 text-gray-800",
      no_show: "bg-red-100 text-red-800",
      cancelled: "bg-orange-100 text-orange-800",
    };

    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-800"}>
        {status.replace(/_/g, " ").toUpperCase()}
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
          <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
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
              <CardTitle className="text-sm font-medium">Total Enrolled</CardTitle>
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
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="attendanceDate">Attendance Date</Label>
                <Input
                  id="attendanceDate"
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </div>
              <Button
                onClick={() => handleMarkAttendance(true)}
                disabled={selectedRegistrations.size === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Mark Present ({selectedRegistrations.size})
              </Button>
              <Button
                onClick={() => handleMarkAttendance(false)}
                disabled={selectedRegistrations.size === 0}
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

      {/* Attendance Roster */}
      {selectedSession && (
        <Card>
          <CardHeader>
            <CardTitle>Session Roster</CardTitle>
            <CardDescription>
              {selectedSession.sessionName} - {selectedSession.courseName}
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
                    <TableHead>Member #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Attended</TableHead>
                    <TableHead className="text-center">Completion</TableHead>
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
                      <TableCell className="font-medium">{registration.memberNumber}</TableCell>
                      <TableCell>
                        {registration.firstName} {registration.lastName}
                      </TableCell>
                      <TableCell>{registration.email}</TableCell>
                      <TableCell>{getStatusBadge(registration.registrationStatus)}</TableCell>
                      <TableCell className="text-center">
                        {registration.attended ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {registration.completionPercentage || 0}%
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {!registration.attended && (
                            <Button
                              size="sm"
                              variant="ghost"
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

