'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  MapPin,
  DollarSign,
  Building,
  Clock,
  Upload,
  Check,
} from 'lucide-react';

interface JobPosting {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements: string;
  responsibilities: string;
  benefits: string | null;
  category: string;
  location: string;
  jobType: string;
  experienceLevel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedDate: string;
  closingDate: string | null;
  organization: string;
  contactEmail: string;
  requireResume: boolean;
  requireCoverLetter: boolean;
  customQuestions: Array<{
    question: string;
    required: boolean;
  }>;
}

interface JobApplicationPageProps {
  jobSlug: string;
}

export function PublicJobApplicationPage({ jobSlug }: JobApplicationPageProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'details' | 'form' | 'confirmation'>('details');
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  useState(() => {
    fetchJob();
  });

  const fetchJob = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobSlug}`);
      if (!response.ok) throw new Error('Job not found');
      const data = await response.json();
      setJob(data);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        alert('Please upload a PDF or Word document');
        return;
      }

      if (file.size > maxSize) {
        alert('File size must be less than 5MB');
        return;
      }

      setResumeFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setSubmitting(true);

    try {
      // Upload resume to storage
      let resumeUrl = '';
      if (resumeFile) {
        const formData = new FormData();
        formData.append('file', resumeFile);
        formData.append('folder', 'resumes');

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        resumeUrl = uploadData.url;
      }

      // Submit application
      const response = await fetch('/api/jobs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          applicantName,
          applicantEmail,
          applicantPhone,
          resumeUrl,
          coverLetter: coverLetter || null,
          customAnswers: job.customQuestions.length > 0 ? customAnswers : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit application');
      }

      setStep('confirmation');
    } catch (_error) {
alert('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !job) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading job details...</p>
      </div>
    );
  }

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

  if (step === 'confirmation') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8">
          <div className="text-center mb-8">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Application Submitted!</h1>
            <p className="text-muted-foreground">
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              We've received your application for {job.title}
            </p>
          </div>

          <div className="border rounded-lg p-6 mb-6">
            <h2 className="font-semibold text-lg mb-4">What&apos;s Next?</h2>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="text-primary">1.</span>
                <span>You&apos;ll receive a confirmation email at {applicantEmail}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">2.</span>
                <span>Our team will review your application</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">3.</span>
                <span>We&apos;ll contact you within 2 weeks if you&apos;re selected for an interview</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => router.push('/jobs')} variant="outline" className="flex-1">
              Browse More Jobs
            </Button>
            <Button onClick={() => router.push('/')} className="flex-1">
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {step === 'details' && (
          <>
            {/* Job Header */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Badge>{getCategoryLabel(job.category)}</Badge>
                <Badge variant="outline">{getJobTypeLabel(job.jobType)}</Badge>
              </div>
              <h1 className="text-4xl font-bold mb-3">{job.title}</h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Building className="h-4 w-4" />
                  {job.organization}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Posted {new Date(job.postedDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div className="md:col-span-2 space-y-8">
                <div>
                  <h2 className="text-2xl font-semibold mb-4">Job Description</h2>
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{job.description}</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-semibold mb-4">Responsibilities</h2>
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{job.responsibilities}</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-semibold mb-4">Requirements</h2>
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{job.requirements}</p>
                  </div>
                </div>

                {job.benefits && (
                  <div>
                    <h2 className="text-2xl font-semibold mb-4">Benefits</h2>
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-wrap">{job.benefits}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div>
                <Card className="p-6 sticky top-4">
                  <h2 className="font-semibold text-lg mb-4">Job Overview</h2>
                  <div className="space-y-4 text-sm">
                    <div>
                      <div className="text-muted-foreground mb-1">Salary Range</div>
                      <div className="font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {formatSalary(job.salaryMin, job.salaryMax)}
                      </div>
                    </div>

                    <div>
                      <div className="text-muted-foreground mb-1">Experience Level</div>
                      <div className="font-medium flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        {getExperienceLabel(job.experienceLevel)}
                      </div>
                    </div>

                    <div>
                      <div className="text-muted-foreground mb-1">Job Type</div>
                      <div className="font-medium">{getJobTypeLabel(job.jobType)}</div>
                    </div>

                    {job.closingDate && (
                      <div>
                        <div className="text-muted-foreground mb-1">Application Deadline</div>
                        <div className="font-medium">
                          {new Date(job.closingDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t">
                    <Button size="lg" className="w-full mb-3" onClick={() => setStep('form')}>
                      Apply Now
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Application typically takes 5-10 minutes
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {step === 'form' && (
          <Card className="p-8 max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Apply for {job.title}</h1>
              <p className="text-muted-foreground">{job.organization}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={applicantEmail}
                        onChange={(e) => setApplicantEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={applicantPhone}
                        onChange={(e) => setApplicantPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Resume */}
              {job.requireResume && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Resume *</h2>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <input
                      type="file"
                      id="resume"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                      required={job.requireResume}
                    />
                    <label
                      htmlFor="resume"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="h-12 w-12 text-muted-foreground mb-3" />
                      {resumeFile ? (
                        <div>
                          <p className="font-medium text-primary">{resumeFile.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium mb-1">Upload Resume</p>
                          <p className="text-sm text-muted-foreground">
                            PDF or Word document (Max 5MB)
                          </p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Cover Letter */}
              {job.requireCoverLetter && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    Cover Letter {job.requireCoverLetter && '*'}
                  </h2>
                  <Textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Tell us why you&apos;re interested in this position..."
                    rows={8}
                    required={job.requireCoverLetter}
                  />
                </div>
              )}

              {/* Custom Questions */}
              {job.customQuestions && job.customQuestions.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Additional Questions</h2>
                  <div className="space-y-4">
                    {job.customQuestions.map((q, index) => (
                      <div key={index}>
                        <Label htmlFor={`question-${index}`}>
                          {q.question} {q.required && '*'}
                        </Label>
                        <Textarea
                          id={`question-${index}`}
                          value={customAnswers[index] || ''}
                          onChange={(e) =>
                            setCustomAnswers({ ...customAnswers, [index]: e.target.value })
                          }
                          rows={4}
                          required={q.required}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('details')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

