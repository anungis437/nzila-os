/**
 * Data Ingestion Pipeline
 * 
 * Unified data ingestion for stakeholder documents:
 * - Multi-format parsing (PDF, DOCX, XLSX, CSV)
 * - Data validation & normalization
 * - Deduplication
 * - Quality scoring
 */

import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

// PDF.js will be loaded dynamically for browser/server compatibility
let pdfjsLib: unknown = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    try {
      pdfjsLib = await import('pdfjs-dist');
    } catch {
      // Fallback for environments where pdfjs-dist not available
      return null;
    }
  }
  return pdfjsLib;
}

// Supported file types
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'html' | 'email';

export interface IngestedDocument {
  id: string;
  content: string;
  metadata: IngestedMetadata;
  quality: DocumentQuality;
}

export interface IngestedMetadata {
  source: string;
  type: FileType;
  originalFilename?: string;
  size?: number;
  uploadedBy?: string;
  organizationId?: string;
  jurisdiction?: string;
  documentDate?: Date;
  tags?: string[];
}

export interface DocumentQuality {
  score: number; // 0-100
  completeness: number; // 0-100
  validity: number; // 0-100
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: 'missing_field' | 'invalid_format' | 'duplicate' | 'encoding_error' | 'truncated';
  severity: 'low' | 'medium' | 'high';
  description: string;
  field?: string;
}

export interface ParsedData {
  content: string;
  structured?: Record<string, unknown>;
  tables?: TableData[];
  entities?: ExtractedEntity[];
  metadata?: Record<string, unknown>;
}

export interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * File Parser Interface
 */
interface FileParser {
  canParse(contentType: string, filename: string): boolean;
  parse(buffer: Buffer): Promise<ParsedData>;
}

/**
 * Text Parser (txt, json, html)
 */
class TextParser implements FileParser {
  canParse(contentType: string, filename: string): boolean {
    return ['text/plain', 'application/json', 'text/html', 'application/html']
      .includes(contentType) || 
      /\.(txt|json|html|htm)$/i.test(filename);
  }

  async parse(buffer: Buffer): Promise<ParsedData> {
    const content = buffer.toString('utf-8');
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(content);
      return {
        content: JSON.stringify(json, null, 2),
        structured: json,
      };
    } catch {
      // Not JSON, return as text
      return { content };
    }
  }
}

/**
 * CSV Parser
 */
class CSVParser implements FileParser {
  canParse(contentType: string, filename: string): boolean {
    return contentType === 'text/csv' || /\.csv$/i.test(filename);
  }

  async parse(buffer: Buffer): Promise<ParsedData> {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length === 0) {
      return { content: '', tables: [] };
    }

    // Parse headers
    const headers = this.parseCSVLine(lines[0]);
    
    // Parse rows
    const rows = lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });

    const content = rows.map(row => 
      headers.map(h => `${h}: ${row[h]}`).join('; ')
    ).join('\n');

    return {
      content,
      tables: [{ headers, rows }],
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  }
}

/**
 * PDF Parser - Extracts text from PDF files
 * Uses pdfjs-dist for parsing
 */
class PDFParser implements FileParser {
  canParse(contentType: string, filename: string): boolean {
    return contentType === 'application/pdf' || /\.pdf$/i.test(filename);
  }

  async parse(buffer: Buffer): Promise<ParsedData> {
    const pdfjs = await getPdfJs();
    
    if (!pdfjs) {
      // Fallback: return basic info if pdfjs not available
      return {
        content: '[PDF Content - parsing not available in this environment]',
        metadata: { note: 'PDF parsing requires pdfjs-dist package' }
      };
    }

    try {
      // Load the PDF document
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loadingTask = (pdfjs as any).getDocument({ data: buffer });
      const pdf = await loadingTask.promise;

      const textContent: string[] = [];
      const tables: TableData[] = [];

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        
        const pageText = content.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => item.str)
          .join(' ');
        
        textContent.push(pageText);
      }

      // Try to extract structured data (tables)
      const fullText = textContent.join('\n\n');
      
      // Simple table detection: look for structured data patterns
      const lines = fullText.split('\n');
      const potentialTables = this.detectTables(lines);
      if (potentialTables.length > 0) {
        tables.push(...potentialTables);
      }

      return {
        content: fullText,
        tables: tables.length > 0 ? tables : undefined,
        metadata: {
          pageCount: pdf.numPages,
          parsedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('PDF parsing error', { error });
      return {
        content: '',
        metadata: { error: 'Failed to parse PDF' }
      };
    }
  }

  private detectTables(lines: string[]): TableData[] {
    const tables: TableData[] = [];
    
    // Look for lines with consistent delimiters (tabs or multiple spaces)
    const tableLines: string[][] = [];
    
    for (const line of lines) {
      // Split by tab or multiple spaces
      const cells = line.split(/\t|\s{2,}/).filter(c => c.trim());
      if (cells.length >= 2) {
        tableLines.push(cells);
      }
    }

    if (tableLines.length >= 2) {
      // Assume first row is header
      tables.push({
        headers: tableLines[0],
        rows: tableLines.slice(1).map(row => {
          const rowObj: Record<string, string> = {};
          tableLines[0].forEach((header, i) => {
            rowObj[header] = row[i] || '';
          });
          return rowObj;
        })
      });
    }

    return tables;
  }
}

/**
 * DOCX Parser - Extracts text from Word documents
 * Uses mammoth for parsing
 */
class DOCXParser implements FileParser {
  canParse(contentType: string, filename: string): boolean {
    return (
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      contentType === 'application/msword' ||
      /\.docx$/i.test(filename)
    );
  }

  async parse(buffer: Buffer): Promise<ParsedData> {
    try {
      // Dynamic import mammoth
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - mammoth types may not be available
      const mammoth = await import('mammoth');
      
      const result = await mammoth.extractRawText({ buffer: buffer });
      
      return {
        content: result.value,
        metadata: {
          warnings: result.messages,
          parsedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('DOCX parsing error', { error });
      
      // Try alternative: extract as HTML then strip tags
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - mammoth types may not be available
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ buffer: buffer });
        
        // Simple HTML tag stripping
        const text = result.value
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
        
        return {
          content: text,
          metadata: {
            parseMethod: 'html-stripped',
            parsedAt: new Date().toISOString()
          }
        };
      } catch (_fallbackError) {
        return {
          content: '',
          metadata: { error: 'Failed to parse DOCX' }
        };
      }
    }
  }
}

/**
 * Email Parser - Extracts from email formats
 */
class EmailParser implements FileParser {
  canParse(contentType: string, filename: string): boolean {
    return (
      contentType === 'message/rfc822' ||
      contentType === 'text/rfc822' ||
      /\.eml$/i.test(filename) ||
      /\.msg$/i.test(filename)
    );
  }

  async parse(buffer: Buffer): Promise<ParsedData> {
    const content = buffer.toString('utf-8');
    
    // Parse email headers and body
    const lines = content.split(/\r?\n/);
    const headers: Record<string, string> = {};
    let bodyStartIndex = 0;
    let inHeader = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (inHeader) {
        if (line.trim() === '') {
          inHeader = false;
          bodyStartIndex = i + 1;
          continue;
        }
        
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }
    }

    // Extract body (everything after headers)
    const body = lines.slice(bodyStartIndex).join('\n').trim();
    
    // Clean up quoted replies and signatures
    const cleanedBody = this.cleanEmailBody(body);

    return {
      content: cleanedBody,
      structured: {
        from: headers['from'],
        to: headers['to'],
        subject: headers['subject'],
        date: headers['date'],
        messageId: headers['message-id']
      },
      metadata: {
        parsedAt: new Date().toISOString()
      }
    };
  }

  private cleanEmailBody(body: string): string {
    let cleaned = body;
    
    // Remove quoted sections (lines starting with >)
    const lines = cleaned.split(/\r?\n/);
    const nonQuotedLines = lines.filter(line => !line.trim().startsWith('>'));
    cleaned = nonQuotedLines.join('\n');
    
    // Remove common signature patterns
    cleaned = cleaned.replace(/--\s*\n[\s\S]*/g, '');
    cleaned = cleaned.replace(/___+\s*\n[\s\S]*/g, '');
    
    return cleaned.trim();
  }
}

/**
 * Data Validation
 */
class DataValidator {
  private rules: ValidationRule[] = [];

  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  validate(data: Record<string, unknown>): ValidationResult {
    const issues: QualityIssue[] = [];

    for (const rule of this.rules) {
      const value = data[rule.field];
      
      if (rule.required && (value === undefined || value === null || value === '')) {
        issues.push({
          type: 'missing_field',
          severity: rule.severity,
          description: `Required field missing: ${rule.field}`,
          field: rule.field,
        });
        continue;
      }

      if (value && rule.pattern && !rule.pattern.test(String(value))) {
        issues.push({
          type: 'invalid_format',
          severity: rule.severity,
          description: `Invalid format for ${rule.field}`,
          field: rule.field,
        });
      }
    }

    return {
      valid: issues.filter(i => i.severity === 'high').length === 0,
      issues,
    };
  }
}

interface ValidationRule {
  field: string;
  required: boolean;
  pattern?: RegExp;
  severity: 'low' | 'medium' | 'high';
}

interface ValidationResult {
  valid: boolean;
  issues: QualityIssue[];
}

/**
 * Deduplicator
 */
class Deduplicator {
  private hashCache = new Map<string, string>();

  /**
   * Generate content hash
   */
  generateHash(content: string): string {
    // Normalize whitespace for comparison
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Check if content is duplicate
   */
  isDuplicate(content: string): boolean {
    const hash = this.generateHash(content);
    return this.hashCache.has(hash);
  }

  /**
   * Add content to deduplication cache
   */
  add(content: string): string {
    const hash = this.generateHash(content);
    this.hashCache.set(hash, hash);
    return hash;
  }

  /**
   * Get duplicate info
   */
  getDuplicateInfo(content: string): { isDuplicate: boolean; existingHash?: string } {
    const hash = this.generateHash(content);
    const existing = this.hashCache.get(hash);
    return {
      isDuplicate: !!existing,
      existingHash: existing,
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.hashCache.clear();
  }
}

/**
 * Document Quality Scorer
 */
class QualityScorer {
  score(document: ParsedData, metadata: IngestedMetadata): DocumentQuality {
    const issues: QualityIssue[] = [];
    
    // Content completeness
    const contentLength = document.content?.length || 0;
    const completeness = Math.min(100, (contentLength / 5000) * 100);
    
    if (contentLength < 100) {
      issues.push({
        type: 'truncated',
        severity: contentLength < 50 ? 'high' : 'medium',
        description: 'Document content is very short',
      });
    }

    // Validity checks
    let validity = 100;
    
    if (!document.content || document.content.trim() === '') {
      validity = 0;
      issues.push({
        type: 'invalid_format',
        severity: 'high',
        description: 'Document has no parseable content',
      });
    }

    // Metadata completeness
    let metadataScore = 50;
    if (metadata.source) metadataScore += 10;
    if (metadata.documentDate) metadataScore += 10;
    if (metadata.jurisdiction) metadataScore += 10;
    if (metadata.tags && metadata.tags.length > 0) metadataScore += 10;
    if (metadata.originalFilename) metadataScore += 10;

    // Calculate overall score
    const score = Math.round((completeness + validity + metadataScore) / 3);

    return {
      score,
      completeness: Math.round(completeness),
      validity: Math.round(validity),
      issues,
    };
  }
}

/**
 * Main Data Ingestion Service
 */
class DataIngestionService {
  private parsers: FileParser[] = [
    new TextParser(),
    new CSVParser(),
    new PDFParser(),
    new DOCXParser(),
    new EmailParser(),
  ];

  private validator = new DataValidator();
  private deduplicator = new Deduplicator();
  private qualityScorer = new QualityScorer();

  constructor() {
    // Add default validation rules
    this.validator.addRule({
      field: 'content',
      required: true,
      severity: 'high',
    });
  }

  /**
   * Ingest a document
   */
  async ingest(
    buffer: Buffer,
    contentType: string,
    filename: string,
    metadata: Partial<IngestedMetadata>
  ): Promise<IngestedDocument> {
    // Find appropriate parser
    const parser = this.parsers.find(p => p.canParse(contentType, filename));
    
    if (!parser) {
      throw new Error(`No parser available for ${contentType} / ${filename}`);
    }

    // Parse content
    const parsed = await parser.parse(buffer);
    
    // Check for duplicates
    const dupInfo = this.deduplicator.getDuplicateInfo(parsed.content);
    
    if (dupInfo.isDuplicate) {
      logger.warn('Duplicate document detected', { existingHash: dupInfo.existingHash });
    }

    // Validate
    const _validation = this.validator.validate({
      content: parsed.content,
      ...parsed.structured,
    });

    // Score quality
    const quality = this.qualityScorer.score(parsed, {
      type: this.getFileType(filename),
      source: metadata.source || 'unknown',
      ...metadata,
    });

    // Add to deduplication cache
    const hash = this.deduplicator.add(parsed.content);

    const doc: IngestedDocument = {
      id: hash,
      content: parsed.content,
      metadata: {
        type: this.getFileType(filename),
        source: metadata.source || 'unknown',
        originalFilename: filename,
        size: buffer.length,
        ...metadata,
      },
      quality,
    };

    logger.info('Document ingested', {
      id: doc.id,
      type: doc.metadata.type,
      quality: doc.quality.score,
      isDuplicate: dupInfo.isDuplicate,
    });

    return doc;
  }

  /**
   * Get file type from filename
   */
  private getFileType(filename: string): FileType {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'pdf': return 'pdf';
      case 'docx':
      case 'doc': return 'docx';
      case 'xlsx':
      case 'xls': return 'xlsx';
      case 'csv': return 'csv';
      case 'txt': return 'txt';
      case 'json': return 'json';
      case 'html':
      case 'htm': return 'html';
      case 'eml':
      case 'msg': return 'email';
      default: return 'txt';
    }
  }

  /**
   * Add custom parser
   */
  addParser(parser: FileParser): void {
    this.parsers.push(parser);
  }

  /**
   * Add validation rule
   */
  addValidationRule(rule: ValidationRule): void {
    this.validator.addRule(rule);
  }
}

// Export singleton
export const dataIngestion = new DataIngestionService();

// Export classes for testing
export { DataIngestionService, DataValidator, Deduplicator };
export type { FileParser };
