"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
 
import {
  Users,
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  Plus,
  Search,
  Filter as _Filter,
  Trash2,
  Eye,
  Award,
} from "lucide-react";
import { toast } from "sonner";

interface Program {
  id: string;
  programName: string;
  programCode: string;
  programType: string;
  programStatus: string;
  description: string | null;
  durationMonths: number | null;
  requiredCourses: string[];
  totalRequiredHours: number | null;
  certificationAwarded: string | null;
  clcApproved: boolean;
  stats: {
    totalEnrolled: number;
    activeEnrolled: number;
    completed: number;
    withdrawn: number;
    avgCompletionPercentage: number;
  };
}

interface Enrollment {
  id: string;
  programId: string;
  memberId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentDate: string;
  enrollmentStatus: string;
  completionPercentage: number;
  currentLevel: string | null;
  mentorId: string | null;
  hoursCompleted: number;
  hoursRequired: number | null;
  coursesCompleted: number;
  coursesRequired: number | null;
}

interface Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Course {
  id: string;
  courseName: string;
  courseCode: string;
}

export default function ApprenticeshipManager({
  organizationId,
}: {
  organizationId: string;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [programStatusFilter, setProgramStatusFilter] = useState("all");
  const [programTypeFilter, setProgramTypeFilter] = useState("all");
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [createProgramOpen, setCreateProgramOpen] = useState(false);
  const [enrollMemberOpen, setEnrollMemberOpen] = useState(false);
  const [viewEnrollmentsOpen, setViewEnrollmentsOpen] = useState(false);

  // Form states
  const [newProgram, setNewProgram] = useState({
    programName: "",
    programType: "apprenticeship",
    description: "",
    durationMonths: 24,
    totalRequiredHours: 2000,
    certificationAwarded: "",
    apprenticeshipLevel: "",
    clcApproved: false,
    requiredCourses: [] as string[],
  });

  const [newEnrollment, setNewEnrollment] = useState<{
    memberId: string;
    mentorId: string | null;
    currentLevel: string;
  }>({
    memberId: "",
    mentorId: null,
    currentLevel: "orientation",
  });

  const fetchPrograms = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        organizationId,
        ...(programStatusFilter !== "all" && {
          programStatus: programStatusFilter,
        }),
        ...(programTypeFilter !== "all" && { programType: programTypeFilter }),
      });

      const response = await fetch(`/api/education/programs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch programs");

      const data = await response.json();
      setPrograms(data.programs);
    } catch (_error) {
toast.error("Failed to load programs");
    } finally {
      setLoading(false);
    }
  }, [organizationId, programStatusFilter, programTypeFilter]);

  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/members?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error("Failed to fetch members");

      const data = await response.json();
      setMembers(data.members || data);
    } catch (_error) {
}
  }, [organizationId]);

  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/education/courses?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error("Failed to fetch courses");

      const data = await response.json();
      setCourses(data.courses || data);
    } catch (_error) {
}
  }, [organizationId]);

  useEffect(() => {
    fetchPrograms();
    fetchMembers();
    fetchCourses();
  }, [fetchPrograms, fetchMembers, fetchCourses]);

  const fetchEnrollments = async (programId: string) => {
    try {
      const params = new URLSearchParams({
        ...(enrollmentStatusFilter !== "all" && {
          enrollmentStatus: enrollmentStatusFilter,
        }),
        includeProgress: "true",
      });

      const response = await fetch(
        `/api/education/programs/${programId}/enrollments?${params}`
      );
      if (!response.ok) throw new Error("Failed to fetch enrollments");

      const data = await response.json();
      setEnrollments(data.enrollments);
    } catch (_error) {
toast.error("Failed to load enrollments");
    }
  };

  const handleCreateProgram = async () => {
    try {
      const response = await fetch("/api/education/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          ...newProgram,
        }),
      });

      if (!response.ok) throw new Error("Failed to create program");

      const _data = await response.json();
      toast.success("Program created successfully");
      setCreateProgramOpen(false);
      fetchPrograms();

      // Reset form
      setNewProgram({
        programName: "",
        programType: "apprenticeship",
        description: "",
        durationMonths: 24,
        totalRequiredHours: 2000,
        certificationAwarded: "",
        apprenticeshipLevel: "",
        clcApproved: false,
        requiredCourses: [],
      });
    } catch (_error) {
toast.error("Failed to create program");
    }
  };

  const handleEnrollMember = async () => {
    if (!selectedProgram) return;

    try {
      const response = await fetch(
        `/api/education/programs/${selectedProgram.id}/enrollments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEnrollment),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to enroll member");
      }

      toast.success("Member enrolled successfully");
      setEnrollMemberOpen(false);
      fetchPrograms();
      if (viewEnrollmentsOpen) {
        fetchEnrollments(selectedProgram.id);
      }

      // Reset form
      setNewEnrollment({
        memberId: "",
        mentorId: "",
        currentLevel: "orientation",
      });
    } catch (error) {
toast.error(error.message || "Failed to enroll member");
    }
  };

  const handleUpdateEnrollmentStatus = async (
    enrollmentId: string,
    programId: string,
    status: string
  ) => {
    try {
      const response = await fetch(
        `/api/education/programs/${programId}/enrollments?enrollmentId=${enrollmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentStatus: status }),
        }
      );

      if (!response.ok) throw new Error("Failed to update enrollment");

      toast.success("Enrollment status updated");
      fetchEnrollments(programId);
      fetchPrograms();
    } catch (_error) {
toast.error("Failed to update enrollment");
    }
  };

  const handleDeactivateProgram = async (programId: string) => {
    if (
      !confirm(
        "Are you sure you want to deactivate this program? It must have no active enrollments."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/education/programs?id=${programId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to deactivate program");
      }

      toast.success("Program deactivated");
      fetchPrograms();
    } catch (error) {
toast.error(error.message || "Failed to deactivate program");
    }
  };

  const handleViewEnrollments = (program: Program) => {
    setSelectedProgram(program);
    fetchEnrollments(program.id);
    setViewEnrollmentsOpen(true);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "suspended":
        return "bg-orange-100 text-orange-800";
      case "withdrawn":
        return "bg-red-100 text-red-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProgramTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      apprenticeship: "Apprenticeship",
      journeyman: "Journeyman",
      certification: "Certification",
      continuing_education: "Continuing Education",
      leadership: "Leadership Development",
      safety: "Safety Training",
    };
    return labels[type] || type;
  };

  const filteredPrograms = programs.filter((program) =>
    program.programName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    program.programCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate overall statistics
  const totalPrograms = programs.length;
  const activePrograms = programs.filter((p) => p.programStatus === "active").length;
  const totalEnrolled = programs.reduce((sum, p) => sum + p.stats.totalEnrolled, 0);
  const totalCompleted = programs.reduce((sum, p) => sum + p.stats.completed, 0);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
            <GraduationCap className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPrograms}</div>
            <p className="text-xs text-gray-500 mt-1">{activePrograms} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolled</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalEnrolled}</div>
            <p className="text-xs text-gray-500 mt-1">Across all programs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalCompleted}</div>
            <p className="text-xs text-gray-500 mt-1">
              {totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {programs.length > 0
                ? Math.round(
                    programs.reduce((sum, p) => sum + p.stats.avgCompletionPercentage, 0) /
                      programs.length
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-gray-500 mt-1">Average completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Training Programs</CardTitle>
            <Dialog open={createProgramOpen} onOpenChange={setCreateProgramOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Program
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Training Program</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="programName">Program Name *</Label>
                    <Input
                      id="programName"
                      value={newProgram.programName}
                      onChange={(e) =>
                        setNewProgram({ ...newProgram, programName: e.target.value })
                      }
                      placeholder="e.g., Electrical Apprenticeship Program"
                    />
                  </div>

                  <div>
                    <Label htmlFor="programType">Program Type *</Label>
                    <Select
                      value={newProgram.programType}
                      onValueChange={(value) =>
                        setNewProgram({ ...newProgram, programType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
                        <SelectItem value="journeyman">Journeyman</SelectItem>
                        <SelectItem value="certification">Certification</SelectItem>
                        <SelectItem value="continuing_education">
                          Continuing Education
                        </SelectItem>
                        <SelectItem value="leadership">Leadership Development</SelectItem>
                        <SelectItem value="safety">Safety Training</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newProgram.description}
                      onChange={(e) =>
                        setNewProgram({ ...newProgram, description: e.target.value })
                      }
                      placeholder="Describe the program objectives and requirements..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="durationMonths">Duration (Months)</Label>
                      <Input
                        id="durationMonths"
                        type="number"
                        value={newProgram.durationMonths}
                        onChange={(e) =>
                          setNewProgram({
                            ...newProgram,
                            durationMonths: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="totalRequiredHours">Required Hours</Label>
                      <Input
                        id="totalRequiredHours"
                        type="number"
                        value={newProgram.totalRequiredHours}
                        onChange={(e) =>
                          setNewProgram({
                            ...newProgram,
                            totalRequiredHours: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="certificationAwarded">Certification Awarded</Label>
                    <Input
                      id="certificationAwarded"
                      value={newProgram.certificationAwarded}
                      onChange={(e) =>
                        setNewProgram({
                          ...newProgram,
                          certificationAwarded: e.target.value,
                        })
                      }
                      placeholder="e.g., Journeyman Electrician"
                    />
                  </div>

                  <div>
                    <Label htmlFor="apprenticeshipLevel">Apprenticeship Level</Label>
                    <Select
                      value={newProgram.apprenticeshipLevel}
                      onValueChange={(value) =>
                        setNewProgram({ ...newProgram, apprenticeshipLevel: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="level_1">Level 1</SelectItem>
                        <SelectItem value="level_2">Level 2</SelectItem>
                        <SelectItem value="level_3">Level 3</SelectItem>
                        <SelectItem value="level_4">Level 4</SelectItem>
                        <SelectItem value="journeyman">Journeyman</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="requiredCourses">Required Courses</Label>
                    <Select
                      onValueChange={(value) => {
                        if (!newProgram.requiredCourses.includes(value)) {
                          setNewProgram({
                            ...newProgram,
                            requiredCourses: [...newProgram.requiredCourses, value],
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add courses..." />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.courseCode} - {course.courseName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {newProgram.requiredCourses.map((courseId) => {
                        const course = courses.find((c) => c.id === courseId);
                        return (
                          <Badge
                            key={courseId}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() =>
                              setNewProgram({
                                ...newProgram,
                                requiredCourses: newProgram.requiredCourses.filter(
                                  (id) => id !== courseId
                                ),
                              })
                            }
                          >
                            {course?.courseCode} âœ•
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="clcApproved"
                      checked={newProgram.clcApproved}
                      onCheckedChange={(checked) =>
                        setNewProgram({ ...newProgram, clcApproved: checked as boolean })
                      }
                    />
                    <Label htmlFor="clcApproved" className="cursor-pointer">
                      CLC Approved Program
                    </Label>
                  </div>

                  <Button
                    onClick={handleCreateProgram}
                    disabled={!newProgram.programName || !newProgram.programType}
                    className="w-full"
                  >
                    Create Program
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search programs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={programStatusFilter} onValueChange={setProgramStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={programTypeFilter} onValueChange={setProgramTypeFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
                  <SelectItem value="journeyman">Journeyman</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="continuing_education">
                    Continuing Education
                  </SelectItem>
                  <SelectItem value="leadership">Leadership</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Programs Grid */}
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading programs...</div>
            ) : filteredPrograms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No programs found. Create your first training program to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPrograms.map((program) => (
                  <Card key={program.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{program.programName}</CardTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            {program.programCode}
                          </p>
                        </div>
                        <Badge className={getStatusBadgeColor(program.programStatus)}>
                          {program.programStatus}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Type:</span>
                        <Badge variant="outline">
                          {getProgramTypeLabel(program.programType)}
                        </Badge>
                      </div>

                      {program.durationMonths && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">
                            {program.durationMonths} months
                          </span>
                        </div>
                      )}

                      {program.totalRequiredHours && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Required Hours:</span>
                          <span className="font-medium">
                            {program.totalRequiredHours} hrs
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Enrolled:</span>
                        <span className="font-medium text-blue-600">
                          {program.stats.activeEnrolled} active
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Completed:</span>
                        <span className="font-medium text-green-600">
                          {program.stats.completed}
                        </span>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-600">Avg Progress:</span>
                          <span className="font-medium">
                            {Math.round(program.stats.avgCompletionPercentage)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${program.stats.avgCompletionPercentage}%`,
                            }}
                          />
                        </div>
                      </div>

                      {program.clcApproved && (
                        <Badge variant="outline" className="w-full justify-center">
                          <Award className="h-3 w-3 mr-1" />
                          CLC Approved
                        </Badge>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleViewEnrollments(program)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedProgram(program);
                            setEnrollMemberOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Enroll
                        </Button>
                        {program.programStatus === "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeactivateProgram(program.id)}
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
          </div>
        </CardContent>
      </Card>

      {/* Enroll Member Dialog */}
      <Dialog open={enrollMemberOpen} onOpenChange={setEnrollMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Enroll Member in {selectedProgram?.programName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="memberId">Select Member *</Label>
              <Select
                value={newEnrollment.memberId}
                onValueChange={(value) =>
                  setNewEnrollment({ ...newEnrollment, memberId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose member..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.memberNumber} - {member.firstName} {member.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="mentorId">Assign Mentor (Optional)</Label>
              <Select
                value={newEnrollment.mentorId || ""}
                onValueChange={(value) =>
                  setNewEnrollment({ ...newEnrollment, mentorId: value || null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose mentor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No mentor</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="currentLevel">Starting Level</Label>
              <Select
                value={newEnrollment.currentLevel}
                onValueChange={(value) =>
                  setNewEnrollment({ ...newEnrollment, currentLevel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orientation">Orientation</SelectItem>
                  <SelectItem value="level_1">Level 1</SelectItem>
                  <SelectItem value="level_2">Level 2</SelectItem>
                  <SelectItem value="level_3">Level 3</SelectItem>
                  <SelectItem value="level_4">Level 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleEnrollMember}
              disabled={!newEnrollment.memberId}
              className="w-full"
            >
              Enroll Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Enrollments Dialog */}
      <Dialog open={viewEnrollmentsOpen} onOpenChange={setViewEnrollmentsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Enrollments - {selectedProgram?.programName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Select
              value={enrollmentStatusFilter}
              onValueChange={setEnrollmentStatusFilter}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>

            {enrollments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No enrollments found for this program.
              </div>
            ) : (
              <div className="space-y-3">
                {enrollments.map((enrollment) => (
                  <Card key={enrollment.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold">
                              {enrollment.firstName} {enrollment.lastName}
                            </h4>
                            <Badge className={getStatusBadgeColor(enrollment.enrollmentStatus)}>
                              {enrollment.enrollmentStatus}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {enrollment.memberNumber} â€¢ {enrollment.email}
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                            <div>
                              <p className="text-gray-600">Enrolled</p>
                              <p className="font-medium">
                                {new Date(enrollment.enrollmentDate).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Current Level</p>
                              <p className="font-medium">
                                {enrollment.currentLevel || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Courses</p>
                              <p className="font-medium">
                                {enrollment.coursesCompleted} /{" "}
                                {enrollment.coursesRequired || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Hours</p>
                              <p className="font-medium">
                                {enrollment.hoursCompleted} /{" "}
                                {enrollment.hoursRequired || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Progress</span>
                              <span className="font-medium">
                                {enrollment.completionPercentage}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${enrollment.completionPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {enrollment.enrollmentStatus === "active" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleUpdateEnrollmentStatus(
                                    enrollment.id,
                                    enrollment.programId,
                                    "completed"
                                  )
                                }
                              >
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleUpdateEnrollmentStatus(
                                    enrollment.id,
                                    enrollment.programId,
                                    "suspended"
                                  )
                                }
                              >
                                Suspend
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

