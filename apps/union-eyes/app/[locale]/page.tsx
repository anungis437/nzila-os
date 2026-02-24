/**
 * Locale-prefixed root page
 * Redirects authenticated users to dashboard, unauthenticated to marketing page
 */

export const dynamic = 'force-dynamic';

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LocaleRootPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { userId } = await auth();
  
  // If authenticated, go to dashboard
  if (userId) {
    redirect(`/${locale}/dashboard`);
  }
  
  // If not authenticated, show login page
  redirect(`/${locale}/login`);
}

