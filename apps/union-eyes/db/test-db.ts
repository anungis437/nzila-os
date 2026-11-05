/**
 * Test Database Client - Single Connection
 * 
 * This module creates a single-connection database client for testing
 * to ensure session context variables persist across queries.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { serializeRawDates } from "./driver-dates";

// Create a single connection (no pooling) for tests
// This ensures session variables set with set_config() persist
const testConnectionOptions = {
  max: 1,               // SINGLE connection (no pooling)
  idle_timeout: 60,     // Keep alive longer for tests
  connect_timeout: 10,
  prepare: false,
  keepalive: true,
  debug: false,
  connection: {
    application_name: "union-claims-app-test"
  }
};

// Create test client and db
export const testClient = postgres(process.env.DATABASE_URL!, testConnectionOptions);
export const testDb = drizzle(testClient, { schema });
// after drizzle(): drizzle installs its serializers at construction
serializeRawDates(testClient);
