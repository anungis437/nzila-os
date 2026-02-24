/**
 * SQL Injection Prevention Middleware
 * 
 * Prevents SQL injection attacks by:
 * - Detecting raw SQL template usage patterns
 * - Enforcing parameterized query requirements
 * - Validating ORM usage in routes
 * - Logging suspicious patterns
 * 
 * Usage:
 *   import { validateSafeQueries } from '@/lib/middleware/sql-injection-prevention';
 */

/**
 * Pattern detectors for common SQL injection attempts
 */
const INJECTION_PATTERNS = {
  // Raw SQL with template literals - matches: sql`...${}...`
  rawSqlTemplate: new RegExp('sql`[\\s\\S]*\\$\\{[\\s\\S]*\\}`', 'g'),
  
  // Raw SQL concatenation
  sqlConcatenation: /sql\s*\+|concatenating.*sql|query.*\+.*string/gi,
  
  // Comment-based injection attempts
  sqlComments: new RegExp('--\\s+|\\/\\*|\\*\\/|;.*-{2}|;.*\\/\\*', 'g'),
  
  // Union-based injection
  unionInjection: /union\s+(all\s+)?select/gi,
  
  // Common SQL functions in user input
  sqlFunctions: /exec\s*\(|execute\s*\(|xp_|sp_|drop\s+table|delete\s+from|insert\s+into|update\s+|truncate/gi,
};

/**
 * Analysis result for a request
 */
interface SQLAnalysisResult {
  isSafe: boolean;
  detectedPatterns: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

/**
 * SQL injection vulnerability scanner
 */
export class SQLInjectionScanner {
  /**
   * Scan request for potential SQL injection vulnerabilities
   */
  static scanRequest(body: unknown, query: unknown): SQLAnalysisResult {
    const detectedPatterns: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Convert to string for analysis
    const bodyStr = JSON.stringify(body || {});
    const queryStr = JSON.stringify(query || {});
    const combinedInput = `${bodyStr} ${queryStr}`;

    // Check for SQL injection patterns
    Object.entries(INJECTION_PATTERNS).forEach(([patternName, pattern]) => {
      if (pattern.test(combinedInput)) {
        detectedPatterns.push(patternName);
        
        // Escalate severity for different pattern types
        if (patternName === 'unionInjection' || patternName === 'sqlFunctions') {
          severity = 'critical';
        } else if (patternName === 'sqlConcatenation') {
          severity = 'high';
        } else if (patternName === 'sqlComments') {
          severity = 'medium';
        }
      }
    });

    const recommendations = this.getRecommendations(detectedPatterns);

    return {
      isSafe: detectedPatterns.length === 0,
      detectedPatterns,
      severity,
      recommendations,
    };
  }

  /**
   * Scan a single string value for SQL injection patterns
   * Used for checking IDs, parameters, etc.
   */
  static scanMethod(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    // Check for SQL injection patterns
    for (const [_patternName, pattern] of Object.entries(INJECTION_PATTERNS)) {
      if (pattern.test(value)) {
        return true; // Pattern detected
      }
    }

    // Check for suspicious characters that might indicate injection
    const suspiciousChars = /[';\"\\-]|--|\/\*|\*\/|union|select|drop|delete|insert|update|truncate/gi;
    return suspiciousChars.test(value);
  }

  /**
   * Get recommendations based on detected patterns
   */
  private static getRecommendations(patterns: string[]): string[] {
    const recommendations: string[] = [];

    if (patterns.includes('rawSqlTemplate')) {
      recommendations.push(
        'Use Drizzle ORM parameterized queries instead of raw sql`` templates'
      );
    }

    if (patterns.includes('sqlConcatenation')) {
      recommendations.push(
        'Never concatenate SQL strings. Use ORM methods or parameterized queries'
      );
    }

    if (patterns.includes('unionInjection') || patterns.includes('sqlFunctions')) {
      recommendations.push(
        'Input validation failed. Implement strict request validation with Zod schemas'
      );
    }

    if (patterns.includes('sqlComments')) {
      recommendations.push(
        'Sanitize user input to remove SQL comment characters'
      );
    }

    return recommendations;
  }

  /**
   * Validate that ORM is used correctly
   */
  static validateORMUsage(code: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for direct sql`` usage
    if (/sql`/.test(code) && /\$\{[^}]+\}/.test(code)) {
      issues.push('Raw SQL templates with interpolation detected - use parameterized queries');
    }

    // Check for query string concatenation
    if (/query.*\+|concatenate.*query/i.test(code)) {
      issues.push('SQL query concatenation detected - use ORM methods');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

/**
 * HTTP middleware for SQL injection prevention
 * 
 * Usage in route:
 *   export async function POST(request: Request) {
 *     const validation = validateSQLSafety(request.body, request.nextUrl.searchParams);
 *     if (!validation.isSafe) {
 *       return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
 *     }
 *     // ... continue processing
 *   }
 */
export function validateSQLSafety(body: unknown, query: unknown): SQLAnalysisResult {
  return SQLInjectionScanner.scanRequest(body, query);
}

/**
 * Audit logging for SQL injection attempts
 */
export interface SecurityAuditEvent {
  timestamp: Date;
  eventType: 'SQL_INJECTION_ATTEMPT' | 'SUSPICIOUS_QUERY' | 'SAFE_REQUEST';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedPatterns: string[];
  sourceIp?: string;
  userId?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
}

class SQLSecurityAuditLog {
  private static events: SecurityAuditEvent[] = [];
  private static readonly MAX_EVENTS = 10000;

  static logEvent(event: Omit<SecurityAuditEvent, 'timestamp'>): void {
    const auditEvent: SecurityAuditEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(auditEvent);

    // Keep log size manageable
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Log critical events immediately
    if (auditEvent.severity === 'critical') {
}
  }

  static getEvents(filter?: { severity?: string; eventType?: string }): SecurityAuditEvent[] {
    let filtered = this.events;

    if (filter?.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }

    if (filter?.eventType) {
      filtered = filtered.filter(e => e.eventType === filter.eventType);
    }

    return filtered;
  }

  static clear(): void {
    this.events = [];
  }
}

export { SQLSecurityAuditLog };

/**
 * Safe parameterized query helper
 * 
 * Provides type-safe wrapper around Drizzle ORM for required queries
 * 
 * Usage:
 *   import { db } from '@/db/db';
 *   import { executeParameterizedQuery } from '@/lib/middleware/sql-injection-prevention';
 *   
 *   const results = await executeParameterizedQuery(async () => {
 *     return db.select().from(users).where(eq(users.userId, userId)).execute();
 *   });
 */
export async function executeParameterizedQuery<T>(
  query: () => Promise<T>,
  context?: { endpoint?: string; userId?: string; sourceIp?: string }
): Promise<T> {
  try {
    const result = await query();
    
    // Log successful safe query
    SQLSecurityAuditLog.logEvent({
      eventType: 'SAFE_REQUEST',
      severity: 'low',
      detectedPatterns: [],
      ...context,
    });

    return result;
  } catch (error) {
throw error;
  }
}

/**
 * List of unsafe query patterns to audit in codebase
 * 
 * These patterns should be replaced with parameterized queries
 */
export const UNSAFE_PATTERNS_AUDIT = {
  description: 'SQL patterns that should be fixed to prevent injection',
  patterns: [
    {
      pattern: 'sql`...${}...`',
      issue: 'Raw SQL with template literal interpolation',
      replacement: 'Use Drizzle ORM methods or parameterized queries',
      severity: 'critical',
    },
    {
      pattern: 'query = query.concat(...)',
      issue: 'String concatenation of SQL queries',
      replacement: 'Use ORM builder methods',
      severity: 'critical',
    },
    {
      pattern: 'Database.raw(`SELECT * WHERE id = ${id}`)',
      issue: 'Raw queries with user input',
      replacement: 'Use parameterized queries with placeholders',
      severity: 'critical',
    },
    {
      pattern: 'eval(userInput)',
      issue: 'Dynamic code execution with user input',
      replacement: 'Never use eval, use safe JSON.parse or schema validation',
      severity: 'critical',
    },
  ],
};

/**
 * Vulnerability audit report generator
 * 
 * Generates report of SQL injection vulnerabilities in code
 */
export function generateVulnerabilityReport() {
  const report = {
    title: 'SQL Injection Prevention Report',
    generated: new Date().toISOString(),
    auditLog: SQLSecurityAuditLog.getEvents(),
    summary: {
      totalEvents: SQLSecurityAuditLog.getEvents().length,
      criticalAttempts: SQLSecurityAuditLog.getEvents({ severity: 'critical' }).length,
      highRiskPatterns: SQLSecurityAuditLog.getEvents({ severity: 'high' }).length,
    },
    recommendations: [
      'Audit 374 API routes for raw SQL template usage',
      'Replace all sql`...${}` patterns with ORM methods',
      'Implement request validation middleware on all endpoints',
      'Enable code scanning tools to detect SQL injection patterns',
      'Conduct security review of database query patterns',
    ],
  };

  return report;
}

