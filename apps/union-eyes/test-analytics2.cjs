const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { sql } = require("drizzle-orm");
const client = postgres({ host:"localhost", port:5433, database:"nzila_automation", username:"nzila", password:"nzila_dev" });
const db = drizzle(client);

(async () => {
  try {
    // Test FILTER (WHERE ...) syntax
    console.log("Test 1: FILTER syntax");
    const r1 = await db.execute(sql`SELECT 
      count(*)::int as total,
      count(*) FILTER (WHERE status IN ('settled','withdrawn','denied','closed'))::int as resolved
      FROM grievances`);
    console.log("  Result:", JSON.stringify(r1));

    // Test to_char and extract
    console.log("Test 2: to_char and extract");
    const r2 = await db.execute(sql`SELECT 
      to_char(created_at, 'Mon') as month,
      extract(month from created_at)::int as month_num,
      extract(year from created_at)::int as year_num,
      count(*)::int as total
      FROM grievances
      GROUP BY to_char(created_at, 'Mon'), extract(month from created_at), extract(year from created_at)
      ORDER BY extract(year from created_at), extract(month from created_at)
      LIMIT 12`);
    console.log("  Result:", JSON.stringify(r2));

    // Test AVG response time
    console.log("Test 3: AVG response time");
    const r3 = await db.execute(sql`SELECT COALESCE(
      ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - filed_date)) / 3600)::numeric, 1),
      0
    )::float as avg_hrs
    FROM grievances
    WHERE resolved_at IS NOT NULL AND filed_date IS NOT NULL`);
    console.log("  Result:", JSON.stringify(r3));

    // Test union_rep_id grouping
    console.log("Test 4: Top reps");
    const r4 = await db.execute(sql`SELECT 
      union_rep_id,
      count(*)::int as total,
      count(*) FILTER (WHERE status IN ('settled','withdrawn','denied','closed'))::int as resolved
      FROM grievances
      WHERE union_rep_id IS NOT NULL
      GROUP BY union_rep_id
      ORDER BY count(*) DESC
      LIMIT 5`);
    console.log("  Result:", JSON.stringify(r4));

    // Test grievances by type
    console.log("Test 5: By type");
    const r5 = await db.execute(sql`SELECT type, count(*)::int as ct FROM grievances GROUP BY type ORDER BY count(*) DESC`);
    console.log("  Result:", JSON.stringify(r5));

    // Test org members role filter
    console.log("Test 6: Stewards");
    const r6 = await db.execute(sql`SELECT count(*)::int as ct FROM organization_members WHERE lower(role) LIKE '%steward%'`);
    console.log("  Result:", JSON.stringify(r6));

    console.log("\nAll tests passed!");
  } catch(e) { 
    console.error("ERROR:", e.message);
    console.error("Stack:", e.stack);
  }
  await client.end();
})();
