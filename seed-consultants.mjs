/**
 * seed-consultants.mjs
 *
 * Inserts 14 QAH ENT consultants as pre-approved user accounts.
 * Each consultant gets:
 *   - auditRole = "consultant"
 *   - approved = true
 *   - roleApproved = true
 *   - loginMethod = "password"
 *   - a temporary password hash (bcrypt of "ChangeMe123!")
 *   - a unique openId derived from their name slug
 *   - an NHS email derived from their name slug @porthosp.nhs.uk
 *
 * Run with: node seed-consultants.mjs
 * Safe to re-run — uses INSERT IGNORE to skip existing records.
 */

import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// ── Consultant data ────────────────────────────────────────────────────────────
const CONSULTANTS = [
  { title: "Mr",   fullName: "Costa Repanos",       grade: "Consultant — Head and Neck" },
  { title: "Miss", fullName: "Ellie Sproson",        grade: "Consultant — Paediatric and Laryngology" },
  { title: "Mr",   fullName: "Erik Nilssen",         grade: "Consultant — Rhinology" },
  { title: "Mr",   fullName: "Hani Nasef",           grade: "Consultant — Head and Neck" },
  { title: "Mr",   fullName: "Stephen Hayes",        grade: "Consultant — Rhinology" },
  { title: "Mr",   fullName: "Harish Vishwanathan",  grade: "Consultant — Rhinology" },
  { title: "Mr",   fullName: "Tim Biggs",            grade: "Consultant — Rhinology" },
  { title: "Mr",   fullName: "Jonathan Buckland",    grade: "Consultant — Otology" },
  { title: "Mr",   fullName: "Matt Ward",            grade: "Consultant — Head and Neck" },
  { title: "Mr",   fullName: "Mike Pringle",         grade: "Consultant — Otology" },
  { title: "Mr",   fullName: "Marcel Geyer",         grade: "Consultant — Otology" },
  { title: "Mr",   fullName: "Florian Schmidt",      grade: "Consultant — Head and Neck" },
  { title: "Mr",   fullName: "Moe Alsalem",          grade: "Consultant — Paediatric" },
  { title: "Mr",   fullName: "Rob Chessman",         grade: "Consultant — Otology" },
];

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z.]/g, "");
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // Generate a single shared temporary password hash
  const tempHash = await bcrypt.hash("ChangeMe123!", 10);
  const now = new Date();

  let inserted = 0;
  let skipped = 0;

  for (const c of CONSULTANTS) {
    const slug = toSlug(c.fullName);
    const openId = `consultant-${slug}`;
    const email = `${slug}@porthosp.nhs.uk`;
    const displayName = `${c.title}. ${c.fullName}`;

    const [result] = await conn.execute(
      `INSERT IGNORE INTO users
         (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn,
          fullName, title, grade, auditRole, passwordHash, approved, roleApproved)
       VALUES (?, ?, ?, 'password', 'user', ?, ?, ?,
               ?, ?, ?, 'consultant', ?, true, true)`,
      [openId, displayName, email, now, now, now, displayName, c.title, c.grade, tempHash]
    );

    if (result.affectedRows > 0) {
      console.log(`  ✓ Inserted: ${displayName} <${email}>`);
      inserted++;
    } else {
      console.log(`  – Skipped (already exists): ${displayName}`);
      skipped++;
    }
  }

  await conn.end();
  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped.`);
  console.log(`Temporary password for all new accounts: ChangeMe123!`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
