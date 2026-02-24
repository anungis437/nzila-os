/**
 * Union-Specific Entity Extraction (NER)
 * 
 * Extracts union-relevant entities from text:
 * - Members (names, IDs, contact info)
 * - Employers (company names, locations)
 * - Claims (amounts, dates, types)
 * - Contracts (dates, terms)
 * - Grievances (issues, outcomes)
 * - Legal references
 */

import { logger } from '@/lib/logger';

// Entity types specific to union domain
export type UnionEntityType = 
  | 'MEMBER'
  | 'EMPLOYER'
  | 'WORKSITE'
  | 'CLAIM'
  | 'CONTRACT'
  | 'GRIEVANCE'
  | 'COMMITTEE'
  | 'OFFICER'
  | 'LEGAL_REFERENCE'
  | 'DATE'
  | 'MONEY'
  | 'JURISDICTION';

export interface ExtractedEntity {
  id: string;
  type: UnionEntityType;
  value: string;
  normalizedValue?: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  metadata: Record<string, unknown>;
  relationships: EntityRelationship[];
}

export interface EntityRelationship {
  targetId: string;
  type: 'works_for' | 'filed_by' | 'belongs_to' | 'references' | 'covers_period';
  confidence: number;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: EntityRelationship[];
  documentType: 'member_record' | 'claim' | 'contract' | 'grievance' | 'meeting_minutes' | 'unknown';
  confidence: number;
}

// Regex patterns for union entities
const PATTERNS = {
  // Canadian SIN (9 digits with dashes)
  SIN: /\b\d{3}-\d{3}-\d{3}\b/g,
  
  // Phone numbers (various formats)
  PHONE: /\b(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  
  // Email
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Money amounts
  MONEY: /\$[\d,]+(\.\d{2})?/g,
  
  // Dates (various formats)
  DATE: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g,
  
  // Canadian postal code
  POSTAL_CODE: /\b[A-Z]\d[A-Z][\s.-]?\d[A-Z]\d\b/gi,
  
  // Province codes
  PROVINCE: /\b(ON|QC|BC|AB|MB|NB|NL|NS|PE|SK|NT|YU|NU)\b/gi,
  
  // Contract numbers
  CONTRACT_NO: /\b(CBA|LA|contract)[\s.#]*\d{2,}[-\d]*\b/gi,
  
  // Claim numbers  
  CLAIM_NO: /\b(claim|CL)[\s.#]*\d{4,}\b/gi,
  
  // Grievance numbers
  GRIEVANCE_NO: /\b(GRV|grievance)[\s.#]*\d{3,}\b/gi,
  
  // Membership numbers
  MEMBER_NO: /\b(member|mem)[\s.#]*\d{4,}\b/gi,
};

// Union-specific keywords for context
const ENTITY_KEYWORDS = {
  MEMBER: ['member', 'employee', 'worker', 'staff', 'personnel'],
  EMPLOYER: ['employer', 'company', 'corporation', 'business', 'organization'],
  WORKSITE: ['worksite', 'location', 'facility', 'branch', 'office'],
  CLAIM: ['claim', 'benefit', 'expense', 'reimbursement'],
  CONTRACT: ['contract', 'agreement', 'cba', 'collective agreement', 'la'],
  GRIEVANCE: ['grievance', 'complaint', 'dispute', 'issue'],
  COMMITTEE: ['committee', 'executive', 'board', 'council'],
  OFFICER: ['president', 'vice president', 'secretary', 'treasurer', 'steward', 'chief'],
};

/**
 * Entity Extraction Service
 */
class EntityExtractionService {
  private customPatterns: Map<UnionEntityType, RegExp[]> = new Map();

  /**
   * Extract entities from text
   */
  extract(text: string, context?: { documentType?: string; jurisdiction?: string }): ExtractionResult {
    const entities: ExtractedEntity[] = [];
    const relationships: EntityRelationship[] = [];
    
    // Extract by pattern
    entities.push(...this.extractByPattern(text));
    
    // Extract by context keywords
    entities.push(...this.extractByContext(text));
    
    // Extract relationships
    const rels = this.extractRelationships(entities);
    relationships.push(...rels);
    
    // Determine document type
    const docType = this.detectDocumentType(text, context);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(entities, text);

    // Deduplicate entities
    const uniqueEntities = this.deduplicate(entities);

    logger.info('Entity extraction complete', {
      entityCount: uniqueEntities.length,
      relationshipCount: relationships.length,
      documentType: docType,
    });

    return {
      entities: uniqueEntities,
      relationships,
      documentType: docType,
      confidence,
    };
  }

  /**
   * Extract entities by regex patterns
   */
  private extractByPattern(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // SIN
    let match;
    while ((match = PATTERNS.SIN.exec(text)) !== null) {
      entities.push(this.createEntity('MEMBER', match[0], match.index, {
        type: 'government_id',
        category: 'sin',
      }));
    }

    // Phone
    while ((match = PATTERNS.PHONE.exec(text)) !== null) {
      entities.push(this.createEntity('MEMBER', match[0], match.index, {
        type: 'contact',
        category: 'phone',
      }));
    }

    // Email
    while ((match = PATTERNS.EMAIL.exec(text)) !== null) {
      entities.push(this.createEntity('MEMBER', match[0], match.index, {
        type: 'contact',
        category: 'email',
      }));
    }

    // Money
    while ((match = PATTERNS.MONEY.exec(text)) !== null) {
      const amount = parseFloat(match[0].replace(/[$,]/g, ''));
      entities.push(this.createEntity('MONEY', match[0], match.index, {
        amount,
        currency: 'CAD',
      }));
    }

    // Dates
    while ((match = PATTERNS.DATE.exec(text)) !== null) {
      entities.push(this.createEntity('DATE', match[0], match.index, {
        original: match[0],
      }));
    }

    // Jurisdiction (Province)
    while ((match = PATTERNS.PROVINCE.exec(text)) !== null) {
      entities.push(this.createEntity('JURISDICTION', match[0].toUpperCase(), match.index, {
        type: 'province',
      }));
    }

    // Contract numbers
    while ((match = PATTERNS.CONTRACT_NO.exec(text)) !== null) {
      entities.push(this.createEntity('CONTRACT', match[0], match.index, {
        type: 'contract_number',
      }));
    }

    // Claim numbers
    while ((match = PATTERNS.CLAIM_NO.exec(text)) !== null) {
      entities.push(this.createEntity('CLAIM', match[0], match.index, {
        type: 'claim_number',
      }));
    }

    // Grievance numbers
    while ((match = PATTERNS.GRIEVANCE_NO.exec(text)) !== null) {
      entities.push(this.createEntity('GRIEVANCE', match[0], match.index, {
        type: 'grievance_number',
      }));
    }

    // Member numbers
    while ((match = PATTERNS.MEMBER_NO.exec(text)) !== null) {
      entities.push(this.createEntity('MEMBER', match[0], match.index, {
        type: 'member_number',
      }));
    }

    return entities;
  }

  /**
   * Extract entities by context keywords
   */
  private extractByContext(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const _lowerText = text.toLowerCase();

    for (const [entityType, keywords] of Object.entries(ENTITY_KEYWORDS)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}[\\s]+([A-Z][\\w\\s]{2,30})`, 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          // Skip if already captured by pattern
          const captured = match[1].trim();
          if (captured.length < 3) continue;
          
          entities.push(this.createEntity(
            entityType as UnionEntityType,
            captured,
            match.index + match[0].indexOf(captured),
            {
              type: 'name_extracted',
              keyword,
            },
            0.6 // Lower confidence for context extraction
          ));
        }
      }
    }

    return entities;
  }

  /**
   * Extract relationships between entities
   */
  private extractRelationships(entities: ExtractedEntity[]): EntityRelationship[] {
    const relationships: EntityRelationship[] = [];

    // Find member-claim relationships
    const members = entities.filter(e => e.type === 'MEMBER');
    const claims = entities.filter(e => e.type === 'CLAIM');

    for (const member of members) {
      for (const claim of claims) {
        // If member appears before claim in text, likely filed by member
        if (member.endIndex < claim.startIndex) {
          relationships.push({
            targetId: claim.id,
            type: 'filed_by',
            confidence: 0.5,
          });
        }
      }
    }

    // Find employer-worksite relationships
    const employers = entities.filter(e => e.type === 'EMPLOYER');
    const worksites = entities.filter(e => e.type === 'WORKSITE');

    for (const employer of employers) {
      for (const worksite of worksites) {
        if (Math.abs(employer.startIndex - worksite.startIndex) < 200) {
          relationships.push({
            targetId: worksite.id,
            type: 'works_for',
            confidence: 0.6,
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Detect document type
   */
  private detectDocumentType(text: string, context?: { documentType?: string }): ExtractionResult['documentType'] {
    if (context?.documentType) {
      return context.documentType as ExtractionResult['documentType'];
    }

    const lower = text.toLowerCase();

    if (lower.includes('grievance') || lower.includes('filed under')) {
      return 'grievance';
    }
    if (lower.includes('claim') || lower.includes('benefit')) {
      return 'claim';
    }
    if (lower.includes('contract') || lower.includes('collective agreement')) {
      return 'contract';
    }
    if (lower.includes('member') && (lower.includes('dues') || lower.includes('status'))) {
      return 'member_record';
    }
    if (lower.includes('minutes') || lower.includes('meeting')) {
      return 'meeting_minutes';
    }

    return 'unknown';
  }

  /**
   * Calculate extraction confidence
   */
  private calculateConfidence(entities: ExtractedEntity[], text: string): number {
    if (entities.length === 0) return 0;
    
    const avgConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
    const density = entities.length / (text.length / 100); // entities per 100 chars
    
    // Boost for having multiple entity types
    const types = new Set(entities.map(e => e.type)).size;
    const typeBonus = Math.min(types * 0.05, 0.2);
    
    return Math.min(1, avgConfidence * (1 + density * 0.1) + typeBonus);
  }

  /**
   * Create entity
   */
  private createEntity(
    type: UnionEntityType,
    value: string,
    index: number,
    metadata: Record<string, unknown>,
    confidence: number = 0.8
  ): ExtractedEntity {
    return {
      id: `${type}-${index}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      value,
      normalizedValue: value.toUpperCase().trim(),
      confidence,
      startIndex: index,
      endIndex: index + value.length,
      metadata,
      relationships: [],
    };
  }

  /**
   * Deduplicate entities
   */
  private deduplicate(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Map<string, ExtractedEntity>();
    
    for (const entity of entities) {
      const key = `${entity.type}:${entity.normalizedValue}`;
      
      if (!seen.has(key) || seen.get(key)!.confidence < entity.confidence) {
        seen.set(key, entity);
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Add custom pattern
   */
  addPattern(type: UnionEntityType, pattern: RegExp): void {
    if (!this.customPatterns.has(type)) {
      this.customPatterns.set(type, []);
    }
    this.customPatterns.get(type)!.push(pattern);
  }
}

// Export singleton
export const entityExtraction = new EntityExtractionService();

// Export class
export { EntityExtractionService };
