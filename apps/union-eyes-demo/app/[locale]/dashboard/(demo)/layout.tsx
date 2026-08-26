/**
 * Demo route-group layout — Union Eyes Demo artifact.
 *
 * Wave 0 §3 (semantic demo isolation): the prior implementation
 * called `isCupe4373DemoRuntime()` to defend against demo pages
 * rendering under a production/pilot runtime. That defence is now
 * obsolete for these files: they live inside the
 * `@nzila/union-eyes-demo` artifact (`apps/union-eyes-demo/`), which
 * is a separate application and is not part of the operational
 * `@nzila/union-eyes` build. There is no runtime under which these
 * pages can render inside the operational app.
 *
 * This layout is a passthrough. It exists to preserve the
 * `(demo)` route-group boundary and to hold future demo-only
 * layout chrome.
 */
export default async function DashboardDemoGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
