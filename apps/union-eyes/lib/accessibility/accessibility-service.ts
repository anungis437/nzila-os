/**
 * Accessibility Audit Service
 * 
 * WCAG 2.2 AA compliance testing
 * Automated and manual audit workflows
 * Integration with axe-core, Pa11y, Lighthouse
 */

import { db } from "@/db";
import {
  accessibilityAudits,
  accessibilityIssues,
  type NewAccessibilityIssue,
  type AccessibilityAudit,
  type AccessibilityIssue,
} from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

/**
 * Accessibility Audit Manager
 */
export class AccessibilityAuditManager {
  /**
   * Create a new audit
   */
  async createAudit(data: {
    organizationId: string;
    auditName: string;
    auditType: "automated" | "manual" | "hybrid";
    targetUrl: string;
    targetEnvironment: string;
    wcagVersion?: string;
    conformanceLevel?: "A" | "AA" | "AAA";
    toolsUsed?: Array<{ name: string; version: string; config?: unknown }>;
    scheduledBy?: string;
    triggeredBy?: string;
  }): Promise<AccessibilityAudit> {
    const [audit] = await db
      .insert(accessibilityAudits)
      .values({
        ...data,
        conformanceLevel: data.conformanceLevel || "AA",
        status: "pending",
        startedAt: new Date(),
      })
      .returning();
    
    return audit;
  }
  
  /**
   * Run automated audit using axe-core
   */
  async runAutomatedAudit(auditId: string): Promise<void> {
    // Update status
    await db
      .update(accessibilityAudits)
      .set({ status: "in_progress" })
      .where(eq(accessibilityAudits.id, auditId));
    
    const audit = await db
      .select()
      .from(accessibilityAudits)
      .where(eq(accessibilityAudits.id, auditId))
      .limit(1);
    
    if (!audit[0]) {
      throw new Error("Audit not found");
    }
    
    try {
      // Run axe-core scan (this is a placeholder - actual implementation would use Playwright/Puppeteer)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scanResults = await this.runAxeScan(audit[0].targetUrl) as any;
      
      // Process and save issues
      const issues: NewAccessibilityIssue[] = scanResults.violations.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (violation: any) => ({
          auditId,
          organizationId: audit[0].organizationId,
          issueTitle: violation.description,
          issueDescription: violation.help,
          severity: this.mapAxeSeverityToOurs(violation.impact),
          wcagCriteria: violation.tags
            .find((t: string) => t.startsWith("wcag"))
            ?.replace("wcag", "")
            .replace(/([a-z])(\d)/gi, "$1.$2") || "unknown",
          wcagLevel: this.extractWCAGLevel(violation.tags) as unknown,
          wcagTitle: violation.description,
          wcagUrl: violation.helpUrl,
          pageUrl: audit[0].targetUrl,
          elementSelector: violation.nodes[0]?.target.join(" > ") || "",
          elementHtml: violation.nodes[0]?.html || "",
          fixSuggestion: violation.nodes[0]?.failureSummary,
          status: "open",
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        })
      );
      
      // Save issues
      if (issues.length > 0) {
        await db.insert(accessibilityIssues).values(issues);
      }
      
      // Calculate summary
      const summary = this.calculateIssueSummary(issues);
      
      // Update audit with results
      await db
        .update(accessibilityAudits)
        .set({
          status: "completed",
          totalIssues: summary.total,
          criticalIssues: summary.critical,
          seriousIssues: summary.serious,
          moderateIssues: summary.moderate,
          minorIssues: summary.minor,
          accessibilityScore: this.calculateAccessibilityScore(summary),
          pagesScanned: 1,
          completedAt: new Date(),
        })
        .where(eq(accessibilityAudits.id, auditId));
    } catch (error) {
      await db
        .update(accessibilityAudits)
        .set({
          status: "failed",
          completedAt: new Date(),
        })
        .where(eq(accessibilityAudits.id, auditId));
      
      throw error;
    }
  }
  
  /**
   * Run axe-core scan (placeholder - implement with Playwright)
   */
  private async runAxeScan(_url: string): Promise<unknown> {
    // This is a placeholder. In production, you would:
    // 1. Launch Playwright/Puppeteer browser
    // 2. Navigate to URL
    // 3. Inject axe-core
    // 4. Run axe.run()
    // 5. Return results
    
    // For now, return mock data
    return {
      violations: [
        {
          id: "color-contrast",
          impact: "serious",
          tags: ["wcag2aa", "wcag143"],
          description: "Elements must have sufficient color contrast",
          help: "Ensure text has sufficient contrast against background",
          helpUrl: "https://dequeuniversity.com/rules/axe/4.7/color-contrast",
          nodes: [
            {
              target: ["button.primary"],
              html: '<button class="primary">Submit</button>',
              failureSummary:
                "Fix by ensuring contrast ratio is at least 4.5:1",
            },
          ],
        },
      ],
    };
  }
  
  /**
   * Get audit results
   */
  async getAudit(
    auditId: string
  ): Promise<{ audit: AccessibilityAudit; issues: AccessibilityIssue[] }> {
    const [audit] = await db
      .select()
      .from(accessibilityAudits)
      .where(eq(accessibilityAudits.id, auditId))
      .limit(1);
    
    if (!audit) {
      throw new Error("Audit not found");
    }
    
    const issues = await db
      .select()
      .from(accessibilityIssues)
      .where(eq(accessibilityIssues.auditId, auditId))
      .orderBy(desc(accessibilityIssues.severity));
    
    return { audit, issues };
  }
  
  /**
   * Get open issues for organization
   */
  async getOpenIssues(
    organizationId: string,
    options: {
      severity?: string[];
      wcagCriteria?: string;
      status?: string;
      limit?: number;
    } = {}
  ): Promise<AccessibilityIssue[]> {
    let query = db
      .select()
      .from(accessibilityIssues)
      .where(eq(accessibilityIssues.organizationId, organizationId))
      .$dynamic();
    
    if (options.severity && options.severity.length > 0) {
      query = query.where(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inArray(accessibilityIssues.severity as any, options.severity)
      );
    }
    
    if (options.wcagCriteria) {
      query = query.where(
        eq(accessibilityIssues.wcagCriteria, options.wcagCriteria)
      );
    }
    
    if (options.status) {
      query = query.where(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(accessibilityIssues.status as any, options.status)
      );
    }
    
    query = query.orderBy(desc(accessibilityIssues.severity));
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    return query;
  }
  
  /**
   * Resolve issue
   */
  async resolveIssue(
    issueId: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<void> {
    await db
      .update(accessibilityIssues)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes,
        updatedAt: new Date(),
      })
      .where(eq(accessibilityIssues.id, issueId));
  }
  
  /**
   * Helper: Map axe severity to our severity
   */
  private mapAxeSeverityToOurs(
    axeSeverity: string
  ): "critical" | "serious" | "moderate" | "minor" {
    const mapping: Record<string, "critical" | "serious" | "moderate" | "minor"> = {
      critical: "critical",
      serious: "serious",
      moderate: "moderate",
      minor: "minor",
    };
    
    return mapping[axeSeverity] || "moderate";
  }
  
  /**
   * Helper: Extract WCAG level from tags
   */
  private extractWCAGLevel(tags: string[]): "A" | "AA" | "AAA" {
    if (tags.includes("wcag2aaa") || tags.includes("wcag21aaa")) return "AAA";
    if (tags.includes("wcag2aa") || tags.includes("wcag21aa")) return "AA";
    return "A";
  }
  
  /**
   * Helper: Calculate issue summary
   */
  private calculateIssueSummary(issues: NewAccessibilityIssue[]): {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  } {
    return {
      total: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      serious: issues.filter((i) => i.severity === "serious").length,
      moderate: issues.filter((i) => i.severity === "moderate").length,
      minor: issues.filter((i) => i.severity === "minor").length,
    };
  }
  
  /**
   * Helper: Calculate accessibility score (0-100)
   */
  private calculateAccessibilityScore(summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  }): number {
    // Weight different severities
    const deductions =
      summary.critical * 10 +
      summary.serious * 5 +
      summary.moderate * 2 +
      summary.minor * 0.5;
    
    const score = Math.max(0, 100 - deductions);
    return Math.round(score);
  }
}

/**
 * WCAG Checker
 * Check specific WCAG criteria
 */
export class WCAGChecker {
  /**
   * Check color contrast (WCAG 1.4.3)
   */
  checkColorContrast(
    foreground: string,
    background: string,
    fontSize: number,
    isBold: boolean
  ): {
    passes: boolean;
    ratio: number;
    requiredRatio: number;
    level: "AA" | "AAA" | "fail";
  } {
    const ratio = this.calculateContrastRatio(foreground, background);
    
    // Large text (18pt+ or 14pt+ bold) requires 3:1, normal text requires 4.5:1
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);
    const requiredRatio = isLargeText ? 3.0 : 4.5;
    const requiredRatioAAA = isLargeText ? 4.5 : 7.0;
    
    let level: "AA" | "AAA" | "fail" = "fail";
    if (ratio >= requiredRatioAAA) level = "AAA";
    else if (ratio >= requiredRatio) level = "AA";
    
    return {
      passes: ratio >= requiredRatio,
      ratio: Math.round(ratio * 100) / 100,
      requiredRatio,
      level,
    };
  }
  
  /**
   * Calculate contrast ratio
   */
  private calculateContrastRatio(
    foreground: string,
    background: string
  ): number {
    const l1 = this.getRelativeLuminance(foreground);
    const l2 = this.getRelativeLuminance(background);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }
  
  /**
   * Get relative luminance
   */
  private getRelativeLuminance(hex: string): number {
    // Remove #
    hex = hex.replace("#", "");
    
    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    // Apply gamma correction
    const [rLin, gLin, bLin] = [r, g, b].map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    
    // Calculate luminance
    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  }
  
  /**
   * Check keyboard accessibility (WCAG 2.1.1)
   */
  checkKeyboardAccessibility(element: {
    tagName: string;
    tabIndex?: number;
    role?: string;
    hasOnClick: boolean;
  }): {
    passes: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check if interactive element
    const interactiveTags = ["button", "a", "input", "select", "textarea"];
    const interactiveRoles = [
      "button",
      "link",
      "textbox",
      "combobox",
      "checkbox",
    ];
    
    const isInteractive =
      interactiveTags.includes(element.tagName.toLowerCase()) ||
      (element.role && interactiveRoles.includes(element.role)) ||
      element.hasOnClick;
    
    if (isInteractive) {
      // Check if keyboard accessible
      if (element.tabIndex === -1) {
        issues.push("Element is not keyboard accessible (tabIndex=-1)");
        recommendations.push("Remove tabIndex=-1 or add keyboard event handlers");
      }
      
      if (
        element.hasOnClick &&
        !interactiveTags.includes(element.tagName.toLowerCase())
      ) {
        issues.push(
          "onClick on non-interactive element without keyboard handler"
        );
        recommendations.push(
          "Add onKeyDown handler or use button/a element instead"
        );
      }
    }
    
    return {
      passes: issues.length === 0,
      issues,
      recommendations,
    };
  }
  
  /**
   * Check alt text (WCAG 1.1.1)
   */
  checkAltText(element: {
    tagName: string;
    alt?: string;
    role?: string;
    ariaLabel?: string;
    ariaLabelledBy?: string;
  }): {
    passes: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (element.tagName.toLowerCase() === "img") {
      if (!element.alt && !element.ariaLabel && !element.ariaLabelledBy) {
        issues.push("Image missing alt text");
        recommendations.push("Add descriptive alt attribute");
      } else if (element.alt === "") {
        // Empty alt is ok for decorative images
        // No issue
      } else if (element.alt && element.alt.length < 3) {
        issues.push("Alt text too short");
        recommendations.push("Provide more descriptive alt text");
      }
    }
    
    return {
      passes: issues.length === 0,
      issues,
      recommendations,
    };
  }
  
  /**
   * Check heading hierarchy (WCAG 1.3.1)
   */
  checkHeadingHierarchy(headings: Array<{ level: number; text: string }>): {
    passes: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (headings.length === 0) {
      issues.push("Page has no headings");
      recommendations.push("Add h1-h6 headings to structure content");
      return { passes: false, issues, recommendations };
    }
    
    // Check if first heading is h1
    if (headings[0].level !== 1) {
      issues.push("First heading is not h1");
      recommendations.push("Start heading hierarchy with h1");
    }
    
    // Check for skipped levels
    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1].level;
      const curr = headings[i].level;
      
      if (curr > prev + 1) {
        issues.push(
          `Heading level skipped: h${prev} to h${curr} (${headings[i].text})`
        );
        recommendations.push("Use sequential heading levels without skipping");
      }
    }
    
    return {
      passes: issues.length === 0,
      issues,
      recommendations,
    };
  }
}

/**
 * Accessibility Report Generator
 */
export class AccessibilityReportGenerator {
  /**
   * Generate WCAG 2.2 AA compliance report
   */
  async generateComplianceReport(
    organizationId: string,
    _options: {
      startDate?: Date;
      endDate?: Date;
      includeResolved?: boolean;
    } = {}
  ): Promise<{
    summary: {
      totalIssues: number;
      openIssues: number;
      resolvedIssues: number;
      bySeverity: Record<string, number>;
      byWCAGCriteria: Record<string, number>;
    };
    complianceScore: number;
    criteriaCoverage: Array<{
      criteria: string;
      title: string;
      level: string;
      passed: boolean;
      issueCount: number;
    }>;
    recommendations: string[];
  }> {
    // Get all issues for organization
    const issues = await db
      .select()
      .from(accessibilityIssues)
      .where(eq(accessibilityIssues.organizationId, organizationId));
    
    // Calculate summary
    const summary = {
      totalIssues: issues.length,
      openIssues: issues.filter((i) => i.status === "open").length,
      resolvedIssues: issues.filter((i) => i.status === "resolved").length,
      bySeverity: {
        critical: issues.filter((i) => i.severity === "critical").length,
        serious: issues.filter((i) => i.severity === "serious").length,
        moderate: issues.filter((i) => i.severity === "moderate").length,
        minor: issues.filter((i) => i.severity === "minor").length,
      },
      byWCAGCriteria: issues.reduce((acc, issue) => {
        acc[issue.wcagCriteria] = (acc[issue.wcagCriteria] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
    
    // Calculate compliance score
    const complianceScore = Math.max(
      0,
      100 -
        summary.bySeverity.critical * 10 -
        summary.bySeverity.serious * 5 -
        summary.bySeverity.moderate * 2 -
        summary.bySeverity.minor * 0.5
    );
    
    // Criteria coverage
    const criteriaCoverage = Object.entries(summary.byWCAGCriteria).map(
      ([criteria, count]) => ({
        criteria,
        title: `WCAG ${criteria}`,
        level: "AA",
        passed: count === 0,
        issueCount: count,
      })
    );
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (summary.bySeverity.critical > 0) {
      recommendations.push(
        `Fix ${summary.bySeverity.critical} critical accessibility issues immediately`
      );
    }
    if (summary.bySeverity.serious > 0) {
      recommendations.push(
        `Address ${summary.bySeverity.serious} serious issues that block users`
      );
    }
    if (complianceScore < 80) {
      recommendations.push(
        "Schedule comprehensive accessibility audit with assistive technology users"
      );
    }
    
    return {
      summary,
      complianceScore: Math.round(complianceScore),
      criteriaCoverage,
      recommendations,
    };
  }
}

