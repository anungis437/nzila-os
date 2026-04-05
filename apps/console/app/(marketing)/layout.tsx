import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { SiteNavigation } from "@/components/public/site-navigation";
import { SiteFooter } from "@/components/public/site-footer";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth()
  if (userId) redirect('/console')

  return (
    <>
      <SiteNavigation />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
