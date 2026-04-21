export async function getDb() {
  try {
    const { db } = await import("@nzila/db");
    return db;
  } catch {
    return null;
  }
}
