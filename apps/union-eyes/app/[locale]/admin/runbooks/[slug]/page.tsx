/**
 * Admin Runbook Viewer
 */


export const dynamic = 'force-dynamic';

import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";

interface RunbookPageProps {
  params: { locale: string; slug: string };
}

function loadRunbook(slug: string) {
  if (!slug.startsWith("RUNBOOK_") || slug.includes("/") || slug.includes("..")) {
    return null;
  }

  const runbookDir = path.join(process.cwd(), "docs", "runbooks");
  const fileName = `${slug}.md`;
  const filePath = path.join(runbookDir, fileName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8");
  return { content, fileName };
}

export default function RunbookPage({ params }: RunbookPageProps) {
  const runbook = loadRunbook(params.slug);
  if (!runbook) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${params.locale}/admin/runbooks`}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to Runbooks
        </Link>
        <h1 className="text-3xl font-bold mt-2">{runbook.fileName}</h1>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <pre className="whitespace-pre-wrap text-sm leading-6">{runbook.content}</pre>
      </div>
    </div>
  );
}
