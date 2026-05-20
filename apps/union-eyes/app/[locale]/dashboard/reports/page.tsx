import { redirect } from "next/navigation";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { Cupe4373ReportsPage } from "@/components/demo/cupe4373-reports-page";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ReportsPage({ params }: PageProps) {
  const { locale } = await params;

  try {
    await requireUser();
  } catch {
    redirect(`/${locale}/login`);
  }

  const hasAccess = !isCupe4373DemoRuntime() ? await hasMinRole("steward") : true;
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />
      <Cupe4373ReportsPage />
    </div>
  );
}
