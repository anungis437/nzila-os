/**
 * Education & Training Dashboard - Main Landing Page
 * Provides portal to all education features: courses, my learning, certificates
 */

export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Award, Calendar } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/api-auth-guard";
import { getTranslations } from "next-intl/server";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "educationDashboardPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function EducationDashboard({
  params,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "educationDashboardPage" });
  await requireUser();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href={`/${locale}/dashboard/education/courses`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg">{t("cards.catalog.title")}</CardTitle>
              <CardDescription className="mt-2">
                {t("cards.catalog.description")}
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href={`/${locale}/dashboard/education/my-courses`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <GraduationCap className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg">{t("cards.myCourses.title")}</CardTitle>
              <CardDescription className="mt-2">
                {t("cards.myCourses.description")}
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href={`/${locale}/dashboard/education/certificates`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Award className="h-5 w-5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg">{t("cards.certificates.title")}</CardTitle>
              <CardDescription className="mt-2">
                {t("cards.certificates.description")}
              </CardDescription>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href={`/${locale}/dashboard/education/courses`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg">{t("cards.sessions.title")}</CardTitle>
              <CardDescription className="mt-2">
                {t("cards.sessions.description")}
              </CardDescription>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Featured Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("welcome.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("welcome.description")}
            </p>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">{t("welcome.featuresTitle")}</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>{t("welcome.features.clc")}</li>
                <li>{t("welcome.features.delivery")}</li>
                <li>{t("welcome.features.progress")}</li>
                <li>{t("welcome.features.credits")}</li>
                <li>{t("welcome.features.archives")}</li>
              </ul>
            </div>
            <Button asChild className="w-full">
              <Link href="/dashboard/education/courses">
                {t("welcome.button")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("path.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("path.description")}
            </p>
            <div className="space-y-3">
              <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                <h4 className="font-semibold text-sm mb-1">{t("path.newSteward.title")}</h4>
                <p className="text-xs text-muted-foreground">
                  {t("path.newSteward.description")}
                </p>
              </div>
              <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                <h4 className="font-semibold text-sm mb-1">{t("path.advanced.title")}</h4>
                <p className="text-xs text-muted-foreground">
                  {t("path.advanced.description")}
                </p>
              </div>
              <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                <h4 className="font-semibold text-sm mb-1">{t("path.specialized.title")}</h4>
                <p className="text-xs text-muted-foreground">
                  {t("path.specialized.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
