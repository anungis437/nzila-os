/**
 * Pilot Program Application Page
 * 
 * Public-facing form for unions to request Union Eyes pilot program.
 * Collects readiness information and provides instant assessment.
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { PilotApplicationInput } from '@/types/marketing';
import { calculateReadinessScore, ReadinessAssessmentResult } from '@/lib/pilot/readiness-assessment';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { logger } from '@/lib/logger';

export default function PilotRequestPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<PilotApplicationInput>>({
    organizationType: 'local',
    jurisdictions: [],
    sectors: [],
    challenges: [],
    goals: [],
    responses: {}
  });
  const [assessment, setAssessment] = useState<ReadinessAssessmentResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (field: keyof PilotApplicationInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleResponseChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      responses: { ...prev.responses, [key]: value }
    }));
  };

  const handleMultiSelect = (field: 'jurisdictions' | 'sectors' | 'challenges' | 'goals', value: string) => {
    setFormData(prev => {
      const current = prev[field] || [];
      const updated = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleAssessReadiness = () => {
    if (isFormValid()) {
      const result = calculateReadinessScore(formData as PilotApplicationInput);
      setAssessment(result);
      setStep(5);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/pilot/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, assessment }),
      });

      if (response.ok) {
        setStep(6);
      } else {
        alert('Submission failed. Please try again.');
      }
    } catch (error) {
      logger.error('Submission error:', error);
      alert('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.organizationName &&
      formData.contactName &&
      formData.contactEmail &&
      formData.memberCount &&
      formData.jurisdictions?.length &&
      formData.sectors?.length &&
      formData.goals?.length
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Union Eyes Pilot Program
          </h1>
          <p className="text-xl text-gray-600">
            Join us in building the future of member advocacy tools
          </p>
        </div>

        <HumanCenteredCallout 
          variant="trust"
          message="This is a no-pressure exploration. You&apos;ll get an instant readiness assessment before any commitment."
          className="mb-8"
        />

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 mx-1 rounded ${
                  s <= step ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>Organization</span>
            <span>Context</span>
            <span>Goals</span>
            <span>Readiness</span>
            <span>Assessment</span>
          </div>
        </div>

        {/* Form Steps */}
        <div className="bg-white shadow rounded-lg p-8">
          {/* Step 1: Organization Details */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Tell us about your organization
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.organizationName || ''}
                  onChange={(e) => handleInputChange('organizationName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Healthcare Workers Union Local 123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Type *
                </label>
                <div className="space-y-2">
                  {['local', 'regional', 'national'].map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="radio"
                        name="orgType"
                        value={type}
                        checked={formData.organizationType === type}
                        onChange={(e) => handleInputChange('organizationType', e.target.value)}
                        className="mr-2"
                      />
                      <span className="capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name *
                </label>
                <input
                  type="text"
                  value={formData.contactName || ''}
                  onChange={(e) => handleInputChange('contactName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email *
                </label>
                <input
                  type="email"
                  value={formData.contactEmail || ''}
                  onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone || ''}
                  onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Member Count *
                </label>
                <input
                  type="number"
                  value={formData.memberCount || ''}
                  onChange={(e) => handleInputChange('memberCount', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 1200"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Approximate total membership
                </p>
              </div>

              <button
                onClick={handleNext}
                disabled={!formData.organizationName || !formData.contactName || !formData.contactEmail || !formData.memberCount}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Context & Current State */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Your current context
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jurisdictions *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK'].map((prov) => (
                    <label key={prov} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.jurisdictions?.includes(prov)}
                        onChange={() => handleMultiSelect('jurisdictions', prov)}
                        className="mr-2"
                      />
                      <span>{prov}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sectors *
                </label>
                <div className="space-y-2">
                  {['Healthcare', 'Education', 'Construction', 'Transportation', 'Public Service', 'Manufacturing', 'Other'].map((sector) => (
                    <label key={sector} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.sectors?.includes(sector)}
                        onChange={() => handleMultiSelect('sectors', sector)}
                        className="mr-2"
                      />
                      <span>{sector}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current System (Optional)
                </label>
                <input
                  type="text"
                  value={formData.currentSystem || ''}
                  onChange={(e) => handleInputChange('currentSystem', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Excel spreadsheets, paper files, existing software"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Challenges (Select all that apply)
                </label>
                <div className="space-y-2">
                  {[
                    'Lost or missing documents',
                    'Manual tracking processes',
                    'No audit trail',
                    'Inconsistent case handling',
                    'Long resolution times',
                    'Poor member communication',
                    'Difficult reporting',
                    'Limited transparency'
                  ].map((challenge) => (
                    <label key={challenge} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.challenges?.includes(challenge)}
                        onChange={() => handleMultiSelect('challenges', challenge)}
                        className="mr-2"
                      />
                      <span>{challenge}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md font-medium hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!formData.jurisdictions?.length || !formData.sectors?.length}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Goals & Readiness Questions */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                What are you hoping to achieve?
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Goals * (Select 3-5)
                </label>
                <div className="space-y-2">
                  {[
                    'Reduce case resolution time',
                    'Improve documentation quality',
                    'Better member experience',
                    'Increase transparency',
                    'Easier reporting for leadership',
                    'Stronger audit trail',
                    'More consistent processes',
                    'Empower organizers'
                  ].map((goal) => (
                    <label key={goal} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.goals?.includes(goal)}
                        onChange={() => handleMultiSelect('goals', goal)}
                        className="mr-2"
                        disabled={!formData.goals?.includes(goal) && (formData.goals?.length || 0) >= 5}
                      />
                      <span className={!formData.goals?.includes(goal) && (formData.goals?.length || 0) >= 5 ? 'text-gray-400' : ''}>
                        {goal}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Readiness Questions
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Do you have an executive sponsor for this initiative?
                  </label>
                  <div className="space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="executiveSponsor"
                        value="true"
                        checked={formData.responses?.executiveSponsor === true}
                        onChange={() => handleResponseChange('executiveSponsor', true)}
                        className="mr-2"
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="executiveSponsor"
                        value="false"
                        checked={formData.responses?.executiveSponsor === false}
                        onChange={() => handleResponseChange('executiveSponsor', false)}
                        className="mr-2"
                      />
                      No
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Staff commitment level
                  </label>
                  <select
                    value={formData.responses?.staffCommitment || ''}
                    onChange={(e) => handleResponseChange('staffCommitment', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="high">High - Excited and ready</option>
                    <option value="medium">Medium - Cautiously interested</option>
                    <option value="low">Low - Skeptical or resistant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IT support available?
                  </label>
                  <div className="space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="hasITSupport"
                        value="true"
                        checked={formData.responses?.hasITSupport === true}
                        onChange={() => handleResponseChange('hasITSupport', true)}
                        className="mr-2"
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="hasITSupport"
                        value="false"
                        checked={formData.responses?.hasITSupport === false}
                        onChange={() => handleResponseChange('hasITSupport', false)}
                        className="mr-2"
                      />
                      No
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Staff comfort with technology
                  </label>
                  <select
                    value={formData.responses?.staffTechComfort || ''}
                    onChange={(e) => handleResponseChange('staffTechComfort', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="high">High - Very tech-savvy</option>
                    <option value="medium">Medium - Basic computer skills</option>
                    <option value="low">Low - Prefer paper/phone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget pre-approved?
                  </label>
                  <div className="space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="budgetApproved"
                        value="true"
                        checked={formData.responses?.budgetApproved === true}
                        onChange={() => handleResponseChange('budgetApproved', true)}
                        className="mr-2"
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="budgetApproved"
                        value="false"
                        checked={formData.responses?.budgetApproved === false}
                        onChange={() => handleResponseChange('budgetApproved', false)}
                        className="mr-2"
                      />
                      No
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md font-medium hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={(formData.goals?.length || 0) < 1}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Assess */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Review your information
              </h2>

              <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-700">Organization</h3>
                  <p>{formData.organizationName}</p>
                  <p className="text-sm text-gray-600">{formData.memberCount} members</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Jurisdictions</h3>
                  <p>{formData.jurisdictions?.join(', ')}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Sectors</h3>
                  <p>{formData.sectors?.join(', ')}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Primary Goals</h3>
                  <ul className="list-disc list-inside text-sm">
                    {formData.goals?.map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <HumanCenteredCallout
                variant="transparency"
                message="We&apos;ll now calculate your readiness score based on your responses. This helps us understand how to best support your pilot."
              />

              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md font-medium hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleAssessReadiness}
                  disabled={!isFormValid()}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Calculate Readiness
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Assessment Results */}
          {step === 5 && assessment && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Your Pilot Readiness Assessment
              </h2>

              {/* Readiness Score */}
              <div className={`p-6 rounded-lg border-2 ${
                assessment.level === 'ready' ? 'border-green-500 bg-green-50' :
                assessment.level === 'mostly-ready' ? 'border-blue-500 bg-blue-50' :
                assessment.level === 'needs-preparation' ? 'border-yellow-500 bg-yellow-50' :
                'border-red-500 bg-red-50'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {assessment.score}/100
                    </h3>
                    <p className="text-lg capitalize">
                      {assessment.level.replace('-', ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Estimated Setup Time</p>
                    <p className="text-lg font-bold">{assessment.estimatedSetupTime}</p>
                  </div>
                </div>

                <p className="text-sm">
                  Support Level Recommended: <strong className="capitalize">{assessment.supportLevel}</strong>
                </p>
              </div>

              {/* Strengths */}
              {assessment.strengths.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-green-700 mb-2">
                    ✓ Strengths
                  </h3>
                  <ul className="space-y-2">
                    {assessment.strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        <span className="text-gray-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {assessment.concerns.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-yellow-700 mb-2">
                    ⚠ Areas to Address
                  </h3>
                  <ul className="space-y-2">
                    {assessment.concerns.map((concern, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-yellow-600 mr-2">•</span>
                        <span className="text-gray-700">{concern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  Recommended Next Steps
                </h3>
                <ol className="space-y-2 list-decimal list-inside">
                  {assessment.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-gray-800">{rec}</li>
                  ))}
                </ol>
              </div>

              <HumanCenteredCallout
                variant="human"
                message="This assessment helps us understand where you are. Every union is different, and we work with you at your pace."
              />

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md font-medium hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Confirmation */}
          {step === 6 && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✓</div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Application Submitted
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Thank you for your interest in the Union Eyes pilot program.
              </p>
              <p className="text-gray-700 mb-6">
                We&apos;ll review your application and contact you within 2-3 business days
                to discuss next steps.
              </p>
              <p className="text-sm text-gray-500">
                Questions? Email <a href="mailto:pilot@unioneyes.org" className="text-blue-600 hover:underline">pilot@unioneyes.org</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
