import { SiteNavigation } from "@/components/public/site-navigation";
import { SiteFooter } from "@/components/public/site-footer";
import { SupportWidgetShell } from "@/components/public/support-widget-shell";

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
      <SupportWidgetShell />
    </>
  );
}
