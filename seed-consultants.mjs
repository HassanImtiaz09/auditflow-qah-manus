/**
 * seed-consultants.mjs
 *
 * Seeds the `consultantNames` roster table with the 14 QAH ENT consultants.
 * This script does NOT create user accounts and does NOT set any passwords.
 *
 * How real consultant accounts work
 * ----------------------------------
 * 1. The consultant registers at /register using their own email and password.
 * 2. The admin approves the account via /approvals (sets roleApproved = true).
 * 3. The admin links the new user account to a consultantNames row via
 *    User Management -> "Link Consultant" (calls users.updateLinkedConsultant).
 *
 * Once linked, the consultant's name appears in the Submit Audit dropdown and
 * they can see audits assigned to them in their Approval Queue.
 *
 * WARNING: If you are upgrading an existing deployment that was seeded with the
 * old version of this script (which created backdoor user accounts with a shared
 * password), run the companion cleanup script FIRST:
 *
 *   node cleanup-seeded-users.mjs
 *
 * That script deletes all users rows whose openId starts with "consultant-".
 *
 * Usage
 * -----
 *   node seed-consultants.mjs        (or: pnpm db:seed)
 *
 * Safe to re-run -- uses INSERT IGNORE keyed on fullName.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

// -- Consultant roster --------------------------------------------------------
const CONSULTANTS = [
  { title: "Mr",   fullName: "Costa Repanos",       grade: "Consultant - Head and Neck" },
  { title: "Miss", fullName: "Ellie Sproson",        grade: "Consultant - Paediatric and Laryngology" },
  { title: "Mr",   fullName: "Erik Nilssen",         grade: "Consultant - Rhinology" },
  { title: "Mr",   fullName: "Hani Nasef",           grade: "Consultant - Head and Neck" },
  { title: "Mr",   fullName: "Stephen Hayes",        grade: "Consultant - Rhinology" },
  { title: "Mr",   fullName: "Harish Vishwanathan",  grade: "Consultant - Rhinology" },
  { title: "Mr",   fullName: "Tim Biggs",            grade: "Consultant - Rhinology" },
  { title: "Mr",   fullName: "Jonathan Buckland",    grade: "Consultant - Otology" },
  { title: "Mr",   fullName: "Matt Ward",            grade: "Consultant - Head and Neck" },
  { title: "Mr",   fullName: "Mike Pringle",         grade: "Consultant - Otology" },
  { title: "Mr",   fullName: "Marcel Geyer",         grade: "Consultant - Otology" },
  { title: "Mr",   fullName: "Florian Schmidt",      grade: "Consultant - Head and Neck" },
  { title: "Mr",   fullName: "Moe Alsalem",          grade: "Consultant - Paediatric" },
  { title: "Mr",   fullName: "Rob Chessman",         grade: "Consultant - Otology" },
];

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  const now = new Date();
  let inserted = 0;
  let skipped = 0;

  for (const c of CONSULTANTS) {
    const [result] = await conn.execute(
      `INSERT IGNORE INTO consultantNames
         (title, fullName, grade, active, createdAt)
       VALUES (?, ?, ?, true, ?)`,
      [c.title, c.fullName, c.grade, now]
    );
    if (result.affectedRows > 0) {
      console.log(`  + Inserted: ${c.title}. ${c.fullName} (${c.grade})`);
      inserted++;
    } else {
      console.log(`  - Skipped (already exists): ${c.fullName}`);
      skipped++;
    }
  }

  await conn.end();
  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped.`);
  console.log("No user accounts or passwords were created.");
  console.log("Consultants must register at /register and be approved by the admin.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
