import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tiles = [
  {
    title: "Timesheets",
    description: "Upload CSV files, validate mappings, and inspect row-level issues.",
    href: "/dashboard/employer-execution/timesheets",
  },
  {
    title: "Payroll Runs",
    description: "Create deterministic preview and official payroll runs with traces.",
    href: "/dashboard/employer-execution/payroll-runs",
  },
  {
    title: "Remittance Runs",
    description: "Generate remittance packages from approved payroll runs.",
    href: "/dashboard/employer-execution/remittance-runs",
  },
  {
    title: "Compliance",
    description: "Track blockers and governance issues before official approval.",
    href: "/dashboard/employer-execution/compliance",
  },
  {
    title: "Settings",
    description: "Manage runtime profile, entitlement assumptions, and controls.",
    href: "/dashboard/employer-execution/settings",
  },
];

export function EmployerExecutionDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Employer Execution</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Contractor-grade execution for employer payroll and remittance compliance inside UnionEyes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <Card className="h-full hover:border-slate-400/60">
              <CardHeader>
                <CardTitle className="text-lg">{tile.title}</CardTitle>
                <CardDescription>{tile.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-slate-700">Open workspace</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
