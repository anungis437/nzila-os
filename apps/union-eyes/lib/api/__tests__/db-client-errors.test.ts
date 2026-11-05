import { describe, expect, it } from 'vitest';
import { ApiError, ErrorCode } from '../errors';
import { mapClientDatabaseError, postgresFaultOf } from '../db-client-errors';

// node-postgres reports `column`; postgres-js reports `column_name`; Drizzle wraps either as the `cause` of the error it throws.
const nodePostgres = (code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error('Failed query: insert into "t" ... params: secret-value'), { cause: Object.assign(new Error(`database said ${code} secret-value`), { code, ...extra }) });
const postgresJs = (code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error('postgres refused secret-value'), { name: 'PostgresError', code, ...extra });

describe('postgresFaultOf', () => {
  it('finds the SQLSTATE and the column on the error or behind its causes, for either driver', () => {
    expect(postgresFaultOf(nodePostgres('23502', { column: 'legal_basis' }))).toEqual({ code: '23502', column: 'legal_basis' });
    expect(postgresFaultOf(postgresJs('23502', { column_name: 'legal_basis' }))).toEqual({ code: '23502', column: 'legal_basis' });
    expect(postgresFaultOf(Object.assign(new Error('outer'), { cause: nodePostgres('22P02') }))).toEqual({ code: '22P02', column: undefined });
  });

  it('finds nothing in an error that is not the database\'s', () => {
    expect(postgresFaultOf(new Error('boom'))).toBeNull();
    expect(postgresFaultOf(null)).toBeNull();
    expect(postgresFaultOf('23502')).toBeNull();
    expect(postgresFaultOf(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBeNull();
    expect(postgresFaultOf(Object.assign(new Error('x'), { code: 23502 }))).toBeNull();
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(postgresFaultOf(loop)).toBeNull();
  });
});

describe('mapClientDatabaseError', () => {
  const fieldOf = (column: string) => ({ legal_basis: 'legalBasis' })[column];

  it('answers a required column the body left out as a 400 that names the property, whichever driver reported it', () => {
    for (const error of [nodePostgres('23502', { column: 'legal_basis' }), postgresJs('23502', { column_name: 'legal_basis' })]) {
      const mapped = mapClientDatabaseError(error, 'create', fieldOf)!;
      expect(mapped).toBeInstanceOf(ApiError);
      expect(mapped.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(mapped.message).toBe('legalBasis is required');
      expect(mapped.details).toEqual({ field: 'legalBasis' });
    }
  });

  it('names the column when no property maps to it, and no field when the driver gave none', () => {
    expect(mapClientDatabaseError(nodePostgres('23502', { column: 'other' }), 'create', fieldOf)!.message).toBe('other is required');
    expect(mapClientDatabaseError(nodePostgres('23502'), 'update', fieldOf)!.message).toBe('A required field is missing');
  });

  it('answers a value of the wrong type, format or size, and a broken constraint, as a 400', () => {
    for (const code of ['22P02', '22007', '22008', '22003', '22001', '22021', '22P05', '22004']) {
      const mapped = mapClientDatabaseError(nodePostgres(code), 'create')!;
      expect(mapped.code, code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(mapped.message, code).toBe('A field has a value of the wrong type, format or size');
    }
    expect(mapClientDatabaseError(nodePostgres('23514'), 'update')!.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('answers a duplicate as a conflict, and a reference as a 400 on a write and a conflict on a delete', () => {
    expect(mapClientDatabaseError(nodePostgres('23505'), 'create')!.code).toBe(ErrorCode.CONFLICT);
    expect(mapClientDatabaseError(nodePostgres('23P01'), 'update')!.code).toBe(ErrorCode.CONFLICT);
    expect(mapClientDatabaseError(nodePostgres('23503'), 'create')!.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(mapClientDatabaseError(nodePostgres('23503'), 'update')!.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(mapClientDatabaseError(nodePostgres('23503'), 'delete')!.code).toBe(ErrorCode.CONFLICT);
  });

  it('never carries a value, a statement, a constraint or a driver message into the answer', () => {
    for (const code of ['23502', '23505', '23503', '23514', '22P02', '22001']) {
      const mapped = mapClientDatabaseError(nodePostgres(code, { column: 'legal_basis', constraint: 'cnesst_filings_secret_key', detail: 'Key (title)=(secret-value) already exists.' }), 'create', fieldOf)!;
      expect(JSON.stringify({ message: mapped.message, details: mapped.details }), code).not.toMatch(/secret|insert into|cnesst_filings|Key \(/);
    }
  });

  it('leaves a missing grant, a lost connection, a policy refusal and a plain error as the server faults they are', () => {
    for (const code of ['42501', '42P01', '42703', '40001', '40P01', '08006', '57014', '53300', 'XX000']) {
      expect(mapClientDatabaseError(nodePostgres(code), 'create'), code).toBeNull();
    }
    expect(mapClientDatabaseError(new Error('boom'), 'create')).toBeNull();
    expect(mapClientDatabaseError(new ApiError(ErrorCode.FORBIDDEN, 'nope'), 'create')).toBeNull();
  });
});
