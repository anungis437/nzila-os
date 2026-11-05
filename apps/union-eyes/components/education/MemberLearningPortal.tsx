/**
 * Member Learning Portal Component
 * The signed-in member's registrations and certifications, as the education routes hold them.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Award, GraduationCap, Calendar, CheckCircle2, AlertCircle, Download, TrendingUp } from 'lucide-react';
import { fetchAllRows } from '@/lib/client/crud-lists';
import { MemberSessionJoin } from './MemberSessionJoin';
import {
  certificationState,
  daysBetween,
  formatDay,
  humanizeCode,
  readCertification,
  readCourse,
  readRegistration,
  readSession,
  safeHttpsUrl,
  todayDay,
  type Certification,
  type Course,
  type CourseSession,
  type Registration,
} from './education-data';

interface MemberLearningPortalProps {
  organizationId: string;
  memberId: string;
}

/** A registration with the course and session it points at. Either is null when the catalogue no longer lists it. */
interface RegistrationView {
  registration: Registration;
  course: Course | null;
  session: CourseSession | null;
}

type ScheduledView = RegistrationView & { session: CourseSession };

const hasSession = (view: RegistrationView): view is ScheduledView => view.session !== null;

type Load<T> = { state: 'loading' } | { state: 'error'; reason: string } | { state: 'ready'; value: T };

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

// Registrations that still call for the member's attention (a finished or cancelled one does not).
const ACTIVE_STATUSES = ['registered', 'confirmed', 'attended'];

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Every registration of the member with the course and session it names. The course and session lists are catalogue reads: when one of them
 * cannot be read the registrations are not shown with made-up names, the whole read is an error.
 */
async function loadRegistrations(): Promise<RegistrationView[]> {
  const [registrationRows, courseRows, sessionRows] = await Promise.all([
    fetchAllRows<unknown>('/api/education/registrations'),
    fetchAllRows<unknown>('/api/education/courses'),
    fetchAllRows<unknown>('/api/education/sessions'),
  ]);
  const registrations = registrationRows.map(readRegistration);
  const courseIds = new Set(registrations.map((registration) => registration.courseId));
  const sessionIds = new Set(registrations.map((registration) => registration.sessionId));
  // Only the courses and sessions a registration points at are read, so an unrelated malformed row cannot hide the member's own.
  const courses = new Map(courseRows.flatMap((row) => {
    const course = readCourseIf(row, courseIds);
    return course === null ? [] : [[course.id, course] as const];
  }));
  const sessions = new Map(sessionRows.flatMap((row) => {
    const session = readSessionIf(row, sessionIds);
    return session === null ? [] : [[session.id, session] as const];
  }));
  return registrations.map((registration) => ({
    registration,
    course: courses.get(registration.courseId) ?? null,
    session: sessions.get(registration.sessionId) ?? null,
  }));
}

function idOf(row: unknown): string | null {
  return typeof row === 'object' && row !== null && 'id' in row && typeof row.id === 'string' ? row.id : null;
}

function readCourseIf(row: unknown, ids: Set<string>): Course | null {
  const id = idOf(row);
  return id !== null && ids.has(id) ? readCourse(row) : null;
}

function readSessionIf(row: unknown, ids: Set<string>): CourseSession | null {
  const id = idOf(row);
  return id !== null && ids.has(id) ? readSession(row) : null;
}

async function loadCertifications(): Promise<Certification[]> {
  const rows = await fetchAllRows<unknown>('/api/education/certifications');
  return rows.map(readCertification);
}

function useLoad<T>(fetcher: () => Promise<T>, resetKey: string): [Load<T>, () => void] {
  const [result, setResult] = useState<Load<T>>({ state: 'loading' });
  const request = useRef(0);
  // The latest request wins: a slow answer to an earlier request (or to another organization) is never shown.
  const load = useCallback(() => {
    const id = ++request.current;
    fetcher().then(
      (value) => {
        if (id === request.current) setResult({ state: 'ready', value });
      },
      (error: unknown) => {
        if (id === request.current) setResult({ state: 'error', reason: reasonOf(error) });
      },
    );
  }, [fetcher]);
  useEffect(() => {
    load();
    return () => {
      request.current += 1;
    };
  }, [load, resetKey]);
  const retry = useCallback(() => {
    setResult({ state: 'loading' });
    load();
  }, [load]);
  return [result, retry];
}

function Failure({ title, reason, onRetry }: { title: string; reason: string; onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-4 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      <p className="text-muted-foreground">{reason}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function MemberLearningPortal({ organizationId }: MemberLearningPortalProps) {
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState('my-courses');
  const [registrations, retryRegistrations] = useLoad(loadRegistrations, organizationId);
  const [certifications, retryCertifications] = useLoad(loadCertifications, organizationId);

  const today = todayDay();
  const views = registrations.state === 'ready' ? registrations.value : [];
  const isActive = (view: RegistrationView) => !view.registration.completed && ACTIVE_STATUSES.includes(view.registration.status ?? '');
  const scheduled = views.filter(hasSession);
  const inProgress = scheduled.filter((view) => isActive(view) && view.session.startDate <= today && view.session.endDate >= today);
  const upcoming = scheduled.filter((view) => isActive(view) && view.session.startDate > today);
  const shown = new Set([...inProgress, ...upcoming].map((view) => view.registration.id));
  // Everything else the member is registered for: no schedule on file, a session that has ended without a completion, a waitlist, a cancellation.
  const others = views.filter((view) => !view.registration.completed && !shown.has(view.registration.id));
  const activeCount = views.filter(isActive).length;
  const completedCount = views.filter((view) => view.registration.completed).length;

  const certs = certifications.state === 'ready' ? certifications.value.map((cert) => ({ cert, state: certificationState(cert, today) })) : [];
  const valid = certs.filter((item) => item.state === 'active' || item.state === 'expiring');
  const expiring = certs.filter((item) => item.state === 'expiring');
  const pending = certs.filter((item) => item.state === 'pending');

  const nameOf = (view: RegistrationView) => view.course?.name ?? 'Course no longer in the catalogue';
  const dash = '—';
  const figure = (load: Load<unknown>, value: number) => (load.state === 'ready' ? String(value) : dash);

  const canJoin = (view: ScheduledView) =>
    view.registration.status === 'registered' && view.session.deliveryMethod !== 'in_person' && view.session.startDate <= today && view.session.endDate >= today;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Learning Portal</h2>
          <p className="text-muted-foreground">Your registrations and certifications</p>
        </div>
        <Button onClick={() => { retryRegistrations(); retryCertifications(); }}>Refresh</Button>
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
            <div className="text-2xl font-bold" data-testid="stat-active-courses">{figure(registrations, activeCount)}</div>
            <p className="text-xs text-muted-foreground">
              {registrations.state === 'ready' ? `${inProgress.length} in progress, ${upcoming.length} upcoming` : 'Not loaded'}
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
            <div className="text-2xl font-bold" data-testid="stat-completed">{figure(registrations, completedCount)}</div>
            <p className="text-xs text-muted-foreground">Completed registrations</p>
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
            <div className="text-2xl font-bold" data-testid="stat-certificates">{figure(certifications, valid.length)}</div>
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
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-expiring">{figure(certifications, expiring.length)}</div>
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
          {registrations.state === 'loading' && <p role="status" className="text-sm text-muted-foreground">Loading your courses…</p>}
          {registrations.state === 'error' && (
            <Failure title="Your courses could not be loaded." reason={registrations.reason} onRetry={retryRegistrations} />
          )}

          {inProgress.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">In Progress</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {inProgress.map((view) => (
                  <Card key={view.registration.id} data-testid="in-progress-course">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{nameOf(view)}</CardTitle>
                          {view.course && <CardDescription>{view.course.code}</CardDescription>}
                        </div>
                        {view.course && (
                          <Badge className={categoryColors[view.course.category] || 'bg-gray-600'}>
                            {humanizeCode(view.course.category)}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDay(view.session.startDate, locale)} – {formatDay(view.session.endDate, locale)}
                      </div>

                      {view.session.venueName && (
                        <div className="text-sm text-muted-foreground">Venue: {view.session.venueName}</div>
                      )}

                      {canJoin(view) && <MemberSessionJoin sessionId={view.registration.sessionId} />}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Upcoming</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {upcoming.map((view) => (
                  <Card key={view.registration.id} data-testid="upcoming-course">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{nameOf(view)}</CardTitle>
                          <CardDescription>{view.session.name ?? view.session.code}</CardDescription>
                        </div>
                        <Badge className={statusColors[view.registration.status ?? ''] || 'bg-gray-500'}>
                          {humanizeCode(view.registration.status ?? 'unknown')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="font-medium">{formatDay(view.session.startDate, locale, 'long')}</span>
                      </div>

                      {view.session.venueName && (
                        <div className="text-sm text-muted-foreground">Venue: {view.session.venueName}</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Other Enrollments</h3>
              {others.map((view) => (
                <Card key={view.registration.id} data-testid="other-course">
                  <CardContent className="space-y-2 pt-4">
                    <p className="font-medium">{nameOf(view)}</p>
                    <p className="text-sm text-muted-foreground">
                      Status: {humanizeCode(view.registration.status ?? 'unknown')}.{' '}
                      {view.session === null
                        ? 'Session schedule is not available in this view.'
                        : `Session: ${formatDay(view.session.startDate, locale)} – ${formatDay(view.session.endDate, locale)}.`}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {registrations.state === 'ready' && views.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No registrations yet</p>
                <p className="text-sm text-muted-foreground mb-4">Browse available courses to get started</p>
                <Button onClick={() => setActiveTab('available')}>Browse Courses</Button>
              </CardContent>
            </Card>
          )}

          {registrations.state === 'ready' && views.length > 0 && inProgress.length + upcoming.length + others.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="no-open-courses">You have no course in progress or coming up.</p>
          )}
        </TabsContent>

        {/* Certificates Tab */}
        <TabsContent value="certificates" className="space-y-4">
          {certifications.state === 'loading' && <p role="status" className="text-sm text-muted-foreground">Loading your certifications…</p>}
          {certifications.state === 'error' && (
            <Failure title="Your certifications could not be loaded." reason={certifications.reason} onRetry={retryCertifications} />
          )}

          {expiring.length > 0 && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CardHeader>
                <CardTitle className="text-lg flex items-center text-yellow-900 dark:text-yellow-100">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Certificates Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {expiring.map(({ cert }) => (
                    <div key={cert.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
                      <div>
                        <div className="font-medium text-sm">{cert.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {cert.expiryDate !== null && `Expires in ${daysBetween(today, cert.expiryDate)} days (${formatDay(cert.expiryDate, locale)})`}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Contact your union for renewal options.</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pending.length > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="pending-certifications">
              {pending.length === 1 ? '1 certification is' : `${pending.length} certifications are`} waiting for verification by your union and not counted above.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {valid.map(({ cert }) => {
              const certificateUrl = safeHttpsUrl(cert.certificateUrl);
              return (
                <Card key={cert.id} className="border-green-200 dark:border-green-900" data-testid="valid-certificate">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Award className="h-5 w-5 text-green-600" />
                          {cert.name}
                        </CardTitle>
                        {cert.number !== null && <CardDescription>{cert.number}</CardDescription>}
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Issued</span>
                        <span className="font-medium">{formatDay(cert.issueDate, locale)}</span>
                      </div>
                      {cert.expiryDate !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Expires</span>
                          <span className="font-medium">{formatDay(cert.expiryDate, locale)}</span>
                        </div>
                      )}
                    </div>

                    {cert.type !== null && <Badge className="bg-gray-600">{humanizeCode(cert.type)}</Badge>}

                    {certificateUrl !== null && (
                      <a href={certificateUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex items-center text-sm underline">
                        <Download className="h-4 w-4 mr-2" /> Open certificate
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {certifications.state === 'ready' && valid.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Award className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No valid certificates</p>
                <p className="text-sm text-muted-foreground">Certifications appear here once your union has verified them.</p>
              </CardContent>
            </Card>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard/education/certificates`}>See every certification, including expired ones</Link>
          </Button>
        </TabsContent>

        {/* Available Courses Tab */}
        <TabsContent value="available">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Browse Course Catalog</p>
              <p className="text-sm text-muted-foreground mb-4">View the courses your union offers and enroll in a session</p>
              <Button asChild><Link href={`/${locale}/dashboard/education/courses`}>Go to Course Catalog</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MemberLearningPortal;
