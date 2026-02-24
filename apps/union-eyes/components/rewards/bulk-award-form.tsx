'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AwardTypeSelector } from './award-type-selector';
import { Upload, X, CheckCircle, Users } from 'lucide-react';
import { createAward } from '@/actions/rewards-actions';
import type { RecognitionAwardType } from '@/db/schema/recognition-rewards-schema';

interface BulkAwardFormProps {
  awardTypes: RecognitionAwardType[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface RecipientEntry {
  userId: string;
  name: string;
  email?: string;
  customMessage?: string;
}

export function BulkAwardForm({ awardTypes, onSuccess, onCancel }: BulkAwardFormProps) {
  const t = useTranslations('rewards.admin.bulkAward');
  const [awardTypeId, setAwardTypeId] = useState('');
  const [baseMessage, setBaseMessage] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter((line) => line.trim());
    const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
    
    const userIdIndex = headers.findIndex((h) => h === 'userid' || h === 'user_id');
    const nameIndex = headers.findIndex((h) => h === 'name');
    const emailIndex = headers.findIndex((h) => h === 'email');
    const messageIndex = headers.findIndex((h) => h === 'message' || h === 'custom_message');

    const parsedRecipients: RecipientEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      
      if (userIdIndex >= 0 && values[userIdIndex]) {
        parsedRecipients.push({
          userId: values[userIdIndex],
          name: nameIndex >= 0 ? values[nameIndex] : '',
          email: emailIndex >= 0 ? values[emailIndex] : undefined,
          customMessage: messageIndex >= 0 ? values[messageIndex] : undefined,
        });
      }
    }

    setRecipients(parsedRecipients);
  };

  const handleManualAdd = () => {
    setRecipients([...recipients, { userId: '', name: '', email: '', customMessage: '' }]);
  };

  const updateRecipient = (index: number, field: keyof RecipientEntry, value: string) => {
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: value };
    setRecipients(updated);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!awardTypeId || recipients.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setResults(null);

    const selectedType = awardTypes.find((t) => t.id === awardTypeId);
    const creditsToAward = credits || selectedType?.defaultCreditAmount || 0;

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      if (!recipient.userId) {
        failedCount++;
        errors.push(`Skipped recipient without userId: ${recipient.name}`);
        continue;
      }

      try {
        const result = await createAward({
          award_type_id: awardTypeId,
          recipient_user_id: recipient.userId,
          message: recipient.customMessage || baseMessage,
          credits_to_award: creditsToAward,
        });

        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          errors.push(`${recipient.name}: ${result.error}`);
        }
      } catch (error) {
        failedCount++;
        errors.push(`${recipient.name}: ${error.message}`);
      }
    }

    setResults({ success: successCount, failed: failedCount, errors });
    setIsSubmitting(false);

    if (successCount > 0 && onSuccess) {
      setTimeout(onSuccess, 2000);
    }
  };

  const selectedAwardType = awardTypes.find((t) => t.id === awardTypeId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Award Type Selection */}
          <AwardTypeSelector
            awardTypes={awardTypes}
            value={awardTypeId}
            onChange={setAwardTypeId}
            required
          />

          {/* Credits Override */}
          {selectedAwardType && (
            <div>
              <Label htmlFor="credits">{t('credits')}</Label>
              <Input
                id="credits"
                type="number"
                min="0"
                placeholder={`Default: ${selectedAwardType.defaultCreditAmount || 0}`}
                value={credits || ''}
                onChange={(e) => setCredits(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          )}

          {/* Base Message */}
          <div>
            <Label htmlFor="baseMessage">{t('baseMessage')}</Label>
            <Textarea
              id="baseMessage"
              placeholder={t('baseMessagePlaceholder')}
              value={baseMessage}
              onChange={(e) => setBaseMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div>
            <Label>{t('uploadCSV')}</Label>
            <div className="mt-2 flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {csvFile ? csvFile.name : t('selectFile')}
              </Button>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button type="button" variant="outline" onClick={handleManualAdd}>
                {t('addManually')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('csvFormat')}
            </p>
          </div>

          {/* Recipients List */}
          {recipients.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t('recipients', { count: recipients.length })}</Label>
                <Badge variant="outline">{recipients.length} total</Badge>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                {recipients.map((recipient, index) => (
                  <div key={index} className="flex gap-2 p-2 bg-muted/30 rounded">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="User ID"
                        value={recipient.userId}
                        onChange={(e) => updateRecipient(index, 'userId', e.target.value)}
                        size={1}
                      />
                      <Input
                        placeholder="Name"
                        value={recipient.name}
                        onChange={(e) => updateRecipient(index, 'name', e.target.value)}
                        size={1}
                      />
                      <Input
                        placeholder="Custom message (optional)"
                        value={recipient.customMessage || ''}
                        onChange={(e) => updateRecipient(index, 'customMessage', e.target.value)}
                        className="col-span-2"
                        size={1}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRecipient(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <Alert variant={results.failed === 0 ? 'default' : 'destructive'}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">
                  {t('results', { success: results.success, failed: results.failed })}
                </p>
                {results.errors.length > 0 && (
                  <ul className="mt-2 text-xs space-y-1">
                    {results.errors.slice(0, 5).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {results.errors.length > 5 && (
                      <li>...and {results.errors.length - 5} more</li>
                    )}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!awardTypeId || recipients.length === 0 || isSubmitting}
            >
              {isSubmitting
                ? t('processing')
                : t('submit', { count: recipients.length })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

