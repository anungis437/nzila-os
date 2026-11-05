/**
 * Course Catalog Component
 * Browse the live training courses and enroll in one of their open sessions.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { buildEducationEnrollment } from '@/lib/education/enrollment-selection';
import { assertEducationRegistrationCreated } from '@/lib/education/crud-response';
import { ApiShapeError, isRecord, readApiError } from '@/lib/client/api-envelope';
import { fetchAllRows } from '@/lib/client/crud-lists';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Clock, Users, Award, Search, Filter, CheckCircle2 } from 'lucide-react';
import {
  formatDay,
  humanizeCode,
  readCourse,
  readSession,
  toEnrollmentSession,
  type Course,
  type CourseSession,
} from './education-data';

interface CourseCatalogProps {
  organizationId: string;
  memberId?: string;
}

type Catalogue = { state: 'loading' } | { state: 'error'; reason: string } | { state: 'ready'; courses: Course[] };
type Sessions = { state: 'idle' } | { state: 'loading' } | { state: 'error'; reason: string } | { state: 'ready'; sessions: CourseSession[] };

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

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// The table holds drafts and archived courses beside the live ones, and staff read all of them; only a live course can be enrolled in.
async function loadCourses(): Promise<Course[]> {
  const rows = await fetchAllRows<unknown>('/api/education/courses');
  return rows.map(readCourse).filter((course) => course.isActive);
}

// The sessions route lists every session of the organization, so the course's own are picked out here (before they are read, so another course's
// malformed row cannot hide this course's sessions).
async function loadSessionsOf(courseId: string): Promise<CourseSession[]> {
  const rows = await fetchAllRows<unknown>('/api/education/sessions');
  return rows.filter((row) => isRecord(row) && row.courseId === courseId).map(readSession);
}

function distinct(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

const feeText = (fee: number | null): string => (fee === null ? 'Fee unavailable' : fee > 0 ? `$${fee.toFixed(2)}` : 'Free');

const durationText = (course: Course): string | null => {
  const parts: string[] = [];
  if (course.durationHours !== null) parts.push(`${course.durationHours} hours`);
  if (course.durationDays !== null) parts.push(`${course.durationDays} days`);
  return parts.length > 0 ? parts.join(' • ') : null;
};

const capacityText = (course: Course): string | null => {
  if (course.minEnrollment !== null && course.maxEnrollment !== null) return `${course.minEnrollment}-${course.maxEnrollment} participants`;
  if (course.maxEnrollment !== null) return `Up to ${course.maxEnrollment} participants`;
  if (course.minEnrollment !== null) return `At least ${course.minEnrollment} participants`;
  return null;
};

export function CourseCatalog({ organizationId, memberId }: CourseCatalogProps) {
  const locale = useLocale();
  const [catalogue, setCatalogue] = useState<Catalogue>({ state: 'loading' });
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Sessions>({ state: 'idle' });
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState<string | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const catalogueRequest = useRef(0);
  const sessionsRequest = useRef(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [clcApprovedOnly, setClcApprovedOnly] = useState(false);

  // The latest request wins: a slow answer to an earlier request (or to another organization) is never shown.
  const loadCatalogue = useCallback(() => {
    const request = ++catalogueRequest.current;
    loadCourses().then(
      (courses) => {
        if (request === catalogueRequest.current) setCatalogue({ state: 'ready', courses });
      },
      (error: unknown) => {
        if (request === catalogueRequest.current) setCatalogue({ state: 'error', reason: reasonOf(error) });
      },
    );
  }, []);

  useEffect(() => {
    loadCatalogue();
    return () => {
      catalogueRequest.current += 1;
    };
  }, [organizationId, loadCatalogue]);

  const openCourse = (course: Course) => {
    const request = ++sessionsRequest.current;
    setSelectedCourse(course);
    setSelectedSessionId('');
    setEnrollmentError(null);
    setEnrollmentMessage(null);
    setSessions({ state: 'loading' });
    loadSessionsOf(course.id).then(
      (rows) => {
        if (request === sessionsRequest.current) setSessions({ state: 'ready', sessions: rows });
      },
      (error: unknown) => {
        if (request === sessionsRequest.current) setSessions({ state: 'error', reason: reasonOf(error) });
      },
    );
  };

  const closeCourse = () => {
    sessionsRequest.current += 1;
    setSelectedCourse(null);
    setSessions({ state: 'idle' });
  };

  const refresh = () => {
    setCatalogue({ state: 'loading' });
    closeCourse();
    setEnrollmentMessage(null);
    loadCatalogue();
  };

  const courses = catalogue.state === 'ready' ? catalogue.courses : [];
  const filteredCourses = courses.filter((course) => {
    const term = searchTerm.trim().toLowerCase();
    if (term && !course.name.toLowerCase().includes(term) && !(course.description ?? '').toLowerCase().includes(term)) return false;
    if (categoryFilter !== 'all' && course.category !== categoryFilter) return false;
    if (deliveryFilter !== 'all' && course.deliveryMethod !== deliveryFilter) return false;
    if (difficultyFilter !== 'all' && course.difficulty !== difficultyFilter) return false;
    if (clcApprovedOnly && !course.clcApproved) return false;
    return true;
  });

  // Only sessions the enrollment guard accepts (scheduled, registration window open, not full) are offered.
  const allSessions = sessions.state === 'ready' ? sessions.sessions.map(toEnrollmentSession) : [];
  const openSessions = sessions.state === 'ready' && selectedCourse
    ? sessions.sessions.filter((session) => {
        try {
          buildEducationEnrollment(selectedCourse.id, session.id, allSessions);
          return true;
        } catch {
          return false;
        }
      })
    : [];

  const sessionLabel = (session: CourseSession) => {
    const dates = session.startDate === session.endDate
      ? formatDay(session.startDate, locale)
      : `${formatDay(session.startDate, locale)} – ${formatDay(session.endDate, locale)}`;
    return `${session.name ?? session.code} · ${dates}`;
  };

  const enroll = async () => {
    if (!memberId || !selectedCourse) return;
    setEnrolling(true);
    setEnrollmentError(null);
    try {
      const payload = buildEducationEnrollment(selectedCourse.id, selectedSessionId, allSessions);
      const response = await fetch('/api/education/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, `Registration was refused (status ${response.status})`));
      const result: unknown = await response.json().catch(() => {
        throw new ApiShapeError('the answer is not JSON');
      });
      assertEducationRegistrationCreated(result, payload.courseId, payload.sessionId);
      setEnrollmentMessage('Registration submitted. Check My Courses for its current status.');
      closeCourse();
    } catch (error) {
      setEnrollmentError(`Registration could not be completed: ${reasonOf(error)}`);
    } finally {
      setEnrolling(false);
    }
  };

  if (catalogue.state === 'loading') {
    return (
      <div className="flex items-center justify-center p-8" role="status" aria-busy="true">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (catalogue.state === 'error') {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 p-4 text-sm">
        <p className="font-medium text-destructive">The course catalogue could not be loaded.</p>
        <p className="text-muted-foreground">{catalogue.reason}</p>
        <Button onClick={refresh}>Try again</Button>
      </div>
    );
  }

  const categories = distinct(courses.map((course) => course.category));
  const deliveryMethods = distinct(courses.map((course) => course.deliveryMethod));
  const difficulties = distinct(courses.flatMap((course) => (course.difficulty === null ? [] : [course.difficulty])));
  const selectClass = 'w-full rounded-md border bg-background p-2 text-sm';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Course Catalog</h2>
          <p className="text-muted-foreground">
            {filteredCourses.length === courses.length ? `${courses.length} courses` : `${filteredCourses.length} of ${courses.length} courses`}
          </p>
        </div>
        <Button onClick={refresh}>Refresh</Button>
      </div>

      {enrollmentMessage && <p role="status" className="text-sm text-green-700">{enrollmentMessage}</p>}

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
              <select id="category" className={selectClass} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{humanizeCode(category)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery">Delivery Method</Label>
              <select id="delivery" className={selectClass} value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)}>
                <option value="all">All Methods</option>
                {deliveryMethods.map((method) => (
                  <option key={method} value={method}>{humanizeCode(method)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <select id="difficulty" className={selectClass} value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
                <option value="all">All Levels</option>
                {difficulties.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>{humanizeCode(difficulty)}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant={clcApprovedOnly ? 'default' : 'outline'}
                aria-pressed={clcApprovedOnly}
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
          <Card
            key={course.id}
            role="button"
            tabIndex={0}
            aria-label={`${course.name}, details`}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => openCourse(course)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCourse(course);
              }
            }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{humanizeCode(course.deliveryMethod)}</Badge>
                    {course.clcApproved && (
                      <Badge variant="outline" className="text-xs">CLC Approved</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{course.name}</CardTitle>
                  <CardDescription className="text-xs">{course.code}</CardDescription>
                </div>
                <Badge className={categoryColors[course.category] || 'bg-gray-600'}>
                  {humanizeCode(course.category)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {course.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
              )}

              <div className="space-y-2">
                {durationText(course) !== null && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-2" />
                    {durationText(course)}
                  </div>
                )}

                {capacityText(course) !== null && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="h-4 w-4 mr-2" />
                    {capacityText(course)}
                  </div>
                )}

                {course.providesCertification && (
                  <div className="flex items-center text-sm text-green-600">
                    <Award className="h-4 w-4 mr-2" />
                    Provides certification
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm">
                  {course.difficulty !== null && <Badge variant="outline">{humanizeCode(course.difficulty)}</Badge>}
                </div>
                <div className={course.fee === 0 ? 'text-sm text-green-600 font-medium' : course.fee === null ? 'text-sm text-muted-foreground' : 'text-sm font-medium'}>
                  {feeText(course.fee)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Course Details Modal */}
      <Dialog open={selectedCourse !== null} onOpenChange={(open) => { if (!open) closeCourse(); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedCourse && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl">{selectedCourse.name}</DialogTitle>
                    <DialogDescription className="mt-2">
                      {selectedCourse.code} • {humanizeCode(selectedCourse.deliveryMethod)}
                    </DialogDescription>
                  </div>
                  <Badge className={categoryColors[selectedCourse.category] || 'bg-gray-600'}>
                    {humanizeCode(selectedCourse.category)}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {selectedCourse.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground">{selectedCourse.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Duration</h4>
                    <p className="text-sm text-muted-foreground">{durationText(selectedCourse) ?? 'Not recorded'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Difficulty</h4>
                    {selectedCourse.difficulty !== null
                      ? <Badge variant="outline">{humanizeCode(selectedCourse.difficulty)}</Badge>
                      : <p className="text-sm text-muted-foreground">Not recorded</p>}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Capacity</h4>
                    <p className="text-sm text-muted-foreground">{capacityText(selectedCourse) ?? 'Not recorded'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Cost</h4>
                    <p className="text-sm font-semibold">{feeText(selectedCourse.fee)}</p>
                  </div>
                </div>

                {selectedCourse.providesCertification && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold text-green-900 dark:text-green-100">Certification Provided</h4>
                    </div>
                    {selectedCourse.certificationName && (
                      <p className="text-sm text-green-800 dark:text-green-200">{selectedCourse.certificationName}</p>
                    )}
                  </div>
                )}

                {selectedCourse.clcApproved && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>This course is approved by the Canadian Labour Congress</span>
                  </div>
                )}

                {/* Enroll against a real course session, never the course ID. */}
                <div className="space-y-2">
                  <Label htmlFor="education-session">Available session</Label>
                  <select
                    id="education-session"
                    className={selectClass}
                    value={selectedSessionId}
                    onChange={(event) => setSelectedSessionId(event.target.value)}
                    disabled={sessions.state !== 'ready' || enrolling}
                  >
                    <option value="">Select a session</option>
                    {openSessions.map((session) => (
                      <option key={session.id} value={session.id}>{sessionLabel(session)}</option>
                    ))}
                  </select>
                  {sessions.state === 'loading' && <p className="text-sm text-muted-foreground">Loading available sessions…</p>}
                  {sessions.state === 'error' && (
                    <p role="alert" className="text-sm text-destructive">
                      Sessions could not be loaded, so enrollment is unavailable. {sessions.reason}
                    </p>
                  )}
                  {sessions.state === 'ready' && openSessions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No session of this course is open for registration. Contact your union for scheduling.</p>
                  )}
                  {selectedCourse.fee === null && <p className="text-sm text-muted-foreground">Course fee is unavailable; enrollment is paused until it can be confirmed.</p>}
                  {!memberId && <p className="text-sm text-muted-foreground">Sign in to enroll.</p>}
                  {enrollmentError && <p role="alert" className="text-sm text-destructive">{enrollmentError}</p>}
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={enroll}
                    className="flex-1"
                    disabled={enrolling || sessions.state !== 'ready' || !memberId || !selectedSessionId || selectedCourse.fee === null}
                  >
                    {enrolling ? 'Submitting registration…' : 'Enroll in selected session'}
                  </Button>
                  <Button variant="outline" onClick={closeCourse}>
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
            {courses.length === 0 ? (
              <>
                <p className="text-lg font-medium">No courses are listed</p>
                <p className="text-sm text-muted-foreground">Your union has not published any course yet.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No courses found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CourseCatalog;
