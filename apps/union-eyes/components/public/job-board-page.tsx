'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  Building,
  Heart,
  ExternalLink,
} from 'lucide-react';

interface JobPosting {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: 'organizing' | 'office' | 'field' | 'leadership' | 'research' | 'communications' | 'legal' | 'other';
  location: string;
  jobType: 'full-time' | 'part-time' | 'contract' | 'temporary';
  experienceLevel: 'entry' | 'mid' | 'senior' | 'executive';
  salaryMin: number | null;
  salaryMax: number | null;
  postedDate: string;
  closingDate: string | null;
  status: 'open' | 'closed' | 'filled';
  organization: string;
  contactEmail: string;
  applicationUrl: string | null;
  requireResume: boolean;
  requireCoverLetter: boolean;
  customQuestions: Array<{
    question: string;
    required: boolean;
  }>;
}

interface JobBoardPageProps {
  organizationSlug?: string;
}

export function PublicJobBoardPage({ organizationSlug }: JobBoardPageProps) {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('all');
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchJobs();
    loadSavedJobs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationSlug]);

  const fetchJobs = async () => {
    try {
      const url = organizationSlug
        ? `/api/jobs?organization=${organizationSlug}`
        : '/api/jobs';
      const response = await fetch(url);
      const data = await response.json();
      setJobs(data);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const loadSavedJobs = () => {
    const saved = localStorage.getItem('savedJobs');
    if (saved) {
      setSavedJobs(new Set(JSON.parse(saved)));
    }
  };

  const toggleSaveJob = (jobId: string) => {
    const newSavedJobs = new Set(savedJobs);
    if (newSavedJobs.has(jobId)) {
      newSavedJobs.delete(jobId);
    } else {
      newSavedJobs.add(jobId);
    }
    setSavedJobs(newSavedJobs);
    localStorage.setItem('savedJobs', JSON.stringify(Array.from(newSavedJobs)));
  };

  const filteredJobs = jobs.filter(job => {
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !job.title.toLowerCase().includes(query) &&
        !job.description.toLowerCase().includes(query) &&
        !job.organization.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Category filter
    if (categoryFilter !== 'all' && job.category !== categoryFilter) {
      return false;
    }

    // Location filter
    if (locationFilter !== 'all' && job.location !== locationFilter) {
      return false;
    }

    // Job type filter
    if (jobTypeFilter !== 'all' && job.jobType !== jobTypeFilter) {
      return false;
    }

    return true;
  });

  const uniqueLocations = Array.from(new Set(jobs.map(job => job.location))).sort();

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      organizing: 'Organizing',
      office: 'Office & Admin',
      field: 'Field Representative',
      leadership: 'Leadership',
      research: 'Research & Policy',
      communications: 'Communications',
      legal: 'Legal',
      other: 'Other',
    };
    return labels[category] || category;
  };

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'full-time': 'Full-Time',
      'part-time': 'Part-Time',
      'contract': 'Contract',
      'temporary': 'Temporary',
    };
    return labels[type] || type;
  };

  const getExperienceLabel = (level: string) => {
    const labels: Record<string, string> = {
      entry: 'Entry Level',
      mid: 'Mid-Level',
      senior: 'Senior',
      executive: 'Executive',
    };
    return labels[level] || level;
  };

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Salary not listed';
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `From $${min.toLocaleString()}`;
    if (max) return `Up to $${max.toLocaleString()}`;
    return 'Salary not listed';
  };

  const getDaysAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-16 w-full mb-8" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-2">Job Board</h1>
          <p className="text-lg text-muted-foreground">
            {organizationSlug
              ? 'Find opportunities with our organization'
              : 'Explore career opportunities in the labor movement'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="md:col-span-1">
            <Card className="p-6 sticky top-4">
              <h2 className="font-semibold text-lg mb-4">Filters</h2>

              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Job title, keyword..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="organizing">Organizing</SelectItem>
                      <SelectItem value="office">Office & Admin</SelectItem>
                      <SelectItem value="field">Field Representative</SelectItem>
                      <SelectItem value="leadership">Leadership</SelectItem>
                      <SelectItem value="research">Research & Policy</SelectItem>
                      <SelectItem value="communications">Communications</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {uniqueLocations.map(location => (
                        <SelectItem key={location} value={location}>{location}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Job Type</label>
                  <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="full-time">Full-Time</SelectItem>
                      <SelectItem value="part-time">Part-Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(searchQuery || categoryFilter !== 'all' || locationFilter !== 'all' || jobTypeFilter !== 'all') && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('all');
                      setLocationFilter('all');
                      setJobTypeFilter('all');
                    }}
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Job Listings */}
          <div className="md:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-muted-foreground">
                {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {filteredJobs.length === 0 ? (
              <Card className="p-12 text-center">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Jobs Found</h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your filters or search query
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                    setLocationFilter('all');
                    setJobTypeFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <Card key={job.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>{getCategoryLabel(job.category)}</Badge>
                          <Badge variant="outline">{getJobTypeLabel(job.jobType)}</Badge>
                          {job.closingDate && new Date(job.closingDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                            <Badge variant="destructive">Closing Soon</Badge>
                          )}
                        </div>
                        <h3 className="text-xl font-semibold mb-1">
                          <a
                            href={`/jobs/${job.slug}`}
                            className="hover:text-primary transition-colors"
                          >
                            {job.title}
                          </a>
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {job.organization}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSaveJob(job.id)}
                        className={savedJobs.has(job.id) ? 'text-primary' : ''}
                      >
                        <Heart
                          className={`h-5 w-5 ${savedJobs.has(job.id) ? 'fill-current' : ''}`}
                        />
                      </Button>
                    </div>

                    <p className="text-muted-foreground mb-4 line-clamp-2">
                      {job.description}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {formatSalary(job.salaryMin, job.salaryMax)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        {getExperienceLabel(job.experienceLevel)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Posted {getDaysAgo(job.postedDate)}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button asChild className="flex-1">
                        <a href={`/jobs/${job.slug}`}>
                          View Details
                        </a>
                      </Button>
                      {job.applicationUrl && (
                        <Button asChild variant="outline">
                          <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            External Application
                          </a>
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

