'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, CheckCircle, AlertTriangle, Info, Scale, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JurisdictionBadge } from '@/components/jurisdiction/jurisdiction-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CAJurisdiction, getJurisdictionName, mapJurisdictionValue } from '@/lib/jurisdiction-helpers-client';
import { Progress } from '@/components/ui/progress';

interface StrikeVoteJurisdictionInfoProps {
  voteId: string;
  organizationId: string;
  totalEligibleMembers: number;
  votesInFavor: number;
  votesAgainst: number;
  totalVotesCast: number;
}

interface ThresholdRequirements {
  jurisdiction: CAJurisdiction;
  majorityThreshold: number;
  participationRequired: boolean;
  minimumParticipation?: number;
  legalReference: string;
  specialRules?: string[];
}

export function StrikeVoteJurisdictionInfo({
  voteId,
  organizationId,
  totalEligibleMembers,
  votesInFavor,
  votesAgainst,
  totalVotesCast,
}: StrikeVoteJurisdictionInfoProps) {
  const _t = useTranslations();
  const [jurisdiction, setJurisdiction] = useState<CAJurisdiction | null>(null);
  const [requirements, setRequirements] = useState<ThresholdRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequirements = async () => {
      try {
        setLoading(true);

        // Fetch organization's jurisdiction
        const jurisdictionResponse = await fetch(
          `/api/organizations/${organizationId}`
        );

        if (!jurisdictionResponse.ok) {
          throw new Error('Failed to fetch jurisdiction');
        }

        const jurisdictionData = await jurisdictionResponse.json();
        const organization = jurisdictionData?.data ?? jurisdictionData;
        const rawJurisdiction =
          (organization?.jurisdiction ??
            organization?.provinceTerritory ??
            organization?.province_territory ??
            '') as string;
        const jur = mapJurisdictionValue(rawJurisdiction);
        setJurisdiction(jur);

        // Fetch strike vote threshold requirements
        const rulesResponse = await fetch(
          `/api/jurisdiction/rules?jurisdiction=${jur}&category=strike_vote`
        );

        if (rulesResponse.ok) {
          const rulesData = await rulesResponse.json();
          
          if (rulesData.rules && rulesData.rules.length > 0) {
            const rule = rulesData.rules[0];
            
            // Parse jurisdiction-specific thresholds
            const thresholds: { [key: string]: number } = {
              'CA-FED': 50, // Federal: Simple majority
              'CA-AB': 50,  // Alberta: Simple majority
              'CA-BC': 50,  // BC: Simple majority
              'CA-MB': 65,  // Manitoba: 65% majority
              'CA-NB': 60,  // New Brunswick: 60% majority
              'CA-NL': 50,  // Newfoundland: Simple majority
              'CA-NT': 50,  // Northwest Territories: Simple majority
              'CA-NS': 50,  // Nova Scotia: Simple majority
              'CA-NU': 50,  // Nunavut: Simple majority
              'CA-ON': 50,  // Ontario: Simple majority
              'CA-PE': 50,  // PEI: Simple majority
              'CA-QC': 50,  // Quebec: Simple majority
              'CA-SK': 45,  // Saskatchewan: 45% of eligible members (special rule)
              'CA-YT': 50,  // Yukon: Simple majority
            };

            const threshold = thresholds[jur] || 50;
            const specialRules: string[] = [];

            // Saskatchewan has unique rule: 45% of ALL eligible members must vote "yes"
            if (jur === 'CA-SK') {
              specialRules.push(
                'Saskatchewan requires 45% of total eligible members to vote in favor (not just 45% of votes cast)'
              );
            }

            // Manitoba has high threshold
            if (jur === 'CA-MB') {
              specialRules.push(
                'Manitoba requires a super-majority of 65% of votes cast in favor'
              );
            }

            // New Brunswick has moderate threshold
            if (jur === 'CA-NB') {
              specialRules.push(
                'New Brunswick requires 60% of votes cast in favor'
              );
            }

            setRequirements({
              jurisdiction: jur,
              majorityThreshold: threshold,
              participationRequired: jur === 'CA-SK',
              minimumParticipation: jur === 'CA-SK' ? 45 : undefined,
              legalReference: rule.legalReference || '',
              specialRules: specialRules.length > 0 ? specialRules : undefined,
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
  }, [voteId, organizationId]);

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

  // Calculate vote statistics
  const participationRate = (totalVotesCast / totalEligibleMembers) * 100;
  const favorPercentageOfCast = totalVotesCast > 0 ? (votesInFavor / totalVotesCast) * 100 : 0;
  const favorPercentageOfEligible = (votesInFavor / totalEligibleMembers) * 100;

  // Determine if vote passes based on jurisdiction rules
  let voteStatus: 'pending' | 'passed' | 'failed' = 'pending';
  
  if (totalVotesCast > 0) {
    if (jurisdiction === 'CA-SK') {
      // Saskatchewan: Need 45% of eligible members to vote "yes"
      voteStatus = favorPercentageOfEligible >= 45 ? 'passed' : 'failed';
    } else {
      // All other jurisdictions: threshold % of votes cast
      const requiresStrictMajority = requirements.majorityThreshold === 50;
      const meetsThreshold = requiresStrictMajority
        ? favorPercentageOfCast > requirements.majorityThreshold
        : favorPercentageOfCast >= requirements.majorityThreshold;
      voteStatus = meetsThreshold ? 'passed' : 'failed';
    }
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

      {/* Threshold Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Scale size={16} className="text-blue-600" />
            Strike Vote Threshold Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Required Majority:</span>
              <p className="font-medium text-lg">
                {requirements.majorityThreshold}%
                {jurisdiction === 'CA-SK' && (
                  <span className="text-xs text-gray-600 ml-1">
                    of eligible members
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Eligible Members:</span>
              <p className="font-medium text-lg">{totalEligibleMembers}</p>
            </div>
          </div>

          {/* Special Rules Alert */}
          {requirements.specialRules && requirements.specialRules.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {requirements.specialRules.map((rule, index) => (
                    <p key={index} className="text-sm">
                      {rule}
                    </p>
                  ))}
                </div>
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

      {/* Vote Status & Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            Current Vote Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Status Alert */}
          {voteStatus !== 'pending' && (
            <Alert
              variant={voteStatus === 'passed' ? 'default' : 'destructive'}
            >
              {voteStatus === 'passed' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                <strong>
                  {voteStatus === 'passed'
                    ? 'Strike Vote PASSED'
                    : 'Strike Vote FAILED'}
                </strong>
                <br />
                {jurisdiction === 'CA-SK'
                  ? `${favorPercentageOfEligible.toFixed(1)}% of eligible members voted in favor (required: ${requirements.majorityThreshold}%)`
                  : `${favorPercentageOfCast.toFixed(1)}% of votes cast in favor (required: ${requirements.majorityThreshold}%)`}
              </AlertDescription>
            </Alert>
          )}

          {/* Vote Breakdown */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Votes in Favor</span>
                <span className="font-medium">
                  {votesInFavor} ({favorPercentageOfCast.toFixed(1)}% of votes cast)
                </span>
              </div>
              <Progress value={favorPercentageOfCast} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Participation Rate</span>
                <span className="font-medium">
                  {totalVotesCast} / {totalEligibleMembers} ({participationRate.toFixed(1)}%)
                </span>
              </div>
              <Progress value={participationRate} className="h-2" />
            </div>

            {jurisdiction === 'CA-SK' && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    Favor as % of Eligible Members (SK Rule)
                  </span>
                  <span className="font-medium">
                    {favorPercentageOfEligible.toFixed(1)}% (need {requirements.majorityThreshold}%)
                  </span>
                </div>
                <Progress
                  value={favorPercentageOfEligible}
                  className={`h-2 ${
                    favorPercentageOfEligible >= requirements.majorityThreshold
                      ? 'bg-green-200'
                      : 'bg-red-200'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Vote Details Grid */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{votesInFavor}</p>
              <p className="text-xs text-gray-600">In Favor</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{votesAgainst}</p>
              <p className="text-xs text-gray-600">Against</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{totalVotesCast}</p>
              <p className="text-xs text-gray-600">Total Votes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Jurisdiction Comparison (Optional Educational Info) */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            Strike Vote Requirements Across Canada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>Manitoba:</strong> 65% majority
              </div>
              <div>
                <strong>New Brunswick:</strong> 60% majority
              </div>
              <div>
                <strong>Saskatchewan:</strong> 45% of all eligible members
              </div>
              <div>
                <strong>All others:</strong> Simple majority (50%+1)
              </div>
            </div>
            <p className="text-gray-600 italic pt-2 border-t border-blue-300">
              Your jurisdiction ({getJurisdictionName(jurisdiction)}) requires{' '}
              {requirements.majorityThreshold}%
              {jurisdiction === 'CA-SK' && ' of all eligible members'} to authorize
              a strike.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

