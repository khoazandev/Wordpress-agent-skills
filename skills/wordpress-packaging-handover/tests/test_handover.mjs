/**
 * Test Suite: Master Orchestrator CLI (handover.mjs)
 * Module: <skill-dir>/scripts/handover.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runHandover, parseArgs, formatDualSize } from '../scripts/handover.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../scripts/handover.mjs');

console.log('=== RUNNING HANDOVER MASTER CLI TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;

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

/**
 * Helper to construct a realistic WordPress project fixture directory
 */
function createProjectFixture(projectName = 'MockHandoverSite') {
  const tempDir = path.join(os.tmpdir(), `wp-handover-${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. Root files
  fs.writeFileSync(path.join(tempDir, 'index.php'), '<?php // WordPress entrypoint', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'wp-config.php'), `<?php
define( 'DB_NAME', 'mock_handover_db' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

define( 'AUTH_KEY',         'put your unique phrase here' );
define( 'SECURE_AUTH_KEY',  'put your unique phrase here' );
define( 'LOGGED_IN_KEY',    'put your unique phrase here' );
define( 'NONCE_KEY',        'put your unique phrase here' );
define( 'AUTH_SALT',        'put your unique phrase here' );
define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );
define( 'LOGGED_IN_SALT',   'put your unique phrase here' );
define( 'NONCE_SALT',       'put your unique phrase here' );

$table_prefix = 'wp_';
`, 'utf8');
  fs.writeFileSync(path.join(tempDir, 'wp-config-sample.php'), '<?php // sample config', 'utf8');
  fs.writeFileSync(path.join(tempDir, '.htaccess'), '# BEGIN WordPress\nRewriteEngine On\n# END WordPress', 'utf8');

  // Junk root files to verify cleaner
  fs.writeFileSync(path.join(tempDir, 'backup.bak'), 'junk backup', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'temp.tmp'), 'temporary file', 'utf8');

  // 2. wp-admin & wp-includes
  fs.mkdirSync(path.join(tempDir, 'wp-admin'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'wp-admin', 'admin.php'), '<?php // admin', 'utf8');

  fs.mkdirSync(path.join(tempDir, 'wp-includes'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'wp-includes', 'version.php'), '<?php $wp_version = "6.5";', 'utf8');

  // 3. Themes: flatsome (parent) and flatsome-child
  const themesDir = path.join(tempDir, 'wp-content', 'themes');
  fs.mkdirSync(path.join(themesDir, 'flatsome'), { recursive: true });
  fs.writeFileSync(path.join(themesDir, 'flatsome', 'style.css'), '/*\nTheme Name: Flatsome\n*/', 'utf8');
  fs.writeFileSync(path.join(themesDir, 'flatsome', 'functions.php'), '<?php // Flatsome core', 'utf8');

  fs.mkdirSync(path.join(themesDir, 'flatsome-child'), { recursive: true });
  fs.writeFileSync(path.join(themesDir, 'flatsome-child', 'style.css'), '/*\nTheme Name: Flatsome Child\nTemplate: flatsome\n*/', 'utf8');
  fs.writeFileSync(path.join(themesDir, 'flatsome-child', 'functions.php'), '<?php // Child customizations', 'utf8');
  fs.writeFileSync(path.join(themesDir, 'flatsome-child', 'sketch.psd'), 'heavy psd file data', 'utf8');

  // 4. Plugins: active plugin + junk hello.php
  const pluginsDir = path.join(tempDir, 'wp-content', 'plugins');
  fs.mkdirSync(path.join(pluginsDir, 'my-active-plugin'), { recursive: true });
  fs.writeFileSync(path.join(pluginsDir, 'my-active-plugin', 'my-active-plugin.php'), '<?php // Plugin Name: Active', 'utf8');
  fs.writeFileSync(path.join(pluginsDir, 'hello.php'), '<?php // Hello Dolly junk', 'utf8');

  // 5. Uploads with wc-logs
  const uploadsDir = path.join(tempDir, 'wp-content', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, 'banner.jpg'), 'fake-jpeg-data', 'utf8');
  const wcLogsDir = path.join(uploadsDir, 'wc-logs');
  fs.mkdirSync(wcLogsDir, { recursive: true });
  fs.writeFileSync(path.join(wcLogsDir, 'error.log'), 'error logs data', 'utf8');

  return tempDir;
}

// =============================================================================
// TEST 1: Argument Parsing (parseArgs)
// =============================================================================
await runAsyncTest('Test 1: parseArgs correctly parses all CLI flags with = and space syntax', () => {
  // Test defaults
  const defaults = parseArgs([]);
  assert.strictEqual(defaults.parentThemeMode, 'bundle');
  assert.strictEqual(defaults.regenerateSalts, false);
  assert.strictEqual(defaults.cleanInactivePlugins, false);
  assert.strictEqual(defaults.skipClean, false);
  assert.strictEqual(defaults.skipDb, false);
  assert.strictEqual(defaults.themesOnly, false);
  assert.strictEqual(defaults.dryRun, false);
  assert.strictEqual(defaults.help, false);
  assert.ok(defaults.path, 'default path must be set');
  assert.ok(defaults.output, 'default output must be set');

  // Test full flags with = syntax
  const parsedEqual = parseArgs([
    '--path=/custom/wp/path',
    '--output=/custom/output/dist',
    '--parent-theme-mode=external-license',
    '--regenerate-salts',
    '--clean-inactive-plugins',
    '--skip-clean',
    '--skip-db',
    '--themes-only',
    '--dry-run',
    '--auth-token=secret_hex_1234',
    '--php-fallback-dump'
  ]);

  assert.strictEqual(parsedEqual.path, path.resolve('/custom/wp/path'));
  assert.strictEqual(parsedEqual.output, path.resolve('/custom/output/dist'));
  assert.strictEqual(parsedEqual.parentThemeMode, 'external-license');
  assert.strictEqual(parsedEqual.regenerateSalts, true);
  assert.strictEqual(parsedEqual.cleanInactivePlugins, true);
  assert.strictEqual(parsedEqual.skipClean, true);
  assert.strictEqual(parsedEqual.skipDb, true);
  assert.strictEqual(parsedEqual.themesOnly, true);
  assert.strictEqual(parsedEqual.dryRun, true);
  assert.strictEqual(parsedEqual.authToken, 'secret_hex_1234');
  assert.strictEqual(parsedEqual.phpFallbackDump, true);
  assert.strictEqual(parsedEqual.help, false);

  // Test space-separated flags and help
  const parsedSpace = parseArgs([
    '--path', '/another/wp',
    '--output', '/another/out',
    '--parent-theme-mode', 'bundle',
    '--auth-token', 'mytoken',
    '-h'
  ]);
  assert.strictEqual(parsedSpace.path, path.resolve('/another/wp'));
  assert.strictEqual(parsedSpace.output, path.resolve('/another/out'));
  assert.strictEqual(parsedSpace.parentThemeMode, 'bundle');
  assert.strictEqual(parsedSpace.authToken, 'mytoken');
  assert.strictEqual(parsedSpace.help, true);
});

// =============================================================================
// TEST 2: Dual-size Formatter (formatDualSize)
// =============================================================================
await runAsyncTest('Test 2: formatDualSize correctly formats Base-2 (MiB/KiB) vs Base-10 (MB/KB)', () => {
  // Test exact brief example: 136,314,880 bytes -> 130.00 MiB / 136.31 MB
  const size1 = formatDualSize(136314880);
  assert.strictEqual(size1.base2, '130.00 MiB');
  assert.strictEqual(size1.base10, '136.31 MB');
  assert.strictEqual(size1.formatted, '130.00 MiB / 136.31 MB');
  assert.strictEqual(String(size1), '130.00 MiB / 136.31 MB');

  // Test KiB / KB: 20,480 bytes -> 20.00 KiB / 20.48 KB
  const size2 = formatDualSize(20480);
  assert.strictEqual(size2.base2, '20.00 KiB');
  assert.strictEqual(size2.base10, '20.48 KB');
  assert.strictEqual(size2.formatted, '20.00 KiB / 20.48 KB');

  // Test 0 bytes
  const sizeZero = formatDualSize(0);
  assert.strictEqual(sizeZero.base2, '0 B');
  assert.strictEqual(sizeZero.base10, '0 B');
  assert.strictEqual(sizeZero.formatted, '0 B / 0 B');

  // Test 512 bytes
  const sizeBytes = formatDualSize(512);
  assert.strictEqual(sizeBytes.base2, '512 B');
  assert.strictEqual(sizeBytes.base10, '512 B');

  // Test GiB / GB: 1,073,741,824 bytes -> 1.00 GiB / 1.07 GB
  const sizeGiga = formatDualSize(1073741824);
  assert.strictEqual(sizeGiga.base2, '1.00 GiB');
  assert.strictEqual(sizeGiga.base10, '1.07 GB');
});

// =============================================================================
// TEST 3: Programmatic Invocation (runHandover)
// =============================================================================
await runAsyncTest('Test 3: runHandover executes full sequential pipeline and returns structured summary', async () => {
  const fixtureDir = createProjectFixture('TestSiteFull');
  const outputDir = path.join(fixtureDir, 'dong_goi_du_an');

  // Intercept console.log to verify table and auth token link output
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog(...args);
  };

  try {
    const result = await runHandover({
      path: fixtureDir,
      output: outputDir,
      parentThemeMode: 'bundle',
      regenerateSalts: true,
      skipDb: true, // Use skipDb for temp fixture since mock DB isn't running
      activeTheme: 'flatsome-child',
      activePlugins: ['my-active-plugin/my-active-plugin.php']
    });

    // 1. Verify returned result structure
    assert.strictEqual(result.success, true, 'Result success must be true');
    assert.ok(typeof result.authToken === 'string' && result.authToken.length === 16, 'AuthToken must be 16-hex string');
    assert.ok(Array.isArray(result.packages) && result.packages.length > 0, 'Packages must be a non-empty array');
    assert.ok(Array.isArray(result.table) && result.table.length > 0, 'Table must be a non-empty array');

    // 2. Verify sequential step effects
    // Step 1: Cleaned files
    assert.ok(!fs.existsSync(path.join(fixtureDir, 'backup.bak')), 'backup.bak should have been cleaned');
    assert.ok(!fs.existsSync(path.join(fixtureDir, 'temp.tmp')), 'temp.tmp should have been cleaned');
    assert.ok(!fs.existsSync(path.join(fixtureDir, 'wp-content/themes/flatsome-child/sketch.psd')), 'sketch.psd should have been cleaned');

    // Step 2: Patched wp-config.php with dynamic snippet & regenerated salts
    const configContent = fs.readFileSync(path.join(fixtureDir, 'wp-config.php'), 'utf8');
    assert.ok(configContent.includes('WP_HOME'), 'wp-config.php should have dynamic URL snippet');
    assert.ok(configContent.includes('AUTH_KEY'), 'wp-config.php should have AUTH_KEY');

    // Step 4: Installer setup.php created
    const installerPath = path.join(outputDir, 'setup.php');
    assert.ok(fs.existsSync(installerPath), 'setup.php must exist in outputDir');
    const installerContent = fs.readFileSync(installerPath, 'utf8');
    assert.ok(installerContent.includes(result.authToken), 'setup.php must contain authToken');

    // Step 5: Bundling created packages
    const packageNames = result.packages.map(p => p.name);
    assert.ok(packageNames.includes('flatsome.zip'), 'Packages must contain flatsome.zip');
    assert.ok(packageNames.includes('flatsome-child.zip'), 'Packages must contain flatsome-child.zip');
    assert.ok(packageNames.includes('themes'), 'Packages must contain themes directory');
    assert.ok(packageNames.some(n => n.endsWith('_Full_Website.zip')), 'Packages must contain Full Website zip');
    assert.ok(packageNames.some(n => n.endsWith('.zip') && !n.endsWith('_Full_Website.zip') && n !== 'flatsome.zip' && n !== 'flatsome-child.zip'), 'Packages must contain Project zip');

    // 3. Verify Table structure
    for (const row of result.table) {
      assert.ok(row.name, 'Table row must have name');
      assert.ok(typeof row.sizeBytes === 'number', 'Table row must have sizeBytes');
      assert.ok(row.base2, 'Table row must have base2 format');
      assert.ok(row.base10, 'Table row must have base10 format');
    }

    // 4. Verify Console Output contains ASCII Table and setup.php URL
    const joinedLogs = logs.join('\n');
    assert.ok(joinedLogs.includes('setup.php?key=' + result.authToken), 'Console output must contain setup.php link with token');
    assert.ok(joinedLogs.includes('Windows Explorer') || joinedLogs.includes('Base-2'), 'Console output must show Base-2 Explorer column');
    assert.ok(joinedLogs.includes('Standard') || joinedLogs.includes('Base-10'), 'Console output must show Base-10 Decimal column');
  } finally {
    console.log = origLog;
    try {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    } catch {}
  }
});

// =============================================================================
// TEST 4: Themes-Only and External-License Modes
// =============================================================================
await runAsyncTest('Test 4: runHandover handles --themes-only and --parent-theme-mode=external-license', async () => {
  const fixtureDir = createProjectFixture('TestSiteThemesOnly');
  const outputDir = path.join(fixtureDir, 'dong_goi_themes_only');

  try {
    const result = await runHandover({
      path: fixtureDir,
      output: outputDir,
      parentThemeMode: 'external-license',
      themesOnly: true,
      skipDb: true,
      skipClean: true
    });

    assert.strictEqual(result.success, true);
    const packageNames = result.packages.map(p => p.name);

    // In external-license + themesOnly:
    // Should contain flatsome-child.zip, LICENSE_NOTICE.txt, PARENT_THEME_INSTRUCTIONS.txt
    assert.ok(packageNames.includes('flatsome-child.zip'), 'Must package child theme');
    assert.ok(!packageNames.includes('flatsome.zip'), 'Must NOT package parent theme in external-license mode');
    assert.ok(packageNames.includes('LICENSE_NOTICE.txt'), 'Must produce LICENSE_NOTICE.txt');
    assert.ok(!packageNames.some(n => n.endsWith('_Full_Website.zip')), 'Must NOT package full website in themes-only mode');
  } finally {
    try {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    } catch {}
  }
});

// =============================================================================
// TEST 5: CLI Direct Execution (--help and --dry-run)
// =============================================================================
await runAsyncTest('Test 5: CLI invocation via child_process works cleanly for --help and --dry-run', () => {
  // 1. Test --help
  const helpOutput = execFileSync('node', [SCRIPT_PATH, '--help'], { encoding: 'utf8' });
  assert.ok(helpOutput.includes('--path'), 'Help output must explain --path');
  assert.ok(helpOutput.includes('--parent-theme-mode'), 'Help output must explain --parent-theme-mode');
  assert.ok(helpOutput.includes('--regenerate-salts'), 'Help output must explain --regenerate-salts');
  assert.ok(helpOutput.includes('--dry-run'), 'Help output must explain --dry-run');

  // 2. Test --dry-run on fixture
  const fixtureDir = createProjectFixture('TestCliDryRun');
  try {
    const dryRunOutput = execFileSync('node', [
      SCRIPT_PATH,
      `--path=${fixtureDir}`,
      '--dry-run',
      '--skip-db'
    ], { encoding: 'utf8' });

    assert.ok(dryRunOutput.includes('DRY RUN') || dryRunOutput.includes('dry-run') || dryRunOutput.includes('Dry Run'), 'Dry run must announce dry-run execution');
    // Verify files were NOT deleted during dry-run
    assert.ok(fs.existsSync(path.join(fixtureDir, 'backup.bak')), 'backup.bak should NOT be deleted in dry run');
  } finally {
    try {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    } catch {}
  }
});

console.log('\n===================================================');
console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} tests`);
console.log('===================================================');

if (failCount > 0) {
  process.exit(1);
}
