/**
 * Test Suite: Multi-Tier Isolated Bundler (bundler.mjs)
 * Module: scripts\bundler.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { bundleProject } from '../scripts/bundler.mjs';

console.log('=== RUNNING BUNDLER TEST SUITE ===\n');

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
 * Helper to inspect archive entries inside a zip file using native tar
 */
function getZipEntries(zipPath) {
  assert.ok(fs.existsSync(zipPath), `Zip file must exist: ${zipPath}`);
  const output = execSync(`tar -tf "${zipPath}"`, { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .map(entry => entry.trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

/**
 * Helper to construct a realistic WordPress project fixture directory
 */
function createWordPressProjectFixture(projectName = 'demo_site') {
  const tempDir = path.join(os.tmpdir(), `wp-bundler-${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. Root files
  fs.writeFileSync(path.join(tempDir, 'index.php'), '<?php // Silence is golden.', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'wp-config.php'), `<?php
define( 'DB_NAME', '${projectName.toLowerCase()}' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', 'localhost' );
$table_prefix = 'wp_';
`, 'utf8');
  fs.writeFileSync(path.join(tempDir, 'setup.php'), '<?php // Automated 1-Click Installer', 'utf8');
  fs.writeFileSync(path.join(tempDir, `${projectName.toLowerCase()}_database.sql`), '-- Mock Database Dump\nCREATE TABLE wp_options;', 'utf8');
  fs.writeFileSync(path.join(tempDir, '.htaccess'), '# BEGIN WordPress\nRewriteEngine On\n# END WordPress', 'utf8');

  // Junk root file to verify cleaner/bundler exclusion
  fs.writeFileSync(path.join(tempDir, 'test.bak'), 'backup data', 'utf8');

  // 2. wp-admin & wp-includes
  fs.mkdirSync(path.join(tempDir, 'wp-admin'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'wp-admin', 'admin.php'), '<?php // admin', 'utf8');

  fs.mkdirSync(path.join(tempDir, 'wp-includes'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'wp-includes', 'version.php'), '<?php $wp_version = "6.5";', 'utf8');

  // 3. Themes: flatsome (parent) and flatsome-child
  const parentThemeDir = path.join(tempDir, 'wp-content', 'themes', 'flatsome');
  fs.mkdirSync(parentThemeDir, { recursive: true });
  fs.writeFileSync(path.join(parentThemeDir, 'style.css'), '/*\nTheme Name: Flatsome\nVersion: 3.19.0\n*/', 'utf8');
  fs.writeFileSync(path.join(parentThemeDir, 'index.php'), '<?php // Flatsome theme index', 'utf8');

  const childThemeDir = path.join(tempDir, 'wp-content', 'themes', 'flatsome-child');
  fs.mkdirSync(childThemeDir, { recursive: true });
  fs.writeFileSync(path.join(childThemeDir, 'style.css'), '/*\nTheme Name: Flatsome Child\nTemplate: flatsome\nVersion: 1.0.0\n*/', 'utf8');
  fs.writeFileSync(path.join(childThemeDir, 'functions.php'), '<?php // Child functions', 'utf8');
  // Child junk file
  fs.writeFileSync(path.join(childThemeDir, 'temp.bak'), 'child backup', 'utf8');

  // 4. Plugins: active custom plugin & inactive plugin
  const activePluginDir = path.join(tempDir, 'wp-content', 'plugins', 'banh-su-woo-fillings');
  fs.mkdirSync(activePluginDir, { recursive: true });
  fs.writeFileSync(path.join(activePluginDir, 'banh-su-woo-fillings.php'), '<?php\n/*\nPlugin Name: Bánh Su Woo Fillings\nVersion: 1.0\n*/', 'utf8');

  const inactivePluginDir = path.join(tempDir, 'wp-content', 'plugins', 'inactive-plugin');
  fs.mkdirSync(inactivePluginDir, { recursive: true });
  fs.writeFileSync(path.join(inactivePluginDir, 'plugin.php'), '<?php\n/*\nPlugin Name: Inactive Plugin\n*/', 'utf8');

  // 5. Uploads: image and wc-logs
  const uploadsDir = path.join(tempDir, 'wp-content', 'uploads', '2026', '09');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, 'image.jpg'), 'JPEG_BINARY_DATA', 'utf8');

  const logsDir = path.join(tempDir, 'wp-content', 'uploads', 'wc-logs');
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(path.join(logsDir, 'error.log'), 'Error log entries...', 'utf8');

  // 6. Output folder simulating dong_goi_du_an inside project to test anti-recursion
  const internalOutputDir = path.join(tempDir, 'dong_goi_du_an');
  fs.mkdirSync(internalOutputDir, { recursive: true });
  fs.writeFileSync(path.join(internalOutputDir, 'old_backup_to_ignore.zip'), 'FAKE_ZIP_DATA', 'utf8');

  return {
    projectDir: tempDir,
    internalOutputDir,
    projectName
  };
}

async function runSuite() {
  // Test 1: Full staging and bundling with parent-theme-mode='bundle'
  await runAsyncTest('Test 1: Full staging and bundling with parent-theme-mode="bundle" (anti-recursion, parent+child themes, custom plugin, full website zips, wc-logs excluded)', async () => {
    const { projectDir, internalOutputDir, projectName } = createWordPressProjectFixture('demo_site');
    let stagedDetectedDuringRun = false;

    const result = await bundleProject(projectDir, internalOutputDir, {
      projectName,
      parentThemeMode: 'bundle',
      activePlugins: ['banh-su-woo-fillings/banh-su-woo-fillings.php'],
      onStaged: (stagingDir) => {
        if (fs.existsSync(stagingDir)) {
          stagedDetectedDuringRun = true;
        }
      }
    });

    // 1. Verify staging cleanup
    const stagingDir = path.join(projectDir, '_staging_handover');
    assert.strictEqual(fs.existsSync(stagingDir), false, '_staging_handover must be removed after bundling');
    assert.strictEqual(stagedDetectedDuringRun, true, 'onStaged callback should have confirmed staging folder existed during run');
    assert.strictEqual(result.stagingCleaned, true, 'result.stagingCleaned must be true');

    // 2. Verify packages array returned
    assert.ok(Array.isArray(result.packages), 'result.packages must be an array');
    assert.ok(result.packages.length >= 4, `Expected at least 4 package entries, got ${result.packages.length}`);

    for (const pkg of result.packages) {
      assert.ok(pkg.name, 'Package must have a name');
      assert.ok(pkg.path, 'Package must have a path');
      assert.ok(typeof pkg.sizeBytes === 'number', 'Package sizeBytes must be number');
      assert.ok(fs.existsSync(pkg.path), `Package file/folder must exist on disk: ${pkg.path}`);
    }

    // 3. Verify parent theme flatsome.zip exists
    const flatsomeZip = path.join(internalOutputDir, 'flatsome.zip');
    assert.ok(fs.existsSync(flatsomeZip), 'flatsome.zip must exist in outputPackageDir');
    const flatsomeEntries = getZipEntries(flatsomeZip);
    assert.ok(flatsomeEntries.some(e => e.includes('flatsome/style.css')), 'flatsome.zip must contain flatsome/style.css');

    // 4. Verify child theme flatsome-child.zip exists and is clean (no .bak)
    const flatsomeChildZip = path.join(internalOutputDir, 'flatsome-child.zip');
    assert.ok(fs.existsSync(flatsomeChildZip), 'flatsome-child.zip must exist in outputPackageDir');
    const childEntries = getZipEntries(flatsomeChildZip);
    assert.ok(childEntries.some(e => e.includes('flatsome-child/style.css')), 'flatsome-child.zip must contain style.css');
    assert.ok(childEntries.some(e => e.includes('flatsome-child/functions.php')), 'flatsome-child.zip must contain functions.php');
    assert.ok(!childEntries.some(e => e.includes('.bak')), 'flatsome-child.zip must not contain .bak files');

    // 5. Verify themes/ folder containing both themes exists
    const themesDir = path.join(internalOutputDir, 'themes');
    assert.ok(fs.existsSync(themesDir), 'themes/ directory must exist in outputPackageDir');
    assert.ok(fs.existsSync(path.join(themesDir, 'flatsome', 'style.css')), 'themes/flatsome/style.css must exist');
    assert.ok(fs.existsSync(path.join(themesDir, 'flatsome-child', 'style.css')), 'themes/flatsome-child/style.css must exist');

    // 6. Verify custom plugin banh-su-woo-fillings.zip exists
    const pluginZip = path.join(internalOutputDir, 'banh-su-woo-fillings.zip');
    assert.ok(fs.existsSync(pluginZip), 'banh-su-woo-fillings.zip must exist in outputPackageDir');
    const pluginEntries = getZipEntries(pluginZip);
    assert.ok(pluginEntries.some(e => e.includes('banh-su-woo-fillings/banh-su-woo-fillings.php')), 'plugin zip must contain plugin file');

    // 7. Verify full website zips: [Project]_Full_Website.zip and [Project].zip
    const fullWebsiteZip = path.join(internalOutputDir, `${projectName}_Full_Website.zip`);
    const projectZip = path.join(internalOutputDir, `${projectName}.zip`);
    assert.ok(fs.existsSync(fullWebsiteZip), `${projectName}_Full_Website.zip must exist`);
    assert.ok(fs.existsSync(projectZip), `${projectName}.zip must exist`);

    const fullEntries = getZipEntries(fullWebsiteZip);

    // Verify root files present
    assert.ok(fullEntries.some(e => e.includes('index.php')), 'Full website zip must contain index.php');
    assert.ok(fullEntries.some(e => e.includes('wp-config.php')), 'Full website zip must contain wp-config.php');
    assert.ok(fullEntries.some(e => e.includes('setup.php')), 'Full website zip must contain setup.php');
    assert.ok(fullEntries.some(e => e.includes('demo_site_database.sql')), 'Full website zip must contain SQL dump');
    assert.ok(fullEntries.some(e => e.includes('.htaccess')), 'Full website zip must contain .htaccess');

    // Verify wp-admin, wp-includes, uploads/image.jpg
    assert.ok(fullEntries.some(e => e.includes('wp-admin/admin.php')), 'Full website zip must contain wp-admin');
    assert.ok(fullEntries.some(e => e.includes('wp-includes/version.php')), 'Full website zip must contain wp-includes');
    assert.ok(fullEntries.some(e => e.includes('image.jpg')), 'Full website zip must contain image.jpg in uploads');

    // 8. Verify anti-recursion & exclusions
    // - output folder dong_goi_du_an must NEVER be zipped
    assert.ok(!fullEntries.some(e => e.includes('dong_goi_du_an')), 'outputPackageDir must NOT be zipped into website archive');
    assert.ok(!fullEntries.some(e => e.includes('old_backup_to_ignore.zip')), 'Files inside outputPackageDir must NOT be zipped');
    // - _staging_handover must NOT be zipped
    assert.ok(!fullEntries.some(e => e.includes('_staging_handover')), '_staging_handover must NOT be zipped');
    // - wc-logs must be excluded
    assert.ok(!fullEntries.some(e => e.includes('wc-logs')), 'wc-logs must be excluded from website zip');
    assert.ok(!fullEntries.some(e => e.includes('error.log')), 'error.log inside wc-logs must be excluded');
    // - inactive plugin must be excluded
    assert.ok(!fullEntries.some(e => e.includes('inactive-plugin')), 'inactive-plugin must be excluded when active plugins whitelist is provided');
    // - junk files must be excluded
    assert.ok(!fullEntries.some(e => e.includes('test.bak')), '*.bak must be excluded');

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // Test 2: Mode parent-theme-mode='external-license'
  await runAsyncTest('Test 2: Mode parent-theme-mode="external-license" packages only child theme and generates license notice', async () => {
    const { projectDir, internalOutputDir } = createWordPressProjectFixture('License_Project');

    const result = await bundleProject(projectDir, internalOutputDir, {
      parentThemeMode: 'external-license',
      activePlugins: ['banh-su-woo-fillings']
    });

    // 1. flatsome.zip must NOT exist
    const flatsomeZip = path.join(internalOutputDir, 'flatsome.zip');
    assert.strictEqual(fs.existsSync(flatsomeZip), false, 'flatsome.zip must NOT be packaged in external-license mode');

    // 2. flatsome-child.zip MUST exist
    const childZip = path.join(internalOutputDir, 'flatsome-child.zip');
    assert.ok(fs.existsSync(childZip), 'flatsome-child.zip must still be packaged');

    // 3. LICENSE_NOTICE.txt or PARENT_THEME_INSTRUCTIONS.txt must exist in outputPackageDir
    const noticePath = path.join(internalOutputDir, 'LICENSE_NOTICE.txt');
    const instructionPath = path.join(internalOutputDir, 'PARENT_THEME_INSTRUCTIONS.txt');
    const noticeExists = fs.existsSync(noticePath) || fs.existsSync(instructionPath);
    assert.ok(noticeExists, 'LICENSE_NOTICE.txt or PARENT_THEME_INSTRUCTIONS.txt must be generated in external-license mode');

    const actualNoticeFile = fs.existsSync(noticePath) ? noticePath : instructionPath;
    const noticeContent = fs.readFileSync(actualNoticeFile, 'utf8');
    assert.ok(noticeContent.toLowerCase().includes('flatsome'), 'Notice must reference the parent theme flatsome');
    assert.ok(
      noticeContent.toLowerCase().includes('license') ||
      noticeContent.toLowerCase().includes('bản quyền') ||
      noticeContent.toLowerCase().includes('ban quyen') ||
      noticeContent.toLowerCase().includes('parent theme'),
      'Notice must explain parent theme license requirement'
    );

    // 4. Verify packages returned does not include flatsome.zip
    assert.ok(!result.packages.some(p => p.name === 'flatsome.zip'), 'flatsome.zip must not be in returned packages list');

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // Test 3: Safety guards
  await runAsyncTest('Test 3: Safety guards against missing projectPath, non-existent directory, and missing outputPackageDir', async () => {
    const { projectDir, internalOutputDir } = createWordPressProjectFixture('Guards_Project');

    // Missing projectPath
    await assert.rejects(
      async () => await bundleProject(null, internalOutputDir),
      /Invalid project path|projectPath is required/i
    );
    await assert.rejects(
      async () => await bundleProject('', internalOutputDir),
      /Invalid project path|projectPath is required/i
    );

    // Non-existent projectPath
    await assert.rejects(
      async () => await bundleProject('C:\\path_that_does_not_exist_xyz_999', internalOutputDir),
      /Project path not found|does not exist/i
    );

    // Missing outputPackageDir
    await assert.rejects(
      async () => await bundleProject(projectDir, null),
      /Invalid output package directory|outputPackageDir is required/i
    );
    await assert.rejects(
      async () => await bundleProject(projectDir, ''),
      /Invalid output package directory|outputPackageDir is required/i
    );

    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // Test 4: detectThemeHierarchy correctly parses Template header and falls back
  await runAsyncTest('Test 4: detectThemeHierarchy correctly identifies child and parent theme hierarchy', async () => {
    const tempDir = path.join(os.tmpdir(), `wp-theme-hierarchy-${Date.now()}`);
    const themesDir = path.join(tempDir, 'wp-content', 'themes');
    fs.mkdirSync(path.join(themesDir, 'parent-woodmart'), { recursive: true });
    fs.writeFileSync(path.join(themesDir, 'parent-woodmart', 'style.css'), '/*\nTheme Name: Woodmart\n*/');

    fs.mkdirSync(path.join(themesDir, 'woodmart-child'), { recursive: true });
    fs.writeFileSync(path.join(themesDir, 'woodmart-child', 'style.css'), '/*\nTheme Name: Woodmart Child\nTemplate: parent-woodmart\n*/');

    // Detect without options
    const hierarchy = (await import('../scripts/bundler.mjs')).detectThemeHierarchy(tempDir);
    assert.strictEqual(hierarchy.childTheme, 'woodmart-child');
    assert.strictEqual(hierarchy.parentTheme, 'parent-woodmart');

    // Detect with activeTheme option
    const hierarchy2 = (await import('../scripts/bundler.mjs')).detectThemeHierarchy(tempDir, 'woodmart-child');
    assert.strictEqual(hierarchy2.childTheme, 'woodmart-child');
    assert.strictEqual(hierarchy2.parentTheme, 'parent-woodmart');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Test 5: createZipArchive and calculateDirSize unit tests
  await runAsyncTest('Test 5: createZipArchive generates readable zip and calculateDirSize computes bytes', async () => {
    const { createZipArchive, calculateDirSize } = await import('../scripts/bundler.mjs');
    const tempDir = path.join(os.tmpdir(), `wp-zip-test-${Date.now()}`);
    fs.mkdirSync(path.join(tempDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'sub', 'test.txt'), 'Hello Bundler World 12345');

    const zipOut = path.join(tempDir, 'archive.zip');
    createZipArchive(zipOut, tempDir, 'sub');

    assert.ok(fs.existsSync(zipOut), 'Archive file must be created');
    const size = calculateDirSize(zipOut);
    assert.ok(size > 0, 'Archive size must be > 0 bytes');

    const entries = getZipEntries(zipOut);
    assert.ok(entries.some(e => e.includes('sub/test.txt')), 'Archive entries must contain sub/test.txt');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Test 6: Custom options (projectName and customPlugins)
  await runAsyncTest('Test 6: Custom projectName and customPlugins array are respected and packaged', async () => {
    const { projectDir, internalOutputDir } = createWordPressProjectFixture('Fixture_Base');
    
    // Create extra custom plugin
    const extraPluginDir = path.join(projectDir, 'wp-content', 'plugins', 'my-custom-addon');
    fs.mkdirSync(extraPluginDir, { recursive: true });
    fs.writeFileSync(path.join(extraPluginDir, 'addon.php'), '<?php // addon');

    const result = await bundleProject(projectDir, internalOutputDir, {
      projectName: 'BanhSuShop',
      parentThemeMode: 'bundle',
      activePlugins: ['my-custom-addon/addon.php', 'banh-su-woo-fillings/banh-su-woo-fillings.php'],
      customPlugins: ['my-custom-addon']
    });

    const expectedFullZip = path.join(internalOutputDir, 'BanhSuShop_Full_Website.zip');
    const expectedShortZip = path.join(internalOutputDir, 'BanhSuShop.zip');
    const expectedAddonZip = path.join(internalOutputDir, 'my-custom-addon.zip');

    assert.ok(fs.existsSync(expectedFullZip), 'BanhSuShop_Full_Website.zip must exist');
    assert.ok(fs.existsSync(expectedShortZip), 'BanhSuShop.zip must exist');
    assert.ok(fs.existsSync(expectedAddonZip), 'my-custom-addon.zip must exist');

    assert.ok(result.packages.some(p => p.name === 'BanhSuShop_Full_Website.zip'));
    assert.ok(result.packages.some(p => p.name === 'BanhSuShop.zip'));
    assert.ok(result.packages.some(p => p.name === 'my-custom-addon.zip'));

    fs.rmSync(projectDir, { recursive: true, force: true });
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
