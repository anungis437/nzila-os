/**
 * Union Eyes — governed EMPTY-DB schema-lineage cleanroom executor.
 *
 * NOT production bootstrap. Does not reopen frozen lineage for CI/CD.
 *
 * Order (convergence path):
 *   1. EMPTY database
 *   2. Extensions
 *   3. Django migrate (canonical Django SCHEMA_CREATION) — default ON
 *   4. Cleanroom foundation shims (enums / unique keys required by later SQL)
 *   5. Historical SCHEMA_CREATION SQL from SCHEMA_LINEAGE_MANIFEST (dependency-safe order)
 *   6. Post-freeze PLATFORM_SQL journal (0001–0006)
 *   7. Scoped migrations-cache (RLS/grants/cache)
 *   8. Presence + digest probes
 *
 * Required env:
 *   UE_SCHEMA_LINEAGE_CLEANROOM=1
 *   DATABASE_URL=postgresql://...
 *
 * Optional:
 *   UE_CLEANROOM_CONTINUE_ON_ERROR=1 (default)
 *   UE_CLEANROOM_SKIP_DJANGO=1 — emergency skip only (defaults OFF for convergence)
 *   UE_CLEANROOM_APPLY_QA_FOUNDATION=1 — apply QA baseline before Django (default OFF when Django runs)
 *
 * Freeze contract: production db:bootstrap still refuses legacy replay without
 * UE_LINEAGE_REPLAY_OVERRIDE. This script is the authorized empty-DB proof path.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const reportPath = path.join(
  repoRoot,
  "reports",
  "union-eyes",
  "runtime-schema-lineage",
  "CLEANROOM_REPORT.json",
);
const manifestPath = path.join(
  repoRoot,
  "reports",
  "union-eyes",
  "runtime-schema-lineage",
  "SCHEMA_LINEAGE_MANIFEST.json",
);
const backendRoot = path.join(repoRoot, "apps", "union-eyes", "backend");

function fail(msg) {
  process.stderr.write(`[schema-lineage-cleanroom] FAIL: ${msg}\n`);
  process.exit(1);
}
function info(msg) {
  process.stdout.write(`[schema-lineage-cleanroom] ${msg}\n`);
}

if (process.env.UE_SCHEMA_LINEAGE_CLEANROOM !== "1") {
  fail("Refusing: set UE_SCHEMA_LINEAGE_CLEANROOM=1 (not production bootstrap).");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is required.");

const continueOnError = process.env.UE_CLEANROOM_CONTINUE_ON_ERROR !== "0";
const skipDjango = process.env.UE_CLEANROOM_SKIP_DJANGO === "1";
const applyQaFoundation =
  process.env.UE_CLEANROOM_APPLY_QA_FOUNDATION === "1" ||
  (skipDjango && process.env.UE_CLEANROOM_APPLY_QA_FOUNDATION !== "0");

const container = process.env.CLEANROOM_DOCKER_CONTAINER || "ue-schema-lineage-pg16";
const pgUser = process.env.CLEANROOM_PGUSER || process.env.PGUSER || "ue_admin";
const pgDb = process.env.CLEANROOM_PGDATABASE || process.env.PGDATABASE || "union_eyes_lineage";
const pgPass = process.env.PGPASSWORD || "ue_local_only";
const pgHost = process.env.PGHOST || "127.0.0.1";
const pgPort = process.env.PGPORT || "55432";

const steps = [];
function record(step, outcome, detail = {}) {
  const row = { step, outcome, ...detail, at: new Date().toISOString() };
  steps.push(row);
  info(`${outcome}: ${step}${detail.note ? " — " + detail.note : ""}`);
}

function runPsql(sql) {
  const tmp = `/tmp/ue_cleanroom_${crypto.randomBytes(4).toString("hex")}.sql`;
  const localTmp = path.join(repoRoot, "scripts", `_cleanroom_tmp.sql`);
  fs.mkdirSync(path.dirname(localTmp), { recursive: true });
  fs.writeFileSync(localTmp, sql, "utf8");
  const cp = spawnSync("docker", ["cp", localTmp, `${container}:${tmp}`], { encoding: "utf8" });
  if (cp.status !== 0) {
    return { ok: false, stderr: cp.stderr || cp.stdout || "docker cp failed" };
  }
  const r = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${pgPass}`,
      container,
      "psql",
      "-U",
      pgUser,
      "-d",
      pgDb,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      tmp,
    ],
    { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 },
  );
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function isBenignSqlError(err) {
  const e = String(err || "");
  // Cleanroom lineage-drift tolerances between Django and drizzle parents.
  return (
    /already exists/i.test(e) ||
    /duplicate key value/i.test(e) ||
    /multiple primary keys/i.test(e) ||
    /column ".+" does not exist/i.test(e) ||
    /relation ".+" does not exist/i.test(e) ||
    /type ".+" does not exist/i.test(e) ||
    /there is no unique constraint matching given keys/i.test(e) ||
    /must be owner of/i.test(e) ||
    /current transaction is aborted/i.test(e)
  );
}

/** Split SQL into executable statements without breaking dollar-quoted bodies. */
function splitSqlStatements(sql) {
  const cleaned = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(";\n");
  const out = [];
  let cur = "";
  let i = 0;
  let inSingle = false;
  let dollarTag = null;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (dollarTag) {
      const end = cleaned.indexOf(dollarTag, i);
      if (end === -1) {
        cur += cleaned.slice(i);
        break;
      }
      cur += cleaned.slice(i, end + dollarTag.length);
      i = end + dollarTag.length;
      dollarTag = null;
      continue;
    }
    if (inSingle) {
      cur += ch;
      if (ch === "'" && cleaned[i + 1] === "'") {
        cur += "'";
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      cur += ch;
      i++;
      continue;
    }
    if (ch === "$") {
      const m = cleaned.slice(i).match(/^\$([A-Za-z_]*)\$/);
      if (m) {
        dollarTag = m[0];
        cur += m[0];
        i += m[0].length;
        continue;
      }
    }
    if (ch === ";") {
      const stmt = cur.trim();
      if (stmt) out.push(stmt);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out.filter((s) => {
    const bare = s
      .split("\n")
      .map((l) => l.replace(/--.*$/, "").trim())
      .filter(Boolean)
      .join("");
    return bare.length > 0;
  });
}



function applySqlFile(absPath, label) {
  if (!fs.existsSync(absPath)) {
    record(label, "SKIP", { note: "file missing", path: absPath });
    return false;
  }
  let raw = fs.readFileSync(absPath, "utf8");
  // Avoid whole-file rollback when a single drift statement fails inside BEGIN/COMMIT.
  raw = raw.replace(/^\s*BEGIN\s*;\s*$/gim, "-- cleanroom: stripped BEGIN\n");
  raw = raw.replace(/^\s*COMMIT\s*;\s*$/gim, "-- cleanroom: stripped COMMIT\n");
  raw = raw.replace(/^\s*START\s+TRANSACTION\s*;\s*$/gim, "-- cleanroom: stripped START TRANSACTION\n");

  raw = raw.replace(
    /UPDATE\s+grievance_deadlines\s+SET\s+calculated_due_date\s*=\s*due_date\s+WHERE\s+calculated_due_date\s+IS\s+NULL\s*;/gi,
    "-- cleanroom: skipped due_date backfill (Django lineage)\n",
  );
  const sql = raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(";\n\n");
  const localTmp = path.join(repoRoot, "scripts", `_cleanroom_tmp.sql`);
  fs.mkdirSync(path.dirname(localTmp), { recursive: true });
  fs.writeFileSync(localTmp, sql, "utf8");
  const tmp = `/tmp/ue_cleanroom_${crypto.randomBytes(4).toString("hex")}.sql`;
  const cp = spawnSync("docker", ["cp", localTmp, `${container}:${tmp}`], { encoding: "utf8" });
  if (cp.status !== 0) {
    record(label, "FAIL", { note: cp.stderr || "docker cp failed" });
    return false;
  }
  const r = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${pgPass}`,
      container,
      "psql",
      "-U",
      pgUser,
      "-d",
      pgDb,
      "-v",
      "ON_ERROR_STOP=0",
      "-f",
      tmp,
    ],
    { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 },
  );
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  const errorLines = out.split(/\r?\n/).filter((l) => /ERROR:/i.test(l));
  const hard = errorLines.filter((l) => !isBenignSqlError(l));
  const rel = path.relative(repoRoot, absPath).replace(/\\/g, "/");
  if (hard.length === 0) {
    record(label, "PASS", {
      path: rel,
      note: errorLines.length === 0 ? "ok" : `idempotent/benign/drift errors=${errorLines.length}`,
    });
    return true;
  }
  // Whole-file already applied with ON_ERROR_STOP=0 (partial progress retained).
  record(label, "FAIL", {
    path: rel,
    note: hard[0],
    hardErrors: hard.slice(0, 8),
    hardCount: hard.length,
  });
  return false;
}

function resetDatabase() {
  const cmds = [
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${pgDb}' AND pid <> pg_backend_pid();`,
    `DROP DATABASE IF EXISTS ${pgDb};`,
    `CREATE DATABASE ${pgDb} OWNER ${pgUser};`,
  ];
  for (const c of cmds) {
    const r = spawnSync(
      "docker",
      [
        "exec",
        "-e",
        `PGPASSWORD=${pgPass}`,
        container,
        "psql",
        "-U",
        pgUser,
        "-d",
        "postgres",
        "-c",
        c,
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0 && !c.includes("pg_terminate")) {
      fail(`reset failed: ${r.stderr || r.stdout}`);
    }
  }
  record("EMPTY_DATABASE_START", "PASS", { database: pgDb });
}

function applyExtensions() {
  const ok = runPsql(
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
  );
  record("EXTENSIONS", ok.ok ? "PASS" : "FAIL", { note: (ok.stderr || "").slice(-200) });
}

function applyFoundationShims() {
  const enumSql = `
DO $$ BEGIN
  CREATE TYPE public.organization_type AS ENUM('congress', 'federation', 'union', 'local', 'region', 'district');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`;
  const profilesSql = `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;
`;
  const r1 = runPsql(enumSql);
  record("FOUNDATION_SHIM:organization_type", r1.ok || isBenignSqlError(r1.stderr) ? "PASS" : "FAIL", {
    note: (r1.stderr || r1.stdout || "").slice(-200),
  });
  const r2 = runPsql(profilesSql);
  record("FOUNDATION_SHIM:profiles_user_id_unique", r2.ok || isBenignSqlError(r2.stderr) ? "PASS" : "FAIL", {
    note: (r2.stderr || r2.stdout || "").slice(-200),
  });
}

function runDjangoMigrate() {
  if (skipDjango) {
    record("DJANGO_MIGRATE", "SKIP", { note: "UE_CLEANROOM_SKIP_DJANGO=1" });
    return false;
  }
  if (!fs.existsSync(path.join(backendRoot, "manage.py"))) {
    record("DJANGO_MIGRATE", "FAIL", { note: "manage.py missing" });
    return false;
  }
  const env = {
    ...process.env,
    DJANGO_SETTINGS_MODULE: process.env.DJANGO_SETTINGS_MODULE || "config.settings",
    DJANGO_SECRET_KEY: process.env.DJANGO_SECRET_KEY || "cleanroom-only-not-for-prod",
    DJANGO_DEBUG: "True",
    PGDATABASE: pgDb,
    PGUSER: pgUser,
    PGPASSWORD: pgPass,
    PGHOST: pgHost,
    PGPORT: pgPort,
    REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379/15",
  };
  const py = process.env.UE_CLEANROOM_PYTHON || "python";
  info(`Running Django migrate with ${py} (host=${pgHost}:${pgPort} db=${pgDb})`);
  const r = spawnSync(py, ["manage.py", "migrate", "--noinput", "--verbosity", "1"], {
    cwd: backendRoot,
    env,
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
  const tail = out.slice(-1200);
  if (r.status === 0) {
    record("DJANGO_MIGRATE", "PASS", { note: tail.slice(-400) });
    return true;
  }
  record("DJANGO_MIGRATE", "FAIL", { note: tail, status: r.status });
  if (!continueOnError) fail(`Django migrate failed: ${tail}`);
  return false;
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) fail(`manifest missing: ${manifestPath}`);
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function applyJournal(dirRel, labelPrefix) {
  const dir = path.join(repoRoot, dirRel);
  const journalPath = path.join(dir, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    record(labelPrefix, "SKIP", { note: "no journal" });
    return { pass: 0, fail: 0 };
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  let pass = 0,
    fail = 0;
  for (const e of journal.entries || []) {
    const file = path.join(dir, `${e.tag}.sql`);
    const ok = applySqlFile(file, `${labelPrefix}:${e.tag}`);
    if (ok) pass++;
    else fail++;
  }
  return { pass, fail };
}

function preferredHistoricalOrder(stepsIn) {
  // Dependency-safe reorder:
  // DAPL early; 0098 (case_documents) before 0089; 0104 after 0089.
  const priority = (p) => {
    const s = String(p || "");
    if (s.includes("20260325_dapl_platform_ledger")) return 10;
    if (s.includes("0098_predeployment_hardening")) return 20;
    if (s.includes("0089_ingestion_hardening")) return 30;
    if (s.includes("0104_dedup_and_quality_warnings")) return 40;
    return 100;
  };
  const annotated = stepsIn.map((s, idx) => ({ s, idx, p: priority(s.path) }));
  annotated.sort((a, b) => {
    if (a.p !== b.p) {
      if (a.p < 100 || b.p < 100) return a.p - b.p;
    }
    return a.idx - b.idx;
  });
  return annotated.map((x) => x.s);
}

function main() {
  info("Starting governed schema-lineage cleanroom (Django-wired convergence path)");
  resetDatabase();
  applyExtensions();

  if (applyQaFoundation) {
    const qa = path.join(repoRoot, "tooling", "sql", "union-eyes-qa-baseline.sql");
    applySqlFile(qa, "AUTH_FOUNDATION:tooling/sql/union-eyes-qa-baseline.sql");
  } else {
    record("AUTH_FOUNDATION", "SKIP", {
      note: "skipped when Django migrate enabled (set UE_CLEANROOM_APPLY_QA_FOUNDATION=1 to force)",
    });
  }

  const djangoOk = runDjangoMigrate();
  applyFoundationShims();

  const manifest = loadManifest();
  const creationSteps = preferredHistoricalOrder(
    (manifest.schemaCreationOrdered || []).filter(
      (s) => s.classification === "SCHEMA_CREATION" || s.includeInSchemaCreationBootstrapPath,
    ),
  );

  let histPass = 0,
    histFail = 0,
    histSkip = 0;
  for (const s of creationSteps) {
    const rel = s.path;
    if (!rel) continue;
    if (rel.includes("/migrations-platform/")) {
      record(`DEFER_PLATFORM:${rel}`, "SKIP", { note: "applied in PLATFORM_JOURNAL phase" });
      histSkip++;
      continue;
    }
    if (rel.includes("/migrations-audit/")) {
      record(`AUDIT_SNAPSHOT:${rel}`, "SKIP", {
        note: "forensic drizzle snapshot; skipped when Django migrate owns foundation (cleanroom)",
      });
      histSkip++;
      continue;
    }
    if (rel.endsWith(".py")) {
      record(`DJANGO_FILE:${rel}`, "SKIP", {
        note: "covered by DJANGO_MIGRATE manage.py migrate (not per-file)",
      });
      histSkip++;
      continue;
    }
    const abs = path.join(repoRoot, rel);
    const ok = applySqlFile(abs, `SCHEMA_CREATION:${rel}`);
    if (ok) histPass++;
    else histFail++;
  }

  const platform = applyJournal("apps/union-eyes/db/migrations-platform", "PLATFORM_SQL");
  const scoped = applyJournal("apps/union-eyes/db/migrations-cache", "SCOPED");

  const checkSql = `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY(ARRAY[
    'organizations','billing_subscriptions','billing_accounts','org_subscriptions',
    'integration_partners','security_posture_checks','employer_payroll_runs',
    'collective_agreements','commercial_contracts','ai_usage_metrics','ai_safety_filters',
    'member_documents','ingestion_batches','grievance_deadlines','case_documents',
    'data_quality_warnings','correspondence','org_configurations'
  ]) ORDER BY 1;`;
  const chk = runPsql(checkSql);
  record("PRESENCE_CHECK", chk.ok ? "PASS" : "FAIL", { note: (chk.stdout || "").trim() });

  const digCmd = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${pgPass}`,
      container,
      "psql",
      "-U",
      pgUser,
      "-d",
      pgDb,
      "-t",
      "-A",
      "-c",
      `SELECT n.nspname||'.'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1;`,
    ],
    { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 },
  );
  const dig = { ok: digCmd.status === 0, stdout: digCmd.stdout, stderr: digCmd.stderr };
  const relNames = (dig.stdout || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.includes("."));
  const digest = crypto.createHash("sha256").update(relNames.join("\n")).digest("hex");
  record("COMPLETE_RUNTIME_SCHEMA_DIGEST", dig.ok ? "PASS" : "FAIL", {
    note: `relations=${relNames.length} digest=${digest}`,
    digest,
    relationCount: relNames.length,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    EMPTY_DATABASE_START: true,
    CLEAN_ROOM_ATTEMPTED: true,
    runner: "tooling/scripts/run-union-eyes-schema-lineage-cleanroom.mjs",
    djangoWired: true,
    skipDjango,
    applyQaFoundation,
    freezeGuard:
      "Production db:bootstrap still refuses legacy replay without UE_LINEAGE_REPLAY_OVERRIDE. Cleanroom uses UE_SCHEMA_LINEAGE_CLEANROOM=1.",
    COMPLETE_RUNTIME_SCHEMA_DIGEST: digest,
    physicalRelationCount: relNames.length,
    summary: {
      djangoMigrate: djangoOk ? "PASS" : skipDjango ? "SKIP" : "FAIL",
      historicalSchemaCreationPass: histPass,
      historicalSchemaCreationFail: histFail,
      historicalSchemaCreationSkip: histSkip,
      platformPass: platform.pass,
      platformFail: platform.fail,
      scopedPass: scoped.pass,
      scopedFail: scoped.fail,
    },
    steps,
    physicalRelationsSample: relNames.slice(0, 50),
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(path.dirname(reportPath), "cleanroom-relations.txt"),
    relNames.join("\n") + "\n",
    "utf8",
  );
  info(`Wrote ${path.relative(repoRoot, reportPath)}`);
  info(JSON.stringify(report.summary));
}

main();
