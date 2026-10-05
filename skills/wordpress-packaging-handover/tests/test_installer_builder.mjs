/**
 * Test Suite: Automated 1-Click Installer Builder (installer_builder.mjs)
 * Module: scripts\installer_builder.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import { buildInstaller } from '../scripts/installer_builder.mjs';

console.log('=== RUNNING INSTALLER BUILDER TEST SUITE ===\n');

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

const PHP_CLI = findBinary('php');

/**
 * Helper to build a temporary WordPress fixture directory
 */
function createProjectFixture(dbName = 'mock_project_db') {
  const tempDir = path.join(os.tmpdir(), `wp-installer-proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const wpConfigContent = `<?php
define( 'DB_NAME', '${dbName}' );
define( 'DB_USER', 'mock_user' );
define( 'DB_PASSWORD', 'mock_pass' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

$table_prefix = 'wp_';
`;
  fs.writeFileSync(path.join(tempDir, 'wp-config.php'), wpConfigContent, 'utf8');
  return tempDir;
}

/**
 * Helper to build a temporary target directory
 */
function createTargetFixture() {
  const tempDir = path.join(os.tmpdir(), `wp-installer-out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

async function runSuite() {
  // Test 1: Default buildInstaller generates 16-hex authToken, creates setup.php, and replaces all placeholders
  await runAsyncTest('Test 1: Default buildInstaller generates 16-hex authToken, creates setup.php, and replaces all placeholders with zero curly braces remaining', async () => {
    const projectDir = createProjectFixture('mock_project_db');
    const targetDir = createTargetFixture();

    const result = await buildInstaller(projectDir, targetDir);

    assert.ok(result, 'Expected return object');
    assert.ok(typeof result.authToken === 'string', 'authToken should be string');
    assert.strictEqual(result.authToken.length, 16, 'authToken should be exactly 16 characters');
    assert.match(result.authToken, /^[0-9a-f]{16}$/i, 'authToken should be hexadecimal');

    const expectedSetupPath = path.join(targetDir, 'setup.php');
    assert.strictEqual(result.installerPath, expectedSetupPath, 'installerPath should point to targetDir/setup.php');
    assert.ok(fs.existsSync(expectedSetupPath), 'setup.php must exist in target directory');

    const content = fs.readFileSync(expectedSetupPath, 'utf8');
    assert.ok(!content.includes('{{'), 'No double opening curly braces should remain in setup.php');
    assert.ok(!content.includes('}}'), 'No double closing curly braces should remain in setup.php');

    assert.ok(content.includes(result.authToken), 'Generated authToken should be present in setup.php');
    assert.ok(content.includes('mock_project_db'), 'DB name should be present in setup.php');
    assert.ok(content.includes('mock_project_db_database.sql'), 'Default SQL filename should be present in setup.php');

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  // Test 2: Custom authToken and sqlFilename injection
  await runAsyncTest('Test 2: Custom options (authToken and sqlFilename) are properly injected', async () => {
    const projectDir = createProjectFixture('custom_store');
    const targetDir = createTargetFixture();

    const result = await buildInstaller(projectDir, targetDir, {
      authToken: 'custom-secret-key-123',
      sqlFilename: 'custom_db.sql'
    });

    assert.strictEqual(result.authToken, 'custom-secret-key-123', 'Should use provided custom authToken');
    assert.strictEqual(result.installerPath, path.join(targetDir, 'setup.php'));

    const content = fs.readFileSync(result.installerPath, 'utf8');
    assert.ok(content.includes('custom-secret-key-123'), 'Custom authToken must be present');
    assert.ok(content.includes('custom_db.sql'), 'Custom sqlFilename must be present');
    assert.ok(content.includes('custom_store'), 'DB name must be present');
    assert.ok(!content.includes('{{'), 'No double opening curly braces remain');
    assert.ok(!content.includes('}}'), 'No double closing curly braces remain');

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  // Test 3: PHP syntax validation with php -l
  await runAsyncTest('Test 3: Verify PHP syntax of generated setup.php using PHP CLI (php -l)', async () => {
    if (!PHP_CLI) {
      console.log('       [SKIP] Test 3: PHP CLI not found, skipping syntax linting.');
      return;
    }
    const projectDir = createProjectFixture('syntax_check_db');
    const targetDir = createTargetFixture();

    const result = await buildInstaller(projectDir, targetDir);
    const lintOutput = execFileSync(PHP_CLI, ['-l', result.installerPath], { encoding: 'utf8' });

    assert.match(lintOutput, /No syntax errors detected/, 'PHP linter should detect no syntax errors');

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  // Test 4: Functional verification of injected constants in isolated PHP runtime
  await runAsyncTest('Test 4: Functional verification of generated constants in isolated PHP runtime', async () => {
    if (!PHP_CLI) {
      console.log('       [SKIP] Test 4: PHP CLI not found, skipping functional verification.');
      return;
    }
    const projectDir = createProjectFixture('eval_check_db');
    const targetDir = createTargetFixture();

    const result = await buildInstaller(projectDir, targetDir, {
      authToken: 'token_eval_998877',
      sqlFilename: 'eval_backup.sql'
    });

    const runnerScript = `<?php
define('SETUP_TESTING_MODE', true);
require_once '${result.installerPath.replace(/\\/g, '/')}';
echo json_encode([
    'auth' => defined('SETUP_AUTH_TOKEN') ? SETUP_AUTH_TOKEN : null,
    'db'   => defined('SETUP_DEFAULT_DB') ? SETUP_DEFAULT_DB : null,
    'sql'  => defined('SETUP_SQL_FILE') ? SETUP_SQL_FILE : null,
    'ts'   => defined('SETUP_GENERATED_AT') ? SETUP_GENERATED_AT : null,
]);
`;
    const runnerPath = path.join(targetDir, 'eval_runner.php');
    fs.writeFileSync(runnerPath, runnerScript, 'utf8');

    const output = execFileSync(PHP_CLI, [runnerPath], { encoding: 'utf8' });
    const parsed = JSON.parse(output.trim());

    assert.strictEqual(parsed.auth, 'token_eval_998877');
    assert.strictEqual(parsed.db, 'eval_check_db');
    assert.strictEqual(parsed.sql, 'eval_backup.sql');
    assert.ok(typeof parsed.ts === 'string' || typeof parsed.ts === 'number');
    assert.ok(parseInt(parsed.ts, 10) > 1700000000);

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  // Test 5: Custom defaultDbName option overrides wp-config.php DB_NAME
  await runAsyncTest('Test 5: Custom defaultDbName option overrides wp-config.php DB_NAME', async () => {
    const projectDir = createProjectFixture('wp_initial_db');
    const targetDir = createTargetFixture();

    const result = await buildInstaller(projectDir, targetDir, {
      defaultDbName: 'overridden_db_name'
    });

    const content = fs.readFileSync(result.installerPath, 'utf8');
    assert.ok(content.includes('overridden_db_name'), 'Should include overridden DB name');
    assert.ok(content.includes('overridden_db_name_database.sql'), 'Default SQL filename should reflect overridden DB name');
    assert.ok(!content.includes('wp_initial_db'), 'Should not use wp-config DB name when overridden');

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  // Test 6: Auto-creates targetDir if it does not already exist
  await runAsyncTest('Test 6: Auto-creates targetDir recursively if not already existent', async () => {
    const projectDir = createProjectFixture('mkdir_check_db');
    const nonExistentTargetDir = path.join(os.tmpdir(), `wp-nested-${Date.now()}`, 'sub1', 'sub2');

    assert.strictEqual(fs.existsSync(nonExistentTargetDir), false);

    const result = await buildInstaller(projectDir, nonExistentTargetDir);
    assert.ok(fs.existsSync(result.installerPath));

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(path.join(os.tmpdir(), nonExistentTargetDir.split(path.sep)[2] || 'wp-nested'), { recursive: true, force: true });
  });

  // Test 7: Safety guards against missing projectPath, non-existent directory, missing wp-config.php, and missing targetDir
  await runAsyncTest('Test 7: Safety guards against missing projectPath, non-existent directory, missing wp-config.php, and missing targetDir', async () => {
    const validTargetDir = createTargetFixture();
    const validProjectDir = createProjectFixture('guards_db');

    // 1. Missing projectPath
    await assert.rejects(
      async () => await buildInstaller(null, validTargetDir),
      /Invalid project path/i
    );
    await assert.rejects(
      async () => await buildInstaller('', validTargetDir),
      /Invalid project path/i
    );

    // 2. Non-existent projectPath
    await assert.rejects(
      async () => await buildInstaller('C:\\path_does_not_exist_xyz_123', validTargetDir),
      /Project path not found/i
    );

    // 3. Project path without wp-config.php
    const emptyProjDir = path.join(os.tmpdir(), `wp-empty-${Date.now()}`);
    fs.mkdirSync(emptyProjDir, { recursive: true });
    await assert.rejects(
      async () => await buildInstaller(emptyProjDir, validTargetDir),
      /wp-config\.php not found/i
    );
    fs.rmSync(emptyProjDir, { recursive: true, force: true });

    // 4. Missing targetDir
    await assert.rejects(
      async () => await buildInstaller(validProjectDir, null),
      /Invalid target directory/i
    );
    await assert.rejects(
      async () => await buildInstaller(validProjectDir, ''),
      /Invalid target directory/i
    );

    // Clean up
    fs.rmSync(validProjectDir, { recursive: true, force: true });
    fs.rmSync(validTargetDir, { recursive: true, force: true });
  });

  console.log('\n===================================================');
  console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} tests`);
  console.log('===================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
