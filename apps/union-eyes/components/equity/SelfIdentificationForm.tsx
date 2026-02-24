'use client';

import React, { useState } from 'react';
import { ConsentForm } from '@/components/consent/ConsentForm';

interface EquityGroup {
  value: string;
  label: string;
}

interface SelfIdentificationFormProps {
  memberId: string;
  organizationId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const equityGroupOptions: EquityGroup[] = [
  { value: 'women', label: 'Women' },
  { value: 'indigenous', label: 'Indigenous Peoples' },
  { value: 'visible_minority', label: 'Visible Minorities/Racialized People' },
  { value: 'persons_with_disabilities', label: 'Persons with Disabilities' },
  { value: 'lgbtq2plus', label: 'LGBTQ2+' },
  { value: 'newcomer', label: 'Newcomers/Immigrants' },
];

const genderOptions = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'two_spirit', label: 'Two-Spirit' },
  { value: 'gender_fluid', label: 'Gender Fluid' },
  { value: 'agender', label: 'Agender' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const indigenousIdentityOptions = [
  { value: 'first_nations_status', label: 'First Nations (Status)' },
  { value: 'first_nations_non_status', label: 'First Nations (Non-Status)' },
  { value: 'metis', label: 'Métis' },
  { value: 'inuit', label: 'Inuit' },
];

export default function SelfIdentificationForm({
  memberId,
  organizationId,
  onSuccess,
  onCancel,
}: SelfIdentificationFormProps) {
  const [step, setStep] = useState<'consent' | 'form'>('consent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [equityGroups, setEquityGroups] = useState<string[]>([]);
  const [genderIdentity, setGenderIdentity] = useState('');
  const [genderIdentityOther, setGenderIdentityOther] = useState('');
  const [isIndigenous, setIsIndigenous] = useState<boolean | null>(null);
  const [indigenousIdentity, setIndigenousIdentity] = useState('');
  const [indigenousNation, setIndigenousNation] = useState('');
  const [indigenousTreatyNumber, setIndigenousTreatyNumber] = useState('');
  const [indigenousDataGovernanceConsent, setIndigenousDataGovernanceConsent] = useState(false);
  const [isVisibleMinority, setIsVisibleMinority] = useState<boolean | null>(null);
  const [hasDisability, setHasDisability] = useState<boolean | null>(null);
  const [disabilityTypes, _setDisabilityTypes] = useState<string[]>([]);
  const [requiresAccommodation, setRequiresAccommodation] = useState(false);
  const [isLgbtq2Plus, setIsLgbtq2Plus] = useState<boolean | null>(null);
  const [isNewcomer, setIsNewcomer] = useState<boolean | null>(null);
  const [immigrationYear, setImmigrationYear] = useState('');

  const consentContent = `
    <h3>Equity Data Collection Consent</h3>
    <p>This voluntary self-identification survey collects demographic information to support equity, diversity, and inclusion initiatives within our union.</p>
    <h4>Purpose</h4>
    <ul>
      <li>Monitor representation of equity-seeking groups</li>
      <li>Identify systemic barriers and disparities</li>
      <li>Develop targeted programs and supports</li>
      <li>Comply with pay equity and human rights legislation</li>
    </ul>
    <h4>Privacy Protection (PIPEDA Compliant)</h4>
    <ul>
      <li>All data is stored securely with encryption</li>
      <li>Individual data is never shared - only aggregated statistics with 10+ member minimum</li>
      <li>You can withdraw consent and delete your data at any time</li>
      <li>Data is retained for 7 years unless you request deletion</li>
    </ul>
    <h4>Indigenous Data Sovereignty (OCAP® Principles)</h4>
    <p>For Indigenous members, we respect your right to <strong>Ownership, Control, Access, and Possession</strong> of your data.</p>
    <h4>Your Rights</h4>
    <ul>
      <li>This survey is completely voluntary</li>
      <li>You may skip any question</li>
      <li>Your responses will not affect your membership or employment</li>
      <li>You may update or delete your information at any time</li>
    </ul>
  `;

  const handleConsent = async (consented: boolean, _signature?: string) => {
    if (!consented) {
      if (onCancel) onCancel();
      return;
    }
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/equity/self-identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          organizationId,
          dataCollectionConsent: true,
          consentType: 'explicit',
          consentPurpose: 'Equity monitoring and program development',
          dataRetentionYears: 7,
          equityGroups,
          genderIdentity: genderIdentity || null,
          genderIdentityOther: genderIdentity === 'other' ? genderIdentityOther : null,
          isIndigenous,
          indigenousIdentity: isIndigenous ? indigenousIdentity : null,
          indigenousNation: isIndigenous ? indigenousNation : null,
          indigenousTreatyNumber: isIndigenous ? indigenousTreatyNumber : null,
          indigenousDataGovernanceConsent,
          isVisibleMinority,
          hasDisability,
          disabilityTypes: hasDisability ? disabilityTypes : [],
          requiresAccommodation,
          isLgbtq2Plus,
          isNewcomer,
          immigrationYear: isNewcomer ? parseInt(immigrationYear) : null,
          allowAggregateReporting: true,
          allowResearchParticipation: false,
          allowExternalReporting: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save data');
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEquityGroupToggle = (value: string) => {
    setEquityGroups((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value]
    );
  };

  if (step === 'consent') {
    return (
      <ConsentForm
        consentType="DATA_COLLECTION"
        version="1.0"
        content={consentContent}
        onConsent={handleConsent}
        requireSignature={true}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white shadow-md rounded-lg p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Voluntary Self-Identification Survey
        </h2>
        <p className="text-gray-600 mb-6">
          All questions are optional. Select only what you&apos;re comfortable sharing.
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Equity Groups */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              I identify as a member of the following equity-seeking groups:
            </label>
            <div className="space-y-2">
              {equityGroupOptions.map((group) => (
                <label key={group.value} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={equityGroups.includes(group.value)}
                    onChange={() => handleEquityGroupToggle(group.value)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{group.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Gender Identity */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              Gender Identity
            </label>
            <select
              value={genderIdentity}
              onChange={(e) => setGenderIdentity(e.target.value)}
              aria-label="Select gender identity"
              className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select...</option>
              {genderOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {genderIdentity === 'other' && (
              <input
                type="text"
                value={genderIdentityOther}
                onChange={(e) => setGenderIdentityOther(e.target.value)}
                placeholder="Please specify"
                className="mt-2 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>

          {/* Indigenous Identity */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              Do you identify as Indigenous?
            </label>
            <div className="flex space-x-4 mb-3">
              <button
                type="button"
                onClick={() => setIsIndigenous(true)}
                className={`px-6 py-2 rounded-md ${
                  isIndigenous === true
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIsIndigenous(false)}
                className={`px-6 py-2 rounded-md ${
                  isIndigenous === false
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                No
              </button>
            </div>
            {isIndigenous === true && (
              <div className="space-y-4 mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm text-blue-800 font-medium">
                  OCAP® Principles: Your Indigenous data is governed by principles of Ownership, Control, Access, and Possession.
                </p>
                <select
                  value={indigenousIdentity}
                  onChange={(e) => setIndigenousIdentity(e.target.value)}
                  aria-label="Select Indigenous identity"
                  className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Indigenous Identity...</option>
                  {indigenousIdentityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={indigenousNation}
                  onChange={(e) => setIndigenousNation(e.target.value)}
                  placeholder="Nation/Community (optional)"
                  className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  value={indigenousTreatyNumber}
                  onChange={(e) => setIndigenousTreatyNumber(e.target.value)}
                  placeholder="Treaty Number (optional)"
                  className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={indigenousDataGovernanceConsent}
                    onChange={(e) => setIndigenousDataGovernanceConsent(e.target.checked)}
                    className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    I consent to my Indigenous identity data being used for aggregate statistics under OCAP® principles
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Visible Minority */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              Do you identify as a visible minority/racialized person?
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setIsVisibleMinority(true)}
                className={`px-6 py-2 rounded-md ${
                  isVisibleMinority === true
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIsVisibleMinority(false)}
                className={`px-6 py-2 rounded-md ${
                  isVisibleMinority === false
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Disability */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              Do you identify as a person with a disability?
            </label>
            <div className="flex space-x-4 mb-3">
              <button
                type="button"
                onClick={() => setHasDisability(true)}
                className={`px-6 py-2 rounded-md ${
                  hasDisability === true
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setHasDisability(false)}
                className={`px-6 py-2 rounded-md ${
                  hasDisability === false
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                No
              </button>
            </div>
            {hasDisability === true && (
              <label className="flex items-center space-x-3 mt-3">
                <input
                  type="checkbox"
                  checked={requiresAccommodation}
                  onChange={(e) => setRequiresAccommodation(e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">I would like to discuss workplace accommodations</span>
              </label>
            )}
          </div>

          {/* LGBTQ2+ */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              Do you identify as LGBTQ2+?
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setIsLgbtq2Plus(true)}
                className={`px-6 py-2 rounded-md ${
                  isLgbtq2Plus === true
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIsLgbtq2Plus(false)}
                className={`px-6 py-2 rounded-md ${
                  isLgbtq2Plus === false
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Newcomer */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              Are you a newcomer to Canada (immigrated in past 5 years)?
            </label>
            <div className="flex space-x-4 mb-3">
              <button
                type="button"
                onClick={() => setIsNewcomer(true)}
                className={`px-6 py-2 rounded-md ${
                  isNewcomer === true
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIsNewcomer(false)}
                className={`px-6 py-2 rounded-md ${
                  isNewcomer === false
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                No
              </button>
            </div>
            {isNewcomer === true && (
              <input
                type="number"
                value={immigrationYear}
                onChange={(e) => setImmigrationYear(e.target.value)}
                placeholder="Year of immigration (optional)"
                min="1900"
                max={new Date().getFullYear()}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Submit Survey'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-md text-sm text-gray-600">
          <p className="font-medium mb-2">Privacy Notice:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your data is encrypted and stored securely</li>
            <li>Only anonymized statistics (10+ member minimum) are shared</li>
            <li>You can update or delete your data anytime</li>
            <li>This survey is voluntary and confidential</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

