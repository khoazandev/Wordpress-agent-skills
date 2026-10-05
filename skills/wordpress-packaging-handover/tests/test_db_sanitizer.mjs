/**
 * Test Suite: Database Sanitizer & MySQL Dump (db_sanitizer.mjs)
 * Module: scripts/db_sanitizer.mjs
 *
 * Live-database tests only run when WP_LIVE_PROJECT points at a local WordPress
 * install whose wp-config.php has working DB credentials, e.g.
 *   WP_LIVE_PROJECT=/path/to/site node tests/test_db_sanitizer.mjs
 * Optional: WP_LIVE_OLD_URL (defaults to http://localhost/<folder name>).
 * Without it they print [SKIP] so the suite stays green on any machine/CI.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { dumpDatabase, readDbConfig, purgeDatabaseTransients } from '../scripts/db_sanitizer.mjs';
import { findBinary } from '../scripts/lib/find-binary.mjs';

console.log('=== RUNNING DATABASE SANITIZER & DUMP TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;
let skipCount = 0;

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${testName}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) {
      console.error(`       Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
    }
    failCount++;
  }
}

const PHP_CLI = findBinary('php');
const MYSQLDUMP_CLI = findBinary('mysqldump');
const LIVE_PROJECT_PATH = process.env.WP_LIVE_PROJECT || null;
const LIVE_OLD_URL = process.env.WP_LIVE_OLD_URL
  || (LIVE_PROJECT_PATH ? `http://localhost/${path.basename(LIVE_PROJECT_PATH)}` : null);

function skipTest(testName, reason) {
  console.log(`[SKIP] ${testName} (${reason})`);
  skipCount++;
}

/** Runs fn only when a live WordPress project is configured and PHP exists. */
async function liveTest(testName, fn) {
  if (!LIVE_PROJECT_PATH) return skipTest(testName, 'set WP_LIVE_PROJECT to run');
  if (!PHP_CLI) return skipTest(testName, 'PHP CLI not found');
  return runAsyncTest(testName, fn);
}

/**
 * Helper to run a short PHP PDO query on the live database configured in
 * WP_LIVE_PROJECT/wp-config.php (credentials are read, never hard-coded).
 */
function runLivePhpQuery(queryPhp) {
  const cfg = readDbConfig(LIVE_PROJECT_PATH);
  const dsn = `mysql:host=${cfg.dbHost};port=${cfg.dbPort || 3306};dbname=${cfg.dbName};charset=${cfg.dbCharset || 'utf8mb4'}`;
  const code = `<?php
    $pdo = new PDO(${JSON.stringify(dsn)}, ${JSON.stringify(cfg.dbUser)}, ${JSON.stringify(cfg.dbPassword)}, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    ${queryPhp.replaceAll('wp_options', `${cfg.tablePrefix}options`)}
  `;
  const tempScript = path.join(os.tmpdir(), `test-query-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.php`);
  fs.writeFileSync(tempScript, code, 'utf8');
  try {
    const result = execFileSync(PHP_CLI, [tempScript], { encoding: 'utf8' });
    return result.trim();
  } finally {
    try {
      if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    } catch {}
  }
}

/**
 * Helper to create a temp fixture directory
 */
function createTempDir(prefix) {
  const dir = path.join(os.tmpdir(), `wp-db-fixture-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function main() {
  // --------------------------------------------------------------------------
  // TEST 1: Reading DB config from wp-config.php
  // --------------------------------------------------------------------------
  await runAsyncTest('Test 1.1: Reads DB config accurately from fixture wp-config.php', async () => {
    const fixtureDir = createTempDir('read-config');
    const mockConfig = `<?php
      define( 'DB_NAME', 'mock_store_db' );
      define( 'DB_USER', 'mock_admin' );
      define( 'DB_PASSWORD', 's3cr3t_p@ss!' );
      define( 'DB_HOST', '127.0.0.1:3307' );
      define( 'DB_CHARSET', 'utf8mb4' );
      define( 'DB_COLLATE', 'utf8mb4_unicode_ci' );
      $table_prefix = 'tx_';
    `;
    fs.writeFileSync(path.join(fixtureDir, 'wp-config.php'), mockConfig, 'utf8');

    const config = readDbConfig(fixtureDir);
    assert.strictEqual(config.dbName, 'mock_store_db');
    assert.strictEqual(config.dbUser, 'mock_admin');
    assert.strictEqual(config.dbPassword, 's3cr3t_p@ss!');
    assert.strictEqual(config.dbHost, '127.0.0.1');
    assert.strictEqual(config.dbPort, 3307);
    assert.strictEqual(config.dbCharset, 'utf8mb4');
    assert.strictEqual(config.dbCollate, 'utf8mb4_unicode_ci');
    assert.strictEqual(config.tablePrefix, 'tx_');
  });

  await liveTest('Test 1.2: Reads DB config from the live project in WP_LIVE_PROJECT', async () => {
    const config = readDbConfig(LIVE_PROJECT_PATH);
    assert.ok(typeof config.dbName === 'string' && config.dbName.length > 0, 'dbName must be a non-empty string');
    assert.ok(typeof config.dbUser === 'string' && config.dbUser.length > 0, 'dbUser must be a non-empty string');
    assert.ok(typeof config.dbHost === 'string' && config.dbHost.length > 0, 'dbHost must be a non-empty string');
    assert.ok(typeof config.tablePrefix === 'string' && config.tablePrefix.length > 0, 'tablePrefix must be a non-empty string');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Safety guards & error handling
  // --------------------------------------------------------------------------
  await runAsyncTest('Test 2.1: Throws error when projectPath is missing or invalid', async () => {
    await assert.rejects(
      async () => await dumpDatabase('', 'dump.sql'),
      /Invalid project path/i
    );

    await assert.rejects(
      async () => await dumpDatabase(path.join(os.tmpdir(), 'non_existent_folder_xyz_123'), 'dump.sql'),
      /not found|does not exist/i
    );
  });

  await runAsyncTest('Test 2.2: Throws error when wp-config.php is missing', async () => {
    const fixtureDir = createTempDir('missing-config');
    await assert.rejects(
      async () => await dumpDatabase(fixtureDir, path.join(fixtureDir, 'out.sql')),
      /wp-config\.php not found/i
    );
  });

  await ((PHP_CLI || MYSQLDUMP_CLI) ? runAsyncTest : (n) => skipTest(n, 'neither PHP nor mysqldump found'))('Test 2.3: Throws error on invalid DB credentials', async () => {
    const fixtureDir = createTempDir('invalid-db');
    const mockConfig = `<?php
      define('DB_NAME', 'non_existent_db_99999');
      define('DB_USER', 'invalid_user_99999');
      define('DB_PASSWORD', 'wrong_pass');
      define('DB_HOST', 'localhost');
      $table_prefix = 'wp_';
    `;
    fs.writeFileSync(path.join(fixtureDir, 'wp-config.php'), mockConfig, 'utf8');

    await assert.rejects(
      async () => await dumpDatabase(fixtureDir, path.join(fixtureDir, 'out.sql')),
      /Access denied|Unknown database|failed|connection|connect/i
    );
  });

  await liveTest('Test 2.4: Automatically creates nested non-existent directory for outputPath', async () => {
    const tempDir = createTempDir('nested-output');
    const deeplyNestedPath = path.join(tempDir, 'sub1', 'sub2', 'nested_dump.sql');

    const result = await dumpDatabase(LIVE_PROJECT_PATH, deeplyNestedPath, {
      forcePhpFallback: true,
      purgeTransients: false
    });

    assert.strictEqual(fs.existsSync(deeplyNestedPath), true, 'Nested output file should exist');
    assert.strictEqual(result.dumpPath, deeplyNestedPath);
    assert(result.sizeBytes > 0, 'Dump file size should be > 0');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Purging transients from wp_options and actionscheduler_logs
  // --------------------------------------------------------------------------
  await liveTest('Test 3.1: Purges transients and cleans actionscheduler_logs', async () => {
    const probeKey = '_transient_test_purge_probe_' + Date.now();
    const probeSiteKey = '_site_transient_test_purge_probe_' + Date.now();

    runLivePhpQuery(`
      $stmt = $pdo->prepare("INSERT INTO wp_options (option_name, option_value, autoload) VALUES (?, ?, 'no')");
      $stmt->execute(['${probeKey}', 'probe_value']);
      $stmt->execute(['${probeSiteKey}', 'site_probe_value']);
    `);

    const countBefore = runLivePhpQuery(`
      $stmt = $pdo->query("SELECT COUNT(*) FROM wp_options WHERE option_name IN ('${probeKey}', '${probeSiteKey}')");
      echo $stmt->fetchColumn();
    `);
    assert.strictEqual(parseInt(countBefore, 10), 2, 'Probes should exist before purge');

    const config = readDbConfig(LIVE_PROJECT_PATH);
    const purgeResult = await purgeDatabaseTransients(config);
    assert(purgeResult.transientsDeleted >= 2, 'Should delete at least 2 probe transients');

    const countAfter = runLivePhpQuery(`
      $stmt = $pdo->query("SELECT COUNT(*) FROM wp_options WHERE option_name IN ('${probeKey}', '${probeSiteKey}')");
      echo $stmt->fetchColumn();
    `);
    assert.strictEqual(parseInt(countAfter, 10), 0, 'Probes must be deleted after purge');
  });

  await liveTest('Test 3.2: Respects purgeTransients: false option', async () => {
    const probeKey = '_transient_test_preserve_probe_' + Date.now();
    runLivePhpQuery(`
      $stmt = $pdo->prepare("INSERT INTO wp_options (option_name, option_value, autoload) VALUES (?, 'preserve_val', 'no')");
      $stmt->execute(['${probeKey}']);
    `);

    const tempDir = createTempDir('no-purge');
    const outSql = path.join(tempDir, 'no_purge.sql');

    try {
      await dumpDatabase(LIVE_PROJECT_PATH, outSql, {
        purgeTransients: false,
        forcePhpFallback: true
      });

      const countAfter = runLivePhpQuery(`
        $stmt = $pdo->query("SELECT COUNT(*) FROM wp_options WHERE option_name = '${probeKey}'");
        echo $stmt->fetchColumn();
      `);
      assert.strictEqual(parseInt(countAfter, 10), 1, 'Probe transient should NOT be deleted when purgeTransients is false');
    } finally {
      runLivePhpQuery(`$pdo->exec("DELETE FROM wp_options WHERE option_name = '${probeKey}'");`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Dumping DB using mysqldump CLI method
  // --------------------------------------------------------------------------
  await (MYSQLDUMP_CLI ? liveTest : (n) => skipTest(n, 'mysqldump not found'))('Test 4.1: Dumps DB using mysqldump CLI with valid statements & encoding', async () => {
    const tempDir = createTempDir('mysqldump-test');
    const outSql = path.join(tempDir, 'live_cli.sql');

    const result = await dumpDatabase(LIVE_PROJECT_PATH, outSql, {
      forcePhpFallback: false,
      purgeTransients: true
    });

    assert.strictEqual(result.method, 'mysqldump', 'Should use mysqldump CLI method');
    assert.strictEqual(result.dumpPath, outSql);
    assert.strictEqual(fs.existsSync(outSql), true, 'SQL file must exist');
    assert(result.sizeBytes > 0, `Expected a non-empty dump, got ${result.sizeBytes} bytes`);
    assert(result.tableCount >= 1, `Expected at least 1 table, got ${result.tableCount}`);

    const content = fs.readFileSync(outSql, 'utf8');
    assert(content.includes('DROP TABLE IF EXISTS'), 'Should contain DROP TABLE statements');
    assert(content.includes('CREATE TABLE'), 'Should contain CREATE TABLE statements');
    assert(content.includes('INSERT INTO'), 'Should contain INSERT INTO data');
    assert(content.includes('utf8mb4'), 'Should support utf8mb4 encoding');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Dumping DB using PHP fallback method
  // --------------------------------------------------------------------------
  await liveTest('Test 5.1: Dumps DB using PHP fallback method with batch processing', async () => {
    const tempDir = createTempDir('php-fallback-test');
    const outSql = path.join(tempDir, 'live_fallback.sql');

    const result = await dumpDatabase(LIVE_PROJECT_PATH, outSql, {
      forcePhpFallback: true,
      purgeTransients: true
    });

    assert.strictEqual(result.method, 'php_fallback', 'Should use php_fallback method');
    assert.strictEqual(result.dumpPath, outSql);
    assert.strictEqual(fs.existsSync(outSql), true, 'SQL file must exist');
    assert(result.sizeBytes > 0, `Expected a non-empty fallback dump, got ${result.sizeBytes} bytes`);
    assert(result.tableCount >= 1, `Expected at least 1 table, got ${result.tableCount}`);

    const content = fs.readFileSync(outSql, 'utf8');
    assert(content.includes('DROP TABLE IF EXISTS'), 'Fallback dump must contain DROP TABLE');
    assert(content.includes('CREATE TABLE'), 'Fallback dump must contain CREATE TABLE');
    assert(content.includes('INSERT INTO'), 'Fallback dump must contain INSERT INTO');
    assert(content.includes('utf8mb4'), 'Fallback dump must declare utf8mb4');
    assert(content.includes('FOREIGN_KEY_CHECKS'), 'Fallback dump must manage foreign key checks');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Option safeSerializedReplace
  // --------------------------------------------------------------------------
  await liveTest('Test 6.1: Applies safeSerializedReplace to output SQL dump without corrupting serialize', async () => {
    const tempDir = createTempDir('replace-test');
    const outSql = path.join(tempDir, 'live_replaced.sql');
    const oldUrl = LIVE_OLD_URL;
    const newUrl = 'https://demo-site.example';

    await dumpDatabase(LIVE_PROJECT_PATH, outSql, {
      forcePhpFallback: true,
      purgeTransients: false,
      safeSerializedReplace: { oldUrl, newUrl }
    });

    assert.strictEqual(fs.existsSync(outSql), true);
    const sqlContent = fs.readFileSync(outSql, 'utf8');

    assert(!sqlContent.includes(oldUrl), `SQL dump should no longer contain ${oldUrl} (set WP_LIVE_OLD_URL if the site URL differs)`);
    assert(sqlContent.includes(newUrl), 'SQL dump should contain newUrl');

    const regex = /s:(\d+):\\"([^\\"]+)\\"/g;
    let match;
    let verifiedCount = 0;
    while ((match = regex.exec(sqlContent)) !== null) {
      const len = parseInt(match[1], 10);
      const str = match[2];
      const actualByteLen = Buffer.byteLength(str, 'utf8');
      assert.strictEqual(len, actualByteLen, `Serialized length mismatch: declared ${len} vs actual ${actualByteLen} for "${str}"`);
      verifiedCount++;
      if (verifiedCount >= 20) break;
    }
    assert(verifiedCount > 0, 'Should have verified at least one serialized string');
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n========================================');
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED, ${skipCount} SKIPPED`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
