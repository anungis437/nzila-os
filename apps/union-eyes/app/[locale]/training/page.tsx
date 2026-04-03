/**
 * Training & Education Page
 *
 * Fetches real data from education API routes and maps DB fields to
 * component prop shapes.
 *
 * @page app/[locale]/training/page.tsx
 */

"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseCatalogBrowser, type Course } from "@/components/education/course-catalog-browser";
import { CertificationTracker, type Certification } from "@/components/education/certification-tracker";
import { LearningPathDesigner, type AvailableCourse } from "@/components/education/learning-path-designer";
import { TrainingCalendarWidget, type TrainingEvent } from "@/components/education/training-calendar-widget";

function mapFormat(v: string): "online" | "in-person" | "hybrid" {
  if (v === "online") return "online";
  if (v === "in_person" || v === "in-person") return "in-person";
  return "hybrid";
}

function mapLevel(v: string | null): "beginner" | "intermediate" | "advanced" {
  if (v === "intermediate") return "intermediate";
  if (v === "advanced") return "advanced";
  return "beginner";
}

function mapSessionStatus(v: string | null): "upcoming" | "ongoing" | "completed" | "cancelled" {
  if (v === "in_progress") return "ongoing";
  if (v === "completed") return "completed";
  if (v === "cancelled") return "cancelled";
  return "upcoming";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCourse(r: any): Course {
  return {
    id: r.id,
    title: r.courseName,
    description: r.courseDescription ?? "",
    category: r.courseCategory,
    level: mapLevel(r.courseDifficulty),
    duration: parseFloat(r.durationHours ?? "0"),
    format: mapFormat(r.deliveryMethod),
    instructor: r.primaryInstructorName ?? "",
    maxParticipants: r.maxEnrollment ?? undefined,
    enrolledCount: 0,
    prerequisites: [],
    certificationOffered: r.providesCertification ?? false,
    status: (r.isActive ? "upcoming" : "archived") as Course["status"],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvent(r: any): TrainingEvent {
  return {
    id: r.id,
    title: r.sessionName ?? r.sessionCode,
    description: r.notes ?? "",
    startDate: new Date(r.startDate),
    endDate: new Date(r.endDate),
    location: r.venueName ?? (r.virtualMeetingUrl ? "Online" : ""),
    format: mapFormat(r.deliveryMethod),
    instructor: r.leadInstructorName ?? "",
    category: "",
    maxParticipants: r.maxEnrollment ?? undefined,
    enrolledCount: r.registrationCount ?? 0,
    status: mapSessionStatus(r.sessionStatus),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCertification(r: any): Certification {
  const expiry = r.expiryDate ? new Date(r.expiryDate) : undefined;
  let status: Certification["status"] = "active";
  if (expiry) {
    const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86_400_000);
    if (daysLeft < 0) status = "expired";
    else if (daysLeft <= 60) status = "expiring-soon";
  }
  return {
    id: r.id,
    name: r.certificationName,
    issuer: r.issuedByOrganization ?? "",
    issuedDate: new Date(r.issueDate),
    expiryDate: expiry,
    status,
    certificateUrl: r.certificateUrl ?? undefined,
    credentialId: r.certificationNumber ?? undefined,
    category: r.certificationType ?? "General",
    requirements: {
      completed: 1,
      total: 1,
      items: [{ name: r.certificationName, completed: true }],
    },
  };
}

export default function TrainingPage() {
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [certifications, setCertifications] = React.useState<Certification[]>([]);
  const [events, setEvents] = React.useState<TrainingEvent[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [coursesRes, sessionsRes, certsRes, registrationsRes] = await Promise.all([
          fetch("/api/education/courses?limit=100"),
          fetch("/api/education/sessions?limit=100"),
          fetch("/api/education/certifications?limit=100"),
          fetch("/api/education/registrations?limit=100"),
        ]);

        if (coursesRes.ok) {
          const json = await coursesRes.json();
          const mapped = (json.data ?? []).map(mapCourse);
          setCourses(mapped);
          setCategories([...new Set<string>(mapped.map((c: Course) => c.category))]);
        }

        if (sessionsRes.ok) {
          const json = await sessionsRes.json();
          setEvents((json.data ?? []).map(mapEvent));
        }

        if (certsRes.ok) {
          const json = await certsRes.json();
          setCertifications((json.data ?? []).map(mapCertification));
        }

        if (registrationsRes.ok) {
          const json = await registrationsRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setEnrolledCourseIds((json.data ?? []).map((r: any) => r.courseId));
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleEnroll = async (courseId: string) => {
    await fetch("/api/education/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    setEnrolledCourseIds((prev) => [...prev, courseId]);
  };

  const availableCourses: AvailableCourse[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    duration: c.duration,
    level: c.level,
    category: c.category,
  }));

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-100 rounded w-96" />
          <div className="h-10 bg-gray-200 rounded w-full mt-6" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Training & Education</h1>
        <p className="text-gray-600 mt-2">
          Access courses, track certifications, and manage your learning path
        </p>
      </div>

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses">Course Catalog</TabsTrigger>
          <TabsTrigger value="certifications">My Certifications</TabsTrigger>
          <TabsTrigger value="paths">Learning Paths</TabsTrigger>
          <TabsTrigger value="calendar">Training Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <CourseCatalogBrowser
            courses={courses}
            categories={categories}
            enrolledCourseIds={enrolledCourseIds}
            onEnroll={handleEnroll}
          />
        </TabsContent>

        <TabsContent value="certifications">
          <CertificationTracker certifications={certifications} />
        </TabsContent>

        <TabsContent value="paths">
          <LearningPathDesigner
            availableCourses={availableCourses}
            existingPaths={[]}
            categories={categories}
          />
        </TabsContent>

        <TabsContent value="calendar">
          <TrainingCalendarWidget
            events={events}
            categories={categories}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
