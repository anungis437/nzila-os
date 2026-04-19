import type { AbrDataMode } from '@/lib/data-mode';
import type { IntelligenceIngestResult } from '@/modules/intelligence/types';
import { ingestIntelligenceRecords } from '@/modules/intelligence/service';

export interface IntelligenceIngestJobInput {
  sourceName: string;
  jurisdiction: string;
  format: 'json' | 'csv';
  content: string;
  dataMode?: AbrDataMode;
}

export async function runIntelligenceIngestJob(
  input: IntelligenceIngestJobInput,
): Promise<IntelligenceIngestResult> {
  return ingestIntelligenceRecords({
    sourceName: input.sourceName,
    jurisdiction: input.jurisdiction,
    ingestionType: input.format === 'csv' ? 'manual_csv' : 'manual_json',
    format: input.format,
    content: input.content,
    dataMode: input.dataMode ?? 'pilot',
  });
}
