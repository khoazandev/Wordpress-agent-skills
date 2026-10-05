/**
 * Test Suite: Dynamic URL & Salts Config Patcher (config_patcher.mjs)
 * Module: scripts\config_patcher.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { patchConfig, hasDynamicUrl, generateSalt } from '../scripts/config_patcher.mjs';

console.log('=== RUNNING CONFIG PATCHER TEST SUITE ===\n');

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

import { findBinary } from '../scripts/lib/find-binary.mjs';
import { execFileSync } from 'node:child_process';
const PHP_CLI = findBinary('php');

const SALT_KEYS = [
  'AUTH_KEY',
  'SECURE_AUTH_KEY',
  'LOGGED_IN_KEY',
  'NONCE_KEY',
  'AUTH_SALT',
  'SECURE_AUTH_SALT',
  'LOGGED_IN_SALT',
  'NONCE_SALT',
];

/**
 * Helper to build a fresh fixture directory structure
 */
function createFixture(fixtureName, options = {}) {
  const tempDir = path.join(os.tmpdir(), `wp-config-fixture-${fixtureName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const rawConfig = `<?php
/**
 * The base configuration for WordPress
 */

// ** Database settings - You can get this info from your web host ** //
define( 'DB_NAME', 'database_name_here' );
define( 'DB_USER', 'username_here' );
define( 'DB_PASSWORD', 'password_here' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 */
define( 'AUTH_KEY',         'put your unique phrase here' );
define( 'SECURE_AUTH_KEY',  'put your unique phrase here' );
define( 'LOGGED_IN_KEY',    'put your unique phrase here' );
define( 'NONCE_KEY',        'put your unique phrase here' );
define( 'AUTH_SALT',        'put your unique phrase here' );
define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );
define( 'LOGGED_IN_SALT',   'put your unique phrase here' );
define( 'NONCE_SALT',       'put your unique phrase here' );
/**#@-*/

$table_prefix = 'wp_';
define( 'WP_DEBUG', false );

if ( ! defined( 'ABSPATH' ) ) {
\tdefine( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
`;

  const rawSample = `<?php
/**
 * The base configuration for WordPress sample
 */
define( 'DB_NAME', 'sample_db' );
define( 'DB_USER', 'sample_user' );
define( 'DB_PASSWORD', 'sample_password' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8' );
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
`;

  const rawHtaccessSubfolder = `# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
RewriteBase /subfolder_test/
RewriteRule ^index\\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /subfolder_test/index.php [L]
</IfModule>
# END WordPress
`;

  if (options.createConfig !== false) {
    fs.writeFileSync(path.join(tempDir, 'wp-config.php'), rawConfig, 'utf8');
  }
  if (options.createSample !== false) {
    fs.writeFileSync(path.join(tempDir, 'wp-config-sample.php'), rawSample, 'utf8');
  }
  if (options.createHtaccess !== false) {
    fs.writeFileSync(path.join(tempDir, '.htaccess'), rawHtaccessSubfolder, 'utf8');
  }

  return tempDir;
}

// -----------------------------------------------------------------------------
// Test 1: Inject Dynamic URL snippet into wp-config.php and wp-config-sample.php
//         Ensure idempotent (calling twice does not duplicate snippet)
// -----------------------------------------------------------------------------
await runAsyncTest('Test 1: Inject Dynamic URL snippet into wp-config.php and wp-config-sample.php when not present, and ensure idempotent', async () => {
  const fixtureDir = createFixture('test-1-inject');

  try {
    const configPath = path.join(fixtureDir, 'wp-config.php');
    const samplePath = path.join(fixtureDir, 'wp-config-sample.php');

    // Initial state: dynamic URL not present
    const initConfig = fs.readFileSync(configPath, 'utf8');
    assert(!hasDynamicUrl(initConfig), 'Initial wp-config.php must not have dynamic URL');

    // First call: should inject snippet
    const res1 = await patchConfig(fixtureDir, { regenerateSalts: false });
    assert.strictEqual(res1.patchedConfig, true, 'patchedConfig should be true on first injection');
    assert.strictEqual(res1.patchedSample, true, 'patchedSample should be true on first injection');

    const patchedConfig1 = fs.readFileSync(configPath, 'utf8');
    const patchedSample1 = fs.readFileSync(samplePath, 'utf8');

    assert(hasDynamicUrl(patchedConfig1), 'wp-config.php must have dynamic URL after patch');
    assert(hasDynamicUrl(patchedSample1), 'wp-config-sample.php must have dynamic URL after patch');

    assert(patchedConfig1.includes('WP_HOME'), 'wp-config.php must contain WP_HOME');
    assert(patchedConfig1.includes('WP_SITEURL'), 'wp-config.php must contain WP_SITEURL');
    assert(patchedConfig1.includes('HTTP_HOST'), 'wp-config.php must contain HTTP_HOST');

    // Count occurrences of WP_HOME definitions in wp-config.php
    const countHome1 = (patchedConfig1.match(/define\(\s*['"]WP_HOME['"]/g) || []).length;
    assert.strictEqual(countHome1, 1, 'wp-config.php must have exactly 1 define of WP_HOME');

    // Second call: idempotent check (must not duplicate)
    const res2 = await patchConfig(fixtureDir, { regenerateSalts: false });
    assert.strictEqual(res2.patchedConfig, false, 'patchedConfig should be false on second run (already present)');
    assert.strictEqual(res2.patchedSample, false, 'patchedSample should be false on second run (already present)');

    const patchedConfig2 = fs.readFileSync(configPath, 'utf8');
    const countHome2 = (patchedConfig2.match(/define\(\s*['"]WP_HOME['"]/g) || []).length;
    assert.strictEqual(countHome2, 1, 'wp-config.php must still have exactly 1 define of WP_HOME after second run');
    assert.strictEqual(patchedConfig1, patchedConfig2, 'wp-config.php content must be identical after second run');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 2: Verify php -l on patched wp-config.php using C:\xampp\php\php.exe -l
// -----------------------------------------------------------------------------
await runAsyncTest('Test 2: Verify php -l on patched wp-config.php and wp-config-sample.php using PHP CLI', async () => {
  const fixtureDir = createFixture('test-2-syntax');

  try {
    const configPath = path.join(fixtureDir, 'wp-config.php');
    const samplePath = path.join(fixtureDir, 'wp-config-sample.php');

    await patchConfig(fixtureDir, { regenerateSalts: true });

    if (!PHP_CLI) {
      console.log('       [SKIP] Test 2: PHP CLI not found, skipping syntax linting.');
      return;
    }

    // Test wp-config.php with php -l
    const lintConfigOut = execFileSync(PHP_CLI, ['-l', configPath], { encoding: 'utf8' });
    assert(
      lintConfigOut.includes('No syntax errors detected'),
      `php -l on wp-config.php failed: ${lintConfigOut}`
    );

    // Test wp-config-sample.php with php -l
    const lintSampleOut = execFileSync(PHP_CLI, ['-l', samplePath], { encoding: 'utf8' });
    assert(
      lintSampleOut.includes('No syntax errors detected'),
      `php -l on wp-config-sample.php failed: ${lintSampleOut}`
    );
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 3: Regenerate salts with regenerateSalts: true - verify all 8 keys get new random values
// -----------------------------------------------------------------------------
await runAsyncTest('Test 3: Regenerate salts with regenerateSalts: true replaces all 8 keys with 64-char random values', async () => {
  const fixtureDir = createFixture('test-3-salts');

  try {
    const configPath = path.join(fixtureDir, 'wp-config.php');

    const res = await patchConfig(fixtureDir, { regenerateSalts: true });
    assert.strictEqual(res.regeneratedSalts, true, 'regeneratedSalts should be true');

    const patchedConfig = fs.readFileSync(configPath, 'utf8');
    assert(!patchedConfig.includes('put your unique phrase here'), 'wp-config.php must not contain placeholder phrase');

    const saltValues = new Set();

    for (const key of SALT_KEYS) {
      const regex = new RegExp(`define\\s*\\(\\s*['"]${key}['"]\\s*,\\s*['"]([^'"]+)['"]\\s*\\);`);
      const match = patchedConfig.match(regex);
      assert(match, `Key ${key} must be defined in wp-config.php`);

      const val = match[1];
      assert.notStrictEqual(val, 'put your unique phrase here', `Key ${key} must not be placeholder`);
      assert.strictEqual(val.length, 64, `Key ${key} value length must be 64 characters (got ${val.length})`);
      saltValues.add(val);
    }

    // Ensure all 8 keys are distinct
    assert.strictEqual(saltValues.size, 8, 'All 8 salt keys must have unique random values');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 4: Verify .htaccess standardization (copies standard rules if missing or replaces hardcoded subfolder rewrite rules)
// -----------------------------------------------------------------------------
await runAsyncTest('Test 4: Verify .htaccess standardization for missing file and subfolder rewrite replacement', async () => {
  // 4A: Replacing hardcoded subfolder rewrite rules
  const fixtureDirA = createFixture('test-4-subfolder');

  try {
    const htaccessPath = path.join(fixtureDirA, '.htaccess');
    const resA = await patchConfig(fixtureDirA, { regenerateSalts: false });

    assert.strictEqual(resA.updatedHtaccess, true, 'updatedHtaccess should be true when fixing subfolder');
    const contentA = fs.readFileSync(htaccessPath, 'utf8');

    assert(!contentA.includes('/subfolder_test/'), '.htaccess must not contain old subfolder');
    assert(contentA.includes('RewriteBase /'), '.htaccess must have standard RewriteBase /');
    assert(contentA.includes('RewriteRule . index.php [L]'), '.htaccess must have standard RewriteRule . index.php [L]');

    // Running again should not modify already standardized file
    const resA2 = await patchConfig(fixtureDirA, { regenerateSalts: false });
    assert.strictEqual(resA2.updatedHtaccess, false, 'updatedHtaccess should be false when already standardized');
  } finally {
    fs.rmSync(fixtureDirA, { recursive: true, force: true });
  }

  // 4B: Missing .htaccess file creation
  const fixtureDirB = createFixture('test-4-missing', { createHtaccess: false });

  try {
    const htaccessPath = path.join(fixtureDirB, '.htaccess');
    assert(!fs.existsSync(htaccessPath), '.htaccess should not exist initially');

    const resB = await patchConfig(fixtureDirB, { regenerateSalts: false });
    assert.strictEqual(resB.updatedHtaccess, true, 'updatedHtaccess should be true when creating missing file');
    assert(fs.existsSync(htaccessPath), '.htaccess must exist after patch');

    const contentB = fs.readFileSync(htaccessPath, 'utf8');
    assert(contentB.includes('RewriteBase /'), '.htaccess must have RewriteBase /');
    assert(contentB.includes('RewriteRule . index.php [L]'), '.htaccess must have RewriteRule . index.php [L]');
  } finally {
    fs.rmSync(fixtureDirB, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 5: Verify return object shape and contract
// -----------------------------------------------------------------------------
await runAsyncTest('Test 5: Verify return object shape: { patchedConfig, patchedSample, regeneratedSalts, updatedHtaccess }', async () => {
  const fixtureDir = createFixture('test-5-shape');

  try {
    const res = await patchConfig(fixtureDir, { regenerateSalts: true });

    assert(typeof res === 'object' && res !== null, 'Result must be an object');
    assert(typeof res.patchedConfig === 'boolean', 'patchedConfig must be a boolean');
    assert(typeof res.patchedSample === 'boolean', 'patchedSample must be a boolean');
    assert(typeof res.regeneratedSalts === 'boolean', 'regeneratedSalts must be a boolean');
    assert(typeof res.updatedHtaccess === 'boolean', 'updatedHtaccess must be a boolean');

    assert.strictEqual(res.patchedConfig, true);
    assert.strictEqual(res.patchedSample, true);
    assert.strictEqual(res.regeneratedSalts, true);
    assert.strictEqual(res.updatedHtaccess, true);

    // Verify when calling again with regenerateSalts: false
    const resSecond = await patchConfig(fixtureDir, { regenerateSalts: false });
    assert.strictEqual(resSecond.patchedConfig, false);
    assert.strictEqual(resSecond.patchedSample, false);
    assert.strictEqual(resSecond.regeneratedSalts, false);
    assert.strictEqual(resSecond.updatedHtaccess, false);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 6: Safety guards on invalid inputs
// -----------------------------------------------------------------------------
await runAsyncTest('Test 6: Safety guards against missing projectPath or non-existent directories', async () => {
  await assert.rejects(
    async () => {
      await patchConfig('');
    },
    /projectPath is required/
  );

  await assert.rejects(
    async () => {
      await patchConfig('C:\\non_existent_folder_path_xyz_890');
    },
    /does not exist/
  );
});

console.log('\n===================================================');
console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} tests`);
console.log('===================================================');

if (failCount > 0) {
  process.exit(1);
}
