/**
 * Admin Case Study Editor Page
 * 
 * Create or edit case studies with markdown editor and preview.
 */


export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { caseStudies } from '@/db/schema/domains/marketing';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import CaseStudyEditorForm from '@/components/admin/case-study-editor-form';

interface CaseStudyEditorPageProps {
  params: {
    slug: string;
  };
}

export default async function CaseStudyEditorPage({ params }: CaseStudyEditorPageProps) {
  const { slug } = params;
  const isNew = slug === 'new';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let caseStudy: any = null;

  if (!isNew) {
    [caseStudy] = await db
      .select()
      .from(caseStudies)
      .where(eq(caseStudies.slug, slug))
      .limit(1);

    if (!caseStudy) {
      return (
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Case Study Not Found</CardTitle>
              <CardDescription>
                The case study you&apos;re looking for doesn&apos;t exist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/admin/case-studies">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Case Studies
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">
            {isNew ? 'Create Case Study' : 'Edit Case Study'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isNew
              ? 'Write a compelling case study for the marketing site'
              : `Editing: ${caseStudy?.title}`}
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href="/admin/case-studies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      {/* Editor Form */}
      <CaseStudyEditorForm caseStudy={caseStudy} />
    </div>
  );
}
