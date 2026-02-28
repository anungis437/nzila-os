import { SiteNavigation } from "@/components/public/site-navigation";
import { SiteFooter } from "@/components/public/site-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNavigation />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
