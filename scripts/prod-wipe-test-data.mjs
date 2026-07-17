#!/usr/bin/env node

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                    PRODUCTION DATA WIPE UTILITY                            ║
 * ║                         ⚠️  DESTRUCTIVE OPERATION  ⚠️                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * USAGE:
 *   node scripts/prod-wipe-test-data.mjs --dry-run    # Preview what would be deleted
 *   node scripts/prod-wipe-test-data.mjs --confirm    # Actually delete (requires confirmation prompt)
 *
 * WHAT IT DOES:
 *   Deletes ALL test data and non-admin users from the database in a single transaction.
 *   This includes:
 *   - All audit comments
 *   - All audit trail events
 *   - All audits (drafts, pending, approved, rejected)
 *   - All password reset tokens
 *   - All notifications
 *   - All non-admin user accounts (keeps only admin(s))
 *
 * WHAT IT PRESERVES:
 *   - consultantNames table (the seeded NHS consultant roster — real data)
 *   - Admin user account(s) (identified by auditRole = 'admin')
 *   - refCounters table (if present)
 *
 * WHEN TO USE:
 *   - Development: Clean slate before testing new features
 *   - Staging: Reset before UAT cycles
 *   - Production: One-time reset before onboarding real users (use with extreme caution)
 *
 * ⚠️  WARNING: THIS IS IRREVERSIBLE
 *   - No backup is created automatically
 *   - Once deleted, data cannot be recovered
 *   - Always run with --dry-run first to verify counts
 *   - Ensure you have a database backup before running --confirm on production
 *
 * TRANSACTION SAFETY:
 *   All deletions happen in a single MySQL transaction. If any error occurs,
 *   the entire operation is rolled back and no data is modified.
 *
 * CONFIRMATION FLOW:
 *   1. Run with --dry-run to preview counts
 *   2. Review the output carefully
 *   3. Run with --confirm to proceed
 *   4. Type "WIPE PRODUCTION DATA" at the prompt to confirm
 *   5. Script prints before/after counts and JSON summary
 */

import mysql from 'mysql2/promise';
import readline from 'readline';

// ─── Configuration ────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isConfirm = args.includes('--confirm');

// ─── Colors for terminal output ───────────────────────────────────────────────

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ─── Validation ───────────────────────────────────────────────────────────────

if (!DATABASE_URL) {
  log('❌ ERROR: DATABASE_URL environment variable is not set', 'red');
  process.exit(1);
}

if (!isDryRun && !isConfirm) {
  log('╔════════════════════════════════════════════════════════════════╗', 'red');
  log('║  PRODUCTION DATA WIPE UTILITY                                  ║', 'red');
  log('║  ⚠️  DESTRUCTIVE OPERATION — REQUIRES A FLAG                   ║', 'red');
  log('╚════════════════════════════════════════════════════════════════╝', 'red');
  log('', 'red');
  log('Usage:', 'yellow');
  log('  node scripts/prod-wipe-test-data.mjs --dry-run', 'cyan');
  log('    → Preview what would be deleted (no changes)', 'cyan');
  log('', 'cyan');
  log('  node scripts/prod-wipe-test-data.mjs --confirm', 'cyan');
  log('    → Actually delete (requires typed confirmation)', 'cyan');
  log('', 'cyan');
  process.exit(1);
}

// ─── Helper: Get row count ─────────────────────────────────────────────────────

async function getRowCount(conn, table) {
  const [rows] = await conn.execute(`SELECT COUNT(*) as count FROM ${table}`);
  return rows[0].count;
}

// ─── Helper: Prompt for confirmation ───────────────────────────────────────────

async function promptConfirmation() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `${colors.red}${colors.bold}Type "WIPE PRODUCTION DATA" to confirm: ${colors.reset}`,
      (answer) => {
        rl.close();
        resolve(answer);
      }
    );
  });
}

// ─── Main script ───────────────────────────────────────────────────────────────

async function main() {
  let conn;

  try {
    // Connect to database
    conn = await mysql.createConnection(DATABASE_URL);

    // Print banner
    log('', 'reset');
    log('╔════════════════════════════════════════════════════════════════╗', 'red');
    log('║  PRODUCTION DATA WIPE UTILITY                                  ║', 'red');
    log('║  ⚠️  DESTRUCTIVE OPERATION — IRREVERSIBLE                      ║', 'red');
    log('╚════════════════════════════════════════════════════════════════╝', 'red');
    log('', 'reset');

    // Get BEFORE counts
    log('📊 BEFORE counts:', 'blue');
    const beforeCounts = {
      audits: await getRowCount(conn, 'audits'),
      auditComments: await getRowCount(conn, 'auditComments'),
      auditEvents: await getRowCount(conn, 'auditEvents'),
      notifications: await getRowCount(conn, 'notifications'),
      passwordResetTokens: await getRowCount(conn, 'passwordResetTokens'),
      users: await getRowCount(conn, 'users'),
    };

    log(`  audits:                ${beforeCounts.audits}`, 'cyan');
    log(`  auditComments:         ${beforeCounts.auditComments}`, 'cyan');
    log(`  auditEvents:           ${beforeCounts.auditEvents}`, 'cyan');
    log(`  notifications:         ${beforeCounts.notifications}`, 'cyan');
    log(`  passwordResetTokens:   ${beforeCounts.passwordResetTokens}`, 'cyan');
    log(`  users (total):         ${beforeCounts.users}`, 'cyan');
    log('', 'reset');

    // Get admin count (to verify we're not deleting them)
    const [adminRows] = await conn.execute(
      `SELECT COUNT(*) as count FROM users WHERE auditRole = 'admin'`
    );
    const adminCount = adminRows[0].count;
    log(`  admin users (protected): ${adminCount}`, 'green');
    log('', 'reset');

    if (isDryRun) {
      log('🔍 DRY RUN MODE — No changes will be made', 'yellow');
      log('', 'reset');

      // Calculate what WOULD be deleted
      const [nonAdminUsers] = await conn.execute(
        `SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND auditRole != 'admin'`
      );
      const nonAdminCount = nonAdminUsers[0].count;

      log('📋 WOULD DELETE:', 'yellow');
      log(`  auditComments:         ${beforeCounts.auditComments}`, 'cyan');
      log(`  auditEvents:           ${beforeCounts.auditEvents}`, 'cyan');
      log(`  audits:                ${beforeCounts.audits}`, 'cyan');
      log(`  passwordResetTokens:   ${beforeCounts.passwordResetTokens}`, 'cyan');
      log(`  notifications:         ${beforeCounts.notifications}`, 'cyan');
      log(`  non-admin users:       ${nonAdminCount}`, 'cyan');
      log('', 'reset');

      log('✅ Dry run complete. Review counts above, then run with --confirm to proceed.', 'green');
      process.exit(0);
    }

    // CONFIRM mode: ask for typed confirmation
    if (isConfirm) {
      log('⚠️  CONFIRM MODE — Data will be permanently deleted', 'red');
      log('', 'reset');

      const answer = await promptConfirmation();

      if (answer !== 'WIPE PRODUCTION DATA') {
        log('', 'reset');
        log('❌ Confirmation phrase incorrect. Operation cancelled.', 'red');
        process.exit(1);
      }

      log('', 'reset');
      log('🔄 Starting transaction...', 'yellow');

      // Start transaction
      await conn.execute('START TRANSACTION');

      try {
        // Delete in order (respecting foreign keys)
        log('🗑️  Deleting auditComments...', 'yellow');
        const [commentResult] = await conn.execute('DELETE FROM auditComments');
        const commentsDeleted = commentResult.affectedRows;

        log('🗑️  Deleting auditEvents...', 'yellow');
        const [eventsResult] = await conn.execute('DELETE FROM auditEvents');
        const eventsDeleted = eventsResult.affectedRows;

        log('🗑️  Deleting audits...', 'yellow');
        const [auditsResult] = await conn.execute('DELETE FROM audits');
        const auditsDeleted = auditsResult.affectedRows;

        log('🗑️  Deleting passwordResetTokens...', 'yellow');
        const [tokensResult] = await conn.execute('DELETE FROM passwordResetTokens');
        const tokensDeleted = tokensResult.affectedRows;

        log('🗑️  Deleting notifications...', 'yellow');
        const [notifResult] = await conn.execute('DELETE FROM notifications');
        const notificationsDeleted = notifResult.affectedRows;

        log('🗑️  Deleting non-admin users...', 'yellow');
        const [usersResult] = await conn.execute(
          `DELETE FROM users WHERE role != 'admin' AND auditRole != 'admin'`
        );
        const usersDeleted = usersResult.affectedRows;

        // Commit transaction
        log('✅ Committing transaction...', 'green');
        await conn.execute('COMMIT');

        log('', 'reset');
        log('📊 AFTER counts:', 'blue');

        // Get AFTER counts
        const afterCounts = {
          audits: await getRowCount(conn, 'audits'),
          auditComments: await getRowCount(conn, 'auditComments'),
          auditEvents: await getRowCount(conn, 'auditEvents'),
          notifications: await getRowCount(conn, 'notifications'),
          passwordResetTokens: await getRowCount(conn, 'passwordResetTokens'),
          users: await getRowCount(conn, 'users'),
        };

        log(`  audits:                ${afterCounts.audits}`, 'cyan');
        log(`  auditComments:         ${afterCounts.auditComments}`, 'cyan');
        log(`  auditEvents:           ${afterCounts.auditEvents}`, 'cyan');
        log(`  notifications:         ${afterCounts.notifications}`, 'cyan');
        log(`  passwordResetTokens:   ${afterCounts.passwordResetTokens}`, 'cyan');
        log(`  users (total):         ${afterCounts.users}`, 'cyan');
        log('', 'reset');

        // Print summary
        const summary = {
          auditsDeleted,
          commentsDeleted,
          eventsDeleted,
          notificationsDeleted,
          tokensDeleted,
          usersDeleted,
          adminUsersPreserved: adminCount,
          timestamp: new Date().toISOString(),
        };

        log('📋 DELETION SUMMARY (JSON):', 'green');
        log(JSON.stringify(summary, null, 2), 'green');
        log('', 'reset');

        log('✅ Data wipe completed successfully!', 'green');
        log('   All test data and non-admin users have been removed.', 'green');
        log('   Admin account(s) and consultantNames roster preserved.', 'green');
      } catch (error) {
        log('', 'reset');
        log('❌ Error during deletion. Rolling back transaction...', 'red');
        await conn.execute('ROLLBACK');
        throw error;
      }
    }

    await conn.end();
  } catch (error) {
    log('', 'reset');
    log('❌ Fatal error:', 'red');
    log(error.message, 'red');
    if (error.stack) {
      log(error.stack, 'red');
    }
    process.exit(1);
  }
}

main();
