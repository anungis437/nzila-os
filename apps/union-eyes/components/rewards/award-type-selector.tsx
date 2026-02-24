'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';
import type { RecognitionAwardType } from '@/db/schema/recognition-rewards-schema';

interface AwardTypeSelectorProps {
  awardTypes: (RecognitionAwardType & {
    program_name?: string;
  })[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  showCredits?: boolean;
}

export function AwardTypeSelector({
  awardTypes,
  value,
  onChange,
  disabled = false,
  required = false,
  label = 'Award Type',
  showCredits = true,
}: AwardTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<RecognitionAwardType | undefined>(
    awardTypes.find((t) => t.id === value)
  );

  const handleChange = (newValue: string) => {
    const selected = awardTypes.find((t) => t.id === newValue);
    setSelectedType(selected);
    onChange(newValue);
  };

  const activeTypes = awardTypes; // All types passed in are considered active
  const groupedByProgram = activeTypes.reduce((acc, type) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const programName = (type as any).program_name || 'Other';
    if (!acc[programName]) {
      acc[programName] = [];
    }
    acc[programName].push(type);
    return acc;
  }, {} as Record<string, typeof activeTypes>);

  return (
    <div className="space-y-2">
      <Label htmlFor="award-type">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <Select
        value={value}
        onValueChange={handleChange}
        disabled={disabled || activeTypes.length === 0}
        required={required}
      >
        <SelectTrigger id="award-type" className="w-full">
          <SelectValue placeholder="Select an award type">
            {selectedType && (
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                <span>{selectedType.name}</span>
                {showCredits && selectedType.defaultCreditAmount && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedType.defaultCreditAmount} credits
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        
        <SelectContent>
          {activeTypes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No active award types available
            </div>
          ) : (
            Object.entries(groupedByProgram).map(([programName, types]) => (
              <div key={programName}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {programName}
                </div>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2 w-full">
                      <Award className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{type.name}</div>
                      </div>
                      {showCredits && type.defaultCreditAmount && (
                        <Badge variant="outline" className="ml-2">
                          {type.defaultCreditAmount}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Selected Type Details */}
      {selectedType && (
        <div className="mt-2 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="font-semibold text-sm">{selectedType.name}</h4>
              <div className="flex gap-2 mt-2">
                {selectedType.defaultCreditAmount && (
                  <Badge variant="secondary">
                    {selectedType.defaultCreditAmount} credits
                  </Badge>
                )}
                {selectedType.requiresApproval && (
                  <Badge variant="outline">Requires Approval</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

