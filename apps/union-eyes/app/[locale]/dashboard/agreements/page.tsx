/**
 * /dashboard/agreements — Collective agreements page
 * Server component with auth guard, delegates to client component
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/api-auth-guard";
import AgreementsPage from "./agreements-page";

export const dynamic = "force-dynamic";

export default async function AgreementsServerPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");

  return <AgreementsPage />;
}
