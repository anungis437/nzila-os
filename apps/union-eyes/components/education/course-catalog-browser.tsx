/**
 * Course Catalog Browser Component
 * 
 * Training course discovery with:
 * - Course browsing
 * - Category filtering
 * - Search functionality
 * - Course details
 * - Enrollment options
 * - Prerequisites display
 * 
 * @module components/education/course-catalog-browser
 */

"use client";

import * as React from "react";
import {
  BookOpen,
  Search,
  Clock,
  Users,
  Award,
  Calendar,
} from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  duration: number; // in hours
  format: "online" | "in-person" | "hybrid";
  instructor: string;
  maxParticipants?: number;
  enrolledCount: number;
  startDate?: Date;
  endDate?: Date;
  prerequisites: string[];
  certificationOffered: boolean;
  thumbnail?: string;
  price?: number;
  status: "upcoming" | "ongoing" | "completed" | "archived";
}

export interface CourseCatalogBrowserProps {
  courses: Course[];
  categories: string[];
  enrolledCourseIds?: string[];
  onEnroll?: (courseId: string) => void;
  onViewDetails?: (courseId: string) => void;
}

export function CourseCatalogBrowser({
  courses,
  categories,
  enrolledCourseIds = [],
  onEnroll,
  onViewDetails: _onViewDetails,
}: CourseCatalogBrowserProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedLevel, setSelectedLevel] = React.useState<string>("all");
  const [selectedFormat, setSelectedFormat] = React.useState<string>("all");
  const [selectedCourse, setSelectedCourse] = React.useState<Course | null>(null);

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      searchQuery === "" ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "all" || course.category === selectedCategory;
    const matchesLevel = selectedLevel === "all" || course.level === selectedLevel;
    const matchesFormat = selectedFormat === "all" || course.format === selectedFormat;

    return matchesSearch && matchesCategory && matchesLevel && matchesFormat;
  });

  const levelConfig = {
    beginner: { color: "bg-green-100 text-green-800", label: "Beginner" },
    intermediate: { color: "bg-blue-100 text-blue-800", label: "Intermediate" },
    advanced: { color: "bg-purple-100 text-purple-800", label: "Advanced" },
  };

  const formatConfig = {
    online: { label: "Online", icon: "💻" },
    "in-person": { label: "In-Person", icon: "👥" },
    hybrid: { label: "Hybrid", icon: "🔄" },
  };

  const statusConfig = {
    upcoming: { color: "bg-blue-100 text-blue-800", label: "Upcoming" },
    ongoing: { color: "bg-green-100 text-green-800", label: "Ongoing" },
    completed: { color: "bg-gray-100 text-gray-800", label: "Completed" },
    archived: { color: "bg-gray-100 text-gray-800", label: "Archived" },
  };

  const isEnrolled = (courseId: string) => enrolledCourseIds.includes(courseId);

  const handleEnroll = (course: Course) => {
    onEnroll?.(course.id);
    setSelectedCourse(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Course Catalog
        </h2>
        <p className="text-gray-600 mt-1">
          Browse and enroll in training courses
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="in-person">In-Person</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredCourses.length} of {courses.length} courses
        </p>
        {(selectedCategory !== "all" ||
          selectedLevel !== "all" ||
          selectedFormat !== "all" ||
          searchQuery !== "") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
              setSelectedLevel("all");
              setSelectedFormat("all");
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-gray-600">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No courses found matching your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const enrolled = isEnrolled(course.id);
            const spotsRemaining = course.maxParticipants
              ? course.maxParticipants - course.enrolledCount
              : null;

            return (
              <Card key={course.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={statusConfig[course.status].color}>
                      {statusConfig[course.status].label}
                    </Badge>
                    {course.certificationOffered && (
                      <Award className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {course.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className={levelConfig[course.level].color}>
                        {levelConfig[course.level].label}
                      </Badge>
                      <Badge variant="outline">{course.category}</Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {course.duration}h
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{formatConfig[course.format].icon}</span>
                        {formatConfig[course.format].label}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      {course.enrolledCount} enrolled
                      {spotsRemaining !== null && spotsRemaining > 0 && (
                        <span className="text-orange-600">
                          • {spotsRemaining} spots left
                        </span>
                      )}
                    </div>

                    {course.startDate && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        Starts {course.startDate.toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedCourse(course)}
                    >
                      View Details
                    </Button>
                    {enrolled ? (
                      <Badge variant="default" className="px-4 py-2">
                        Enrolled
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEnroll(course)}
                        disabled={
                          spotsRemaining !== null &&
                          spotsRemaining === 0
                        }
                      >
                        Enroll
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Course Details Dialog */}
      <Dialog open={!!selectedCourse} onOpenChange={() => setSelectedCourse(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedCourse?.title}</DialogTitle>
            <DialogDescription>
              {selectedCourse?.category} • {selectedCourse?.level}
            </DialogDescription>
          </DialogHeader>

          {selectedCourse && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className={statusConfig[selectedCourse.status].color}>
                  {statusConfig[selectedCourse.status].label}
                </Badge>
                <Badge className={levelConfig[selectedCourse.level].color}>
                  {levelConfig[selectedCourse.level].label}
                </Badge>
                {selectedCourse.certificationOffered && (
                  <Badge variant="default">
                    <Award className="h-3 w-3 mr-1" />
                    Certification
                  </Badge>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-gray-600">{selectedCourse.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Duration</h4>
                  <p className="text-gray-600">{selectedCourse.duration} hours</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Format</h4>
                  <p className="text-gray-600">
                    {formatConfig[selectedCourse.format].label}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Instructor</h4>
                  <p className="text-gray-600">{selectedCourse.instructor}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Enrolled</h4>
                  <p className="text-gray-600">
                    {selectedCourse.enrolledCount}
                    {selectedCourse.maxParticipants &&
                      ` / ${selectedCourse.maxParticipants}`}
                  </p>
                </div>
              </div>

              {selectedCourse.prerequisites.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Prerequisites</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedCourse.prerequisites.map((prereq, index) => (
                      <li key={index} className="text-gray-600">
                        {prereq}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedCourse.startDate && selectedCourse.endDate && (
                <div>
                  <h4 className="font-semibold mb-2">Schedule</h4>
                  <div className="text-gray-600">
                    <div>
                      Start: {selectedCourse.startDate.toLocaleDateString()} at{" "}
                      {selectedCourse.startDate.toLocaleTimeString()}
                    </div>
                    <div>
                      End: {selectedCourse.endDate.toLocaleDateString()} at{" "}
                      {selectedCourse.endDate.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCourse(null)}>
              Close
            </Button>
            {selectedCourse && !isEnrolled(selectedCourse.id) && (
              <Button onClick={() => handleEnroll(selectedCourse)}>
                Enroll Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

