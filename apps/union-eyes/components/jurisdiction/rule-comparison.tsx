/**
 * Jurisdiction Rules Comparison Component
 * Side-by-side comparison of rules across jurisdictions
 * Phase 5D: Jurisdiction Framework
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, InfoIcon } from 'lucide-react';
import { MultiJurisdictionSelector } from './jurisdiction-selector';
import { JurisdictionBadge, type CAJurisdiction } from './jurisdiction-badge';
import { cn } from '@/lib/utils';

interface JurisdictionRule {
  id: string;
  jurisdiction: CAJurisdiction;
  ruleType: string;
  ruleName: string;
  ruleDescription: string;
  category: string;
  legalReference: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: Record<string, any>;
  effectiveDate: string;
}

interface RuleComparisonProps {
  ruleCategory: string;
  defaultJurisdictions?: CAJurisdiction[];
  maxJurisdictions?: number;
}

export function RuleComparison({
  ruleCategory,
  defaultJurisdictions = ['CA-FED', 'CA-ON', 'CA-QC', 'CA-BC'],
  maxJurisdictions = 6
}: RuleComparisonProps) {
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<CAJurisdiction[]>(
    defaultJurisdictions
  );
  const [rules, setRules] = useState<Record<string, JurisdictionRule[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComparison = useCallback(async () => {
    if (selectedJurisdictions.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/jurisdiction-rules/compare?jurisdictions=${selectedJurisdictions.join(',')}&category=${ruleCategory}`
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load comparison');
      }

      setRules(data.data.comparison);
    } catch (err) {
      setError(err.message || 'Failed to load comparison');
      setRules({});
    } finally {
      setLoading(false);
    }
  }, [selectedJurisdictions, ruleCategory]);

  useEffect(() => {
    if (selectedJurisdictions.length > 0) {
      loadComparison();
    }
  }, [loadComparison, selectedJurisdictions]);

  const getParameterValue = (rule: JurisdictionRule, key: string) => {
    const value = rule.parameters[key];
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  };

  // Extract all parameter keys from rules
  const allParameterKeys = new Set<string>();
  Object.values(rules).forEach(jurisdictionRules => {
    jurisdictionRules.forEach(rule => {
      Object.keys(rule.parameters).forEach(key => allParameterKeys.add(key));
    });
  });

  const parameterKeys = Array.from(allParameterKeys);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jurisdiction Rules Comparison</CardTitle>
        <CardDescription>
          Compare {ruleCategory.replace(/_/g, ' ')} rules across multiple jurisdictions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <MultiJurisdictionSelector
            value={selectedJurisdictions}
            onChange={setSelectedJurisdictions}
            maxSelections={maxJurisdictions}
            includeFederal={true}
          />
        </div>

        <Button
          onClick={loadComparison}
          disabled={loading || selectedJurisdictions.length === 0}
          className="w-full"
        >
          {loading ? 'Loading...' : 'Compare Rules'}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {Object.keys(rules).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left p-3 font-semibold sticky left-0 bg-muted z-10">
                    Attribute
                  </th>
                  {selectedJurisdictions.map(jurisdiction => (
                    <th key={jurisdiction} className="text-left p-3 min-w-[200px]">
                      <JurisdictionBadge jurisdiction={jurisdiction} size="sm" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Rule Name */}
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium sticky left-0 bg-background">
                    Rule Name
                  </td>
                  {selectedJurisdictions.map(jurisdiction => {
                    const jurisdictionRules = rules[jurisdiction] || [];
                    const rule = jurisdictionRules[0];
                    return (
                      <td key={jurisdiction} className="p-3">
                        {rule ? rule.ruleName : <span className="text-muted-foreground">N/A</span>}
                      </td>
                    );
                  })}
                </tr>

                {/* Legal Reference */}
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium sticky left-0 bg-background">
                    Legal Reference
                  </td>
                  {selectedJurisdictions.map(jurisdiction => {
                    const jurisdictionRules = rules[jurisdiction] || [];
                    const rule = jurisdictionRules[0];
                    return (
                      <td key={jurisdiction} className="p-3 text-xs">
                        {rule ? (
                          <span className="text-blue-600">{rule.legalReference}</span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Description */}
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium sticky left-0 bg-background">
                    Description
                  </td>
                  {selectedJurisdictions.map(jurisdiction => {
                    const jurisdictionRules = rules[jurisdiction] || [];
                    const rule = jurisdictionRules[0];
                    return (
                      <td key={jurisdiction} className="p-3 text-xs">
                        {rule ? rule.ruleDescription : <span className="text-muted-foreground">N/A</span>}
                      </td>
                    );
                  })}
                </tr>

                {/* Parameters */}
                {parameterKeys.map(key => (
                  <tr key={key} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium sticky left-0 bg-background capitalize">
                      {key.replace(/_/g, ' ')}
                    </td>
                    {selectedJurisdictions.map(jurisdiction => {
                      const jurisdictionRules = rules[jurisdiction] || [];
                      const rule = jurisdictionRules[0];
                      const value = rule ? getParameterValue(rule, key) : 'N/A';
                      
                      // Highlight differences
                      const allValues = selectedJurisdictions.map(j => {
                        const r = (rules[j] || [])[0];
                        return r ? getParameterValue(r, key) : 'N/A';
                      });
                      const isDifferent = new Set(allValues).size > 1;

                      return (
                        <td
                          key={jurisdiction}
                          className={cn(
                            'p-3 font-medium',
                            isDifferent && value !== 'N/A' && 'bg-yellow-50'
                          )}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {Object.keys(rules).length > 0 && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Highlighted cells indicate differences across jurisdictions. Legal references cite
              specific acts and sections for verification.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

