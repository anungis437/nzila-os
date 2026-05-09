/**
 * Non-locale Marketing Layout
 *
 * Pages under app/(marketing) are redirect aliases to /en-CA/... routes.
 * Keep this layout minimal to avoid rendering locale-dependent UI before
 * redirects execute.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
