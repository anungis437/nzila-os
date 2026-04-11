/**
 * /dashboard/knowledge-base — Union Documents Library
 * Server component with auth guard, delegates to client component
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/api-auth-guard";
import KnowledgeBaseBrowser from "@/components/knowledge/knowledge-base-browser";

export const dynamic = "force-dynamic";

export default async function KnowledgeBaseServerPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");

  return <KnowledgeBaseBrowser />;
}
