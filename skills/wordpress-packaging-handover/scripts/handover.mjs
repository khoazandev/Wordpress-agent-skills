/**
 * Master Orchestrator CLI (handover.mjs)
 * Module: scripts/handover.mjs
 *
 * Responsibilities:
 * 1. CLI entrypoint supporting all control flags (--path, --output, --parent-theme-mode,
 *    --regenerate-salts, --clean-inactive-plugins, --skip-clean, --skip-db, --themes-only,
 *    --auth-token, --php-fallback-dump, --dry-run, --help).
 * 2. Orchestrates full sequential packaging pipeline:
 *    Step 1: cleanProject()       (cleaner.mjs)
 *    Step 2: patchConfig()        (config_patcher.mjs)
 *    Step 3: dumpDatabase()       (db_sanitizer.mjs)
 *    Step 4: buildInstaller()     (installer_builder.mjs)
 *    Step 5: bundleProject()      (bundler.mjs)
 * 3. Dual-size calculation & table formatting:
 *    - Windows Explorer Standard (Base-2: MiB, KiB, GiB)
 *    - International Decimal Standard (Base-10: MB, KB, GB)
 * 4. Outputs professional ASCII/Unicode acceptance summary table,
 *    Secret Auth Token, 1-Click Installer URL, and admin instructions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Import sibling modules
import { cleanProject } from './cleaner.mjs';
import { patchConfig } from './config_patcher.mjs';
import { dumpDatabase } from './db_sanitizer.mjs';
import { buildInstaller, generateAuthToken, extractDbName } from './installer_builder.mjs';
import { bundleProject } from './bundler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculates Base-2 (Windows Explorer) vs Base-10 (Decimal) file sizes.
 *
 * Example:
 *   136,314,880 bytes -> 130.00 MiB (Base-2) / 136.31 MB (Base-10)
 *
 * @param {number} bytes - Number of bytes
 * @returns {{ bytes: number, base2: string, base10: string, formatted: string, toString: () => string }}
 */
export function formatDualSize(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    bytes = 0;
  }

  // Base-2 formatting (1024-based)
  let base2;
  if (bytes >= 1024 * 1024 * 1024) {
    base2 = `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
  } else if (bytes >= 1024 * 1024) {
    base2 = `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  } else if (bytes >= 1024) {
    base2 = `${(bytes / 1024).toFixed(2)} KiB`;
  } else {
    base2 = `${bytes} B`;
  }

  // Base-10 formatting (1000-based)
  let base10;
  if (bytes >= 1000 * 1000 * 1000) {
    base10 = `${(bytes / (1000 * 1000 * 1000)).toFixed(2)} GB`;
  } else if (bytes >= 1000 * 1000) {
    base10 = `${(bytes / (1000 * 1000)).toFixed(2)} MB`;
  } else if (bytes >= 1000) {
    base10 = `${(bytes / 1000).toFixed(2)} KB`;
  } else {
    base10 = `${bytes} B`;
  }

  const formatted = `${base2} / ${base10}`;

  return {
    bytes,
    base2,
    base10,
    formatted,
    toString() {
      return formatted;
    }
  };
}

/**
 * Parses command-line arguments into structured options.
 *
 * @param {string[]} [rawArgs=process.argv.slice(2)]
 * @returns {object} Parsed options
 */
export function parseArgs(rawArgs = process.argv.slice(2)) {
  const result = {
    path: path.resolve(process.cwd()),
    output: null,
    parentThemeMode: 'bundle',
    regenerateSalts: false,
    cleanInactivePlugins: false,
    skipClean: false,
    skipDb: false,
    themesOnly: false,
    dryRun: false,
    authToken: undefined,
    phpFallbackDump: false,
    help: false
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg.startsWith('--path=')) {
      result.path = path.resolve(arg.slice(7));
    } else if (arg === '--path' && i + 1 < rawArgs.length) {
      result.path = path.resolve(rawArgs[++i]);
    } else if (arg.startsWith('--output=')) {
      result.output = path.resolve(arg.slice(9));
    } else if (arg === '--output' && i + 1 < rawArgs.length) {
      result.output = path.resolve(rawArgs[++i]);
    } else if (arg.startsWith('--parent-theme-mode=')) {
      result.parentThemeMode = arg.slice(20);
    } else if (arg === '--parent-theme-mode' && i + 1 < rawArgs.length) {
      result.parentThemeMode = rawArgs[++i];
    } else if (arg === '--regenerate-salts') {
      result.regenerateSalts = true;
    } else if (arg === '--clean-inactive-plugins') {
      result.cleanInactivePlugins = true;
    } else if (arg === '--skip-clean') {
      result.skipClean = true;
    } else if (arg === '--skip-db') {
      result.skipDb = true;
    } else if (arg === '--themes-only') {
      result.themesOnly = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg.startsWith('--auth-token=')) {
      result.authToken = arg.slice(13);
    } else if (arg === '--auth-token' && i + 1 < rawArgs.length) {
      result.authToken = rawArgs[++i];
    } else if (arg === '--php-fallback-dump') {
      result.phpFallbackDump = true;
    } else if (!arg.startsWith('-') && i === 0) {
      // Positional path
      result.path = path.resolve(arg);
    }
  }

  if (!result.output) {
    result.output = path.join(result.path, 'dong_goi_du_an');
  }

  return result;
}

/**
 * Prints CLI usage help.
 */
function printHelp() {
  console.log(`
================================================================================
WordPress Packaging Handover — Master Orchestrator CLI
================================================================================

Usage:
  node scripts/handover.mjs [options]

Options:
  --path=<path>                WordPress project root directory (default: current directory)
  --output=<dir>               Output directory for handover packages (default: <path>/dong_goi_du_an)
  --parent-theme-mode=<mode>   Parent theme mode: 'bundle' (default) or 'external-license'
  --regenerate-salts           Regenerate 64-char security keys & salts in wp-config.php
  --clean-inactive-plugins     Remove inactive plugins after DB whitelist verification
  --skip-clean                 Skip development junk & cache cleaner step
  --skip-db                    Skip database sanitization and dump step
  --themes-only                Package themes only ([child].zip, [parent].zip, themes/)
  --auth-token=<token>         Custom 16-hex secret token for setup.php
  --php-fallback-dump          Force PHP pure dumper instead of mysqldump CLI
  --dry-run                    Simulate pipeline without modifying or deleting files
  --help, -h                   Display this help message

Examples:
  node scripts/handover.mjs --path=/path/to/demo_site
  node scripts/handover.mjs --parent-theme-mode=external-license --regenerate-salts
  node scripts/handover.mjs --themes-only --skip-db
  node scripts/handover.mjs --dry-run
================================================================================
`);
}

/**
 * Helper to compute size of a file or directory recursively.
 */
function getPathSizeBytes(targetPath) {
  try {
    const st = fs.statSync(targetPath);
    if (!st.isDirectory()) {
      return st.size;
    }
    let total = 0;
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      total += getPathSizeBytes(path.join(targetPath, entry.name));
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Renders an ASCII/Unicode table for handover acceptance.
 *
 * @param {Array<{ name: string, sizeBytes: number, base2: string, base10: string }>} tableRows
 * @param {number} totalBytes
 */
function renderTable(tableRows, totalBytes) {
  // Determine column widths
  let nameWidth = 24;
  let bytesWidth = 14;
  let base2Width = 18;
  let base10Width = 18;

  for (const row of tableRows) {
    if (row.name.length > nameWidth) nameWidth = row.name.length;
    const bytesStr = row.sizeBytes.toLocaleString();
    if (bytesStr.length > bytesWidth) bytesWidth = bytesStr.length;
    if (row.base2.length > base2Width) base2Width = row.base2.length;
    if (row.base10.length > base10Width) base10Width = row.base10.length;
  }

  // Padding
  nameWidth += 2;
  bytesWidth += 2;
  base2Width += 2;
  base10Width += 2;

  const pad = (str, len, align = 'left') => {
    const s = String(str);
    if (s.length >= len) return s;
    return align === 'right' ? s.padStart(len) : s.padEnd(len);
  };

  const topBorder = `┌${'─'.repeat(nameWidth)}┬${'─'.repeat(bytesWidth)}┬${'─'.repeat(base2Width)}┬${'─'.repeat(base10Width)}┐`;
  const midBorder = `├${'─'.repeat(nameWidth)}┼${'─'.repeat(bytesWidth)}┼${'─'.repeat(base2Width)}┼${'─'.repeat(base10Width)}┤`;
  const botBorder = `└${'─'.repeat(nameWidth)}┴${'─'.repeat(bytesWidth)}┴${'─'.repeat(base2Width)}┴${'─'.repeat(base10Width)}┘`;

  const header = `│${pad(' Package / File Name', nameWidth)}│${pad(' Size (Bytes) ', bytesWidth, 'right')}│${pad(' Windows Explorer ', base2Width, 'right')}│${pad(' Decimal Standard ', base10Width, 'right')}│`;

  console.log('\n📊 HANDOVER PACKAGES ACCEPTANCE TABLE');
  console.log(topBorder);
  console.log(header);
  console.log(midBorder);

  for (const row of tableRows) {
    const line = `│${pad(' ' + row.name, nameWidth)}│${pad(row.sizeBytes.toLocaleString() + ' ', bytesWidth, 'right')}│${pad(row.base2 + ' ', base2Width, 'right')}│${pad(row.base10 + ' ', base10Width, 'right')}│`;
    console.log(line);
  }

  console.log(midBorder);
  const totalDual = formatDualSize(totalBytes);
  const totalLine = `│${pad(` TOTAL (${tableRows.length} items)`, nameWidth)}│${pad(totalBytes.toLocaleString() + ' ', bytesWidth, 'right')}│${pad(totalDual.base2 + ' ', base2Width, 'right')}│${pad(totalDual.base10 + ' ', base10Width, 'right')}│`;
  console.log(totalLine);
  console.log(botBorder);
}

/**
 * Main Orchestration Pipeline.
 *
 * @param {object} [options={}] - Pipeline execution options
 * @returns {Promise<{ success: boolean, packages: Array<object>, authToken: string, table: Array<object>, outputDir: string }>}
 */
export async function runHandover(options = {}) {
  const resolvedPath = path.resolve(options.path || process.cwd());
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`WordPress project path does not exist: ${resolvedPath}`);
  }

  const resolvedOutputDir = path.resolve(options.output || path.join(resolvedPath, 'dong_goi_du_an'));
  const parentThemeMode = options.parentThemeMode || 'bundle';
  const dryRun = Boolean(options.dryRun);
  const skipClean = Boolean(options.skipClean);
  const skipDb = Boolean(options.skipDb);
  const themesOnly = Boolean(options.themesOnly);
  const regenerateSalts = Boolean(options.regenerateSalts);
  const cleanInactivePlugins = Boolean(options.cleanInactivePlugins);
  const phpFallbackDump = Boolean(options.phpFallbackDump);

  const folderName = path.basename(resolvedPath);

  console.log('\n================================================================================');
  console.log('🚀 WORDPRESS PACKAGING HANDOVER — MASTER ORCHESTRATOR');
  console.log('================================================================================');
  console.log(`📁 Project Path:     ${resolvedPath}`);
  console.log(`📦 Output Dir:       ${resolvedOutputDir}`);
  console.log(`🎨 Parent Theme:     ${parentThemeMode}`);
  console.log(`🛡️  Dry Run Mode:    ${dryRun ? 'ENABLED (Simulated execution, no writes)' : 'DISABLED'}`);
  console.log(`🧹 Clean Inactive:   ${cleanInactivePlugins}`);
  console.log(`🔑 Regenerate Salts: ${regenerateSalts}`);
  console.log(`🎯 Themes Only:      ${themesOnly}`);
  console.log('--------------------------------------------------------------------------------');

  if (dryRun) {
    console.log('\n⚠️  [DRY RUN] Running in dry-run simulation mode. No files will be permanently modified or deleted.');
  }

  // Ensure output directory exists if not dryRun
  if (!dryRun) {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Smart Project Cleaning (cleaner.mjs)
  // ---------------------------------------------------------------------------
  let cleanResult = null;
  if (skipClean) {
    console.log('\n[1/5] ⏭️  Skipping project cleaning (--skip-clean enabled)');
  } else {
    console.log('\n[1/5] 🧹 Cleaning project junk, dev files, and inactive items...');
    cleanResult = await cleanProject(resolvedPath, {
      dryRun,
      cleanInactivePlugins,
      activePlugins: options.activePlugins,
      activeTheme: options.activeTheme
    });
    const freed = formatDualSize(cleanResult.spaceFreedBytes);
    console.log(`      ✓ Cleaned items:     ${cleanResult.cleanedFiles.length}`);
    console.log(`      ✓ Space freed:       ${freed.formatted} (${cleanResult.spaceFreedBytes.toLocaleString()} bytes)`);
    console.log(`      ✓ Whitelisted items: ${cleanResult.skippedWhitelisted.join(', ') || 'none'}`);
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Config & Dynamic URL Patching (config_patcher.mjs)
  // ---------------------------------------------------------------------------
  let patchResult = null;
  console.log('\n[2/5] 🔧 Patching dynamic URL configuration & security salts...');
  if (dryRun) {
    console.log('      [DRY RUN] Config patching simulated (wp-config.php and salts preserved)');
    patchResult = {
      patchedConfig: false,
      patchedSample: false,
      regeneratedSalts: regenerateSalts,
      updatedHtaccess: false
    };
  } else {
    patchResult = await patchConfig(resolvedPath, {
      regenerateSalts,
      standardizeHtaccess: true
    });
    console.log(`      ✓ Dynamic URL injected: ${patchResult.patchedConfig ? 'YES' : 'Already present'}`);
    console.log(`      ✓ Salts regenerated:    ${patchResult.regeneratedSalts ? 'YES' : 'Skipped'}`);
    console.log(`      ✓ .htaccess updated:     ${patchResult.updatedHtaccess ? 'YES' : 'Up to date'}`);
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Database Sanitization & MySQL Dump (db_sanitizer.mjs)
  // ---------------------------------------------------------------------------
  let dumpResult = null;
  let dbName = 'wordpress';
  const wpConfigPath = path.join(resolvedPath, 'wp-config.php');
  if (fs.existsSync(wpConfigPath)) {
    const extracted = extractDbName(fs.readFileSync(wpConfigPath, 'utf8'));
    if (extracted) dbName = extracted;
  }

  const sqlFilename = `${dbName}_database.sql`;
  const targetSqlPath = path.join(resolvedOutputDir, sqlFilename);
  const rootSqlPath = path.join(resolvedPath, sqlFilename);

  if (skipDb) {
    console.log('\n[3/5] ⏭️  Skipping database dump (--skip-db enabled)');
  } else if (dryRun) {
    console.log('\n[3/5] [DRY RUN] Database sanitization and dump simulated');
    dumpResult = {
      dumpPath: targetSqlPath,
      sizeBytes: 15728640, // Simulated 15 MB
      tableCount: 28,
      method: 'simulated_dry_run',
      transientsPurged: { transientsDeleted: 12, logsDeleted: 0 }
    };
  } else {
    console.log('\n[3/5] 💾 Sanitizing database and dumping MySQL schema...');
    dumpResult = await dumpDatabase(resolvedPath, targetSqlPath, {
      forcePhpFallback: phpFallbackDump,
      purgeTransients: true
    });
    const sqlSize = formatDualSize(dumpResult.sizeBytes);
    console.log(`      ✓ Dump method:       ${dumpResult.method}`);
    console.log(`      ✓ Tables exported:   ${dumpResult.tableCount}`);
    console.log(`      ✓ Dump file size:    ${sqlSize.formatted} (${dumpResult.sizeBytes.toLocaleString()} bytes)`);
    console.log(`      ✓ Transients purged: ${dumpResult.transientsPurged.transientsDeleted}`);

    // Copy to project root so bundler stages it inside Full Website zip
    if (fs.existsSync(targetSqlPath)) {
      try {
        fs.copyFileSync(targetSqlPath, rootSqlPath);
      } catch {
        // ignore
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Automated 1-Click Installer Builder (installer_builder.mjs)
  // ---------------------------------------------------------------------------
  console.log('\n[4/5] 🔐 Building automated 1-click installer (setup.php)...');
  let authToken = options.authToken;
  let installerResult = null;

  if (dryRun) {
    authToken = authToken || generateAuthToken();
    installerResult = {
      installerPath: path.join(resolvedOutputDir, 'setup.php'),
      authToken
    };
    console.log(`      [DRY RUN] Installer setup.php simulated with token: ${authToken}`);
  } else {
    installerResult = await buildInstaller(resolvedPath, resolvedOutputDir, {
      authToken,
      defaultDbName: dbName,
      sqlFilename
    });
    authToken = installerResult.authToken;
    console.log(`      ✓ Generated setup.php: ${installerResult.installerPath}`);
    console.log(`      ✓ Secret Auth Token:  ${authToken}`);

    // Also copy to project root so bundler stages it in Full Website zip
    try {
      fs.copyFileSync(installerResult.installerPath, path.join(resolvedPath, 'setup.php'));
    } catch {
      // ignore
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Multi-Tier Isolated Bundler (bundler.mjs)
  // ---------------------------------------------------------------------------
  console.log('\n[5/5] 📦 Bundling multi-tier packages (themes, plugins, full website)...');
  const packages = [];

  if (dryRun) {
    console.log('      [DRY RUN] Staging and zip archive packaging simulated');
    packages.push({
      name: 'flatsome.zip',
      path: path.join(resolvedOutputDir, 'flatsome.zip'),
      sizeBytes: 12450000
    });
    packages.push({
      name: 'flatsome-child.zip',
      path: path.join(resolvedOutputDir, 'flatsome-child.zip'),
      sizeBytes: 125000
    });
    packages.push({
      name: 'themes',
      path: path.join(resolvedOutputDir, 'themes'),
      sizeBytes: 25000000
    });
    if (!themesOnly) {
      const fullZipName = `${folderName}_Full_Website.zip`;
      packages.push({
        name: fullZipName,
        path: path.join(resolvedOutputDir, fullZipName),
        sizeBytes: 136314880 // 130 MiB / 136.31 MB
      });
      packages.push({
        name: `${folderName}.zip`,
        path: path.join(resolvedOutputDir, `${folderName}.zip`),
        sizeBytes: 136314880
      });
    }
    packages.push({
      name: 'setup.php',
      path: path.join(resolvedOutputDir, 'setup.php'),
      sizeBytes: 18450
    });
    if (!skipDb) {
      packages.push({
        name: sqlFilename,
        path: targetSqlPath,
        sizeBytes: dumpResult ? dumpResult.sizeBytes : 15728640
      });
    }
  } else {
    const bundlerResult = await bundleProject(resolvedPath, resolvedOutputDir, {
      parentThemeMode,
      themesOnly,
      projectName: options.projectName || folderName,
      activePlugins: options.activePlugins,
      activeTheme: options.activeTheme,
      customPlugins: options.customPlugins
    });

    for (const pkg of bundlerResult.packages) {
      packages.push(pkg);
    }

    // Add setup.php if present in resolvedOutputDir and not already in packages
    const setupInOutput = path.join(resolvedOutputDir, 'setup.php');
    if (fs.existsSync(setupInOutput) && !packages.some(p => p.name === 'setup.php')) {
      packages.push({
        name: 'setup.php',
        path: setupInOutput,
        sizeBytes: fs.statSync(setupInOutput).size
      });
    }

    // Add SQL dump if present in resolvedOutputDir and not already in packages
    if (fs.existsSync(targetSqlPath) && !packages.some(p => p.name === sqlFilename)) {
      packages.push({
        name: sqlFilename,
        path: targetSqlPath,
        sizeBytes: fs.statSync(targetSqlPath).size
      });
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 6: Summary Acceptance Table & Output
  // ---------------------------------------------------------------------------
  let totalBytes = 0;
  const table = [];

  for (const pkg of packages) {
    const size = typeof pkg.sizeBytes === 'number' ? pkg.sizeBytes : getPathSizeBytes(pkg.path);
    totalBytes += size;
    const dual = formatDualSize(size);
    table.push({
      name: pkg.name,
      path: pkg.path,
      sizeBytes: size,
      base2: dual.base2,
      base10: dual.base10,
      formattedSize: dual.formatted
    });
  }

  renderTable(table, totalBytes);

  // Print Setup URL and Access Credentials
  const setupUrl = `http://localhost/${folderName}/setup.php?key=${authToken}`;
  console.log('\n================================================================================');
  console.log('🎉 HANDOVER PACKAGE READY FOR CLIENT DELIVERY!');
  console.log('================================================================================');
  console.log(`🔑 Secret Auth Token:     ${authToken}`);
  console.log(`🌐 1-Click Installer URL: ${setupUrl}`);
  console.log('👤 Default Admin:         Use your existing WordPress administrator credentials.');
  console.log('🛡️  Self-Locking Note:     setup.php automatically disables itself after installation.');
  console.log(`📂 Package Location:      ${resolvedOutputDir}`);
  console.log('================================================================================\n');

  return {
    success: true,
    packages,
    authToken,
    table,
    outputDir: resolvedOutputDir,
    cleanResult,
    patchResult,
    dumpResult,
    installerResult
  };
}

// -----------------------------------------------------------------------------
// Direct CLI Execution Support
// -----------------------------------------------------------------------------
const isDirectCli = Boolean(
  process.argv[1] &&
  (
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  )
);

if (isDirectCli) {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  runHandover(args)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ HANDOVER FAILED:', err.message);
      if (err.stack) {
        console.error(err.stack);
      }
      process.exit(1);
    });
}
