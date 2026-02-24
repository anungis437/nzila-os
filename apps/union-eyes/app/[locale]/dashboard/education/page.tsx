/**
 * Education & Training Dashboard - Main Landing Page
 * Provides portal to all education features: courses, my learning, certificates
 */

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Award, Calendar } from "lucide-react";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

export default async function EducationDashboard() {
  const _user = await currentUser();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-primary" />
          Education & Training
        </h1>
        <p className="text-muted-foreground">
          Access courses, track your learning progress, and earn certifications
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/education/courses">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg">Course Catalog</CardTitle>
              <CardDescription className="mt-2">
                Browse and enroll in available training courses
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/education/my-courses">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <GraduationCap className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg">My Courses</CardTitle>
              <CardDescription className="mt-2">
                View your enrolled courses and learning progress
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/education/certificates">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Award className="h-5 w-5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg">My Certificates</CardTitle>
              <CardDescription className="mt-2">
                View and download your earned certifications
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/education/courses">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
              <CardDescription className="mt-2">
                View scheduled course sessions and events
              </CardDescription>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Featured Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Education & Training</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Our education program offers comprehensive training for union members, stewards, and officers. 
              From foundational steward training to advanced leadership development, we provide the skills 
              you need to be an effective union representative.
            </p>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Key Features:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>CLC-approved certification courses</li>
                <li>In-person and online training options</li>
                <li>Track your progress and certifications</li>
                <li>Earn continuing education credits</li>
                <li>Access to archived course materials</li>
              </ul>
            </div>
            <Button asChild className="w-full">
              <Link href="/dashboard/education/courses">
                Browse Course Catalog
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Learning Path</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Not sure where to start? We&apos;ve organized our courses into clear learning paths 
              based on your role and experience level.
            </p>
            <div className="space-y-3">
              <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                <h4 className="font-semibold text-sm mb-1">New Steward Training</h4>
                <p className="text-xs text-muted-foreground">
                  Essential courses for newly elected stewards covering union basics, grievance handling, and member support.
                </p>
              </div>
              <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                <h4 className="font-semibold text-sm mb-1">Advanced Leadership</h4>
                <p className="text-xs text-muted-foreground">
                  Strategic planning, contract negotiation, and mobilization for experienced union leaders.
                </p>
              </div>
              <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                <h4 className="font-semibold text-sm mb-1">Specialized Training</h4>
                <p className="text-xs text-muted-foreground">
                  Health & safety, equity & diversity, communications, and other specialized topics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
