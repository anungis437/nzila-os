const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A value PostgreSQL accepts for a uuid column. Anything else names no row, so a read of it is "not found" and never a database fault. */
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
