import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

const TEST_URL = process.env.P3_2_MIGRATION_TEST_URL;
const describeOrSkip = TEST_URL ? describe : describe.skip;
const execFileAsync = promisify(execFile);
const appRoot = resolve(import.meta.dirname, "../..");

function loadForwardSql(): string {
  const migration = readFileSync(
    resolve(appRoot, "backend/core/migrations/0003_automation_rules_organization_id.py"),
    "utf8",
  );
  const match = migration.match(/FORWARD_SQL = """([\s\S]*?)"""/);
  if (!match) throw new Error("Unable to load FORWARD_SQL from core.0003");
  return match[1];
}

describeOrSkip("P3.2 ownership migration (disposable PostgreSQL)", () => {
  let adminClient: Client;
  let client: Client;
  let isolatedUrl: string;
  const databaseName = `p32_${randomUUID().replaceAll("-", "")}`;
  const forwardSql = loadForwardSql();

  beforeAll(async () => {
    adminClient = new Client({ connectionString: TEST_URL });
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${databaseName}"`);

    const url = new URL(TEST_URL!);
    url.pathname = `/${databaseName}`;
    isolatedUrl = url.toString();
    client = new Client({ connectionString: isolatedUrl });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("DROP TABLE IF EXISTS public.automation_rules CASCADE");
    await client.query("DROP TABLE IF EXISTS public.organizations CASCADE");
    await client.query("DROP TABLE IF EXISTS public.pilot_applications CASCADE");
    await client.query("DROP FUNCTION IF EXISTS public.ue_create_direct_org_rls_policy(text, text, boolean)");
  });

  afterAll(async () => {
    await client.query("DROP TABLE IF EXISTS public.automation_rules CASCADE");
    await client.query("DROP TABLE IF EXISTS public.organizations CASCADE");
    await client.query("DROP TABLE IF EXISTS public.pilot_applications CASCADE");
    await client.query("DROP FUNCTION IF EXISTS public.ue_create_direct_org_rls_policy(text, text, boolean)");
    await client.end();
    await adminClient.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await adminClient.end();
  });

  it("creates canonical ownership and index on an empty table", async () => {
    await client.query("CREATE TABLE public.automation_rules (id uuid PRIMARY KEY)");
    await client.query(forwardSql);

    const column = await client.query(`
      SELECT data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'automation_rules'
        AND column_name = 'organization_id'
    `);
    expect(column.rows).toEqual([{
      data_type: "character varying",
      character_maximum_length: 255,
      is_nullable: "NO",
    }]);

    const index = await client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'automation_rules'
        AND indexname = 'idx_automation_rules_org'
    `);
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0].indexdef).toContain("(organization_id)");
  });

  it("refuses a missing table", async () => {
    await expect(client.query(forwardSql)).rejects.toThrow(/automation_rules does not exist/);
  });

  it("refuses a non-empty table with no canonical ownership", async () => {
    await client.query("CREATE TABLE public.automation_rules (id uuid PRIMARY KEY)");
    await client.query("INSERT INTO public.automation_rules VALUES (gen_random_uuid())");
    await expect(client.query(forwardSql)).rejects.toThrow(/requires an empty table/);
  });

  it("is idempotent when canonical ownership is already correct", async () => {
    await client.query(`
      CREATE TABLE public.automation_rules (
        id uuid PRIMARY KEY,
        organization_id varchar(255) NOT NULL
      )
    `);
    await client.query(forwardSql);
    await client.query(forwardSql);
    const indexes = await client.query(`
      SELECT count(*)::int AS count FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'automation_rules'
        AND indexname = 'idx_automation_rules_org'
    `);
    expect(indexes.rows[0].count).toBe(1);
  });

  it("tightens nullable canonical ownership when no NULL rows exist", async () => {
    await client.query(`
      CREATE TABLE public.automation_rules (
        id uuid PRIMARY KEY,
        organization_id varchar(255)
      )
    `);
    await client.query("INSERT INTO public.automation_rules VALUES (gen_random_uuid(), 'org-a')");
    await client.query(forwardSql);
    const column = await client.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'automation_rules'
        AND column_name = 'organization_id'
    `);
    expect(column.rows[0].is_nullable).toBe("NO");
  });

  it("refuses nullable canonical ownership containing a NULL row", async () => {
    await client.query(`
      CREATE TABLE public.automation_rules (
        id uuid PRIMARY KEY,
        organization_id varchar(255)
      )
    `);
    await client.query("INSERT INTO public.automation_rules VALUES (gen_random_uuid(), NULL)");
    await expect(client.query(forwardSql)).rejects.toThrow(/contains NULL ownership/);
  });

  it("canonicalizes empty tracked-0006 legacy geometry", async () => {
    await client.query(`
      CREATE TABLE public.organizations (id uuid PRIMARY KEY);
      CREATE TABLE public.automation_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        org_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        trigger_type varchar(50) NOT NULL,
        conditions jsonb,
        award_type_id uuid NOT NULL,
        credit_amount integer DEFAULT 0 NOT NULL,
        schedule varchar(255),
        is_active boolean DEFAULT true NOT NULL,
        last_triggered_at timestamp,
        trigger_count integer DEFAULT 0 NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL,
        created_by varchar(255),
        CONSTRAINT automation_rules_org_id_organizations_id_fk
          FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
      );
      CREATE INDEX automation_rules_org_idx ON public.automation_rules USING btree (org_id);
      CREATE INDEX automation_rules_trigger_idx ON public.automation_rules USING btree (trigger_type);
      CREATE INDEX automation_rules_active_idx ON public.automation_rules USING btree (is_active);
      CREATE INDEX automation_rules_award_type_idx ON public.automation_rules USING btree (award_type_id);
    `);

    await client.query(forwardSql);
    await client.query(forwardSql);

    const columns = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'automation_rules'
        AND column_name IN ('org_id', 'organization_id')
      ORDER BY column_name
    `);
    expect(columns.rows).toEqual([{
      column_name: "organization_id",
      data_type: "character varying",
      character_maximum_length: 255,
      is_nullable: "NO",
    }]);

    const legacyObjects = await client.query(`
      SELECT
        to_regclass('public.automation_rules_org_idx') AS legacy_index,
        EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.automation_rules'::regclass
            AND conname = 'automation_rules_org_id_organizations_id_fk'
        ) AS legacy_constraint
    `);
    expect(legacyObjects.rows[0]).toEqual({ legacy_index: null, legacy_constraint: false });

    const canonicalIndex = await client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'automation_rules'
        AND indexname = 'idx_automation_rules_org'
    `);
    expect(canonicalIndex.rows).toHaveLength(1);
    expect(canonicalIndex.rows[0].indexdef).toContain("(organization_id)");

    const preservedIndexes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'automation_rules'
        AND indexname IN (
          'automation_rules_trigger_idx',
          'automation_rules_active_idx',
          'automation_rules_award_type_idx'
        )
      ORDER BY indexname
    `);
    expect(preservedIndexes.rows.map(({ indexname }) => indexname)).toEqual([
      "automation_rules_active_idx",
      "automation_rules_award_type_idx",
      "automation_rules_trigger_idx",
    ]);
  });

  it("refuses populated legacy org_id-only geometry", async () => {
    await client.query(`
      CREATE TABLE public.organizations (id uuid PRIMARY KEY);
      CREATE TABLE public.automation_rules (
        id uuid PRIMARY KEY,
        org_id uuid NOT NULL,
        CONSTRAINT automation_rules_org_id_organizations_id_fk
          FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
      );
      CREATE INDEX automation_rules_org_idx ON public.automation_rules USING btree (org_id);
    `);
    const organizationId = randomUUID();
    await client.query("INSERT INTO public.organizations (id) VALUES ($1)", [organizationId]);
    await client.query(
      "INSERT INTO public.automation_rules (id, org_id) VALUES ($1, $2)",
      [randomUUID(), organizationId],
    );

    await expect(client.query(forwardSql)).rejects.toThrow(
      /populated legacy org_id-only ownership geometry/,
    );
    const canonical = await client.query(`
      SELECT count(*)::int AS count FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'automation_rules'
        AND column_name = 'organization_id'
    `);
    expect(canonical.rows[0].count).toBe(0);
    expect(await client.query("SELECT org_id FROM public.automation_rules")).toHaveProperty(
      "rowCount",
      1,
    );
  });

  it("refuses unexpected empty legacy org_id geometry", async () => {
    await client.query(`
      CREATE TABLE public.automation_rules (
        id uuid PRIMARY KEY,
        org_id text
      )
    `);

    await expect(client.query(forwardSql)).rejects.toThrow(/unexpected legacy geometry/);
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'automation_rules'
        AND column_name IN ('org_id', 'organization_id')
    `);
    expect(columns.rows).toEqual([{
      column_name: "org_id",
      data_type: "text",
      is_nullable: "YES",
    }]);
  });

  it("refuses Round 59 before prerequisites and succeeds after they exist", async () => {
    await client.query(`
      CREATE TABLE public.automation_rules (
        id uuid PRIMARY KEY,
        organization_id varchar(255) NOT NULL
      )
    `);

    const before = await execFileAsync(
      "pnpm",
      ["exec", "tsx", "scripts/apply-round59-rls-geometry-gap-closure.ts"],
      { cwd: appRoot, env: { ...process.env, RLS_ENFORCEMENT_ADMIN_DATABASE_URL: isolatedUrl } },
    ).catch((error: { stderr?: string; stdout?: string }) => error);
    expect(`${before.stdout ?? ""}${before.stderr ?? ""}`).toContain(
      "column verified_organization_id not found on pilot_applications",
    );

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
          CREATE ROLE union_eyes_system NOSUPERUSER NOBYPASSRLS NOLOGIN;
        END IF;
      END $$;
      CREATE TABLE public.pilot_applications (
        id uuid PRIMARY KEY,
        verified_organization_id uuid
      );
      CREATE OR REPLACE FUNCTION public.ue_create_direct_org_rls_policy(
        target_table text,
        ownership_column text,
        ownership_is_text boolean
      ) RETURNS void LANGUAGE plpgsql AS $$
      BEGIN
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table);
        EXECUTE format(
          'CREATE POLICY ue_system_all ON public.%I AS PERMISSIVE FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
          target_table
        );
      END $$;
    `);

    const after = await execFileAsync(
      "pnpm",
      ["exec", "tsx", "scripts/apply-round59-rls-geometry-gap-closure.ts"],
      { cwd: appRoot, env: { ...process.env, RLS_ENFORCEMENT_ADMIN_DATABASE_URL: isolatedUrl } },
    );
    expect(after.stdout).toContain("All gap tables in the GAPS list closed and verified");
  });
});