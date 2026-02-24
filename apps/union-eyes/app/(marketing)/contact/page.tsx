/**
 * Contact Page
 * 
 * Purpose: Public contact form for sales inquiries and support
 * Audience: Potential customers, union leaders, organizers
 */


export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { ContactForm } from './contact-form';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us | Union Eyes',
  description: 'Get in touch with the Union Eyes team. We\'re here to answer questions about our platform and how it can help your union.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Get in touch
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            We don&apos;t do high-pressure sales. We&apos;re here to answer questions and have a real conversation about your needs.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              Send us a message
            </h2>
            <ContactForm />
          </div>

          {/* Contact Information */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              Other ways to reach us
            </h2>
            
            <div className="space-y-6">
              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Email</h3>
                  <p className="text-slate-600 mt-1">
                    <a href="mailto:hello@unioneyes.com" className="hover:text-blue-700 transition-colors">
                      hello@unioneyes.com
                    </a>
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    We respond within 24 hours
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Phone</h3>
                  <p className="text-slate-600 mt-1">
                    <a href="tel:+1-855-UNION-EYES" className="hover:text-green-700 transition-colors">
                      1-855-UNION-EYES
                    </a>
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Mon-Fri, 9am-6pm EST
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Location</h3>
                  <p className="text-slate-600 mt-1">
                    Toronto, Ontario, Canada
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    We work with unions across North America
                  </p>
                </div>
              </div>

              {/* Hours */}
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Response Times</h3>
                  <p className="text-slate-600 mt-1">
                    General inquiries: Within 24 hours
                  </p>
                  <p className="text-slate-600">
                    Pilot program questions: Within 48 hours
                  </p>
                </div>
              </div>
            </div>

            {/* What to expect */}
            <div className="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">
                What to expect
              </h3>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>A real conversation, not a sales script</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Honest assessment of whether we&apos;re the right fit</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>No commitment required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Answers to all your questions</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
