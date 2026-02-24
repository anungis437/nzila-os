/**
 * Contact Form Component
 * 
 * Client-side form for contact submissions
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  role: string;
  inquiryType: string;
  message: string;
}

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    organization: '',
    role: '',
    inquiryType: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // In production, this would send to an API endpoint
      // For now, we&apos;ll simulate a successful submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate API call
      logger.info('Contact form submitted:', formData as unknown as Record<string, unknown>);
      
      setSubmitStatus('success');
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        organization: '',
        role: '',
        inquiryType: '',
        message: '',
      });
    } catch (error) {
      logger.error('Contact form error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (submitStatus === 'success') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Message sent!
            </h3>
            <p className="text-green-700 mb-4">
              Thank you for reaching out. We&apos;ll get back to you within 24 hours.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setSubmitStatus('idle')}
              className="border-green-600 text-green-700 hover:bg-green-100"
            >
              Send another message
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitStatus === 'error' && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Something went wrong. Please try again or email us directly.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            placeholder="Jane"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            placeholder="Doe"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="jane@unionlocal175.org"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="organization">Organization</Label>
        <Input
          id="organization"
          placeholder="UFCW Local 175"
          value={formData.organization}
          onChange={(e) => handleChange('organization', e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Your role</Label>
          <Select 
            value={formData.role} 
            onValueChange={(value) => handleChange('role', value)}
          >
            <SelectTrigger id="role">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="steward">Union Steward</SelectItem>
              <SelectItem value="business-rep">Business Representative</SelectItem>
              <SelectItem value="organizer">Organizer</SelectItem>
              <SelectItem value="executive">Union Executive</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inquiryType">Inquiry type</Label>
          <Select 
            value={formData.inquiryType} 
            onValueChange={(value) => handleChange('inquiryType', value)}
          >
            <SelectTrigger id="inquiryType">
              <SelectValue placeholder="What can we help with?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General question</SelectItem>
              <SelectItem value="demo">Request a demo</SelectItem>
              <SelectItem value="pilot">Pilot program inquiry</SelectItem>
              <SelectItem value="pricing">Pricing information</SelectItem>
              <SelectItem value="support">Technical support</SelectItem>
              <SelectItem value="partnership">Partnership opportunity</SelectItem>
              <SelectItem value="other">Something else</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          placeholder="Tell us about your organization and what you&apos;re looking for..."
          rows={5}
          value={formData.message}
          onChange={(e) => handleChange('message', e.target.value)}
          required
        />
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>Sending...</>
        ) : (
          <>
            <Mail className="h-4 w-4 mr-2" />
            Send message
          </>
        )}
      </Button>

      <p className="text-xs text-slate-500 text-center">
        By submitting this form, you agree to our{' '}
        <Link href="/privacy" className="underline hover:text-slate-700">Privacy Policy</Link>.
        We&apos;ll never share your information with third parties.
      </p>
    </form>
  );
}
