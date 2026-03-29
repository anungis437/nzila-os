const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { sql } = require("drizzle-orm");
const client = postgres({ host:"localhost", port:5433, database:"nzila_automation", username:"nzila", password:"nzila_dev" });
const db = drizzle(client);
(async () => {
  try {
    const r = await db.execute(sql`SELECT count(*)::int as ct FROM grievances`);
    console.log("grievances count:", JSON.stringify(r));
    const r2 = await db.execute(sql`SELECT count(*)::int as ct FROM claims`);
    console.log("claims count:", JSON.stringify(r2));
    const r3 = await db.execute(sql`SELECT count(*)::int as ct FROM organization_members`);
    console.log("org_members count:", JSON.stringify(r3));
  } catch(e) { console.error("ERROR:", e.message); }
  await client.end();
})();
