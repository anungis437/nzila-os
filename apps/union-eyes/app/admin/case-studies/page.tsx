/**
 * Admin Case Studies Management Page
 * 
 * Full CRUD interface for internal team to manage case studies.
 * 
 * Features:
 * - List all case studies with status filters
 * - Create/edit with markdown editor
 * - Publish/unpublish workflow
 * - Preview before publish
 * - Metrics tracking (views, downloads)
 */


export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { caseStudies } from '@/db/schema/domains/marketing';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Eye, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface AdminCaseStudiesPageProps {
  searchParams: {
    search?: string;
    status?: 'draft' | 'published' | 'archived';
    category?: string;
  };
}

export default async function AdminCaseStudiesPage({ searchParams }: AdminCaseStudiesPageProps) {
  const { search, status, category } = searchParams;

  // Fetch case studies
  const allStudies = await db
    .select()
    .from(caseStudies)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(category ? eq(caseStudies.category, category as any) : undefined)
    .orderBy(desc(caseStudies.updatedAt))
    .limit(100);

  // Filter by status and search in JS (publishStatus not in schema)
  const studies = allStudies.filter(s => {
    if (status === 'published' && !s.publishedAt) return false;
    if (status === 'draft' && s.publishedAt) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.title.toLowerCase().includes(q) && !s.organizationType.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Calculate statistics
  const stats = {
    total: studies.length,
    published: studies.filter((s) => s.publishedAt !== null).length,
    draft: studies.filter((s) => s.publishedAt === null).length,
    archived: 0,
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">Case Studies Management</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage case studies for the marketing site
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/case-studies/new">
            <Plus className="mr-2 h-4 w-4" />
            New Case Study
          </Link>
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Published" value={stats.published} variant="success" />
        <StatCard label="Draft" value={stats.draft} variant="warning" />
        <StatCard label="Archived" value={stats.archived} variant="secondary" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Case Studies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                type="search"
                placeholder="Search by title or organization..."
                defaultValue={search}
                name="search"
              />
            </div>

            <Select defaultValue={status || 'all'} name="status">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue={category || 'all'} name="category">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="grievance-wins">Grievance Wins</SelectItem>
                <SelectItem value="organizing-victory">Organizing Victory</SelectItem>
                <SelectItem value="system-adoption">System Adoption</SelectItem>
                <SelectItem value="member-engagement">Member Engagement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Case Studies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Case Studies ({studies.length})</CardTitle>
          <CardDescription>
            Click on a case study to edit or view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No case studies found. Create your first one!
                  </TableCell>
                </TableRow>
              )}
              {studies.map((study) => (
                <TableRow key={study.id}>
                  <TableCell className="font-medium">
                    <Link 
                      href={`/admin/case-studies/${study.slug}/edit`}
                      className="hover:underline"
                    >
                      {study.title}
                    </Link>
                  </TableCell>
                  <TableCell>{study.organizationType}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {study.category.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        study.publishedAt
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {study.publishedAt ? 'published' : 'draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {study.publishedAt
                      ? format(new Date(study.publishedAt), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(study.updatedAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/case-studies/${study.slug}`} target="_blank">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/case-studies/${study.slug}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Stat card component
 */
function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'warning' | 'secondary';
}) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    secondary: 'bg-gray-50 border-gray-200',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
