/**
 * Training & Education Page
 * 
 * Comprehensive training management interface integrating:
 * - Course catalog browser with filtering
 * - Training enrollment form
 * - Certification tracker
 * - Learning path designer
 * - Training calendar
 * 
 * @page app/[locale]/training/page.tsx
 */


export const dynamic = 'force-dynamic';

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseCatalogBrowser } from "@/components/education/course-catalog-browser";
import { CertificationTracker } from "@/components/education/certification-tracker";
import { LearningPathDesigner } from "@/components/education/learning-path-designer";
import { TrainingCalendarWidget } from "@/components/education/training-calendar-widget";

export default function TrainingPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
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
            courses={[]}
            categories={[]}
            onEnroll={async (_courseId) => {
}}
          />
        </TabsContent>

        <TabsContent value="certifications">
          <CertificationTracker certifications={[]} />
        </TabsContent>

        <TabsContent value="paths">
          <LearningPathDesigner
            availableCourses={[]}
            existingPaths={[]}
            categories={[]}
          />
        </TabsContent>

        <TabsContent value="calendar">
          <TrainingCalendarWidget
            events={[]}
            categories={[]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
