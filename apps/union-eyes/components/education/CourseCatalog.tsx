/**
 * Course Catalog Component
 * Browse and enroll in training courses with filters and capacity checking
 * Phase 3: Education & Training UI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BookOpen,
  Clock,
  Users,
  Award,
  Search,
  Filter,
  CheckCircle2,
} from 'lucide-react';

interface Course {
  id: string;
  course_code: string;
  course_name: string;
  course_description: string;
  course_category: string;
  delivery_method: string;
  course_difficulty: string;
  duration_hours: number;
  duration_days: number;
  provides_certification: boolean;
  certification_name: string;
  clc_approved: boolean;
  course_fee: number;
  min_enrollment: number;
  max_enrollment: number;
}

interface CourseCatalogProps {
  organizationId: string;
  memberId?: string;
}

const categoryColors: Record<string, string> = {
  steward_training: 'bg-blue-600',
  leadership_development: 'bg-purple-600',
  health_and_safety: 'bg-red-600',
  collective_bargaining: 'bg-green-600',
  grievance_handling: 'bg-orange-600',
  labor_law: 'bg-indigo-600',
  political_action: 'bg-pink-600',
  organizing: 'bg-teal-600',
  equity_and_inclusion: 'bg-yellow-600',
  workplace_rights: 'bg-cyan-600',
};

const deliveryMethodIcons: Record<string, string> = {
  in_person: 'ðŸ¢',
  virtual_live: 'ðŸ’»',
  self_paced_online: 'ðŸ“±',
  hybrid: 'ðŸ”„',
  webinar: 'ðŸŽ¥',
  workshop: 'ðŸ› ï¸',
};

export function CourseCatalog({ organizationId, memberId }: CourseCatalogProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [clcApprovedOnly, setClcApprovedOnly] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/education/courses?organizationId=${organizationId}`);
      
      if (!response.ok) throw new Error('Failed to fetch courses');
      
      const data = await response.json();
      setCourses(data.data || []);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [organizationId]);

  const applyFilters = useCallback(() => {
    let filtered = [...courses];

    // Search
    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.course_description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(course => course.course_category === categoryFilter);
    }

    // Delivery
    if (deliveryFilter !== 'all') {
      filtered = filtered.filter(course => course.delivery_method === deliveryFilter);
    }

    // Difficulty
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(course => course.course_difficulty === difficultyFilter);
    }

    // CLC Approved
    if (clcApprovedOnly) {
      filtered = filtered.filter(course => course.clc_approved);
    }

    setFilteredCourses(filtered);
  }, [courses, searchTerm, categoryFilter, deliveryFilter, difficultyFilter, clcApprovedOnly]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleEnroll = async (sessionId: string) => {
    if (!memberId) {
      alert('Please log in to enroll');
      return;
    }

    try {
      setEnrolling(true);
      const response = await fetch('/api/education/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          memberId,
          courseId: selectedCourse?.id,
          sessionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to enroll');
      }

      alert('Successfully enrolled in course!');
      setSelectedCourse(null);
    } catch (error) {
alert(error instanceof Error ? error.message : 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Course Catalog</h2>
          <p className="text-muted-foreground">{filteredCourses.length} courses available</p>
        </div>
        <Button onClick={fetchCourses}>Refresh</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="steward_training">Steward Training</SelectItem>
                  <SelectItem value="leadership_development">Leadership</SelectItem>
                  <SelectItem value="health_and_safety">Health & Safety</SelectItem>
                  <SelectItem value="collective_bargaining">Bargaining</SelectItem>
                  <SelectItem value="grievance_handling">Grievance</SelectItem>
                  <SelectItem value="labor_law">Labor Law</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery">Delivery Method</Label>
              <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="virtual_live">Virtual Live</SelectItem>
                  <SelectItem value="self_paced_online">Self-Paced</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant={clcApprovedOnly ? "default" : "outline"}
                onClick={() => setClcApprovedOnly(!clcApprovedOnly)}
                className="w-full"
              >
                {clcApprovedOnly && <CheckCircle2 className="h-4 w-4 mr-2" />}
                CLC Approved
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Course Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.map((course) => (
          <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedCourse(course)}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{deliveryMethodIcons[course.delivery_method]}</span>
                    {course.clc_approved && (
                      <Badge variant="outline" className="text-xs">CLC Approved</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{course.course_name}</CardTitle>
                  <CardDescription className="text-xs">{course.course_code}</CardDescription>
                </div>
                <Badge className={categoryColors[course.course_category] || 'bg-gray-600'}>
                  {course.course_category.replace(/_/g, ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {course.course_description}
              </p>

              <div className="space-y-2">
                {course.duration_hours && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-2" />
                    {course.duration_hours} hours
                    {course.duration_days && ` â€¢ ${course.duration_days} days`}
                  </div>
                )}

                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="h-4 w-4 mr-2" />
                  {course.min_enrollment}-{course.max_enrollment} participants
                </div>

                {course.provides_certification && (
                  <div className="flex items-center text-sm text-green-600">
                    <Award className="h-4 w-4 mr-2" />
                    Provides certification
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm">
                  <Badge variant="outline">{course.course_difficulty}</Badge>
                </div>
                {course.course_fee > 0 ? (
                  <div className="text-sm font-medium">${course.course_fee}</div>
                ) : (
                  <div className="text-sm text-green-600 font-medium">Free</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Course Details Modal */}
      <Dialog open={selectedCourse !== null} onOpenChange={() => setSelectedCourse(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedCourse && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl">{selectedCourse.course_name}</DialogTitle>
                    <DialogDescription className="mt-2">
                      {selectedCourse.course_code} â€¢ {selectedCourse.delivery_method.replace(/_/g, ' ')}
                    </DialogDescription>
                  </div>
                  <Badge className={categoryColors[selectedCourse.course_category] || 'bg-gray-600'}>
                    {selectedCourse.course_category.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Course Info */}
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground">{selectedCourse.course_description}</p>
                </div>

                {/* Course Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Duration</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedCourse.duration_hours} hours
                      {selectedCourse.duration_days && ` (${selectedCourse.duration_days} days)`}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Difficulty</h4>
                    <Badge variant="outline">{selectedCourse.course_difficulty}</Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Capacity</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedCourse.min_enrollment}-{selectedCourse.max_enrollment} participants
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Cost</h4>
                    <p className="text-sm font-semibold">
                      {selectedCourse.course_fee > 0 ? `$${selectedCourse.course_fee}` : 'Free'}
                    </p>
                  </div>
                </div>

                {/* Certification */}
                {selectedCourse.provides_certification && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold text-green-900 dark:text-green-100">
                        Certification Provided
                      </h4>
                    </div>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      {selectedCourse.certification_name}
                    </p>
                  </div>
                )}

                {/* CLC Approval */}
                {selectedCourse.clc_approved && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>This course is approved by the Canadian Labour Congress</span>
                  </div>
                )}

                {/* Enrollment Button */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    onClick={() => handleEnroll('mock-session-id')} 
                    className="flex-1"
                    disabled={enrolling || !memberId}
                  >
                    {enrolling ? 'Enrolling...' : 'Enroll Now'}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedCourse(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {filteredCourses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No courses found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CourseCatalog;

