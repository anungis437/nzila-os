/**
 * Federation Meeting Scheduler Component
 * 
 * Schedule and manage federation meetings/conventions with:
 * - Calendar view of upcoming meetings
 * - Create new meeting form
 * - Meeting types (convention, executive, committee)
 * - Attendee tracking
 * - Location and virtual meeting support
 * - Agenda management
 * - RSVP tracking
 * 
 * @module components/federation/FederationMeetingScheduler
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Video,
  Plus,
  Eye,
  Edit,
} from "lucide-react";
import { format, addDays } from "date-fns";

export interface FederationMeeting {
  id: string;
  title: string;
  type: "convention" | "executive" | "committee" | "general" | "special";
  startDate: Date;
  endDate: Date;
  location?: string;
  virtualLink?: string;
  description?: string;
  agenda?: string;
  organizerId: string;
  organizerName: string;
  maxAttendees?: number;
  rsvpCount: number;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
}

export interface FederationMeetingSchedulerProps {
  federationId: string;
}

export function FederationMeetingScheduler({
  federationId
}: FederationMeetingSchedulerProps) {
  const { toast } = useToast();
  const [meetings, setMeetings] = React.useState<FederationMeeting[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: "",
    type: "general" as FederationMeeting["type"],
    startDate: new Date(),
    endDate: addDays(new Date(), 1),
    location: "",
    virtualLink: "",
    description: "",
    maxAttendees: ""
  });

  React.useEffect(() => {
    loadMeetings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId]);

  async function loadMeetings() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/federation/meetings?federationId=${federationId}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to load meetings");
      }

      const data = await response.json();
      if (data.success) {
        setMeetings(data.meetings);
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load meetings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateMeeting() {
    try {
      const response = await fetch(`/api/federation/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          federationId,
          ...formData,
          maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : undefined
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create meeting");
      }

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Meeting Created",
          description: "New meeting has been scheduled"
        });
        setIsDialogOpen(false);
        loadMeetings();
        // Reset form
        setFormData({
          title: "",
          type: "general",
          startDate: new Date(),
          endDate: addDays(new Date(), 1),
          location: "",
          virtualLink: "",
          description: "",
          maxAttendees: ""
        });
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to create meeting",
        variant: "destructive"
      });
    }
  }

  const upcomingMeetings = React.useMemo(() => {
    return meetings
      .filter(m => new Date(m.startDate) >= new Date() && m.status === "scheduled")
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
  }, [meetings]);

  const getMeetingsForDate = (date: Date) => {
    return meetings.filter(m => {
      const meetingDate = new Date(m.startDate);
      return (
        meetingDate.getDate() === date.getDate() &&
        meetingDate.getMonth() === date.getMonth() &&
        meetingDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getTypeBadge = (type: FederationMeeting["type"]) => {
    const variants: Record<FederationMeeting["type"], { variant: string; label: string }> = {
      convention: { variant: "default", label: "Convention" },
      executive: { variant: "secondary", label: "Executive" },
      committee: { variant: "outline", label: "Committee" },
      general: { variant: "secondary", label: "General" },
      special: { variant: "default", label: "Special" }
    };
    const config = variants[type];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const _getStatusBadge = (status: FederationMeeting["status"]) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>;
      case "in-progress":
        return <Badge variant="default">In Progress</Badge>;
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meeting Scheduler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Meeting Scheduler
              </CardTitle>
              <CardDescription>
                Schedule and manage federation meetings and conventions
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Meeting
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Schedule New Meeting</DialogTitle>
                  <DialogDescription>
                    Create a new federation meeting or convention
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Meeting Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Annual Convention 2026"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Meeting Type *</Label>
                    <Select
                      value={formData.type}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onValueChange={(value) => setFormData({ ...formData, type: value as any })}
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="convention">Convention</SelectItem>
                        <SelectItem value="executive">Executive Meeting</SelectItem>
                        <SelectItem value="committee">Committee Meeting</SelectItem>
                        <SelectItem value="general">General Meeting</SelectItem>
                        <SelectItem value="special">Special Meeting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date & Time *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(formData.startDate, "PPP")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.startDate}
                            onSelect={(date) => date && setFormData({ ...formData, startDate: date })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>End Date & Time *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(formData.endDate, "PPP")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.endDate}
                            onSelect={(date) => date && setFormData({ ...formData, endDate: date })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Physical Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g., Toronto Convention Centre"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="virtualLink">Virtual Meeting Link</Label>
                    <div className="relative">
                      <Video className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="virtualLink"
                        value={formData.virtualLink}
                        onChange={(e) => setFormData({ ...formData, virtualLink: e.target.value })}
                        placeholder="https://zoom.us/..."
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Meeting description and objectives..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxAttendees">Maximum Attendees (Optional)</Label>
                    <Input
                      id="maxAttendees"
                      type="number"
                      value={formData.maxAttendees}
                      onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value })}
                      placeholder="Leave empty for unlimited"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateMeeting}>
                      Create Meeting
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Calendar */}
            <div>
              <h3 className="font-medium mb-4">Calendar</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
                modifiers={{
                  meeting: (date) => getMeetingsForDate(date).length > 0
                }}
                modifiersClassNames={{
                  meeting: "bg-primary/10 font-bold"
                }}
              />
            </div>

            {/* Upcoming Meetings */}
            <div>
              <h3 className="font-medium mb-4">Upcoming Meetings</h3>
              {upcomingMeetings.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No upcoming meetings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingMeetings.map((meeting) => (
                    <Card key={meeting.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{meeting.title}</h4>
                              {getTypeBadge(meeting.type)}
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {format(new Date(meeting.startDate), "MMM d, yyyy")}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(meeting.startDate), "h:mm a")}
                              </div>
                              {meeting.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {meeting.location}
                                </div>
                              )}
                              {meeting.virtualLink && (
                                <div className="flex items-center gap-1">
                                  <Video className="h-3 w-3" />
                                  Virtual
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{meeting.rsvpCount} RSVPs</span>
                            {meeting.maxAttendees && (
                              <span className="text-muted-foreground">
                                / {meeting.maxAttendees} max
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/federation/meetings/${meeting.id}`}>
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
