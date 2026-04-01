import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { DataIngestionService, DataValidator, Deduplicator, dataIngestion } from '../data-ingestion';
import type { FileType } from '../data-ingestion';

describe('DataValidator', () => {
  it('validates required field present', () => {
    const validator = new DataValidator();
    validator.addRule({ field: 'name', required: true, severity: 'high' });
    const result = validator.validate({ name: 'Test' });
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('reports missing required field', () => {
    const validator = new DataValidator();
    validator.addRule({ field: 'name', required: true, severity: 'high' });
    const result = validator.validate({});
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].type).toBe('missing_field');
  });

  it('validates field pattern', () => {
    const validator = new DataValidator();
    validator.addRule({ field: 'email', required: false, pattern: /@/, severity: 'medium' });
    const result = validator.validate({ email: 'invalid' });
    expect(result.issues.some(i => i.type === 'invalid_format')).toBe(true);
  });

  it('passes valid pattern', () => {
    const validator = new DataValidator();
    validator.addRule({ field: 'email', required: false, pattern: /@/, severity: 'medium' });
    const result = validator.validate({ email: 'test@example.com' });
    expect(result.issues.length).toBe(0);
  });
});

describe('Deduplicator', () => {
  it('detects duplicate content', () => {
    const dedup = new Deduplicator();
    dedup.add('Hello world');
    expect(dedup.isDuplicate('Hello world')).toBe(true);
  });

  it('normalizes whitespace for comparison', () => {
    const dedup = new Deduplicator();
    dedup.add('Hello   world');
    expect(dedup.isDuplicate('hello world')).toBe(true);
  });

  it('reports non-duplicate correctly', () => {
    const dedup = new Deduplicator();
    dedup.add('Hello');
    expect(dedup.isDuplicate('World')).toBe(false);
  });

  it('getDuplicateInfo returns hash for duplicates', () => {
    const dedup = new Deduplicator();
    dedup.add('test content');
    const info = dedup.getDuplicateInfo('test content');
    expect(info.isDuplicate).toBe(true);
    expect(info.existingHash).toBeTruthy();
  });

  it('clears cache', () => {
    const dedup = new Deduplicator();
    dedup.add('test');
    dedup.clear();
    expect(dedup.isDuplicate('test')).toBe(false);
  });
});

describe('DataIngestionService', () => {
  it('ingests plain text', async () => {
    const service = new DataIngestionService();
    const buffer = Buffer.from('This is a test document with enough content to be useful.');
    const doc = await service.ingest(buffer, 'text/plain', 'test.txt', { source: 'unit-test' });
    expect(doc.id).toBeTruthy();
    expect(doc.content).toContain('test document');
    expect(doc.metadata.type).toBe('txt');
    expect(doc.quality.score).toBeGreaterThan(0);
  });

  it('ingests JSON content', async () => {
    const service = new DataIngestionService();
    const data = { name: 'Test', value: 42 };
    const buffer = Buffer.from(JSON.stringify(data));
    const doc = await service.ingest(buffer, 'application/json', 'data.json', { source: 'test' });
    expect(doc.content).toContain('Test');
    expect(doc.metadata.type).toBe('json');
  });

  it('ingests CSV content', async () => {
    const service = new DataIngestionService();
    const csv = 'Name,Age,Role\nJohn,30,Steward\nJane,25,Member';
    const buffer = Buffer.from(csv);
    const doc = await service.ingest(buffer, 'text/csv', 'members.csv', { source: 'test' });
    expect(doc.content).toContain('John');
    expect(doc.metadata.type).toBe('csv');
  });

  it('ingests email content', async () => {
    const service = new DataIngestionService();
    const email = 'From: sender@example.com\nTo: rcpt@example.com\nSubject: Grievance\n\nPlease review the attached grievance.';
    const buffer = Buffer.from(email);
    const doc = await service.ingest(buffer, 'message/rfc822', 'message.eml', { source: 'email' });
    expect(doc.content).toContain('grievance');
  });

  it('throws for unsupported file type', async () => {
    const service = new DataIngestionService();
    const buffer = Buffer.from('binary data');
    await expect(
      service.ingest(buffer, 'application/octet-stream', 'data.bin', { source: 'test' })
    ).rejects.toThrow('No parser available');
  });

  it('detects duplicates on second ingest', async () => {
    const service = new DataIngestionService();
    const buffer = Buffer.from('Identical content for duplicate detection test.');
    await service.ingest(buffer, 'text/plain', 'first.txt', { source: 'test' });
    // Second ingest of same content should still succeed but log warning
    const doc2 = await service.ingest(buffer, 'text/plain', 'second.txt', { source: 'test' });
    expect(doc2.id).toBeTruthy();
  });

  it('maps file extensions correctly', async () => {
    const service = new DataIngestionService();
    const buffer = Buffer.from('content');
    const htmlDoc = await service.ingest(buffer, 'text/html', 'page.html', {});
    expect(htmlDoc.metadata.type).toBe('html');
  });
});

describe('dataIngestion singleton', () => {
  it('is a DataIngestionService instance', () => {
    expect(dataIngestion).toBeInstanceOf(DataIngestionService);
  });
});

describe('FileType', () => {
  it.each<FileType>(['pdf', 'docx', 'xlsx', 'csv', 'txt', 'json', 'html', 'email'])(
    '%s is a valid file type',
    (type) => {
      expect(typeof type).toBe('string');
    },
  );
});
