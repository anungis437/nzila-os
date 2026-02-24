"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap,
  Award,
  Clock,
  CheckCircle2,
  TrendingUp,
  User,
  Calendar,
  BookOpen,
  Target,
  Download,
} from "lucide-react";

interface Enrollment {
  id: string;
  programId: string;
  enrollmentDate: string;
  enrollmentStatus: string;
  startDate: string;
  expectedCompletionDate: string | null;
  actualCompletionDate: string | null;
  completionPercentage: number;
  currentLevel: string | null;
  mentorId: string | null;
  hoursCompleted: number;
  hoursRequired: number | null;
  coursesCompleted: number;
  coursesRequired: number | null;
  progress?: {
    completedCourses: Array<{
      courseId: string;
      courseName: string;
      courseCode: string;
      completionDate: string;
      finalGrade: number | null;
      attendanceHours: number | null;
    }>;
    totalRequiredCourses: number;
    coursesCompletedCount: number;
    progressPercentage: number;
    remainingCourses: number;
  };
}

interface Program {
  id: string;
  programName: string;
  programCode: string;
  programType: string;
  description: string | null;
  durationMonths: number | null;
  totalRequiredHours: number | null;
  certificationAwarded: string | null;
  clcApproved: boolean;
  requiredCourses: string[];
}

interface Course {
  id: string;
  courseName: string;
  courseCode: string;
  courseStatus: string;
}

interface MentorInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  memberNumber: string;
}

export default function ApprenticeshipPortal({
  organizationId,
  memberId,
}: {
  organizationId: string;
  memberId: string;
}) {
  const [enrollments, setEnrollments] = useState<
    (Enrollment & { program: Program })[]
  >([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [mentors, setMentors] = useState<Record<string, MentorInfo>>({});
  const [loading, setLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all programs first
      const programsResponse = await fetch(
        `/api/education/programs?organizationId=${organizationId}`
      );
      if (!programsResponse.ok) throw new Error("Failed to fetch programs");

      const programsData = await programsResponse.json();
      const programs = programsData.programs;

      // For each program, fetch enrollments for this member
      const memberEnrollments: (Enrollment & { program: Program })[] = [];

      for (const program of programs) {
        const enrollmentsResponse = await fetch(
          `/api/education/programs/${program.id}/enrollments?includeProgress=true`
        );

        if (enrollmentsResponse.ok) {
          const enrollmentsData = await enrollmentsResponse.json();
          const memberEnrollment = enrollmentsData.enrollments.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e: any) => e.memberId === memberId
          );

          if (memberEnrollment) {
            memberEnrollments.push({
              ...memberEnrollment,
              program: enrollmentsData.program,
            });

            // Fetch mentor info if exists
            if (memberEnrollment.mentorId && !mentors[memberEnrollment.mentorId]) {
              fetchMentorInfo(memberEnrollment.mentorId);
            }
          }
        }
      }

      setEnrollments(memberEnrollments);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, memberId, mentors]);

  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/education/courses?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error("Failed to fetch courses");

      const data = await response.json();
      setAllCourses(data.courses || data);
    } catch (_error) {
}
  }, [organizationId]);

  useEffect(() => {
    fetchEnrollments();
    fetchCourses();
  }, [fetchEnrollments, fetchCourses]);

  const fetchMentorInfo = async (mentorId: string) => {
    try {
      const response = await fetch(
        `/api/members?organizationId=${organizationId}`
      );
      if (!response.ok) return;

      const data = await response.json();
      const members = data.members || data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mentor = members.find((m: any) => m.id === mentorId);

      if (mentor) {
        setMentors((prev) => ({
          ...prev,
          [mentorId]: mentor,
        }));
      }
    } catch (_error) {
}
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
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getLevelBadgeColor = (level: string | null) => {
    if (!level) return "bg-gray-100 text-gray-800";
    if (level.includes("1")) return "bg-yellow-100 text-yellow-800";
    if (level.includes("2")) return "bg-orange-100 text-orange-800";
    if (level.includes("3")) return "bg-purple-100 text-purple-800";
    if (level.includes("4")) return "bg-blue-100 text-blue-800";
    return "bg-green-100 text-green-800";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const calculateDaysRemaining = (expectedDate: string | null) => {
    if (!expectedDate) return null;
    const today = new Date();
    const expected = new Date(expectedDate);
    const diffTime = expected.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getCourseInfo = (courseId: string) => {
    return allCourses.find((c) => c.id === courseId);
  };

  // Calculate overall statistics
  const totalEnrollments = enrollments.length;
  const activeEnrollments = enrollments.filter(
    (e) => e.enrollmentStatus === "active"
  ).length;
  const completedEnrollments = enrollments.filter(
    (e) => e.enrollmentStatus === "completed"
  ).length;
  const avgProgress =
    totalEnrollments > 0
      ? Math.round(
          enrollments.reduce((sum, e) => sum + e.completionPercentage, 0) /
            totalEnrollments
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Programs
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {activeEnrollments}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {totalEnrollments} total enrollments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {completedEnrollments}
            </div>
            <p className="text-xs text-gray-500 mt-1">Programs finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {avgProgress}%
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all programs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {enrollments.reduce((sum, e) => sum + e.hoursCompleted, 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Hours completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Loading your programs...
          </CardContent>
        </Card>
      ) : enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Active Programs
            </h3>
            <p className="text-gray-500">
              You are not currently enrolled in any training programs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {enrollments.map((enrollment) => {
            const daysRemaining = calculateDaysRemaining(
              enrollment.expectedCompletionDate
            );

            return (
              <Card key={enrollment.id} className="overflow-hidden">
                <CardHeader className="bg-linear-to-r from-blue-50 to-purple-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl mb-2">
                        {enrollment.program.programName}
                      </CardTitle>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Badge
                          className={getStatusBadgeColor(
                            enrollment.enrollmentStatus
                          )}
                        >
                          {enrollment.enrollmentStatus}
                        </Badge>
                        {enrollment.currentLevel && (
                          <Badge
                            className={getLevelBadgeColor(enrollment.currentLevel)}
                          >
                            {enrollment.currentLevel.replace("_", " ").toUpperCase()}
                          </Badge>
                        )}
                        {enrollment.program.clcApproved && (
                          <Badge variant="outline">
                            <Award className="h-3 w-3 mr-1" />
                            CLC Approved
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-600">
                        {enrollment.completionPercentage}%
                      </div>
                      <p className="text-xs text-gray-500">Complete</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Overall Progress</span>
                      <span className="text-gray-600">
                        {enrollment.coursesCompleted} /{" "}
                        {enrollment.coursesRequired || "N/A"} courses
                      </span>
                    </div>
                    <Progress value={enrollment.completionPercentage} className="h-3" />
                  </div>

                  {/* Key Information Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Enrolled</p>
                        <p className="font-medium">
                          {formatDate(enrollment.enrollmentDate)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Target className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Expected Completion</p>
                        <p className="font-medium">
                          {formatDate(enrollment.expectedCompletionDate)}
                        </p>
                        {daysRemaining !== null && daysRemaining > 0 && (
                          <p className="text-xs text-gray-500">
                            {daysRemaining} days remaining
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Hours</p>
                        <p className="font-medium">
                          {enrollment.hoursCompleted} /{" "}
                          {enrollment.hoursRequired || "N/A"}
                        </p>
                        {enrollment.hoursRequired && (
                          <p className="text-xs text-gray-500">
                            {Math.round(
                              (enrollment.hoursCompleted /
                                enrollment.hoursRequired) *
                                100
                            )}
                            % complete
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mentor Information */}
                  {enrollment.mentorId && mentors[enrollment.mentorId] && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            Your Mentor
                          </p>
                          <p className="text-sm text-blue-700">
                            {mentors[enrollment.mentorId].firstName}{" "}
                            {mentors[enrollment.mentorId].lastName}
                          </p>
                          <p className="text-xs text-blue-600">
                            {mentors[enrollment.mentorId].email}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Certification Information */}
                  {enrollment.program.certificationAwarded && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Award className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-900">
                            Certification Upon Completion
                          </p>
                          <p className="text-sm text-green-700">
                            {enrollment.program.certificationAwarded}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Completed Courses */}
                  {enrollment.progress &&
                    enrollment.progress.completedCourses.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Completed Courses
                        </h4>
                        <div className="space-y-2">
                          {enrollment.progress.completedCourses.map((course) => (
                            <div
                              key={course.courseId}
                              className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-sm">
                                  {course.courseName}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {course.courseCode}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-green-600">
                                  {course.finalGrade !== null
                                    ? `${course.finalGrade}%`
                                    : "Passed"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(course.completionDate)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Required Courses (Pending) */}
                  {enrollment.progress &&
                    enrollment.progress.remainingCourses > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                          Required Courses
                          <Badge variant="outline">
                            {enrollment.progress.remainingCourses} remaining
                          </Badge>
                        </h4>
                        <div className="space-y-2">
                          {enrollment.program.requiredCourses
                            .filter(
                              (courseId) =>
                                !enrollment.progress?.completedCourses.some(
                                  (c) => c.courseId === courseId
                                )
                            )
                            .map((courseId) => {
                              const course = getCourseInfo(courseId);
                              if (!course) return null;

                              return (
                                <div
                                  key={courseId}
                                  className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg"
                                >
                                  <div>
                                    <p className="font-medium text-sm">
                                      {course.courseName}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {course.courseCode}
                                    </p>
                                  </div>
                                  {course.courseStatus === "active" ? (
                                    <Badge variant="outline" className="bg-green-50">
                                      Available
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-gray-50">
                                      Upcoming
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                  {/* Program Description */}
                  {enrollment.program.description && (
                    <div>
                      <h4 className="font-semibold mb-2">Program Description</h4>
                      <p className="text-sm text-gray-600">
                        {enrollment.program.description}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button variant="outline" className="flex-1">
                      <BookOpen className="h-4 w-4 mr-2" />
                      View Course Catalog
                    </Button>
                    {enrollment.enrollmentStatus === "completed" && (
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download Certificate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

