/**
 * Test Suite: Smart Project Cleaner (cleaner.mjs)
 * Module: scripts\cleaner.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cleanProject } from '../scripts/cleaner.mjs';

console.log('=== RUNNING SMART CLEANER TEST SUITE ===\n');

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
 * Helper to build a fresh fixture directory structure
 */
function createFixture(fixtureName) {
  const tempDir = path.join(os.tmpdir(), `wp-cleaner-fixture-${fixtureName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const writeDummy = (relPath, content = 'dummy content') => {
    const fullPath = path.join(tempDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  };

  // 1. Root dummy junk and design files
  writeDummy('file.bak', 'backup data 12345');
  writeDummy('test.tmp', 'temp data 67890');
  writeDummy('design.fig', 'mock figma binary content');
  writeDummy('design.psd', 'mock photoshop binary content');
  writeDummy('sub/folder/nested.bak.old', 'nested backup');
  writeDummy('sub/folder/editor.swp', 'swap file');

  // 2. wc-logs directory
  writeDummy('wp-content/uploads/wc-logs/error.log', 'fatal error log line 1\nline 2');
  writeDummy('wp-content/uploads/wc-logs/sub/fatal.log', 'nested log file');

  // 3. scratch directory
  writeDummy('scratch/temp.txt', 'scratchpad notes');
  writeDummy('scratch/nested/cache.json', '{"cached": true}');

  // 4. Default themes & active theme
  writeDummy('wp-content/themes/twentytwentyone/style.css', '/* Theme Name: Twenty Twenty-One */');
  writeDummy('wp-content/themes/twentytwentytwo/style.css', '/* Theme Name: Twenty Twenty-Two */');
  writeDummy('wp-content/themes/twentytwentytwo/index.php', '<?php // silence');
  writeDummy('wp-content/themes/active-theme/style.css', '/* Theme Name: Active Theme */ body { color: red; }');
  writeDummy('wp-content/themes/active-theme/functions.php', '<?php // active theme functions');

  // 5. Plugins
  writeDummy('wp-content/plugins/akismet/akismet.php', '<?php /* Plugin Name: Akismet Anti-spam */');
  writeDummy('wp-content/plugins/akismet/readme.txt', 'Akismet readme');
  writeDummy('wp-content/plugins/hello.php', '<?php /* Plugin Name: Hello Dolly */');
  writeDummy('wp-content/plugins/my-active-plugin/plugin.php', '<?php /* Plugin Name: My Active Plugin */');
  writeDummy('wp-content/plugins/my-inactive-plugin/plugin.php', '<?php /* Plugin Name: Inactive Plugin */');

  // 6. Regular project file that must remain untouched
  writeDummy('index.php', '<?php // WordPress core root');
  writeDummy('wp-config-sample.php', '<?php // sample config');

  return tempDir;
}

// -----------------------------------------------------------------------------
// Test 1: Full Clean according to Brief requirements
// -----------------------------------------------------------------------------
await runAsyncTest('Test 1: Full Clean removes junk, design files, logs, scratch, twenty* themes, and inactive hello.php while preserving whitelisted active plugins and theme', async () => {
  const fixtureDir = createFixture('full-clean');

  try {
    const options = {
      activePlugins: ['akismet/akismet.php', 'my-active-plugin/plugin.php'],
      activeTheme: 'active-theme'
    };

    const result = await cleanProject(fixtureDir, options);

    // Verify return structure
    assert(result, 'Result must be an object');
    assert(Array.isArray(result.cleanedFiles), 'cleanedFiles must be an array');
    assert(Array.isArray(result.skippedWhitelisted), 'skippedWhitelisted must be an array');
    assert(typeof result.spaceFreedBytes === 'number', 'spaceFreedBytes must be a number');
    assert(result.spaceFreedBytes > 0, 'spaceFreedBytes must be greater than 0');

    // Verify deleted items on disk
    assert(!fs.existsSync(path.join(fixtureDir, 'file.bak')), 'file.bak must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'test.tmp')), 'test.tmp must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'design.fig')), 'design.fig must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'design.psd')), 'design.psd must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'sub/folder/nested.bak.old')), 'nested.bak.old must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'sub/folder/editor.swp')), 'editor.swp must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'wp-content/uploads/wc-logs')), 'wc-logs dir must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'scratch')), 'scratch dir must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'wp-content/themes/twentytwentyone')), 'twentytwentyone must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'wp-content/themes/twentytwentytwo')), 'twentytwentytwo must be deleted');
    assert(!fs.existsSync(path.join(fixtureDir, 'wp-content/plugins/hello.php')), 'hello.php must be deleted if inactive');

    // Verify whitelisted items preserved on disk
    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/plugins/akismet/akismet.php')), 'active plugin akismet must NOT be deleted');
    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/plugins/my-active-plugin/plugin.php')), 'active plugin my-active-plugin must NOT be deleted');
    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/themes/active-theme/style.css')), 'active-theme must NOT be deleted');
    assert(fs.existsSync(path.join(fixtureDir, 'index.php')), 'core index.php must NOT be deleted');
    assert(fs.existsSync(path.join(fixtureDir, 'wp-config-sample.php')), 'wp-config-sample.php must NOT be deleted');

    // Verify skippedWhitelisted contains active plugins and active theme
    const whitelistedNames = result.skippedWhitelisted.join(' ');
    assert(whitelistedNames.includes('akismet'), 'skippedWhitelisted must mention akismet');
    assert(whitelistedNames.includes('my-active-plugin'), 'skippedWhitelisted must mention my-active-plugin');
    assert(whitelistedNames.includes('active-theme'), 'skippedWhitelisted must mention active-theme');

    // Verify cleanedFiles contains cleaned elements
    const cleanedNames = result.cleanedFiles.join(' ');
    assert(cleanedNames.includes('file.bak'), 'cleanedFiles must include file.bak');
    assert(cleanedNames.includes('design.fig'), 'cleanedFiles must include design.fig');
    assert(cleanedNames.includes('wc-logs'), 'cleanedFiles must include wc-logs');
    assert(cleanedNames.includes('scratch'), 'cleanedFiles must include scratch');
    assert(cleanedNames.includes('twentytwentyone'), 'cleanedFiles must include twentytwentyone');
    assert(cleanedNames.includes('hello.php'), 'cleanedFiles must include hello.php');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 2: Dry Run Mode (dryRun: true)
// -----------------------------------------------------------------------------
await runAsyncTest('Test 2: Dry Run mode calculates cleanedFiles and spaceFreedBytes without deleting anything from disk', async () => {
  const fixtureDir = createFixture('dry-run');

  try {
    const options = {
      dryRun: true,
      activePlugins: ['akismet/akismet.php', 'my-active-plugin/plugin.php'],
      activeTheme: 'active-theme'
    };

    const result = await cleanProject(fixtureDir, options);

    assert(result.spaceFreedBytes > 0, 'Dry run spaceFreedBytes must be > 0');
    assert(result.cleanedFiles.length > 0, 'Dry run cleanedFiles must not be empty');

    // In dry run, files MUST STILL EXIST on disk!
    assert(fs.existsSync(path.join(fixtureDir, 'file.bak')), 'file.bak must still exist in dryRun');
    assert(fs.existsSync(path.join(fixtureDir, 'design.fig')), 'design.fig must still exist in dryRun');
    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/uploads/wc-logs/error.log')), 'wc-logs must still exist in dryRun');
    assert(fs.existsSync(path.join(fixtureDir, 'scratch/temp.txt')), 'scratch must still exist in dryRun');
    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/themes/twentytwentyone/style.css')), 'twentytwentyone must still exist in dryRun');
    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/plugins/hello.php')), 'hello.php must still exist in dryRun');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 3: Active Twenty* Theme Protection
// -----------------------------------------------------------------------------
await runAsyncTest('Test 3: If a Twenty* theme is the active theme, it is protected and NOT cleaned', async () => {
  const fixtureDir = createFixture('active-twenty');

  try {
    // Here twentytwentytwo is set as the active theme
    const options = {
      activePlugins: ['akismet/akismet.php'],
      activeTheme: 'twentytwentytwo'
    };

    const result = await cleanProject(fixtureDir, options);

    // twentytwentyone should be cleaned, but twentytwentytwo MUST be protected!
    assert(!fs.existsSync(path.join(fixtureDir, 'wp-content/themes/twentytwentyone')), 'twentytwentyone should be cleaned');
    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/themes/twentytwentytwo/style.css')), 'twentytwentytwo MUST be protected when active');
    assert(result.skippedWhitelisted.some(t => t.includes('twentytwentytwo')), 'skippedWhitelisted must contain twentytwentytwo');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 4: Active hello.php Protection
// -----------------------------------------------------------------------------
await runAsyncTest('Test 4: If hello.php is explicitly active, it is NOT cleaned', async () => {
  const fixtureDir = createFixture('active-hello');

  try {
    const options = {
      activePlugins: ['hello.php', 'akismet/akismet.php'],
      activeTheme: 'active-theme'
    };

    const result = await cleanProject(fixtureDir, options);

    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/plugins/hello.php')), 'hello.php must NOT be cleaned when active');
    assert(result.skippedWhitelisted.some(p => p.includes('hello.php')), 'skippedWhitelisted must contain hello.php');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 5: Optional cleanInactivePlugins flag
// -----------------------------------------------------------------------------
await runAsyncTest('Test 5: cleanInactivePlugins: true cleans all inactive plugins including inactive folder plugins', async () => {
  const fixtureDir = createFixture('clean-inactive-plugins');

  try {
    const options = {
      cleanInactivePlugins: true,
      activePlugins: ['akismet/akismet.php'],
      activeTheme: 'active-theme'
    };

    const result = await cleanProject(fixtureDir, options);

    // akismet is active -> kept
    assert(fs.existsSync(path.join(fixtureDir, 'wp-content/plugins/akismet/akismet.php')), 'akismet must be kept');
    // my-active-plugin and my-inactive-plugin are not in activePlugins
    // With cleanInactivePlugins: true, both should be cleaned!
    assert(!fs.existsSync(path.join(fixtureDir, 'wp-content/plugins/my-inactive-plugin')), 'my-inactive-plugin must be cleaned');
    assert(!fs.existsSync(path.join(fixtureDir, 'wp-content/plugins/my-active-plugin')), 'my-active-plugin was not passed as active, so it should be cleaned with cleanInactivePlugins: true');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Test 6: Project root safety guard
// -----------------------------------------------------------------------------
await runAsyncTest('Test 6: Safety guards against invalid projectPath or non-existent directories', async () => {
  await assert.rejects(
    async () => {
      await cleanProject('');
    },
    /projectPath is required/
  );

  await assert.rejects(
    async () => {
      await cleanProject('C:\\non_existent_folder_path_xyz_123');
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
