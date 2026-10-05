/**
 * Module Đóng Gói Đa Tầng Cách Ly (bundler.mjs)
 * Module: scripts/bundler.mjs
 *
 * Chức năng:
 * 1. Tạo thư mục staging tạm thời `_staging_handover/` cách ly tuyệt đối, chống đệ quy (Anti-Recursive Staging).
 * 2. Sao chép có chọn lọc (Selective Whitelist): WordPress core, active plugins, uploads (loại bỏ wc-logs), themes sạch rác.
 * 3. Đóng gói đa tầng:
 *    - Theme cha (`[parent].zip`), Theme con (`[child].zip`), thư mục `themes/` mở sẵn.
 *    - Hỗ trợ chế độ `--parent-theme-mode=bundle` và `--parent-theme-mode=external-license` (sinh LICENSE_NOTICE.txt).
 *    - Nén riêng plugin tùy biến (custom plugins, ví dụ `banh-su-woo-fillings.zip`).
 *    - Nén trọn bộ website thành `[Project]_Full_Website.zip` và `[Project].zip`.
 * 4. Dọn dẹp hoàn toàn thư mục staging tạm sau khi hoàn tất.
 * 5. Sử dụng native `tar -a -c -f` với fallback PowerShell `Compress-Archive`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';

/**
 * Normalizes relative file paths to forward slashes.
 */
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

import { findBinary } from './lib/find-binary.mjs';

/**
 * Attempts to locate a working PHP binary for DB detection fallback.
 */
function findPhpBinary() {
  return findBinary('php');
}

/**
 * Detects active plugins and theme from WordPress database if available.
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
 * Calculates total size in bytes of a file or directory.
 */
export function calculateDirSize(itemPath) {
  if (!fs.existsSync(itemPath)) return 0;
  const stat = fs.statSync(itemPath);
  if (stat.isFile()) return stat.size;

  let total = 0;
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
          total += fs.statSync(full).size;
        } catch {
          // ignore
        }
      }
    }
  }
  walk(itemPath);
  return total;
}

/**
 * Creates a .zip archive using native tar with PowerShell fallback.
 *
 * @param {string} zipPath - Output zip file path
 * @param {string} cwd - Base working directory for relative entries
 * @param {string|string[]} entries - Relative entry name(s) to archive inside cwd
 * @returns {string} The output zipPath
 */
export function createZipArchive(zipPath, cwd, entries) {
  const normalizedZip = path.resolve(zipPath);
  const normalizedCwd = path.resolve(cwd);

  fs.mkdirSync(path.dirname(normalizedZip), { recursive: true });

  const entryList = Array.isArray(entries) ? entries : [entries];
  if (entryList.length === 0) {
    throw new Error('No entries provided to archive');
  }

  // 1. Try native tar (bsdtar on Windows 10/11)
  try {
    const tarArgs = ['-a', '-c', '-f', normalizedZip, '-C', normalizedCwd, ...entryList];
    execFileSync('tar', tarArgs, { stdio: 'pipe' });
    if (fs.existsSync(normalizedZip)) {
      return normalizedZip;
    }
  } catch {
    // Tar failed or not found, proceed to PowerShell fallback
  }

  // 2. PowerShell Compress-Archive fallback
  try {
    const psItems = entryList
      .map(entry => `'${path.join(normalizedCwd, entry).replace(/'/g, "''")}'`)
      .join(', ');
    const psScript = `Compress-Archive -Path ${psItems} -DestinationPath '${normalizedZip.replace(/'/g, "''")}' -Force`;
    execSync(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, { stdio: 'pipe' });

    if (fs.existsSync(normalizedZip)) {
      return normalizedZip;
    }
  } catch (psErr) {
    throw new Error(`Failed to create zip archive ${zipPath}: tar and PowerShell both failed. ${psErr.message}`);
  }

  return normalizedZip;
}

/**
 * Checks if a filename or path matches junk files.
 */
function isJunkFile(filePath) {
  const norm = normalizePath(filePath).toLowerCase();
  const base = path.basename(norm);

  // Development junk extensions
  if (/\.(bak[0-9]*|tmp|swp|temp|old)$/i.test(base)) return true;
  if (base.endsWith('~')) return true;

  // Specific junk logs / cache
  if (norm.includes('wc-logs') || norm.endsWith('.log')) return true;

  // Heavy raw design files
  if (/\.(fig|psd|ai|xd)$/i.test(base)) return true;

  return false;
}

/**
 * Recursively copies a directory, filtering out ignored paths and junk files.
 */
function copyDirFiltered(src, dest, isIgnoredFn) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcFull = path.join(src, entry.name);
    const destFull = path.join(dest, entry.name);

    if (isIgnoredFn && isIgnoredFn(srcFull, entry)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirFiltered(srcFull, destFull, isIgnoredFn);
    } else if (entry.isFile()) {
      if (isJunkFile(srcFull)) {
        continue;
      }
      fs.copyFileSync(srcFull, destFull);
    }
  }
}

/**
 * Detects child theme and parent theme from wp-content/themes directory.
 */
export function detectThemeHierarchy(projectPath, activeThemeOption = null) {
  const themesDir = path.join(projectPath, 'wp-content', 'themes');
  let childTheme = null;
  let parentTheme = null;

  if (!fs.existsSync(themesDir)) {
    return { childTheme: null, parentTheme: null };
  }

  const dirs = fs.readdirSync(themesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  // If activeThemeOption is given, check that first
  if (activeThemeOption && dirs.includes(activeThemeOption)) {
    const styleCss = path.join(themesDir, activeThemeOption, 'style.css');
    if (fs.existsSync(styleCss)) {
      const content = fs.readFileSync(styleCss, 'utf8');
      const templateMatch = content.match(/Template:\s*([^\r\n]+)/i);
      if (templateMatch) {
        childTheme = activeThemeOption;
        parentTheme = templateMatch[1].trim();
      } else {
        childTheme = activeThemeOption;
      }
    }
  }

  // If not resolved yet, scan all theme directories for a child theme (Template: ...)
  if (!childTheme || !parentTheme) {
    for (const dir of dirs) {
      const styleCss = path.join(themesDir, dir, 'style.css');
      if (fs.existsSync(styleCss)) {
        const content = fs.readFileSync(styleCss, 'utf8');
        const templateMatch = content.match(/Template:\s*([^\r\n]+)/i);
        if (templateMatch) {
          childTheme = dir;
          parentTheme = templateMatch[1].trim();
          break;
        }
      }
    }
  }

  // If still no child theme found, fallback to first non-twenty theme or first theme
  if (!childTheme && dirs.length > 0) {
    const nonDefault = dirs.find(d => !d.startsWith('twenty'));
    childTheme = nonDefault || dirs[0];
  }

  // Verify parent theme exists in directory
  const parentThemeExists = parentTheme ? dirs.includes(parentTheme) : false;

  return {
    childTheme,
    parentTheme: parentThemeExists ? parentTheme : (parentTheme || null)
  };
}

/**
 * Detects if a plugin is active based on active plugins list.
 */
function isPluginActive(pluginSlugOrFile, activePluginsList) {
  if (!activePluginsList || activePluginsList.length === 0) {
    return true; // No whitelist provided, keep
  }
  const normItem = normalizePath(pluginSlugOrFile).toLowerCase();

  for (const active of activePluginsList) {
    const normActive = normalizePath(active).toLowerCase();
    if (normActive === normItem) return true;
    if (normActive.startsWith(normItem + '/')) return true;
    if (normActive.split('/')[0] === normItem) return true;
    if (path.basename(normActive) === normItem) return true;
  }
  return false;
}

/**
 * Module Đóng Gói Đa Tầng Cách Ly (bundleProject)
 *
 * @param {string} projectPath - Đường dẫn thư mục gốc WordPress
 * @param {string} outputPackageDir - Thư mục đích nhận các gói đóng gói
 * @param {object} [options={}] - Các tùy chọn
 * @param {'bundle'|'external-license'} [options.parentThemeMode='bundle'] - Chế độ đóng gói theme cha
 * @param {string[]} [options.activePlugins] - Danh sách active plugins whitelist
 * @param {string[]} [options.customPlugins] - Danh sách plugins tùy biến đóng gói riêng
 * @param {string} [options.projectName] - Tên dự án (mặc định lấy theo folder name)
 * @param {function} [options.onStaged] - Callback khi staging chuẩn bị xong
 * @param {boolean} [options.keepStaging=false] - Không xóa staging sau khi hoàn tất (dùng cho debug)
 * @returns {Promise<{ packages: Array<{ name: string, path: string, sizeBytes: number }>, stagingCleaned: boolean }>}
 */
export async function bundleProject(projectPath, outputPackageDir, options = {}) {
  // 1. Kiểm tra tham số projectPath
  if (!projectPath || typeof projectPath !== 'string' || projectPath.trim() === '') {
    throw new Error('Invalid project path provided');
  }

  const resolvedProjectPath = path.resolve(projectPath);
  if (!fs.existsSync(resolvedProjectPath)) {
    throw new Error(`Project path not found: ${resolvedProjectPath}`);
  }

  // 2. Kiểm tra tham số outputPackageDir
  if (!outputPackageDir || typeof outputPackageDir !== 'string' || outputPackageDir.trim() === '') {
    throw new Error('Invalid output package directory provided');
  }

  const resolvedOutputDir = path.resolve(outputPackageDir);
  fs.mkdirSync(resolvedOutputDir, { recursive: true });

  let projectName = options.projectName;
  if (!projectName) {
    const base = path.basename(resolvedProjectPath);
    const tempMatch = base.match(/^wp-(?:bundler|temp|proj)-([A-Za-z0-9_]+)-/);
    if (tempMatch) {
      projectName = tempMatch[1];
    } else {
      projectName = base;
    }
  }
  const parentThemeMode = options.parentThemeMode || 'bundle'; // 'bundle' | 'external-license'
  const stagingDir = options.stagingDir
    ? path.resolve(options.stagingDir)
    : path.join(resolvedProjectPath, '_staging_handover');

  // Đảm bảo staging cũ bị xóa sạch
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  let stagingCleaned = false;
  const packages = [];

  // Helper chống đệ quy và loại trừ thư mục đặc biệt khi staging từ projectPath
  function isIgnoredForStaging(targetPath, dirent) {
    const resolved = path.resolve(targetPath);
    const baseName = dirent ? dirent.name : path.basename(resolved);

    // Chống đệ quy: Tuyệt đối không bao giờ copy stagingDir hay outputPackageDir
    if (resolved === stagingDir || resolved.startsWith(stagingDir + path.sep)) return true;
    if (resolved === resolvedOutputDir || resolved.startsWith(resolvedOutputDir + path.sep)) return true;

    // Loại bỏ VCS, package manager & cache folders
    if (['.git', '.github', '.vscode', '.idea', '.gemini', '.claude', '.codex', '.agents', '.cursor', 'node_modules', 'scratch'].includes(baseName)) return true;

    // Loại bỏ wc-logs
    if (baseName.toLowerCase() === 'wc-logs') return true;

    // Loại bỏ junk files
    if (dirent && dirent.isFile() && isJunkFile(targetPath)) return true;

    return false;
  }

  try {
    // 3. Nhận diện cấu trúc Theme & Plugins
    const themeHierarchy = detectThemeHierarchy(resolvedProjectPath, options.activeTheme);
    const { childTheme, parentTheme } = themeHierarchy;

    // Danh sách active plugins: ưu tiên options -> sau đó detect DB -> nếu không có thì giữ tất cả non-junk
    let activePlugins = options.activePlugins;
    if (!activePlugins) {
      const dbDetection = detectActiveWordPress(resolvedProjectPath);
      if (dbDetection.activePlugins.length > 0) {
        activePlugins = dbDetection.activePlugins;
      }
    }

    // =========================================================================
    // 4. TIẾN HÀNH STAGING CÓ CHỌN LỌC (Selective Whitelist Staging)
    // =========================================================================

    // a. WordPress Root Files
    const rootEntries = fs.readdirSync(resolvedProjectPath, { withFileTypes: true });
    for (const entry of rootEntries) {
      const srcItem = path.join(resolvedProjectPath, entry.name);
      const destItem = path.join(stagingDir, entry.name);

      if (isIgnoredForStaging(srcItem, entry)) continue;

      if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        // Whitelist các file root quan trọng của WordPress
        const isWhitelistedRootFile =
          lower.endsWith('.php') ||
          lower.endsWith('.sql') ||
          lower.endsWith('.html') ||
          lower.endsWith('.htm') ||
          lower.endsWith('.txt') ||
          lower === '.htaccess' ||
          lower === 'web.config';

        if (isWhitelistedRootFile && !isJunkFile(srcItem)) {
          fs.copyFileSync(srcItem, destItem);
        }
      } else if (entry.isDirectory()) {
        // Chỉ copy wp-admin và wp-includes trực tiếp từ root
        if (entry.name === 'wp-admin' || entry.name === 'wp-includes') {
          copyDirFiltered(srcItem, destItem, isIgnoredForStaging);
        }
      }
    }

    // b. Staging wp-content/themes
    const srcThemesDir = path.join(resolvedProjectPath, 'wp-content', 'themes');
    const destThemesDir = path.join(stagingDir, 'wp-content', 'themes');
    fs.mkdirSync(destThemesDir, { recursive: true });

    if (fs.existsSync(srcThemesDir)) {
      if (parentThemeMode === 'bundle') {
        // Sao chép cả parent theme lẫn child theme
        if (parentTheme && fs.existsSync(path.join(srcThemesDir, parentTheme))) {
          copyDirFiltered(path.join(srcThemesDir, parentTheme), path.join(destThemesDir, parentTheme), isIgnoredForStaging);
        }
        if (childTheme && fs.existsSync(path.join(srcThemesDir, childTheme))) {
          copyDirFiltered(path.join(srcThemesDir, childTheme), path.join(destThemesDir, childTheme), isIgnoredForStaging);
        }
      } else if (parentThemeMode === 'external-license') {
        // Chỉ sao chép child theme, kèm file hướng dẫn bản quyền
        if (childTheme && fs.existsSync(path.join(srcThemesDir, childTheme))) {
          copyDirFiltered(path.join(srcThemesDir, childTheme), path.join(destThemesDir, childTheme), isIgnoredForStaging);
        }
        const noticeText = `================================================================================
HUONG DAN CAI DAT THEME CHA (PARENT THEME LICENSE NOTICE)
================================================================================
Du an su dung Child Theme: ${childTheme || 'custom-child'}
Yeu cau Theme cha: ${parentTheme || 'parent-theme'}

Vi ly do ban quyen thuong mai (GPL / Envato Commercial License), theme cha ${parentTheme || 'goc'}
khong duoc dong goi kem trong che do external-license nay.

Vui long mua hoac tai ban quyen theme ${parentTheme || 'goc'} chinh thuc tu nha phat trien
va copy thu muc '${parentTheme}' vao 'wp-content/themes/${parentTheme}' truoc khi kich hoat child theme.
================================================================================
`;
        fs.writeFileSync(path.join(destThemesDir, 'PARENT_THEME_INSTRUCTIONS.txt'), noticeText, 'utf8');
      }
    }

    // c. Staging wp-content/plugins
    const srcPluginsDir = path.join(resolvedProjectPath, 'wp-content', 'plugins');
    const destPluginsDir = path.join(stagingDir, 'wp-content', 'plugins');
    fs.mkdirSync(destPluginsDir, { recursive: true });

    if (fs.existsSync(srcPluginsDir)) {
      const pluginEntries = fs.readdirSync(srcPluginsDir, { withFileTypes: true });
      for (const pEntry of pluginEntries) {
        const srcP = path.join(srcPluginsDir, pEntry.name);
        const destP = path.join(destPluginsDir, pEntry.name);

        if (isIgnoredForStaging(srcP, pEntry)) continue;

        // Kiểm tra whitelist active plugins
        if (!isPluginActive(pEntry.name, activePlugins)) {
          continue; // Inactive plugin -> loại trừ
        }

        if (pEntry.isDirectory()) {
          copyDirFiltered(srcP, destP, isIgnoredForStaging);
        } else if (pEntry.isFile()) {
          if (!isJunkFile(srcP)) {
            fs.copyFileSync(srcP, destP);
          }
        }
      }
    }

    // d. Staging wp-content/uploads (bỏ wc-logs)
    const srcUploadsDir = path.join(resolvedProjectPath, 'wp-content', 'uploads');
    const destUploadsDir = path.join(stagingDir, 'wp-content', 'uploads');
    if (fs.existsSync(srcUploadsDir)) {
      fs.mkdirSync(destUploadsDir, { recursive: true });
      copyDirFiltered(srcUploadsDir, destUploadsDir, (itemPath, dirent) => {
        if (isIgnoredForStaging(itemPath, dirent)) return true;
        const norm = normalizePath(itemPath).toLowerCase();
        if (norm.includes('/wc-logs') || norm.endsWith('/wc-logs')) return true;
        return false;
      });
    }

    // e. Staging wp-content/languages & wp-content/fonts (nếu có)
    for (const folder of ['languages', 'fonts']) {
      const srcExtra = path.join(resolvedProjectPath, 'wp-content', folder);
      const destExtra = path.join(stagingDir, 'wp-content', folder);
      if (fs.existsSync(srcExtra)) {
        copyDirFiltered(srcExtra, destExtra, isIgnoredForStaging);
      }
    }

    // Callback thông báo staging sẵn sàng
    if (typeof options.onStaged === 'function') {
      options.onStaged(stagingDir);
    }

    // =========================================================================
    // 5. ĐÓNG GÓI CÁC GÓI RIÊNG BIỆT (Themes, Custom Plugins, Notices)
    // =========================================================================

    // a. Đóng gói Parent Theme (nếu parentThemeMode === 'bundle')
    if (parentThemeMode === 'bundle' && parentTheme) {
      const parentThemeStaged = path.join(destThemesDir, parentTheme);
      if (fs.existsSync(parentThemeStaged)) {
        const parentZipPath = path.join(resolvedOutputDir, `${parentTheme}.zip`);
        createZipArchive(parentZipPath, destThemesDir, parentTheme);
        packages.push({
          name: `${parentTheme}.zip`,
          path: parentZipPath,
          sizeBytes: calculateDirSize(parentZipPath)
        });
      }
    }

    // b. Đóng gói Child Theme (sạch rác, không .bak)
    if (childTheme) {
      const childThemeStaged = path.join(destThemesDir, childTheme);
      if (fs.existsSync(childThemeStaged)) {
        const childZipPath = path.join(resolvedOutputDir, `${childTheme}.zip`);
        createZipArchive(childZipPath, destThemesDir, childTheme);
        packages.push({
          name: `${childTheme}.zip`,
          path: childZipPath,
          sizeBytes: calculateDirSize(childZipPath)
        });
      }
    }

    // c. Tạo thư mục themes/ mở sẵn trong outputPackageDir
    const outputThemesDir = path.join(resolvedOutputDir, 'themes');
    if (fs.existsSync(outputThemesDir)) {
      fs.rmSync(outputThemesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputThemesDir, { recursive: true });

    const filterThemeJunk = (itemPath, dirent) => dirent && dirent.isFile() && isJunkFile(itemPath);

    if (parentThemeMode === 'bundle') {
      if (parentTheme && fs.existsSync(path.join(destThemesDir, parentTheme))) {
        copyDirFiltered(path.join(destThemesDir, parentTheme), path.join(outputThemesDir, parentTheme), filterThemeJunk);
      }
      if (childTheme && fs.existsSync(path.join(destThemesDir, childTheme))) {
        copyDirFiltered(path.join(destThemesDir, childTheme), path.join(outputThemesDir, childTheme), filterThemeJunk);
      }
    } else if (parentThemeMode === 'external-license') {
      if (childTheme && fs.existsSync(path.join(destThemesDir, childTheme))) {
        copyDirFiltered(path.join(destThemesDir, childTheme), path.join(outputThemesDir, childTheme), filterThemeJunk);
      }
    }

    packages.push({
      name: 'themes',
      path: outputThemesDir,
      sizeBytes: calculateDirSize(outputThemesDir)
    });

    // d. Sinh LICENSE_NOTICE.txt và PARENT_THEME_INSTRUCTIONS.txt nếu ở chế độ external-license
    if (parentThemeMode === 'external-license') {
      const licenseNoticeText = `================================================================================
HUONG DAN CAI DAT THEME CHA (PARENT THEME LICENSE NOTICE)
================================================================================
Du an su dung Child Theme: ${childTheme || 'custom-child'}
Yeu cau Theme cha: ${parentTheme || 'parent-theme'}

Vi ly do ban quyen thuong mai (GPL / Envato Commercial License), theme cha ${parentTheme || 'goc'}
khong duoc dong goi kem trong goi ban giao nay.

Vui long mua hoac tai ban quyen theme ${parentTheme || 'goc'} chinh thuc tu nha phat trien
va dat vao 'wp-content/themes/${parentTheme}' truoc khi kich hoat child theme.
================================================================================
`;
      const noticePath = path.join(resolvedOutputDir, 'LICENSE_NOTICE.txt');
      const instructionPath = path.join(resolvedOutputDir, 'PARENT_THEME_INSTRUCTIONS.txt');
      fs.writeFileSync(noticePath, licenseNoticeText, 'utf8');
      fs.writeFileSync(instructionPath, licenseNoticeText, 'utf8');

      packages.push({
        name: 'LICENSE_NOTICE.txt',
        path: noticePath,
        sizeBytes: calculateDirSize(noticePath)
      });
      packages.push({
        name: 'PARENT_THEME_INSTRUCTIONS.txt',
        path: instructionPath,
        sizeBytes: calculateDirSize(instructionPath)
      });
    }

    // e. Đóng gói Plugin tùy biến (custom plugins)
    if (!options.themesOnly) {
      const customPluginSlugs = new Set();
      if (Array.isArray(options.customPlugins)) {
        for (const p of options.customPlugins) {
          customPluginSlugs.add(normalizePath(p).split('/')[0]);
        }
      }

      // Tự động nhận diện plugin custom nếu có (ví dụ banh-su-woo-fillings)
      if (fs.existsSync(destPluginsDir)) {
        const stagedPlugins = fs.readdirSync(destPluginsDir, { withFileTypes: true });
        for (const sp of stagedPlugins) {
          if (sp.isDirectory()) {
            const lowerName = sp.name.toLowerCase();
            if (lowerName === 'banh-su-woo-fillings' || lowerName.includes('custom') || lowerName.includes('fillings')) {
              customPluginSlugs.add(sp.name);
            }
          }
        }
      }

      for (const slug of customPluginSlugs) {
        const pluginSrcDir = path.join(destPluginsDir, slug);
        if (fs.existsSync(pluginSrcDir)) {
          const pluginZipPath = path.join(resolvedOutputDir, `${slug}.zip`);
          createZipArchive(pluginZipPath, destPluginsDir, slug);
          packages.push({
            name: `${slug}.zip`,
            path: pluginZipPath,
            sizeBytes: calculateDirSize(pluginZipPath)
          });
        }
      }
    }

    // =========================================================================
    // 6. NÉN TRỌN BỘ WEBSITE (Full Website Packages)
    // =========================================================================
    if (!options.themesOnly) {
      const stagedEntries = fs.readdirSync(stagingDir);
      if (stagedEntries.length > 0) {
        // 1. [Project]_Full_Website.zip
        const fullWebsiteZipName = `${projectName}_Full_Website.zip`;
        const fullWebsiteZipPath = path.join(resolvedOutputDir, fullWebsiteZipName);
        createZipArchive(fullWebsiteZipPath, stagingDir, stagedEntries);

        packages.push({
          name: fullWebsiteZipName,
          path: fullWebsiteZipPath,
          sizeBytes: calculateDirSize(fullWebsiteZipPath)
        });

        // 2. [Project].zip
        const projectZipName = `${projectName}.zip`;
        const projectZipPath = path.join(resolvedOutputDir, projectZipName);
        fs.copyFileSync(fullWebsiteZipPath, projectZipPath);

        packages.push({
          name: projectZipName,
          path: projectZipPath,
          sizeBytes: calculateDirSize(projectZipPath)
        });
      }
    }

    const result = {
      packages,
      stagingCleaned: false
    };

    // 7. DỌN SẠCH THƯ MỤC STAGING TẠM
    if (!options.keepStaging) {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
      result.stagingCleaned = !fs.existsSync(stagingDir);
    } else {
      result.stagingCleaned = false;
    }

    return result;
  } finally {
    // Đảm bảo dọn dẹp kể cả khi có ngoại lệ
    if (!options.keepStaging && fs.existsSync(stagingDir)) {
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
