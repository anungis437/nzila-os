'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Users, CheckCircle, AlertTriangle, Info, Scale, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JurisdictionBadge } from '@/components/jurisdiction/jurisdiction-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CAJurisdiction, getJurisdictionName } from '@/lib/jurisdiction-helpers-client';
 
import { Progress } from '@/components/ui/progress';

interface CertificationJurisdictionInfoProps {
  certificationId: string;
  organizationId: string;
  totalEmployees: number;
  cardsSignedCount?: number;
  certificationMethod?: 'card-check' | 'mandatory-vote' | 'automatic';
}

interface CertificationRequirements {
  jurisdiction: CAJurisdiction;
  cardCheckThreshold: number;
  mandatoryVoteThreshold?: number;
  supportCardCheckMethod: boolean;
  supportMandatoryVote: boolean;
  supportAutomatic: boolean;
  legalReference: string;
  specialRules?: string[];
  formRequirements?: string[];
}

export function CertificationJurisdictionInfo({
  certificationId,
  organizationId,
  totalEmployees,
  cardsSignedCount = 0,
  certificationMethod: _certificationMethod,
}: CertificationJurisdictionInfoProps) {
  const _t = useTranslations();
  const [jurisdiction, setJurisdiction] = useState<CAJurisdiction | null>(null);
  const [requirements, setRequirements] = useState<CertificationRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequirements = async () => {
      try {
        setLoading(true);
        if (!organizationId) {
          throw new Error('Missing organization id');
        }

        // Fetch organization's jurisdiction
        const jurisdictionResponse = await fetch(
          `/api/jurisdiction/organization/${organizationId}`
        );

        if (!jurisdictionResponse.ok) {
          throw new Error('Failed to fetch jurisdiction');
        }

        const jurisdictionData = await jurisdictionResponse.json();
        const jur = jurisdictionData.jurisdiction as CAJurisdiction;
        setJurisdiction(jur);

        // Fetch certification requirements
        const rulesResponse = await fetch(
          `/api/jurisdiction/rules?jurisdiction=${jur}&category=certification`
        );

        if (rulesResponse.ok) {
          const rulesData = await rulesResponse.json();
          
          if (rulesData.rules && rulesData.rules.length > 0) {
            const rule = rulesData.rules[0];
            
            // Parse jurisdiction-specific thresholds and methods
            const certRequirements: { [key: string]: Partial<CertificationRequirements> } = {
              'CA-FED': {
                cardCheckThreshold: 50,
                supportCardCheckMethod: false,
                supportMandatoryVote: true,
                supportAutomatic: false,
                specialRules: [
                  'Federal jurisdiction requires mandatory vote in all cases',
                  'Minimum 35% support cards required to trigger vote',
                  'Simple majority of votes cast required for certification'
                ],
                formRequirements: [
                  'CIRB Form 1: Application for Certification',
                  'List of all employees in proposed bargaining unit',
                  'Evidence of employee support (cards)',
                  'Proposed bargaining unit description'
                ]
              },
              'CA-AB': {
                cardCheckThreshold: 65,
                supportCardCheckMethod: true,
                supportMandatoryVote: false,
                supportAutomatic: false,
                specialRules: [
                  'Card-check certification available with 65%+ support',
                  'Mandatory vote if support between 40-65%',
                  'Application dismissed if less than 40% support'
                ],
                formRequirements: [
                  'Form LRB-001: Application for Certification',
                  'Membership evidence cards',
                  'Employee list from employer'
                ]
              },
              'CA-BC': {
                cardCheckThreshold: 55,
                supportCardCheckMethod: true,
                supportMandatoryVote: true,
                supportAutomatic: false,
                specialRules: [
                  'Card-check certification with 55%+ support',
                  'Mandatory vote if support between 45-55%',
                  'Application dismissed if less than 45% support'
                ],
                formRequirements: [
                  'LRB Form 1: Application for Certification',
                  'Membership cards or evidence of support',
                  'Description of bargaining unit'
                ]
              },
              'CA-MB': {
                cardCheckThreshold: 65,
                supportCardCheckMethod: true,
                supportMandatoryVote: false,
                supportAutomatic: false,
                specialRules: [
                  'Card-check certification with 65%+ support (signed within 90 days)',
                  'Mandatory vote if support between 40-65%',
                  'Vote requires simple majority of those eligible'
                ],
              },
              'CA-NB': {
                cardCheckThreshold: 60,
                supportCardCheckMethod: true,
                supportMandatoryVote: true,
                supportAutomatic: false,
                specialRules: [
                  'Card-check with 60%+ support',
                  'Mandatory vote if support between 40-60%'
                ],
              },
              'CA-NL': {
                cardCheckThreshold: 65,
                supportCardCheckMethod: true,
                supportMandatoryVote: false,
                supportAutomatic: false,
                specialRules: [
                  'Card-check with 65%+ support',
                  'Mandatory vote if less than 65%'
                ],
              },
              'CA-NS': {
                cardCheckThreshold: 55,
                supportCardCheckMethod: false,
                supportMandatoryVote: true,
                supportAutomatic: false,
                specialRules: [
                  'Mandatory vote required in all cases',
                  'Minimum 40% support cards to trigger vote',
                  'Simple majority required for certification'
                ],
              },
              'CA-ON': {
                cardCheckThreshold: 55,
                supportCardCheckMethod: false,
                supportMandatoryVote: true,
                supportAutomatic: false,
                specialRules: [
                  'Mandatory vote required in all cases',
                  'Minimum 40% support to trigger vote',
                  'Simple majority of votes cast required'
                ],
              },
              'CA-PE': {
                cardCheckThreshold: 50,
                supportCardCheckMethod: true,
                supportMandatoryVote: false,
                supportAutomatic: false,
                specialRules: [
                  'Card-check with 50%+1 support',
                  'Board discretion to order vote'
                ],
              },
              'CA-QC': {
                cardCheckThreshold: 50,
                supportCardCheckMethod: true,
                supportMandatoryVote: false,
                supportAutomatic: false,
                specialRules: [
                  'Card-check certification with absolute majority (50%+1)',
                  'TAT (Tribunal administratif du travail) reviews application',
                  'Bilingual documentation required'
                ],
                formRequirements: [
                  'Application to TAT with membership evidence',
                  'List of employees (from union and employer)',
                  'Bilingual forms and documentation',
                  'Union constitution and bylaws'
                ]
              },
              'CA-SK': {
                cardCheckThreshold: 45,
                supportCardCheckMethod: true,
                supportMandatoryVote: false,
                supportAutomatic: false,
                specialRules: [
                  'Card-check with 45%+ support (unique lower threshold)',
                  'Mandatory vote only if LRB determines necessary'
                ],
              },
            };

            const jurReqs = certRequirements[jur] || {
              cardCheckThreshold: 50,
              supportCardCheckMethod: true,
              supportMandatoryVote: true,
              supportAutomatic: false,
            };

            setRequirements({
              jurisdiction: jur,
              cardCheckThreshold: jurReqs.cardCheckThreshold || 50,
              mandatoryVoteThreshold: jurReqs.cardCheckThreshold,
              supportCardCheckMethod: jurReqs.supportCardCheckMethod !== false,
              supportMandatoryVote: jurReqs.supportMandatoryVote !== false,
              supportAutomatic: jurReqs.supportAutomatic || false,
              legalReference: rule.legalReference || '',
              specialRules: jurReqs.specialRules,
              formRequirements: jurReqs.formRequirements,
            });
          }
        }
      } catch (err) {
setError(
          err instanceof Error ? err.message : 'Failed to load requirements'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRequirements();
  }, [certificationId, organizationId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Info className="animate-spin h-5 w-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-500">Loading requirements...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !jurisdiction || !requirements) {
    return null; // Silently fail
  }

  // Calculate support percentage
  const supportPercentage = totalEmployees > 0 ? (cardsSignedCount / totalEmployees) * 100 : 0;

  // Determine recommended method
  let recommendedMethod: 'card-check' | 'mandatory-vote' | 'insufficient' = 'insufficient';
  if (requirements.supportCardCheckMethod && supportPercentage >= requirements.cardCheckThreshold) {
    recommendedMethod = 'card-check';
  } else if (requirements.supportMandatoryVote && supportPercentage >= 35) {
    recommendedMethod = 'mandatory-vote';
  }

  return (
    <div className="space-y-4">
      {/* Jurisdiction Badge */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info size={16} className="text-blue-600" />
            Jurisdiction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <JurisdictionBadge jurisdiction={jurisdiction} size="lg" />
        </CardContent>
      </Card>

      {/* Certification Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Scale size={16} className="text-blue-600" />
            Certification Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Card-Check Threshold:</span>
              <p className="font-medium text-lg">
                {requirements.cardCheckThreshold}%
              </p>
              <p className="text-xs text-gray-600">
                {requirements.supportCardCheckMethod ? 'Available' : 'Not available'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Total Employees:</span>
              <p className="font-medium text-lg">{totalEmployees}</p>
              <p className="text-xs text-gray-600">
                Need {Math.ceil((requirements.cardCheckThreshold / 100) * totalEmployees)} cards
              </p>
            </div>
          </div>

          {/* Special Rules Alert */}
          {requirements.specialRules && requirements.specialRules.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">Jurisdiction-Specific Rules:</p>
                <ul className="text-xs space-y-1 list-disc ml-4">
                  {requirements.specialRules.map((rule, index) => (
                    <li key={index}>{rule}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Legal Reference */}
          {requirements.legalReference && (
            <div className="pt-2 border-t text-xs text-gray-600">
              <span className="font-medium">Legal Reference:</span>{' '}
              {requirements.legalReference}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Support Status */}
      {cardsSignedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users size={16} className="text-blue-600" />
              Current Support Level
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Alert */}
            <Alert
              variant={
                supportPercentage >= requirements.cardCheckThreshold
                  ? 'default'
                  : 'destructive'
              }
            >
              {supportPercentage >= requirements.cardCheckThreshold ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                <strong>
                  {supportPercentage >= requirements.cardCheckThreshold
                    ? 'Card-Check Certification Available'
                    : supportPercentage >= 35
                    ? 'Mandatory Vote Required'
                    : 'Insufficient Support'}
                </strong>
                <br />
                {cardsSignedCount} of {totalEmployees} employees have signed support cards (
                {supportPercentage.toFixed(1)}%)
              </AlertDescription>
            </Alert>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Support Cards Signed</span>
                <span className="font-medium">
                  {cardsSignedCount} / {totalEmployees} ({supportPercentage.toFixed(1)}%)
                </span>
              </div>
              <Progress value={supportPercentage} className="h-3" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span className="font-medium text-orange-600">
                  {requirements.cardCheckThreshold}% (Card-Check)
                </span>
                <span>100%</span>
              </div>
            </div>

            {/* Recommended Method */}
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-gray-900 mb-2">
                Recommended Certification Method:
              </p>
              <div className={`p-3 rounded-lg ${
                recommendedMethod === 'card-check'
                  ? 'bg-green-50 border border-green-200'
                  : recommendedMethod === 'mandatory-vote'
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className="text-sm font-medium">
                  {recommendedMethod === 'card-check' && 'âœ“ Card-Check Certification'}
                  {recommendedMethod === 'mandatory-vote' && 'â†’ Mandatory Representation Vote'}
                  {recommendedMethod === 'insufficient' && 'âœ— Insufficient Support - Continue Organizing'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {recommendedMethod === 'card-check' &&
                    'You have sufficient support for automatic certification without a vote.'}
                  {recommendedMethod === 'mandatory-vote' &&
                    'You have minimum support to trigger a mandatory vote. Continue organizing to improve vote outcomes.'}
                  {recommendedMethod === 'insufficient' &&
                    'Continue signing up members before filing application. Minimum 35-40% required in most jurisdictions.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Requirements */}
      {requirements.formRequirements && requirements.formRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              Required Forms & Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {requirements.formRequirements.map((req, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Multi-Jurisdiction Comparison */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen size={16} className="text-blue-600" />
            Certification Methods Across Canada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>Card-Check Available:</strong>
                <p className="text-gray-600">AB, BC, MB, NB, NL, PE, QC, SK</p>
              </div>
              <div>
                <strong>Mandatory Vote Only:</strong>
                <p className="text-gray-600">Federal, NS, ON</p>
              </div>
            </div>
            <div className="pt-2 border-t border-blue-300">
              <strong>Thresholds:</strong>
              <p className="text-gray-600">
                AB/MB/NL: 65% â€¢ BC/NS/ON: 55% â€¢ NB: 60% â€¢ SK: 45% (lowest) â€¢ QC/PE: 50%
              </p>
            </div>
            <p className="text-gray-600 italic pt-2 border-t border-blue-300">
              Your jurisdiction ({getJurisdictionName(jurisdiction)}) requires{' '}
              {requirements.cardCheckThreshold}% support for{' '}
              {requirements.supportCardCheckMethod
                ? 'card-check certification'
                : 'mandatory vote triggering'}
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

