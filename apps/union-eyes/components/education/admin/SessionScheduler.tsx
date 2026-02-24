"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, MapPin, Users, Video, Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Course {
  id: string;
  courseName: string;
  courseCode: string;
  deliveryMethod: string;
  maxEnrollment: number;
}

interface Session {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  sessionCode: string;
  sessionName: string;
  startDate: string;
  endDate: string;
  deliveryMethod: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  virtualMeetingUrl?: string;
  leadInstructorId?: string;
  sessionStatus: string;
  registrationCapacity?: number;
  enrolledCount: number;
  attendedCount: number;
}

interface SessionSchedulerProps {
  organizationId: string;
}

export function SessionScheduler({ organizationId }: SessionSchedulerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    courseId: "",
    sessionName: "",
    startDate: "",
    endDate: "",
    deliveryMethod: "in_person",
    venueName: "",
    venueAddress: "",
    venueCity: "",
    venueState: "",
    venueZipCode: "",
    venueRoom: "",
    virtualMeetingUrl: "",
    virtualMeetingPassword: "",
    leadInstructorId: "",
    registrationDeadline: "",
    registrationCapacity: "",
  });

  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(`/api/education/courses?organizationId=${organizationId}`);
      const data = await response.json();
      setCourses(data.courses || []);
    } catch (_error) {
toast.error("Failed to load courses");
    }
  }, [organizationId]);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/education/sessions?organizationId=${organizationId}`;
      
      if (filterStatus !== "all") {
        url += `&sessionStatus=${filterStatus}`;
      }
      if (filterCourse !== "all") {
        url += `&courseId=${filterCourse}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (_error) {
toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [organizationId, filterStatus, filterCourse]);

  // Fetch courses
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Fetch sessions
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreateSession = async () => {
    try {
      if (!formData.courseId || !formData.startDate || !formData.endDate) {
        toast.error("Please fill in all required fields");
        return;
      }

      const response = await fetch("/api/education/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          ...formData,
          registrationCapacity: formData.registrationCapacity
            ? parseInt(formData.registrationCapacity)
            : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const _data = await response.json();
      toast.success("Session created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      fetchSessions();
    } catch (_error) {
toast.error("Failed to create session");
    }
  };

  const handleUpdateSession = async () => {
    try {
      if (!selectedSession) return;

      const response = await fetch(`/api/education/sessions?id=${selectedSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          registrationCapacity: formData.registrationCapacity
            ? parseInt(formData.registrationCapacity)
            : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update session");
      }

      toast.success("Session updated successfully");
      setIsEditDialogOpen(false);
      setSelectedSession(null);
      resetForm();
      fetchSessions();
    } catch (_error) {
toast.error("Failed to update session");
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to cancel this session? All enrolled members will be notified.")) {
      return;
    }

    try {
      const reason = prompt("Please provide a cancellation reason:");
      if (!reason) return;

      const response = await fetch(`/api/education/sessions?id=${sessionId}&reason=${encodeURIComponent(reason)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel session");
      }

      toast.success("Session cancelled successfully");
      fetchSessions();
    } catch (_error) {
toast.error("Failed to cancel session");
    }
  };

  const openEditDialog = (session: Session) => {
    setSelectedSession(session);
    setFormData({
      courseId: session.courseId,
      sessionName: session.sessionName,
      startDate: session.startDate.split("T")[0],
      endDate: session.endDate.split("T")[0],
      deliveryMethod: session.deliveryMethod,
      venueName: session.venueName || "",
      venueAddress: session.venueAddress || "",
      venueCity: session.venueCity || "",
      venueState: "",
      venueZipCode: "",
      venueRoom: "",
      virtualMeetingUrl: session.virtualMeetingUrl || "",
      virtualMeetingPassword: "",
      leadInstructorId: session.leadInstructorId || "",
      registrationDeadline: "",
      registrationCapacity: session.registrationCapacity?.toString() || "",
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      courseId: "",
      sessionName: "",
      startDate: "",
      endDate: "",
      deliveryMethod: "in_person",
      venueName: "",
      venueAddress: "",
      venueCity: "",
      venueState: "",
      venueZipCode: "",
      venueRoom: "",
      virtualMeetingUrl: "",
      virtualMeetingPassword: "",
      leadInstructorId: "",
      registrationDeadline: "",
      registrationCapacity: "",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      scheduled: "bg-blue-100 text-blue-800",
      registration_open: "bg-green-100 text-green-800",
      registration_closed: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-purple-100 text-purple-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-800"}>
        {status.replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };

  const getDeliveryIcon = (method: string) => {
    if (method === "virtual_live" || method === "webinar") {
      return <Video className="h-4 w-4" />;
    }
    return <MapPin className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Session Scheduler</h2>
          <p className="text-muted-foreground">Manage course sessions and scheduling</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Session</DialogTitle>
              <DialogDescription>Schedule a new course session</DialogDescription>
            </DialogHeader>
            <SessionForm
              formData={formData}
              setFormData={setFormData}
              courses={courses}
              onSubmit={handleCreateSession}
              onCancel={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="registration_open">Registration Open</SelectItem>
                  <SelectItem value="registration_closed">Registration Closed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Course</Label>
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.courseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Grid */}
      {loading ? (
        <div className="text-center py-8">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No sessions found. Create your first session to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg">{session.sessionName}</CardTitle>
                    <CardDescription>
                      {session.courseName} ({session.courseCode})
                    </CardDescription>
                  </div>
                  {getStatusBadge(session.sessionStatus)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {new Date(session.startDate).toLocaleDateString()} -{" "}
                      {new Date(session.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getDeliveryIcon(session.deliveryMethod)}
                    <span className="capitalize">
                      {session.deliveryMethod.replace(/_/g, " ")}
                    </span>
                  </div>
                  {session.venueName && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{session.venueName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {session.enrolledCount} enrolled
                      {session.registrationCapacity && ` / ${session.registrationCapacity}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{session.attendedCount} attended</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(session)}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  {session.sessionStatus !== "cancelled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelSession(session.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>Update session details</DialogDescription>
          </DialogHeader>
          <SessionForm
            formData={formData}
            setFormData={setFormData}
            courses={courses}
            onSubmit={handleUpdateSession}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setSelectedSession(null);
              resetForm();
            }}
            isEdit
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Session Form Component
interface SessionFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void;
  courses: Course[];
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}

function SessionForm({
  formData,
  setFormData,
  courses,
  onSubmit,
  onCancel,
  isEdit = false,
}: SessionFormProps) {
  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-4">
      {!isEdit && (
        <div>
          <Label htmlFor="courseId">Course *</Label>
          <Select value={formData.courseId} onValueChange={(value) => updateField("courseId", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.courseName} ({course.courseCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="sessionName">Session Name *</Label>
        <Input
          id="sessionName"
          value={formData.sessionName}
          onChange={(e) => updateField("sessionName", e.target.value)}
          placeholder="e.g., Steward Training - Winter 2024"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date *</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => updateField("startDate", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date *</Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => updateField("endDate", e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="deliveryMethod">Delivery Method</Label>
        <Select value={formData.deliveryMethod} onValueChange={(value) => updateField("deliveryMethod", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in_person">In Person</SelectItem>
            <SelectItem value="virtual_live">Virtual Live</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
            <SelectItem value="webinar">Webinar</SelectItem>
            <SelectItem value="workshop">Workshop</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(formData.deliveryMethod === "in_person" || formData.deliveryMethod === "hybrid") && (
        <>
          <div>
            <Label htmlFor="venueName">Venue Name</Label>
            <Input
              id="venueName"
              value={formData.venueName}
              onChange={(e) => updateField("venueName", e.target.value)}
              placeholder="e.g., Union Hall"
            />
          </div>
          <div>
            <Label htmlFor="venueAddress">Venue Address</Label>
            <Input
              id="venueAddress"
              value={formData.venueAddress}
              onChange={(e) => updateField("venueAddress", e.target.value)}
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="venueCity">City</Label>
              <Input
                id="venueCity"
                value={formData.venueCity}
                onChange={(e) => updateField("venueCity", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="venueState">State</Label>
              <Input
                id="venueState"
                value={formData.venueState}
                onChange={(e) => updateField("venueState", e.target.value)}
                placeholder="CA"
              />
            </div>
          </div>
        </>
      )}

      {(formData.deliveryMethod === "virtual_live" || 
        formData.deliveryMethod === "hybrid" || 
        formData.deliveryMethod === "webinar") && (
        <div>
          <Label htmlFor="virtualMeetingUrl">Virtual Meeting URL</Label>
          <Input
            id="virtualMeetingUrl"
            value={formData.virtualMeetingUrl}
            onChange={(e) => updateField("virtualMeetingUrl", e.target.value)}
            placeholder="https://zoom.us/j/..."
          />
        </div>
      )}

      <div>
        <Label htmlFor="registrationCapacity">Registration Capacity</Label>
        <Input
          id="registrationCapacity"
          type="number"
          value={formData.registrationCapacity}
          onChange={(e) => updateField("registrationCapacity", e.target.value)}
          placeholder="Maximum number of participants"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={onSubmit} className="flex-1">
          {isEdit ? "Update Session" : "Create Session"}
        </Button>
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}

