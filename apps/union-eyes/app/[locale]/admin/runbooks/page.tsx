/**
 * Admin Runbooks Index
 */


export const dynamic = 'force-dynamic';

import fs from "fs";
import path from "path";
import Link from "next/link";

interface RunbooksPageProps {
  params: { locale: string };
}

interface RunbookEntry {
  slug: string;
  title: string;
  fileName: string;
}

function getRunbooks(): RunbookEntry[] {
  const runbookDir = path.join(process.cwd(), "docs", "runbooks");
  if (!fs.existsSync(runbookDir)) {
    return [];
  }

  const files = fs.readdirSync(runbookDir);
  return files
    .filter((file) => file.startsWith("RUNBOOK_") && file.endsWith(".md"))
    .map((file) => {
      const filePath = path.join(runbookDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const titleLine = content.split("\n").find((line) => line.startsWith("# "));
      const title = titleLine ? titleLine.replace("# ", "").trim() : file.replace(".md", "");
      return {
        slug: file.replace(".md", ""),
        title,
        fileName: file,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export default function RunbooksPage({ params }: RunbooksPageProps) {
  const runbooks = getRunbooks();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Runbook Library</h1>
        <p className="text-muted-foreground mt-1">
          Operational and compliance runbooks for incidents and audits
        </p>
      </div>

      {runbooks.length === 0 ? (
        <div className="text-sm text-muted-foreground">No runbooks found.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {runbooks.map((runbook) => (
            <Link
              key={runbook.slug}
              href={`/${params.locale}/admin/runbooks/${runbook.slug}`}
              className="rounded-lg border bg-white p-4 hover:shadow-sm"
            >
              <div className="text-sm text-muted-foreground">{runbook.fileName}</div>
              <div className="text-lg font-semibold mt-1">{runbook.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
