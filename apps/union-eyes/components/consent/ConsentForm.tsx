import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { sanitizeHtml } from '@/lib/utils/sanitize';

export interface ConsentFormProps {
  consentType: string;
  version: string;
  content: string;
  onConsent: (consented: boolean, signature?: string) => void;
  requireSignature?: boolean;
}

export const ConsentForm: React.FC<ConsentFormProps> = ({
  consentType,
  version,
  content,
  onConsent,
  requireSignature = false
}) => {
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');
  const [showContent, setShowContent] = useState(false);

  const handleSubmit = (consented: boolean) => {
    if (consented && requireSignature && !signature.trim()) {
      alert('Please provide your digital signature');
      return;
    }
    onConsent(consented, requireSignature ? signature : undefined);
  };

  const consentTitles: Record<string, string> = {
    GENERAL: 'General Terms and Conditions',
    DATA_COLLECTION: 'Data Collection Consent',
    RESEARCH_PARTICIPATION: 'Research Participation Consent',
    DATA_SHARING: 'Data Sharing Consent'
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {consentTitles[consentType] || consentType}
        </h2>
        <p className="text-gray-600">Version {version}</p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => setShowContent(!showContent)}
          className="text-blue-600 hover:text-blue-800 font-medium mb-4"
        >
          {showContent ? 'Hide' : 'Show'} Full Terms
        </button>
        {showContent && (
          <div className="bg-gray-50 p-4 rounded-md max-h-60 overflow-y-auto border">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm text-gray-700">
            I have read and agree to the terms and conditions outlined above.
          </span>
        </label>
        {requireSignature && agreed && (
          <div>
            <label
              htmlFor="signature"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Digital Signature (Type your full name)
            </label>
            <input
              id="signature"
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Enter your full name as digital signature"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
        <div className="flex space-x-4 pt-4">
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            className="flex-1"
          >
            Decline
          </Button>
          <Button
            variant="default"
            onClick={() => handleSubmit(true)}
            disabled={!agreed}
            className="flex-1"
          >
            Accept & Continue
          </Button>
        </div>
      </div>
      <div className="mt-6 text-xs text-gray-500 text-center">
        By clicking &quot;Accept &amp; Continue&quot;, you acknowledge that you understand
        and agree to be bound by these terms.
      </div>
    </Card>
  );
};
