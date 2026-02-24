/**
 * CLC Chart of Accounts Service
 * 
 * Manages the Canadian Labour Congress (CLC) standardized chart of accounts
 * for union financial reporting. Provides account code mapping, classification,
 * and integration with Statistics Canada reporting requirements.
 * 
 * CLC Chart Structure:
 * - 4000 series: Revenue accounts (dues, per-capita, grants)
 * - 5000 series: Operating expense accounts (salaries, admin, legal)
 * - 6000 series: Special expense accounts (strike fund, education, organizing)
 * - 7000 series: Capital assets and investments
 * 
 * @module services/clc/chart-of-accounts
 */

import { db } from '@/db/db';
import { eq, and, isNull } from 'drizzle-orm';
import { 
  chartOfAccounts as unifiedChartOfAccounts,
  accountMappings as unifiedAccountMappings,
  type ChartOfAccount 
} from '@/db/schema/domains/financial/chart-of-accounts';

/**
 * Account types per CLC classification
 */
export type AccountType = 
  | 'revenue' 
  | 'expense' 
  | 'asset' 
  | 'liability' 
  | 'equity';

/**
 * Account categories for financial statement grouping
 */
export type AccountCategory =
  | 'dues_revenue'
  | 'per_capita_revenue'
  | 'other_revenue'
  | 'salaries_wages'
  | 'administrative'
  | 'legal_professional'
  | 'strike_fund'
  | 'education_training'
  | 'organizing'
  | 'political_action'
  | 'assets'
  | 'liabilities'
  | 'equity';

/**
 * Chart of accounts record
 */
export interface CLCAccount {
  code: string;
  name: string;
  type: AccountType;
  category: AccountCategory;
  statcanCode?: string;
  description?: string;
  isActive: boolean;
  parentCode?: string;
  sortOrder: number;
}

/**
 * Account mapping for transaction types
 */
export interface AccountMapping {
  transactionType: string;
  debitAccount: string;
  creditAccount: string;
  description: string;
}

/**
 * CLC Standard Chart of Accounts
 * 
 * Based on CLC Financial Reporting Standards and StatCan Labour Organization Survey
 */
const CLC_CHART_OF_ACCOUNTS: CLCAccount[] = [
  // 4000 Series: Revenue
  {
    code: '4000',
    name: 'Revenue',
    type: 'revenue',
    category: 'dues_revenue',
    description: 'All revenue accounts',
    isActive: true,
    sortOrder: 1000,
  },
  {
    code: '4100',
    name: 'Per-Capita Tax Revenue',
    type: 'revenue',
    category: 'per_capita_revenue',
    statcanCode: 'REV-PER-CAPITA',
    description: 'Monthly per-capita remittances from local unions',
    isActive: true,
    parentCode: '4000',
    sortOrder: 1100,
  },
  {
    code: '4100-001',
    name: 'CLC Per-Capita Tax',
    type: 'revenue',
    category: 'per_capita_revenue',
    statcanCode: 'REV-PER-CAPITA-CLC',
    description: 'Per-capita tax remitted to CLC',
    isActive: true,
    parentCode: '4100',
    sortOrder: 1101,
  },
  {
    code: '4100-002',
    name: 'Federation Per-Capita Tax',
    type: 'revenue',
    category: 'per_capita_revenue',
    statcanCode: 'REV-PER-CAPITA-FED',
    description: 'Per-capita tax remitted to federation',
    isActive: true,
    parentCode: '4100',
    sortOrder: 1102,
  },
  {
    code: '4200',
    name: 'Membership Dues',
    type: 'revenue',
    category: 'dues_revenue',
    statcanCode: 'REV-DUES',
    description: 'Regular membership dues collected',
    isActive: true,
    parentCode: '4000',
    sortOrder: 1200,
  },
  {
    code: '4200-001',
    name: 'Regular Membership Dues',
    type: 'revenue',
    category: 'dues_revenue',
    statcanCode: 'REV-DUES-REG',
    description: 'Monthly or bi-weekly dues from regular members',
    isActive: true,
    parentCode: '4200',
    sortOrder: 1201,
  },
  {
    code: '4200-002',
    name: 'Initiation Fees',
    type: 'revenue',
    category: 'dues_revenue',
    statcanCode: 'REV-DUES-INIT',
    description: 'One-time initiation fees from new members',
    isActive: true,
    parentCode: '4200',
    sortOrder: 1202,
  },
  {
    code: '4300',
    name: 'Grants and Donations',
    type: 'revenue',
    category: 'other_revenue',
    statcanCode: 'REV-GRANTS',
    description: 'Government grants, donations, and gifts',
    isActive: true,
    parentCode: '4000',
    sortOrder: 1300,
  },
  {
    code: '4400',
    name: 'Investment Income',
    type: 'revenue',
    category: 'other_revenue',
    statcanCode: 'REV-INVEST',
    description: 'Interest, dividends, and investment returns',
    isActive: true,
    parentCode: '4000',
    sortOrder: 1400,
  },

  // 5000 Series: Operating Expenses
  {
    code: '5000',
    name: 'Operating Expenses',
    type: 'expense',
    category: 'administrative',
    description: 'All operating expense accounts',
    isActive: true,
    sortOrder: 2000,
  },
  {
    code: '5100',
    name: 'Salaries and Wages',
    type: 'expense',
    category: 'salaries_wages',
    statcanCode: 'EXP-SALARIES',
    description: 'Staff salaries, wages, and related costs',
    isActive: true,
    parentCode: '5000',
    sortOrder: 2100,
  },
  {
    code: '5100-001',
    name: 'Officer Salaries',
    type: 'expense',
    category: 'salaries_wages',
    statcanCode: 'EXP-SAL-OFFICERS',
    description: 'Salaries for elected union officers',
    isActive: true,
    parentCode: '5100',
    sortOrder: 2101,
  },
  {
    code: '5100-002',
    name: 'Staff Salaries',
    type: 'expense',
    category: 'salaries_wages',
    statcanCode: 'EXP-SAL-STAFF',
    description: 'Salaries for administrative and support staff',
    isActive: true,
    parentCode: '5100',
    sortOrder: 2102,
  },
  {
    code: '5100-003',
    name: 'Employee Benefits',
    type: 'expense',
    category: 'salaries_wages',
    statcanCode: 'EXP-SAL-BENEFITS',
    description: 'Health insurance, pensions, and other benefits',
    isActive: true,
    parentCode: '5100',
    sortOrder: 2103,
  },
  {
    code: '5200',
    name: 'Legal and Professional Fees',
    type: 'expense',
    category: 'legal_professional',
    statcanCode: 'EXP-LEGAL',
    description: 'Legal counsel, arbitration, and professional services',
    isActive: true,
    parentCode: '5000',
    sortOrder: 2200,
  },
  {
    code: '5200-001',
    name: 'Legal Counsel',
    type: 'expense',
    category: 'legal_professional',
    statcanCode: 'EXP-LEGAL-COUNSEL',
    description: 'Legal representation and advice',
    isActive: true,
    parentCode: '5200',
    sortOrder: 2201,
  },
  {
    code: '5200-002',
    name: 'Arbitration Costs',
    type: 'expense',
    category: 'legal_professional',
    statcanCode: 'EXP-LEGAL-ARB',
    description: 'Grievance arbitration and mediation',
    isActive: true,
    parentCode: '5200',
    sortOrder: 2202,
  },
  {
    code: '5200-003',
    name: 'Accounting and Audit',
    type: 'expense',
    category: 'legal_professional',
    statcanCode: 'EXP-LEGAL-ACCT',
    description: 'Accounting services and annual audit',
    isActive: true,
    parentCode: '5200',
    sortOrder: 2203,
  },
  {
    code: '5300',
    name: 'Per-Capita Tax Expense',
    type: 'expense',
    category: 'administrative',
    statcanCode: 'EXP-PER-CAPITA',
    description: 'Per-capita remittances to parent organizations',
    isActive: true,
    parentCode: '5000',
    sortOrder: 2300,
  },
  {
    code: '5400',
    name: 'Administrative Expenses',
    type: 'expense',
    category: 'administrative',
    statcanCode: 'EXP-ADMIN',
    description: 'Office supplies, utilities, rent, and general admin',
    isActive: true,
    parentCode: '5000',
    sortOrder: 2400,
  },
  {
    code: '5500',
    name: 'Travel and Meetings',
    type: 'expense',
    category: 'administrative',
    statcanCode: 'EXP-TRAVEL',
    description: 'Travel, accommodations, and meeting costs',
    isActive: true,
    parentCode: '5000',
    sortOrder: 2500,
  },

  // 6000 Series: Special Expenses
  {
    code: '6000',
    name: 'Special Expenses',
    type: 'expense',
    category: 'strike_fund',
    description: 'Strike fund, education, organizing, and special projects',
    isActive: true,
    sortOrder: 3000,
  },
  {
    code: '6100',
    name: 'Strike Fund Disbursements',
    type: 'expense',
    category: 'strike_fund',
    statcanCode: 'EXP-STRIKE',
    description: 'Strike pay and related support costs',
    isActive: true,
    parentCode: '6000',
    sortOrder: 3100,
  },
  {
    code: '6200',
    name: 'Education and Training',
    type: 'expense',
    category: 'education_training',
    statcanCode: 'EXP-EDUCATION',
    description: 'Member education, steward training, conferences',
    isActive: true,
    parentCode: '6000',
    sortOrder: 3200,
  },
  {
    code: '6300',
    name: 'Organizing Campaigns',
    type: 'expense',
    category: 'organizing',
    statcanCode: 'EXP-ORGANIZING',
    description: 'New member organizing and recruitment',
    isActive: true,
    parentCode: '6000',
    sortOrder: 3300,
  },
  {
    code: '6400',
    name: 'Political Action',
    type: 'expense',
    category: 'political_action',
    statcanCode: 'EXP-POLITICAL',
    description: 'Political advocacy and lobbying activities',
    isActive: true,
    parentCode: '6000',
    sortOrder: 3400,
  },

  // 7000 Series: Assets and Liabilities
  {
    code: '7000',
    name: 'Assets',
    type: 'asset',
    category: 'assets',
    description: 'Cash, investments, and capital assets',
    isActive: true,
    sortOrder: 4000,
  },
  {
    code: '7100',
    name: 'Cash and Bank Accounts',
    type: 'asset',
    category: 'assets',
    statcanCode: 'ASSET-CASH',
    description: 'Operating accounts and petty cash',
    isActive: true,
    parentCode: '7000',
    sortOrder: 4100,
  },
  {
    code: '7200',
    name: 'Investments',
    type: 'asset',
    category: 'assets',
    statcanCode: 'ASSET-INVEST',
    description: 'Securities, GICs, and investment funds',
    isActive: true,
    parentCode: '7000',
    sortOrder: 4200,
  },
  {
    code: '7300',
    name: 'Capital Assets',
    type: 'asset',
    category: 'assets',
    statcanCode: 'ASSET-CAPITAL',
    description: 'Buildings, equipment, and vehicles',
    isActive: true,
    parentCode: '7000',
    sortOrder: 4300,
  },
];

/**
 * Standard account mappings for common transactions
 */
const _ACCOUNT_MAPPINGS: AccountMapping[] = [
  {
    transactionType: 'per_capita_remittance',
    debitAccount: '5300',
    creditAccount: '7100',
    description: 'Record per-capita tax payment to parent organization',
  },
  {
    transactionType: 'per_capita_received',
    debitAccount: '7100',
    creditAccount: '4100-001',
    description: 'Record per-capita tax received from local union',
  },
  {
    transactionType: 'dues_collection',
    debitAccount: '7100',
    creditAccount: '4200-001',
    description: 'Record membership dues received',
  },
  {
    transactionType: 'initiation_fee',
    debitAccount: '7100',
    creditAccount: '4200-002',
    description: 'Record new member initiation fee',
  },
  {
    transactionType: 'legal_expense',
    debitAccount: '5200-001',
    creditAccount: '7100',
    description: 'Record legal counsel payment',
  },
  {
    transactionType: 'salary_payment',
    debitAccount: '5100',
    creditAccount: '7100',
    description: 'Record salary and wages payment',
  },
  {
    transactionType: 'strike_payment',
    debitAccount: '6100',
    creditAccount: '7100',
    description: 'Record strike pay disbursement',
  },
];

/**
 * Chart of Accounts Service
 * 
 * UPDATED: Now uses database instead of hardcoded constant
 */
export class ChartOfAccountsService {
  
  /**
   * Get all CLC standard accounts from database
   */
  async getAllAccounts(): Promise<ChartOfAccount[]> {
    return await db
      .select()
      .from(unifiedChartOfAccounts)
      .where(
        and(
          eq(unifiedChartOfAccounts.isCLCStandard, true),
          eq(unifiedChartOfAccounts.isActive, true),
          isNull(unifiedChartOfAccounts.organizationId)
        )
      )
      .orderBy(unifiedChartOfAccounts.sortOrder);
  }

  /**
   * Get account by code from database
   */
  async getAccountByCode(code: string): Promise<ChartOfAccount | undefined> {
    const results = await db
      .select()
      .from(unifiedChartOfAccounts)
      .where(
        and(
          eq(unifiedChartOfAccounts.accountCode, code),
          eq(unifiedChartOfAccounts.isCLCStandard, true)
        )
      )
      .limit(1);
    
    return results[0];
  }

  /**
   * Get accounts by type from database
   */
  async getAccountsByType(type: AccountType): Promise<ChartOfAccount[]> {
    return await db
      .select()
      .from(unifiedChartOfAccounts)
      .where(
        and(
          eq(unifiedChartOfAccounts.accountType, type),
          eq(unifiedChartOfAccounts.isCLCStandard, true),
          eq(unifiedChartOfAccounts.isActive, true)
        )
      )
      .orderBy(unifiedChartOfAccounts.sortOrder);
  }

  /**
   * Get accounts by category from database
   */
  async getAccountsByCategory(category: AccountCategory): Promise<ChartOfAccount[]> {
    return await db
      .select()
      .from(unifiedChartOfAccounts)
      .where(
        and(
          eq(unifiedChartOfAccounts.accountCategory, category),
          eq(unifiedChartOfAccounts.isCLCStandard, true),
          eq(unifiedChartOfAccounts.isActive, true)
        )
      )
      .orderBy(unifiedChartOfAccounts.sortOrder);
  }

  /**
   * Get child accounts for a parent code from database
   */
  async getChildAccounts(parentCode: string): Promise<ChartOfAccount[]> {
    return await db
      .select()
      .from(unifiedChartOfAccounts)
      .where(
        and(
          eq(unifiedChartOfAccounts.parentAccountCode, parentCode),
          eq(unifiedChartOfAccounts.isCLCStandard, true),
          eq(unifiedChartOfAccounts.isActive, true)
        )
      )
      .orderBy(unifiedChartOfAccounts.sortOrder);
  }

  /**
   * Get account mapping for transaction type from database
   */
  async getAccountMapping(transactionType: string): Promise<AccountMapping | undefined> {
    const results = await db
      .select()
      .from(unifiedAccountMappings)
      .where(
        and(
          eq(unifiedAccountMappings.transactionType, transactionType),
          eq(unifiedAccountMappings.isActive, true)
        )
      )
      .limit(1);
    
    if (!results[0]) return undefined;
    
    // Map database columns to interface properties
    return {
      transactionType: results[0].transactionType,
      debitAccount: results[0].debitAccountCode,
      creditAccount: results[0].creditAccountCode,
      description: results[0].description || ''
    };
  }

  /**
   * Get all account mappings from database
   */
  async getAllAccountMappings(): Promise<AccountMapping[]> {
    const results = await db
      .select()
      .from(unifiedAccountMappings)
      .where(eq(unifiedAccountMappings.isActive, true));
    
    // Map database columns to interface properties
    return results.map(r => ({
      transactionType: r.transactionType,
      debitAccount: r.debitAccountCode,
      creditAccount: r.creditAccountCode,
      description: r.description || ''
    }));
  }

  /**
   * Get per-capita revenue account
   */
  async getPerCapitaRevenueAccount(): Promise<ChartOfAccount> {
    const account = await this.getAccountByCode('4100');
    if (!account) {
      throw new Error('Per-capita revenue account (4100) not found in database');
    }
    return account;
  }

  /**
   * Get per-capita expense account
   */
  async getPerCapitaExpenseAccount(): Promise<ChartOfAccount> {
    const account = await this.getAccountByCode('5300');
    if (!account) {
      throw new Error('Per-capita expense account (5300) not found in database');
    }
    return account;
  }

  /**
   * Validate account code format
   * Valid formats:
   * - 4-digit: 4000, 5100, 7200
   * - Sub-account with dash and 3 digits: 4100-001, 5200-123
   */
  isValidAccountCode(code: string): boolean {
    // 4-digit format: 4000-9999
    const fourDigitPattern = /^[0-9]{4}$/;
    // Sub-account format: 4000-001 through 9999-999
    const subAccountPattern = /^[0-9]{4}-[0-9]{3}$/;
    
    return fourDigitPattern.test(code) || subAccountPattern.test(code);
  }

  async getAccountPath(code: string): Promise<string> {
    const account = await this.getAccountByCode(code);
    if (!account) return '';

    const path: string[] = [account.accountCode];
    let current = account;

    while (current.parentAccountCode) {
      const parent = await this.getAccountByCode(current.parentAccountCode);
      if (!parent) break;
      path.unshift(parent.accountCode);
      current = parent;
    }

    return path.join(' > ');
  }

  /**
   * Get account full name with hierarchy (e.g., "Operating Expenses / Legal and Professional Fees / Legal Counsel")
   */
  async getAccountFullName(code: string): Promise<string> {
    const account = await this.getAccountByCode(code);
    if (!account) return '';

    const names: string[] = [account.accountName];
    let current = account;

    while (current.parentAccountCode) {
      const parent = await this.getAccountByCode(current.parentAccountCode);
      if (!parent) break;
      names.unshift(parent.accountName);
      current = parent;
    }

    return names.join(' / ');
  }

  /**
   * Export chart to JSON from database
   */
  async exportToJSON(): Promise<string> {
    const accounts = await this.getAllAccounts();
    return JSON.stringify(accounts, null, 2);
  }

  /**
   * Export chart to CSV from database
   */
  async exportToCSV(): Promise<string> {
    const accounts = await this.getAllAccounts();
    const lines: string[] = [];
    
    // Header
    lines.push([
      'Code',
      'Name',
      'Type',
      'Category',
      'StatCan Code',
      'Description',
      'Active',
      'Parent Code',
      'Sort Order',
    ].join(','));

    // Rows
    for (const account of accounts) {
      lines.push([
        account.accountCode,
        `"${account.accountName}"`,
        account.accountType,
        account.accountCategory || '',
        account.statisticsCanadaCode || '',
        `"${account.description || ''}"`,
        account.isActive ? 'Y' : 'N',
        account.parentAccountCode || '',
        (account.sortOrder || 0).toString(),
      ].join(','));
    }

    return lines.join('\n');
  }
  
  /**
   * Legacy method: Get all CLC accounts (for backwards compatibility)
   * Returns the hardcoded constant for tests that don't need database
   * @deprecated Use getAllAccounts() instead
   */
  getAllAccountsSync(): CLCAccount[] {
    return CLC_CHART_OF_ACCOUNTS;
  }
}

/**
 * Create singleton instance
 */
export const chartOfAccounts = new ChartOfAccountsService();
