/**
 * Safe SQL Identifier Utilities
 * 
 * Provides secure wrapper functions for SQL identifiers to prevent injection attacks
 * when using Drizzle ORM's sql.raw() with dynamic table/column names.
 * 
 * SECURITY: PostgreSQL uses double quotes for identifier escaping.
 * This prevents SQL injection via column/table names sourced from allowlists.
 * 
 * Created: February 11, 2026
 * Part of: P2 Security Enhancement - Column Validation
 */

import { sql, SQL } from 'drizzle-orm';

/**
 * Validates if a string is a valid SQL identifier
 * 
 * Rules:
 * - Must start with letter (a-z, A-Z) or underscore
 * - Can contain letters, digits (0-9), underscores, and dollar signs
 * - Cannot exceed 63 characters (PostgreSQL limit)
 * - Cannot be a SQL reserved keyword
 * 
 * @param identifier - The identifier to validate
 * @returns true if valid, false otherwise
 */
export function isValidIdentifier(identifier: string): boolean {
  if (!identifier || identifier.length === 0) {
    return false;
  }

  // PostgreSQL identifier maximum length
  if (identifier.length > 63) {
    return false;
  }

  // Must start with letter or underscore
  // Can contain letters, digits, underscores, dollar signs
  const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_$]*$/;
  if (!identifierPattern.test(identifier)) {
    return false;
  }

  // Check against SQL reserved keywords (common subset)
  const reservedKeywords = new Set([
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'TABLE', 'VIEW', 'INDEX', 'FROM', 'WHERE', 'JOIN', 'INNER', 'OUTER',
    'LEFT', 'RIGHT', 'FULL', 'CROSS', 'ON', 'AS', 'AND', 'OR', 'NOT',
    'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE',
    'UNION', 'EXCEPT', 'INTERSECT', 'ORDER', 'GROUP', 'HAVING', 'LIMIT',
    'OFFSET', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'DISTINCT',
  ]);

  if (reservedKeywords.has(identifier.toUpperCase())) {
    return false;
  }

  return true;
}

/**
 * Escapes a SQL identifier with double quotes for safe use in queries
 * 
 * PostgreSQL identifier escaping rules:
 * - Wrap identifier in double quotes
 * - Escape internal double quotes by doubling them
 * 
 * Examples:
 * - "user_name" -> "user_name"
 * - "user"name" -> "user""name"
 * 
 * @param identifier - The identifier to escape
 * @returns SQL fragment with safely escaped identifier
 * @throws Error if identifier is invalid
 */
export function safeIdentifier(identifier: string): SQL {
  if (!isValidIdentifier(identifier)) {
    throw new Error(
      `Invalid SQL identifier: "${identifier}". Must start with letter/underscore, ` +
      `contain only alphanumeric/underscore/dollar, be ≤63 chars, and not be a reserved keyword.`
    );
  }

  // Escape double quotes by doubling them
  const escaped = identifier.replace(/"/g, '""');
  
  // Return SQL fragment with double-quoted identifier
  return sql.raw(`"${escaped}"`);
}

/**
 * Escapes a table name that may include a schema prefix
 * 
 * Examples:
 * - "users" -> "users"
 * - "public.users" -> "public"."users"
 * - "claims_schema.claims" -> "claims_schema"."claims"
 * 
 * @param tableName - Table name, optionally with schema prefix
 * @returns SQL fragment with safely escaped table reference
 * @throws Error if any part is invalid
 */
export function safeTableName(tableName: string): SQL {
  const parts = tableName.split('.');
  
  if (parts.length === 1) {
    // Simple table name without schema
    return safeIdentifier(parts[0]);
  } else if (parts.length === 2) {
    // Schema.table format
    const [schema, table] = parts;
    return sql`${safeIdentifier(schema)}.${safeIdentifier(table)}`;
  } else {
    throw new Error(
      `Invalid table name format: "${tableName}". Expected "table" or "schema.table".`
    );
  }
}

/**
 * Escapes a column name that may include a table prefix
 * 
 * Examples:
 * - "user_id" -> "user_id"
 * - "users.user_id" -> "users"."user_id"
 * - "public.users.user_id" -> "public"."users"."user_id"
 * 
 * @param columnName - Column name, optionally with table/schema prefix
 * @returns SQL fragment with safely escaped column reference
 * @throws Error if any part is invalid
 */
export function safeColumnName(columnName: string): SQL {
  const parts = columnName.split('.');
  
  if (parts.length === 1) {
    // Simple column name
    return safeIdentifier(parts[0]);
  } else if (parts.length === 2) {
    // table.column format
    const [table, column] = parts;
    return sql`${safeIdentifier(table)}.${safeIdentifier(column)}`;
  } else if (parts.length === 3) {
    // schema.table.column format
    const [schema, table, column] = parts;
    return sql`${safeIdentifier(schema)}.${safeIdentifier(table)}.${safeIdentifier(column)}`;
  } else {
    throw new Error(
      `Invalid column name format: "${columnName}". Expected "column", "table.column", or "schema.table.column".`
    );
  }
}

/**
 * Validates and escapes multiple identifiers for use in GROUP BY or ORDER BY clauses
 * 
 * @param identifiers - Array of identifier strings
 * @returns Array of SQL fragments with escaped identifiers
 * @throws Error if any identifier is invalid
 */
export function safeIdentifiers(identifiers: string[]): SQL[] {
  return identifiers.map(id => safeIdentifier(id));
}

/**
 * Creates a safe column list for SELECT clauses
 * 
 * Example:
 * safeColumnList(['user_id', 'email', 'created_at'])
 * => "user_id", "email", "created_at"
 * 
 * @param columns - Array of column names
 * @returns SQL fragment with comma-separated escaped columns
 * @throws Error if any column name is invalid
 */
export function safeColumnList(columns: string[]): SQL {
  if (!columns || columns.length === 0) {
    throw new Error('Column list cannot be empty');
  }

  const safeCols = columns.map(col => safeColumnName(col));
  return sql.join(safeCols, sql`, `);
}

/**
 * Type guard to check if an object looks like a SQL fragment
 * Used for defensive programming when mixing safe and unsafe SQL
 */
export function isSQLFragment(value: any): value is SQL {
  return value !== null && value !== undefined && typeof value === 'object' && 'queryChunks' in value;
}
