import { describe, it, expect } from 'vitest';
import {
  SQLInjectionScanner,
  SQLSecurityAuditLog,
  validateSQLSafety,
  executeParameterizedQuery,
  generateVulnerabilityReport,
  UNSAFE_PATTERNS_AUDIT,
} from '../sql-injection-prevention';

describe('SQLInjectionScanner.scanRequest', () => {
  it('reports safe for empty input', () => {
    const r = SQLInjectionScanner.scanRequest({}, {});
    expect(r.isSafe).toBe(true);
    expect(r.detectedPatterns).toHaveLength(0);
    expect(r.severity).toBe('low');
  });

  it('reports safe for normal data', () => {
    const r = SQLInjectionScanner.scanRequest(
      { name: 'Jane Doe', email: 'j@example.com' },
      { page: '1' }
    );
    expect(r.isSafe).toBe(true);
  });

  it('detects UNION SELECT injection', () => {
    const r = SQLInjectionScanner.scanRequest(
      { name: "' UNION SELECT * FROM users --" },
      {}
    );
    expect(r.isSafe).toBe(false);
    expect(r.detectedPatterns).toContain('unionInjection');
    expect(r.severity).toBe('critical');
  });

  it('detects SQL functions (DROP TABLE)', () => {
    const r = SQLInjectionScanner.scanRequest(
      { input: 'DROP TABLE members' },
      {}
    );
    expect(r.isSafe).toBe(false);
    expect(r.detectedPatterns).toContain('sqlFunctions');
    expect(r.severity).toBe('critical');
  });

  it('detects SQL comments', () => {
    const r = SQLInjectionScanner.scanRequest(
      {},
      { id: '1; -- comment' }
    );
    expect(r.isSafe).toBe(false);
    expect(r.detectedPatterns).toContain('sqlComments');
  });

  it('detects SQL concatenation pattern (high severity)', () => {
    const r = SQLInjectionScanner.scanRequest(
      { code: 'sql + userInput' },
      {}
    );
    expect(r.isSafe).toBe(false);
    expect(r.detectedPatterns).toContain('sqlConcatenation');
    expect(r.severity).toBe('high');
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  it('provides recommendations for detected patterns', () => {
    const r = SQLInjectionScanner.scanRequest(
      { q: "' UNION ALL SELECT 1,2,3 --" },
      {}
    );
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  it('handles null body/query gracefully', () => {
    const r = SQLInjectionScanner.scanRequest(null, null);
    expect(r.isSafe).toBe(true);
  });
});

describe('SQLInjectionScanner.scanMethod', () => {
  it('returns false for safe values', () => {
    expect(SQLInjectionScanner.scanMethod('hello world 123')).toBe(false);
  });

  it('returns false for empty/undefined', () => {
    expect(SQLInjectionScanner.scanMethod('')).toBe(false);
    expect(SQLInjectionScanner.scanMethod(undefined as any as string)).toBe(false);
  });

  it('detects suspicious characters', () => {
    expect(SQLInjectionScanner.scanMethod("'; DROP TABLE users;--")).toBe(true);
  });

  it('detects UNION SELECT', () => {
    expect(SQLInjectionScanner.scanMethod("1 UNION SELECT * FROM users")).toBe(true);
  });
});

describe('SQLInjectionScanner.validateORMUsage', () => {
  it('valid for clean ORM code', () => {
    const r = SQLInjectionScanner.validateORMUsage(
      'db.select().from(users).where(eq(users.id, userId))'
    );
    expect(r.isValid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it('detects raw sql template with interpolation', () => {
    const code = 'sql`SELECT * FROM users WHERE id = ${userId}`';
    const r = SQLInjectionScanner.validateORMUsage(code);
    expect(r.isValid).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });
  it('detects query string concatenation', () => {
    const code = 'const result = query + someVariable';
    const r = SQLInjectionScanner.validateORMUsage(code);
    expect(r.isValid).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });
});

describe('validateSQLSafety', () => {
  it('delegates to scanRequest', () => {
    const r = validateSQLSafety({ name: 'ok' }, {});
    expect(r.isSafe).toBe(true);
  });
});

describe('executeParameterizedQuery', () => {
  it('returns query result', async () => {
    const result = await executeParameterizedQuery(async () => [{ id: 1 }]);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('re-throws query errors', async () => {
    await expect(
      executeParameterizedQuery(async () => { throw new Error('db error'); })
    ).rejects.toThrow('db error');
  });
});

describe('SQLSecurityAuditLog', () => {
  it('logs and retrieves events', () => {
    SQLSecurityAuditLog.clear();
    SQLSecurityAuditLog.logEvent({
      eventType: 'SQL_INJECTION_ATTEMPT',
      severity: 'critical',
      detectedPatterns: ['unionInjection'],
      userId: 'u1',
    });
    const events = SQLSecurityAuditLog.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('SQL_INJECTION_ATTEMPT');
  });

  it('filters by severity', () => {
    SQLSecurityAuditLog.clear();
    SQLSecurityAuditLog.logEvent({ eventType: 'SAFE_REQUEST', severity: 'low', detectedPatterns: [] });
    SQLSecurityAuditLog.logEvent({ eventType: 'SQL_INJECTION_ATTEMPT', severity: 'critical', detectedPatterns: ['x'] });
    expect(SQLSecurityAuditLog.getEvents({ severity: 'critical' }).length).toBe(1);
    expect(SQLSecurityAuditLog.getEvents({ severity: 'low' }).length).toBe(1);
  });

  it('filters by eventType', () => {
    SQLSecurityAuditLog.clear();
    SQLSecurityAuditLog.logEvent({ eventType: 'SAFE_REQUEST', severity: 'low', detectedPatterns: [] });
    expect(SQLSecurityAuditLog.getEvents({ eventType: 'SAFE_REQUEST' }).length).toBe(1);
  });

  it('trims events beyond MAX_EVENTS', () => {
    SQLSecurityAuditLog.clear();
    // Fill past 10000 limit
    for (let i = 0; i < 10002; i++) {
      SQLSecurityAuditLog.logEvent({ eventType: 'SAFE_REQUEST', severity: 'low', detectedPatterns: [] });
    }
    const events = SQLSecurityAuditLog.getEvents();
    expect(events.length).toBeLessThanOrEqual(10000);
  });

  it('clears all events', () => {
    SQLSecurityAuditLog.logEvent({ eventType: 'SAFE_REQUEST', severity: 'low', detectedPatterns: [] });
    SQLSecurityAuditLog.clear();
    expect(SQLSecurityAuditLog.getEvents().length).toBe(0);
  });
});

describe('generateVulnerabilityReport', () => {
  it('returns structured report', () => {
    SQLSecurityAuditLog.clear();
    const report = generateVulnerabilityReport();
    expect(report.title).toBe('SQL Injection Prevention Report');
    expect(report.generated).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.recommendations).toBeInstanceOf(Array);
  });
});

describe('UNSAFE_PATTERNS_AUDIT', () => {
  it('contains pattern audit entries', () => {
    expect(UNSAFE_PATTERNS_AUDIT.patterns.length).toBeGreaterThan(0);
    expect(UNSAFE_PATTERNS_AUDIT.patterns[0]).toHaveProperty('pattern');
    expect(UNSAFE_PATTERNS_AUDIT.patterns[0]).toHaveProperty('severity');
  });
});
