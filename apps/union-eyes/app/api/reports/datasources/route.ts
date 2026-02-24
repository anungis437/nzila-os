/**
 * Data Sources API
 * 
 * GET /api/reports/datasources - Get available data sources and their fields
 * Returns metadata for building reports dynamically
 * 
 * Created: November 16, 2025
 * Updated: December 5, 2025 (Phase 2 enhancements)
 * Part of: Phase 2 - Enhanced Analytics & Reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import { getAllDataSources } from '@/lib/report-executor';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
async function getHandler(_req: NextRequest, _context) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Authentication and organization context required'
    );
    }
    
    const _organizationId = user.organizationId;
    const _userId = user.id;
    
    // Get data sources from report executor registry
    const dataSources = getAllDataSources();

    // Transform to API format
    const formattedDataSources = dataSources.map(ds => ({
      id: ds.id,
      name: ds.name,
      table: ds.table,
      description: `Data source for ${ds.name.toLowerCase()}`,
      icon: getIconForDataSource(ds.id),
      joinable: ds.joinable || [],
      fields: ds.fields.map(field => ({
        fieldId: field.id,
        fieldName: field.name,
        column: field.column,
        type: field.type,
        aggregatable: field.aggregatable,
        filterable: field.filterable,
        sortable: field.sortable,
        nullable: field.nullable,
      })),
    }));

    return NextResponse.json({
      dataSources: formattedDataSources,
      count: formattedDataSources.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to fetch data sources', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Get icon name for data source
 */
function getIconForDataSource(dataSourceId: string): string {
  const iconMap: Record<string, string> = {
    claims: 'FileText',
    organization_members: 'Users',
    claim_deadlines: 'Clock',
    dues_assignments: 'DollarSign',
  };

  return iconMap[dataSourceId] || 'Table';
}

export const GET = withApiAuth(getHandler);

