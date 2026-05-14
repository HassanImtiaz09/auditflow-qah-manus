/**
 * cleanup-seeded-users.mjs
 *
 * One-time cleanup script for deployments that were seeded using the OLD
 * version of seed-consultants.mjs, which created 14 backdoor user accounts
 * with a shared default password.
 *
 * This script deletes all rows from the `users` table whose openId starts
 * with "consultant-" (the pattern used by the old seeder).
 *
 * Run ONCE on any existing deployment before or after upgrading to the new
 * seed-consultants.mjs. Safe to run on a clean deployment (will delete 0 rows).
 *
 * Usage
 * -----
 *   node cleanup-seeded-users.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // Preview which rows will be deleted
  const [rows] = await conn.execute(
    `SELECT id, openId, email, fullName FROM users WHERE openId LIKE 'consultant-%'`
  );

  if (rows.length === 0) {
    console.log("No seeded consultant user accounts found. Nothing to delete.");
    await conn.end();
    return;
  }

  console.log(`Found ${rows.length} seeded consultant account(s) to delete:`);
  for (const row of rows) {
    console.log(`  - id=${row.id}  openId=${row.openId}  email=${row.email}  name=${row.fullName}`);
  }

  const [result] = await conn.execute(
    `DELETE FROM users WHERE openId LIKE 'consultant-%'`
  );

  await conn.end();
  console.log(`\nDeleted ${result.affectedRows} row(s).`);
  console.log("Backdoor accounts removed. Real consultants must register at /register.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
