/**
 * Smart WordPress Project Cleaner (cleaner.mjs)
 * Module: scripts/cleaner.mjs
 * 
 * Functions:
 * - Scans project for development junk (*.bak*, *.tmp, *~, *.swp)
 * - Identifies heavy design assets (*.fig, *.psd, *.ai, *.xd)
 * - Cleans log/cache directories (wp-content/uploads/wc-logs, scratch)
 * - Detects active plugins and themes (via wp_options DB query or options fallback)
 * - Whitelists active plugins/themes and prevents accidental removal
 * - Removes inactive junk plugins (e.g. hello.php) and unused default themes (twentytwenty*)
 * - Supports dryRun mode and calculates spaceFreedBytes
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Normalizes relative file paths to forward slashes.
 */
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Attempts to locate a working PHP binary.
 */
function findPhpBinary() {
  const candidates = [
    'C:\\xampp\\php\\php.exe',
    'C:\\laragon\\bin\\php\\current\\php.exe',
    'php'
  ];
  for (const bin of candidates) {
    try {
      execSync(`"${bin}" -v`, { stdio: 'ignore' });
      return bin;
    } catch {
      // Continue to next candidate
    }
  }
  return null;
}

/**
 * Automatically inspects wp-config.php and queries wp_options for active plugins and theme.
 * Returns { activePlugins: string[], activeTheme: string | null } on success, or fallback on error.
 */
function detectActiveWordPress(projectPath) {
  const fallback = { activePlugins: [], activeTheme: null };
  const wpConfigPath = path.join(projectPath, 'wp-config.php');

  if (!fs.existsSync(wpConfigPath)) {
    return fallback;
  }

  try {
    const configContent = fs.readFileSync(wpConfigPath, 'utf8');
    const dbNameMatch = configContent.match(/define\s*\(\s*['"]DB_NAME['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
    const dbUserMatch = configContent.match(/define\s*\(\s*['"]DB_USER['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
    const dbPassMatch = configContent.match(/define\s*\(\s*['"]DB_PASSWORD['"]\s*,\s*['"]([^'"]*)['"]\s*\)/i);
    const dbHostMatch = configContent.match(/define\s*\(\s*['"]DB_HOST['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
    const prefixMatch = configContent.match(/\$table_prefix\s*=\s*['"]([^'"]+)['"]/i);

    if (!dbNameMatch || !dbUserMatch || !dbHostMatch) {
      return fallback;
    }

    const dbName = dbNameMatch[1];
    const dbUser = dbUserMatch[1];
    const dbPass = dbPassMatch ? dbPassMatch[1] : '';
    const dbHost = dbHostMatch[1];
    const tablePrefix = prefixMatch ? prefixMatch[1] : 'wp_';

    const phpBin = findPhpBinary();
    if (!phpBin) {
      return fallback;
    }

    const phpScript = `<?php
try {
  $rawHost = '${dbHost.replace(/'/g, "\\'")}';
  $port = 3306;
  if (strpos($rawHost, ':') !== false) {
    list($rawHost, $port) = explode(':', $rawHost, 2);
  }
  $dsn = "mysql:host={$rawHost};port={$port};dbname=${dbName.replace(/'/g, "\\'")};charset=utf8mb4";
  $pdo = new PDO($dsn, '${dbUser.replace(/'/g, "\\'")}', '${dbPass.replace(/'/g, "\\'")}', [
    PDO::ATTR_TIMEOUT => 2,
    PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT
  ]);
  $stmt = $pdo->query("SELECT option_name, option_value FROM ${tablePrefix}options WHERE option_name IN ('active_plugins', 'stylesheet', 'template')");
  if (!$stmt) exit(1);
  $data = ['active_plugins' => [], 'active_theme' => null];
  while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    if ($row['option_name'] === 'active_plugins') {
      $val = @unserialize($row['option_value']);
      if (is_array($val)) {
        $data['active_plugins'] = array_values($val);
      }
    } elseif ($row['option_name'] === 'stylesheet' && !empty($row['option_value'])) {
      $data['active_theme'] = $row['option_value'];
    } elseif ($row['option_name'] === 'template' && empty($data['active_theme'])) {
      $data['active_theme'] = $row['option_value'];
    }
  }
  echo json_encode($data);
} catch (Throwable $e) {
  exit(1);
}
`;

    const stdout = execFileSync(phpBin, [], { input: phpScript, timeout: 3000, encoding: 'utf8' });
    const parsed = JSON.parse(stdout.trim());
    return {
      activePlugins: Array.isArray(parsed.active_plugins) ? parsed.active_plugins : [],
      activeTheme: parsed.active_theme || null
    };
  } catch {
    return fallback;
  }
}

/**
 * Checks if a plugin is currently active.
 */
function isPluginWhitelisted(pluginItemName, activePluginsList) {
  if (!activePluginsList || !activePluginsList.length) {
    return false;
  }
  const normItem = normalizePath(pluginItemName).toLowerCase();

  for (const active of activePluginsList) {
    const normActive = normalizePath(active).toLowerCase();
    // Direct match: 'hello.php' === 'hello.php'
    if (normActive === normItem) return true;
    // Directory match: 'akismet' matches 'akismet/akismet.php'
    if (normActive.startsWith(normItem + '/')) return true;
    // Basename match: 'akismet.php' or 'akismet'
    const activeDir = normActive.split('/')[0];
    if (activeDir === normItem) return true;
  }
  return false;
}

/**
 * Recursively calculates directory size and returns array of relative file paths.
 */
function inspectDirectory(dirPath, rootDir) {
  let size = 0;
  const files = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        try {
          const st = fs.statSync(full);
          size += st.size;
          files.push(normalizePath(path.relative(rootDir, full)));
        } catch {
          // Ignore unreadable files
        }
      }
    }
  }

  walk(dirPath);
  return { size, files };
}

/**
 * Main Project Cleaner Function
 * 
 * @param {string} projectPath - Path to the WordPress project root
 * @param {object} options - Configuration options:
 *   - activePlugins: string[] (optional active plugins whitelist)
 *   - activeTheme: string (optional active theme name)
 *   - cleanInactivePlugins: boolean (default false, cleans all inactive plugins if true)
 *   - dryRun: boolean (default false, if true only calculates without deleting)
 * @returns {Promise<{ cleanedFiles: string[], skippedWhitelisted: string[], spaceFreedBytes: number }>}
 */
export async function cleanProject(projectPath, options = {}) {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new Error('projectPath is required');
  }

  const resolvedRoot = path.resolve(projectPath);
  if (!fs.existsSync(resolvedRoot)) {
    throw new Error(`projectPath does not exist: ${projectPath}`);
  }

  const dryRun = Boolean(options.dryRun);
  const cleanInactive = Boolean(options.cleanInactivePlugins);

  // 1. Detect active plugins and active theme
  let activePlugins = options.activePlugins;
  let activeTheme = options.activeTheme;

  if (!Array.isArray(activePlugins) || activeTheme === undefined || activeTheme === null) {
    const detected = detectActiveWordPress(resolvedRoot);
    if (!Array.isArray(activePlugins)) {
      activePlugins = detected.activePlugins;
    }
    if (activeTheme === undefined || activeTheme === null) {
      activeTheme = detected.activeTheme;
    }
  }

  activePlugins = Array.isArray(activePlugins) ? activePlugins : [];
  activeTheme = typeof activeTheme === 'string' ? activeTheme.trim() : null;

  const whitelistedSet = new Set();
  const cleanedFilesSet = new Set();
  let spaceFreedBytes = 0;

  // Populate known whitelisted items
  if (activeTheme) {
    whitelistedSet.add(activeTheme);
  }
  for (const p of activePlugins) {
    whitelistedSet.add(p);
  }

  // Paths that will be deleted as directories so recursive scan can skip them
  const cleanedDirectories = new Set();

  // Helper to remove directory or record in dryRun
  function cleanDir(dirFullPath, relPath) {
    if (!fs.existsSync(dirFullPath)) return;
    const { size, files } = inspectDirectory(dirFullPath, resolvedRoot);
    spaceFreedBytes += size;
    cleanedFilesSet.add(normalizePath(relPath));
    for (const f of files) {
      cleanedFilesSet.add(f);
    }
    cleanedDirectories.add(path.resolve(dirFullPath));

    if (!dryRun) {
      try {
        fs.rmSync(dirFullPath, { recursive: true, force: true });
      } catch (err) {
        // Fallback for Windows handle issues
        try {
          fs.rmdirSync(dirFullPath, { recursive: true });
        } catch {
          // Ignore if already deleted
        }
      }
    }
  }

  // Helper to remove a single file
  function cleanFile(fileFullPath, relPath) {
    if (!fs.existsSync(fileFullPath)) return;
    try {
      const st = fs.statSync(fileFullPath);
      spaceFreedBytes += st.size;
    } catch {
      // Ignore stat error
    }
    cleanedFilesSet.add(normalizePath(relPath));

    if (!dryRun) {
      try {
        fs.unlinkSync(fileFullPath);
      } catch {
        // Fallback
        try {
          fs.rmSync(fileFullPath, { force: true });
        } catch {
          // Ignore
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Target 1: wc-logs directory
  // ---------------------------------------------------------------------------
  const wcLogsDir = path.join(resolvedRoot, 'wp-content', 'uploads', 'wc-logs');
  if (fs.existsSync(wcLogsDir)) {
    cleanDir(wcLogsDir, path.join('wp-content', 'uploads', 'wc-logs'));
  }

  // ---------------------------------------------------------------------------
  // Target 2: scratch cache directory
  // ---------------------------------------------------------------------------
  const scratchDir = path.join(resolvedRoot, 'scratch');
  if (fs.existsSync(scratchDir)) {
    cleanDir(scratchDir, 'scratch');
  }

  // ---------------------------------------------------------------------------
  // Target 3: Default WordPress Themes (twentytwenty*)
  // ---------------------------------------------------------------------------
  const themesDir = path.join(resolvedRoot, 'wp-content', 'themes');
  if (fs.existsSync(themesDir)) {
    let themeEntries = [];
    try {
      themeEntries = fs.readdirSync(themesDir, { withFileTypes: true });
    } catch {
      // Ignore
    }

    for (const entry of themeEntries) {
      if (!entry.isDirectory()) continue;
      const themeName = entry.name;
      const isDefaultTheme = /^twenty/i.test(themeName);

      const isActiveTheme = activeTheme && (
        themeName.toLowerCase() === activeTheme.toLowerCase() ||
        activeTheme.toLowerCase().startsWith(themeName.toLowerCase())
      );

      if (isActiveTheme) {
        whitelistedSet.add(themeName);
        continue;
      }

      if (isDefaultTheme) {
        // Clean unused default theme
        const themeFullPath = path.join(themesDir, themeName);
        cleanDir(themeFullPath, path.join('wp-content', 'themes', themeName));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Target 4: Plugins (wp-content/plugins/)
  // ---------------------------------------------------------------------------
  const pluginsDir = path.join(resolvedRoot, 'wp-content', 'plugins');
  if (fs.existsSync(pluginsDir)) {
    let pluginEntries = [];
    try {
      pluginEntries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    } catch {
      // Ignore
    }

    for (const entry of pluginEntries) {
      const pluginName = entry.name;
      const pluginFullPath = path.join(pluginsDir, pluginName);
      const isWhitelisted = isPluginWhitelisted(pluginName, activePlugins);

      if (isWhitelisted) {
        whitelistedSet.add(pluginName);
        continue;
      }

      // Check if it's junk or cleanInactivePlugins is set
      const isHelloJunk = pluginName.toLowerCase() === 'hello.php' || pluginName.toLowerCase() === 'hello-dolly';
      const shouldClean = isHelloJunk || cleanInactive;

      if (shouldClean) {
        if (entry.isDirectory()) {
          cleanDir(pluginFullPath, path.join('wp-content', 'plugins', pluginName));
        } else if (entry.isFile()) {
          cleanFile(pluginFullPath, path.join('wp-content', 'plugins', pluginName));
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Target 5: Development junk (*.bak*, *.tmp, *~, *.swp) & Heavy design files (*.fig, *.psd, *.ai, *.xd)
  // ---------------------------------------------------------------------------
  const ignoredDirNames = new Set([
    '.git',
    'node_modules',
    '_staging_handover',
    'dong_goi_du_an',
    '.gemini',
    '.vscode',
    '.idea'
  ]);

  function scanJunkFiles(currentDir) {
    const resolvedCurrent = path.resolve(currentDir);
    // Skip directories that were already cleaned
    for (const cleanedDir of cleanedDirectories) {
      if (resolvedCurrent === cleanedDir || resolvedCurrent.startsWith(cleanedDir + path.sep)) {
        return;
      }
    }

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      const fullPath = path.join(currentDir, entryName);

      if (entry.isDirectory()) {
        if (ignoredDirNames.has(entryName)) continue;
        scanJunkFiles(fullPath);
      } else if (entry.isFile()) {
        const relPath = normalizePath(path.relative(resolvedRoot, fullPath));
        if (cleanedFilesSet.has(relPath)) continue;

        const isDevJunk = (
          /\.bak(\.|$)/i.test(entryName) ||
          /\.tmp$/i.test(entryName) ||
          /~$/.test(entryName) ||
          /\.swp$/i.test(entryName)
        );

        const isDesignFile = /\.(fig|psd|ai|xd)$/i.test(entryName);

        if (isDevJunk || isDesignFile) {
          cleanFile(fullPath, relPath);
        }
      }
    }
  }

  scanJunkFiles(resolvedRoot);

  return {
    cleanedFiles: Array.from(cleanedFilesSet),
    skippedWhitelisted: Array.from(whitelistedSet),
    spaceFreedBytes
  };
}

// -----------------------------------------------------------------------------
// CLI Direct Execution Support
// -----------------------------------------------------------------------------
const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFilePath && path.resolve(currentFilePath) === invokedFilePath) {
  const args = process.argv.slice(2);
  const targetPath = args.find(a => !a.startsWith('--')) || '.';
  const dryRun = args.includes('--dry-run');
  const cleanInactive = args.includes('--clean-inactive-plugins');

  console.log(`Starting cleanProject for: ${targetPath}`);
  console.log(`DryRun: ${dryRun} | CleanInactivePlugins: ${cleanInactive}`);

  cleanProject(targetPath, { dryRun, cleanInactivePlugins: cleanInactive })
    .then(result => {
      console.log('\n--- CLEAN REPORT ---');
      console.log(`Cleaned items count: ${result.cleanedFiles.length}`);
      console.log(`Space freed: ${(result.spaceFreedBytes / (1024 * 1024)).toFixed(2)} MB (${result.spaceFreedBytes} bytes)`);
      console.log(`Whitelisted: ${result.skippedWhitelisted.join(', ')}`);
      if (result.cleanedFiles.length > 0) {
        console.log('\nCleaned files sample:');
        result.cleanedFiles.slice(0, 10).forEach(f => console.log(`  - ${f}`));
        if (result.cleanedFiles.length > 10) {
          console.log(`  ... and ${result.cleanedFiles.length - 10} more items`);
        }
      }
    })
    .catch(err => {
      console.error('Error during cleanProject:', err.message);
      process.exit(1);
    });
}
