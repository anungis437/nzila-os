/**
 * CLC Per-Capita Remittance File Export Service
 * Purpose: Generate remittance files in multiple formats (CSV, XML/EDI, StatCan LAB-05302)
 * Compliance: CLC reporting requirements + Statistics Canada labour organization reporting
 */

import { db } from '@/db';
import { _organizations } from '@/db/schema';
import { sql } from 'drizzle-orm';

// =====================================================================================
// TYPES
// =====================================================================================

export interface RemittanceFileOptions {
  format: 'csv' | 'xml' | 'statcan';
  remittanceIds: string[];
  includeHeader?: boolean;
  fiscalYear?: number;
}

export interface StatCanExportData {
  fiscalYear: number;
  organizationName: string;
  affiliateCode: string;
  totalRevenue: number;
  totalExpenses: number;
  memberCount: number;
  perCapitaReceived: number;
  perCapitaPaid: number;
}

// =====================================================================================
// CSV EXPORT (Manual Upload Format)
// =====================================================================================

/**
 * Generate CSV file for remittance batch
 * Format: Compatible with most accounting systems (QuickBooks, Sage, etc.)
 */
export async function generateRemittanceCSV(
  remittanceIds: string[]
): Promise<string> {
  // Fetch remittance data with organization names
  const remittances = await db.execute(
    sql`SELECT 
      r.id,
      r.remittance_month,
      r.remittance_year,
      from_org.name as from_organization_name,
      from_org.clc_affiliate_code as from_affiliate_code,
      to_org.name as to_organization_name,
      to_org.clc_affiliate_code as to_affiliate_code,
      r.total_members,
      r.good_standing_members,
      r.remittable_members,
      r.per_capita_rate,
      r.total_amount,
      r.due_date,
      r.clc_account_code,
      r.gl_account,
      r.status,
      r.submitted_date,
      r.paid_date
    FROM per_capita_remittances r
    JOIN organizations from_org ON r.from_organization_id = from_org.id
    JOIN organizations to_org ON r.to_organization_id = to_org.id
    WHERE r.id = ANY(${remittanceIds})
    ORDER BY r.due_date, from_org.name`
  );

  // Build CSV
  const lines: string[] = [];
  
  // Header
  lines.push([
    'Remittance ID',
    'Period (MM/YYYY)',
    'From Organization',
    'From Affiliate Code',
    'To Organization',
    'To Affiliate Code',
    'Total Members',
    'Good Standing',
    'Remittable Members',
    'Per-Capita Rate',
    'Total Amount',
    'Due Date',
    'CLC Account',
    'GL Account',
    'Status',
    'Submitted Date',
    'Paid Date',
  ].join(','));

  // Data rows
  for (const row of remittances) {
    const period = `${String(row.remittance_month).padStart(2, '0')}/${row.remittance_year}`;
    const dueDate = new Date(row.due_date as string).toISOString().split('T')[0];
    const submittedDate = row.submitted_date 
      ? new Date(row.submitted_date as string).toISOString().split('T')[0] 
      : '';
    const paidDate = row.paid_date 
      ? new Date(row.paid_date as string).toISOString().split('T')[0] 
      : '';

    lines.push([
      row.id,
      period,
      `"${row.from_organization_name}"`,
      row.from_affiliate_code || '',
      `"${row.to_organization_name}"`,
      row.to_affiliate_code || '',
      row.total_members,
      row.good_standing_members,
      row.remittable_members,
      row.per_capita_rate,
      row.total_amount,
      dueDate,
      row.clc_account_code || '',
      row.gl_account || '',
      row.status,
      submittedDate,
      paidDate,
    ].join(','));
  }

  return lines.join('\n');
}

// =====================================================================================
// XML/EDI EXPORT (API Integration Format)
// =====================================================================================

/**
 * Generate XML file for automated remittance processing
 * Format: CLC standard EDI format for electronic data interchange
 */
export async function generateRemittanceXML(
  remittanceIds: string[]
): Promise<string> {
  // Fetch remittance data
  const remittances = await db.execute(
    sql`SELECT 
      r.*,
      from_org.name as from_organization_name,
      from_org.clc_affiliate_code as from_affiliate_code,
      from_org.slug as from_slug,
      to_org.name as to_organization_name,
      to_org.clc_affiliate_code as to_affiliate_code,
      to_org.slug as to_slug
    FROM per_capita_remittances r
    JOIN organizations from_org ON r.from_organization_id = from_org.id
    JOIN organizations to_org ON r.to_organization_id = to_org.id
    WHERE r.id = ANY(${remittanceIds})
    ORDER BY r.due_date, from_org.name`
  );

  // Build XML
  const now = new Date().toISOString();
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<PerCapitaRemittances xmlns="http://clc-ctc.ca/schemas/remittance/v1">\n';
  xml += `  <GeneratedAt>${now}</GeneratedAt>\n`;
  xml += `  <RecordCount>${remittances.length}</RecordCount>\n`;
  xml += '  <Remittances>\n';

  for (const row of remittances) {
    xml += '    <Remittance>\n';
    xml += `      <ID>${row.id}</ID>\n`;
    xml += `      <Period>\n`;
    xml += `        <Month>${row.remittance_month}</Month>\n`;
    xml += `        <Year>${row.remittance_year}</Year>\n`;
    xml += `      </Period>\n`;
    
    xml += `      <FromOrganization>\n`;
    xml += `        <ID>${row.from_organization_id}</ID>\n`;
    xml += `        <Name><![CDATA[${row.from_organization_name}]]></Name>\n`;
    xml += `        <AffiliateCode>${row.from_affiliate_code || ''}</AffiliateCode>\n`;
    xml += `        <Slug>${row.from_slug}</Slug>\n`;
    xml += `      </FromOrganization>\n`;
    
    xml += `      <ToOrganization>\n`;
    xml += `        <ID>${row.to_organization_id}</ID>\n`;
    xml += `        <Name><![CDATA[${row.to_organization_name}]]></Name>\n`;
    xml += `        <AffiliateCode>${row.to_affiliate_code || ''}</AffiliateCode>\n`;
    xml += `        <Slug>${row.to_slug}</Slug>\n`;
    xml += `      </ToOrganization>\n`;
    
    xml += `      <MemberCounts>\n`;
    xml += `        <Total>${row.total_members}</Total>\n`;
    xml += `        <GoodStanding>${row.good_standing_members}</GoodStanding>\n`;
    xml += `        <Remittable>${row.remittable_members}</Remittable>\n`;
    xml += `      </MemberCounts>\n`;
    
    xml += `      <Financial>\n`;
    xml += `        <PerCapitaRate currency="CAD">${row.per_capita_rate}</PerCapitaRate>\n`;
    xml += `        <TotalAmount currency="CAD">${row.total_amount}</TotalAmount>\n`;
    xml += `        <CLCAccountCode>${row.clc_account_code || ''}</CLCAccountCode>\n`;
    xml += `        <GLAccount>${row.gl_account || ''}</GLAccount>\n`;
    xml += `      </Financial>\n`;
    
    xml += `      <Status>\n`;
    xml += `        <Current>${row.status}</Current>\n`;
    xml += `        <DueDate>${new Date(row.due_date as string).toISOString().split('T')[0]}</DueDate>\n`;
    if (row.submitted_date) {
      xml += `        <SubmittedDate>${new Date(row.submitted_date as string).toISOString().split('T')[0]}</SubmittedDate>\n`;
    }
    if (row.paid_date) {
      xml += `        <PaidDate>${new Date(row.paid_date as string).toISOString().split('T')[0]}</PaidDate>\n`;
    }
    xml += `      </Status>\n`;
    
    xml += '    </Remittance>\n';
  }

  xml += '  </Remittances>\n';
  xml += '</PerCapitaRemittances>\n';

  return xml;
}

// =====================================================================================
// STATISTICS CANADA LAB-05302 EXPORT
// =====================================================================================

/**
 * Generate Statistics Canada LAB-05302 format
 * Purpose: Annual reporting of labour organization financial data
 * Reference: https://www23.statcan.gc.ca/imdb/p3Instr.pl?Function=assembleInstr&Item_Id=239434
 */
export async function generateStatCanExport(
  fiscalYear: number
): Promise<string> {
// Get all CLC-affiliated organizations with per-capita activity
  const organizations = await db.execute(sql`
    SELECT 
      o.id,
      o.name,
      o.clc_affiliate_code,
      o.organization_type,
      o.member_count,
      
      -- Per-capita received (from child organizations)
      COALESCE(SUM(received.total_amount), 0) as per_capita_received,
      
      -- Per-capita paid (to parent organization)
      COALESCE(SUM(paid.total_amount), 0) as per_capita_paid,
      
      -- Count of remittances
      COUNT(DISTINCT received.id) as remittances_received_count,
      COUNT(DISTINCT paid.id) as remittances_paid_count
      
    FROM organizations o
    
    -- Per-capita received from children
    LEFT JOIN per_capita_remittances received 
      ON received.to_organization_id = o.id
      AND received.remittance_year = ${fiscalYear}
      AND received.status = 'paid'
    
    -- Per-capita paid to parent
    LEFT JOIN per_capita_remittances paid
      ON paid.from_organization_id = o.id
      AND paid.remittance_year = ${fiscalYear}
      AND paid.status = 'paid'
    
    WHERE o.clc_affiliated = true
      AND o.status = 'active'
    
    GROUP BY o.id, o.name, o.clc_affiliate_code, o.organization_type, o.member_count
    ORDER BY o.organization_type, o.name
  `);

  // Build StatCan format (pipe-delimited fixed-width)
  const lines: string[] = [];

  // Header record
  lines.push([
    'H', // Record type
    'LAB-05302', // Form code
    fiscalYear.toString(),
    new Date().toISOString().split('T')[0], // Generation date
    organizations.length.toString(), // Record count
  ].join('|'));

  // Data records
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const org of organizations as any[]) {
    const affiliateCode = (org.clc_affiliate_code as string) || 'UNKNOWN';
    const orgType = mapOrgTypeToStatCan(org.organization_type as string);
    
    lines.push([
      'D', // Record type
      affiliateCode.padEnd(20, ' '), // Affiliate code (20 chars)
      org.name.substring(0, 100).padEnd(100, ' '), // Organization name (100 chars)
      orgType.padEnd(10, ' '), // Organization type (10 chars)
      org.member_count?.toString().padStart(10, '0') || '0000000000', // Member count (10 digits)
      formatStatCanAmount(org.per_capita_received), // Per-capita received (15 digits, 2 decimals)
      formatStatCanAmount(org.per_capita_paid), // Per-capita paid (15 digits, 2 decimals)
      org.remittances_received_count?.toString().padStart(5, '0') || '00000', // Remittances received count
      org.remittances_paid_count?.toString().padStart(5, '0') || '00000', // Remittances paid count
    ].join('|'));
  }

  // Trailer record
  const totalReceived = organizations.reduce(
    (sum, org) => sum + parseFloat(org.per_capita_received as string || '0'), 
    0
  );
  const totalPaid = organizations.reduce(
    (sum, org) => sum + parseFloat(org.per_capita_paid as string || '0'), 
    0
  );

  lines.push([
    'T', // Record type
    organizations.length.toString().padStart(10, '0'), // Total records
    formatStatCanAmount(totalReceived), // Total per-capita received
    formatStatCanAmount(totalPaid), // Total per-capita paid
  ].join('|'));

  return lines.join('\n');
}

/**
 * Map internal organization type to StatCan category
 */
function mapOrgTypeToStatCan(orgType: string): string {
  const mapping: Record<string, string> = {
    'platform': 'PLATFORM', // SaaS platform provider
    'congress': 'NAT-FED', // National federation
    'federation': 'PROV-FED', // Provincial federation
    'union': 'NAT-UNION', // National union
    'local': 'LOCAL', // Local union
    'region': 'REGION', // Regional council
    'district': 'DISTRICT', // District council
  };
  
  return mapping[orgType] || 'OTHER';
}

/**
 * Format amount for StatCan (15 digits, 2 decimals, right-aligned)
 * Example: 123456.78 -> "000000012345678"
 */
function formatStatCanAmount(amount: string | number | null): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  const cents = Math.round(numAmount * 100); // Convert to cents
  return cents.toString().padStart(15, '0');
}

// =====================================================================================
// FILE GENERATION ROUTER
// =====================================================================================

/**
 * Main export function - routes to appropriate format
 */
export async function generateRemittanceFile(
  options: RemittanceFileOptions
): Promise<{ filename: string; content: string; mimeType: string }> {
  const { format, remittanceIds, fiscalYear } = options;

  let filename: string;
  let content: string;
  let mimeType: string;

  switch (format) {
    case 'csv':
      content = await generateRemittanceCSV(remittanceIds);
      filename = `clc-remittances-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
      break;

    case 'xml':
      content = await generateRemittanceXML(remittanceIds);
      filename = `clc-remittances-${new Date().toISOString().split('T')[0]}.xml`;
      mimeType = 'application/xml';
      break;

    case 'statcan':
      if (!fiscalYear) {
        throw new Error('Fiscal year required for StatCan export');
      }
      content = await generateStatCanExport(fiscalYear);
      filename = `statcan-lab-05302-${fiscalYear}.txt`;
      mimeType = 'text/plain';
      break;

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  return { filename, content, mimeType };
}

// =====================================================================================
// EXPORTS
// =====================================================================================

export const RemittanceExporter = {
  generateRemittanceCSV,
  generateRemittanceXML,
  generateStatCanExport,
  generateRemittanceFile,
};

