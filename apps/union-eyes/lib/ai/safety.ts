/**
 * AI Safety Layer
 * 
 * Provides prompt injection detection, output content filtering,
 * and PII detection for secure AI operations
 */


// Pattern-based injection detection patterns
const INJECTION_PATTERNS = [
  // Prompt injection attempts
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|commands?)/i,
  /forget\s+(everything|all|your)\s+(instructions?|rules?|training)/i,
  /disregard\s+(your|all)\s+(safety|ethical|guidelines?)/i,
  /new\s+instructions?/i,
  /system\s*:\s*/i,
  /assistant\s*:/i,
  /human\s*:/i,
  /you\s+are\s+(now|no\s+longer)/i,
  
  // Jailbreak patterns
  /DAN\s+mode/i,
  /do\s+anything\s+now/i,
  /developer\s+mode/i,
  /jailbreak/i,
  
  // Role playing to bypass
  /pretend\s+to\s+be/i,
  /act\s+as\s+if/i,
  /imagine\s+you\s+are/i,
  /roleplay/i,
  
  // Code/format injection
  /```\s*(system|prompt|override)/i,
  /<\/?(system|instructions)>/i,
  
  // Manipulation
  /as\s+an\s+AI/i,
  /you\s+can\s+say/i,
  /there\s+are\s+no\s+restrictions/i,
];

// PII patterns
const PII_PATTERNS = {
  // Social Insurance Number (Canada)
  sin: /\b\d{3}-\d{3}-\d{3}\b|\b\d{9}\b/g,
  
  // Credit Card
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  
  // Email
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone (various formats)
  phone: /\b(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  
  // Date of Birth
  dob: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g,
  
  // Postal code (Canada)
  postalCode: /\b[A-Z]\d[A-Z][\s.-]?\d[A-Z]\d\b/gi,
  
  // Provincial Health Numbers
  healthNumber: /\b\d{10,12}\b/g,
};

// Sensitive keywords that should be filtered/redacted
const SENSITIVE_KEYWORDS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'private_key',
  'credential',
  'ssn',
  'sin',
  'credit card',
  'cvv',
  'bank account',
  'routing number',
];

// Blocked topics for union-specific context
const BLOCKED_TOPICS = [
  'how to terminate an employee',
  'how to fire someone',
  'union busting',
  'how to break a strike',
  'illegal termination',
];

export interface SafetyCheckResult {
  safe: boolean;
  flags: SafetyFlag[];
  sanitizedInput?: string;
  sanitizedOutput?: string;
}

export interface SafetyFlag {
  type: 'injection' | 'pii' | 'sensitive' | 'blocked' | 'length';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  match?: string;
  position?: { start: number; end: number };
}

export interface ContentFilterConfig {
  detectPII: boolean;
  detectInjection: boolean;
  detectSensitive: boolean;
  blockTopics: boolean;
  maxLength: number;
  redactPII: boolean;
}

/**
 * AI Safety Service
 */
class AISafetyService {
  private config: ContentFilterConfig;
  private customPatterns: RegExp[] = [];

  constructor(config: Partial<ContentFilterConfig> = {}) {
    this.config = {
      detectPII: config.detectPII ?? true,
      detectInjection: config.detectInjection ?? true,
      detectSensitive: config.detectSensitive ?? true,
      blockTopics: config.blockTopics ?? true,
      maxLength: config.maxLength ?? 10000,
      redactPII: config.redactPII ?? true,
    };
  }

  /**
   * Check input for safety issues
   */
  checkInput(input: string): SafetyCheckResult {
    const flags: SafetyFlag[] = [];
    let sanitizedInput = input;

    // Check length
    if (input.length > this.config.maxLength) {
      flags.push({
        type: 'length',
        severity: 'medium',
        description: `Input exceeds maximum length of ${this.config.maxLength} characters`,
        match: input.substring(0, 100) + '...',
      });
    }

    // Check for prompt injection
    if (this.config.detectInjection) {
      const injectionFlags = this.checkInjection(input);
      flags.push(...injectionFlags);
    }

    // Check for sensitive content
    if (this.config.detectSensitive) {
      const sensitiveFlags = this.checkSensitive(input);
      flags.push(...sensitiveFlags);
    }

    // Check blocked topics
    if (this.config.blockTopics) {
      const blockedFlags = this.checkBlockedTopics(input);
      flags.push(...blockedFlags);
    }

    // Detect and optionally redact PII
    if (this.config.detectPII) {
      const piiFlags = this.checkPII(input, this.config.redactPII);
      if (this.config.redactPII) {
        sanitizedInput = piiFlags.sanitized || input;
      }
      flags.push(...piiFlags.flags);
    }

    const hasHighSeverity = flags.some(f => f.severity === 'high' || f.severity === 'critical');

    return {
      safe: !hasHighSeverity,
      flags,
      sanitizedInput: this.config.redactPII ? sanitizedInput : undefined,
    };
  }

  /**
   * Check output for safety issues
   */
  checkOutput(output: string): SafetyCheckResult {
    const flags: SafetyFlag[] = [];
    let sanitizedOutput = output;

    // Detect PII in output
    if (this.config.detectPII) {
      const piiFlags = this.checkPII(output, this.config.redactPII);
      if (this.config.redactPII) {
        sanitizedOutput = piiFlags.sanitized || output;
      }
      flags.push(...piiFlags.flags);
    }

    // Check for sensitive content in output
    if (this.config.detectSensitive) {
      const sensitiveFlags = this.checkSensitive(output);
      flags.push(...sensitiveFlags);
    }

    const hasHighSeverity = flags.some(f => f.severity === 'high' || f.severity === 'critical');

    return {
      safe: !hasHighSeverity,
      flags,
      sanitizedOutput: this.config.redactPII ? sanitizedOutput : undefined,
    };
  }

  /**
   * Check for prompt injection attempts
   */
  private checkInjection(input: string): SafetyFlag[] {
    const flags: SafetyFlag[] = [];

    for (const pattern of INJECTION_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        flags.push({
          type: 'injection',
          severity: 'critical',
          description: 'Potential prompt injection detected',
          match: match[0],
          position: this.getMatchPosition(input, match[0]),
        });
      }
    }

    // Check custom patterns
    for (const pattern of this.customPatterns) {
      const match = input.match(pattern);
      if (match) {
        flags.push({
          type: 'injection',
          severity: 'high',
          description: 'Custom injection pattern detected',
          match: match[0],
        });
      }
    }

    return flags;
  }

  /**
   * Check for sensitive keywords
   */
  private checkSensitive(input: string): SafetyFlag[] {
    const flags: SafetyFlag[] = [];
    const lowerInput = input.toLowerCase();

    for (const keyword of SENSITIVE_KEYWORDS) {
      if (lowerInput.includes(keyword)) {
        // Don&apos;t flag if it&apos;s a general discussion about security
        if (!lowerInput.includes('how to protect') && !lowerInput.includes('best practices')) {
          flags.push({
            type: 'sensitive',
            severity: 'medium',
            description: `Potentially sensitive keyword detected: ${keyword}`,
            match: keyword,
          });
        }
      }
    }

    return flags;
  }

  /**
   * Check for blocked topics
   */
  private checkBlockedTopics(input: string): SafetyFlag[] {
    const flags: SafetyFlag[] = [];
    const lowerInput = input.toLowerCase();

    for (const topic of BLOCKED_TOPICS) {
      if (lowerInput.includes(topic.toLowerCase())) {
        flags.push({
          type: 'blocked',
          severity: 'high',
          description: `Blocked topic detected: ${topic}`,
          match: topic,
        });
      }
    }

    return flags;
  }

  /**
   * Check for PII
   */
  private checkPII(input: string, redact: boolean): { flags: SafetyFlag[]; sanitized?: string } {
    const flags: SafetyFlag[] = [];
    let sanitized = input;

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = input.match(pattern);
      if (matches) {
        for (const match of matches) {
          flags.push({
            type: 'pii',
            severity: 'high',
            description: `Potential ${type} detected`,
            match: redact ? this.redactPII(match, type) : match,
          });
        }

        if (redact) {
          sanitized = sanitized.replace(pattern, (match) => this.redactPII(match, type));
        }
      }
    }

    return { flags, sanitized };
  }

  /**
   * Redact PII based on type
   */
  private redactPII(match: string, type: string): string {
    switch (type) {
      case 'sin':
      case 'creditCard':
      case 'healthNumber':
        return '*'.repeat(match.length);
      case 'email':
        const [local, domain] = match.split('@');
        return `${local?.[0] || '*'}***@${domain}`;
      case 'phone':
        return '***-***-****';
      case 'postalCode':
        return match[0] + '***' + match[match.length - 1];
      default:
        return '***';
    }
  }

  /**
   * Get match position
   */
  private getMatchPosition(input: string, match: string): { start: number; end: number } | undefined {
    const index = input.indexOf(match);
    if (index === -1) return undefined;
    return { start: index, end: index + match.length };
  }

  /**
   * Add custom injection pattern
   */
  addCustomPattern(pattern: RegExp): void {
    this.customPatterns.push(pattern);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContentFilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config
   */
  getConfig(): ContentFilterConfig {
    return { ...this.config };
  }
}

// Export singleton
export const aiSafety = new AISafetyService();

// Export class for testing
export { AISafetyService };
