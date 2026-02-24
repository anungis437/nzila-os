/**
 * Member Learning Portal Component
 * Personal learning dashboard with courses, certificates, and progress tracking
 * Phase 3: Education & Training UI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  Award,
  GraduationCap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Download,
  TrendingUp,
} from 'lucide-react';
 
import { format } from 'date-fns';

interface Registration {
  id: string;
  course_name: string;
  course_code: string;
  course_category: string;
  session_code: string;
  start_date: string;
  end_date: string;
  registration_status: string;
  attended: boolean;
  completed: boolean;
  completion_percentage: number;
  passed: boolean | null;
  venue_name: string | null;
}

interface Completion {
  id: string;
  course_name: string;
  course_code: string;
  course_category: string;
  completion_date: string;
  passed: boolean;
  certificate_issued: boolean;
  certificate_number: string | null;
  certificate_url: string | null;
  certification_name: string | null;
  expiry_date: string | null;
  is_expired: boolean;
  expiring_soon: boolean;
  days_until_expiry: number | null;
}

interface MemberLearningPortalProps {
  organizationId: string;
  memberId: string;
}

const statusColors: Record<string, string> = {
  registered: 'bg-blue-500',
  confirmed: 'bg-green-500',
  attended: 'bg-purple-500',
  completed: 'bg-emerald-600',
  cancelled: 'bg-red-500',
  waitlisted: 'bg-yellow-500',
};

const categoryColors: Record<string, string> = {
  steward_training: 'bg-blue-600',
  leadership_development: 'bg-purple-600',
  health_and_safety: 'bg-red-600',
  collective_bargaining: 'bg-green-600',
  grievance_handling: 'bg-orange-600',
  labor_law: 'bg-indigo-600',
};

export function MemberLearningPortal({ organizationId: _organizationId, memberId }: MemberLearningPortalProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-courses');

  const fetchMemberData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch registrations
      const regResponse = await fetch(`/api/education/registrations?memberId=${memberId}`);
      if (regResponse.ok) {
        const regData = await regResponse.json();
        setRegistrations(regData.data || []);
      }

      // Fetch completions
      const compResponse = await fetch(`/api/education/completions?memberId=${memberId}`);
      if (compResponse.ok) {
        const compData = await compResponse.json();
        setCompletions(compData.data || []);
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  const activeCourses = registrations.filter(r => 
    !r.completed && ['registered', 'confirmed', 'attended'].includes(r.registration_status)
  );
  
  const upcomingCourses = activeCourses.filter(r => 
    new Date(r.start_date) > new Date()
  );
  
  const inProgressCourses = activeCourses.filter(r => 
    new Date(r.start_date) <= new Date() && new Date(r.end_date) >= new Date()
  );

  const validCertificates = completions.filter(c => 
    c.certificate_issued && !c.is_expired
  );

  const expiringCertificates = completions.filter(c => 
    c.certificate_issued && c.expiring_soon && !c.is_expired
  );

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
          <h2 className="text-2xl font-bold">My Learning Portal</h2>
          <p className="text-muted-foreground">Track your training progress and certificates</p>
        </div>
        <Button onClick={fetchMemberData}>Refresh</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <BookOpen className="h-4 w-4 mr-2" />
              Active Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCourses.length}</div>
            <p className="text-xs text-muted-foreground">
              {inProgressCourses.length} in progress, {upcomingCourses.length} upcoming
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <GraduationCap className="h-4 w-4 mr-2" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completions.length}</div>
            <p className="text-xs text-muted-foreground">
              {completions.filter(c => c.passed).length} passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Award className="h-4 w-4 mr-2" />
              Certificates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{validCertificates.length}</div>
            <p className="text-xs text-muted-foreground">Valid certifications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{expiringCertificates.length}</div>
            <p className="text-xs text-muted-foreground">Within 90 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-courses">My Courses</TabsTrigger>
          <TabsTrigger value="certificates">My Certificates</TabsTrigger>
          <TabsTrigger value="available">Available Courses</TabsTrigger>
        </TabsList>

        {/* My Courses Tab */}
        <TabsContent value="my-courses" className="space-y-4">
          {/* In Progress */}
          {inProgressCourses.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">In Progress</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {inProgressCourses.map((course) => (
                  <Card key={course.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{course.course_name}</CardTitle>
                          <CardDescription>{course.course_code}</CardDescription>
                        </div>
                        <Badge className={categoryColors[course.course_category] || 'bg-gray-600'}>
                          {course.course_category.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{course.completion_percentage}%</span>
                        </div>
                        <Progress value={course.completion_percentage} className="h-2" />
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        {format(new Date(course.start_date), 'MMM d')} - {format(new Date(course.end_date), 'MMM d, yyyy')}
                      </div>

                      {course.venue_name && (
                        <div className="text-sm text-muted-foreground">
                          ðŸ“ {course.venue_name}
                        </div>
                      )}

                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcomingCourses.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Upcoming</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingCourses.map((course) => (
                  <Card key={course.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{course.course_name}</CardTitle>
                          <CardDescription>{course.session_code}</CardDescription>
                        </div>
                        <Badge className={statusColors[course.registration_status] || 'bg-gray-500'}>
                          {course.registration_status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(course.start_date), 'MMMM d, yyyy')}
                        </span>
                      </div>

                      {course.venue_name && (
                        <div className="text-sm text-muted-foreground">
                          ðŸ“ {course.venue_name}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          View Details
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" disabled>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeCourses.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No active courses</p>
                <p className="text-sm text-muted-foreground mb-4">Browse available courses to get started</p>
                <Button onClick={() => setActiveTab('available')}>Browse Courses</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Certificates Tab */}
        <TabsContent value="certificates" className="space-y-4">
          {/* Expiring Soon Warning */}
          {expiringCertificates.length > 0 && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CardHeader>
                <CardTitle className="text-lg flex items-center text-yellow-900 dark:text-yellow-100">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Certificates Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {expiringCertificates.map((cert) => (
                    <div key={cert.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
                      <div>
                        <div className="font-medium text-sm">{cert.certification_name || cert.course_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Expires in {cert.days_until_expiry} days ({format(new Date(cert.expiry_date!), 'MMM d, yyyy')})
                        </div>
                      </div>
                      <Button size="sm" variant="outline">Renew</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Valid Certificates */}
          <div className="grid gap-4 md:grid-cols-2">
            {validCertificates.map((cert) => (
              <Card key={cert.id} className="border-green-200 dark:border-green-900">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="h-5 w-5 text-green-600" />
                        {cert.certification_name || cert.course_name}
                      </CardTitle>
                      <CardDescription>{cert.certificate_number}</CardDescription>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Issued</span>
                      <span className="font-medium">{format(new Date(cert.completion_date), 'MMM d, yyyy')}</span>
                    </div>
                    {cert.expiry_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Expires</span>
                        <span className="font-medium">{format(new Date(cert.expiry_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>

                  <Badge className={categoryColors[cert.course_category] || 'bg-gray-600'}>
                    {cert.course_category.replace(/_/g, ' ')}
                  </Badge>

                  <Button variant="outline" size="sm" className="w-full" disabled={!cert.certificate_url}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Certificate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {validCertificates.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Award className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No certificates yet</p>
                <p className="text-sm text-muted-foreground">Complete courses to earn certificates</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Available Courses Tab */}
        <TabsContent value="available">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Browse Course Catalog</p>
              <p className="text-sm text-muted-foreground mb-4">View this page in the full Course Catalog</p>
              <Button>Go to Course Catalog</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MemberLearningPortal;

