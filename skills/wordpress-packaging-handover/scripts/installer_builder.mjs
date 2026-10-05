/**
 * Module Sinh Bộ Cài Đặt Tự Động (installer_builder.mjs)
 * Module: scripts/installer_builder.mjs
 *
 * Nhiệm vụ:
 * 1. Tự động sinh mã bảo mật Auth Token ngẫu nhiên (16 ký tự hex) hoặc nhận từ options.
 * 2. Đọc cấu hình wp-config.php để trích xuất tên DB mặc định và tên file SQL dump tương ứng.
 * 3. Nạp template setup-template.php và tiêm các thông số bảo mật, cấu hình, timestamp.
 * 4. Ghi file setup.php hoàn chỉnh vào thư mục đích (targetDir) phục vụ cài đặt 1-click độc lập.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TEMPLATE_PATH = path.resolve(__dirname, '../templates/setup-template.php');

/**
 * Sinh chuỗi Auth Token ngẫu nhiên 16 ký tự hexadecimal bảo mật.
 * @returns {string} 16-hex characters token
 */
export function generateAuthToken() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Trích xuất tên DB_NAME từ nội dung file wp-config.php.
 * 
 * @param {string} wpConfigContent - Nội dung file wp-config.php
 * @returns {string|null} Tên database hoặc null nếu không tìm thấy
 */
export function extractDbName(wpConfigContent) {
  if (!wpConfigContent || typeof wpConfigContent !== 'string') {
    return null;
  }
  const match = wpConfigContent.match(/define\s*\(\s*['"]DB_NAME['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
  return match ? match[1] : null;
}

/**
 * Xây dựng và xuất file setup.php cài đặt tự động.
 * 
 * @param {string} projectPath - Đường dẫn thư mục gốc WordPress nguồn
 * @param {string} targetDir - Thư mục đích nhận file setup.php
 * @param {object} [options={}] - Các tùy chọn bổ sung
 * @param {string} [options.authToken] - Token xác thực tùy chỉnh
 * @param {string} [options.defaultDbName] - Tên database mặc định tùy chỉnh
 * @param {string} [options.sqlFilename] - Tên file SQL database tùy chỉnh
 * @param {string} [options.templatePath] - Đường dẫn tới file template tùy chỉnh
 * @param {number|string} [options.timestamp] - Thời điểm sinh file (Unix timestamp)
 * @returns {Promise<{ installerPath: string, authToken: string }>}
 */
export async function buildInstaller(projectPath, targetDir, options = {}) {
  // 1. Kiểm tra tham số projectPath
  if (!projectPath || typeof projectPath !== 'string' || projectPath.trim() === '') {
    throw new Error('Invalid project path provided');
  }

  const resolvedProjectPath = path.resolve(projectPath);
  if (!fs.existsSync(resolvedProjectPath)) {
    throw new Error(`Project path not found: ${resolvedProjectPath}`);
  }

  // 2. Kiểm tra tham số targetDir
  if (!targetDir || typeof targetDir !== 'string' || targetDir.trim() === '') {
    throw new Error('Invalid target directory provided');
  }

  const resolvedTargetDir = path.resolve(targetDir);

  // 3. Đọc wp-config.php để lấy tên DB mặc định (nếu không cung cấp qua options)
  const wpConfigPath = path.join(resolvedProjectPath, 'wp-config.php');
  let detectedDbName = null;

  if (fs.existsSync(wpConfigPath)) {
    const wpConfigContent = fs.readFileSync(wpConfigPath, 'utf8');
    detectedDbName = extractDbName(wpConfigContent);
  } else {
    throw new Error(`wp-config.php not found in project path: ${resolvedProjectPath}`);
  }

  const defaultDbName = options.defaultDbName || detectedDbName || 'wordpress';
  const sqlFilename = options.sqlFilename || `${defaultDbName}_database.sql`;

  // 4. Sinh hoặc tiếp nhận Auth Token
  const authToken = options.authToken && typeof options.authToken === 'string' && options.authToken.trim() !== ''
    ? options.authToken.trim()
    : generateAuthToken();

  // 5. Xác định timestamp
  const timestamp = options.timestamp !== undefined && options.timestamp !== null
    ? String(options.timestamp)
    : String(Math.floor(Date.now() / 1000));

  // 6. Đọc template setup-template.php
  const templatePath = options.templatePath || DEFAULT_TEMPLATE_PATH;
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Installer template file not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf8');

  // 7. Thay thế toàn bộ các placeholder
  const renderedContent = templateContent
    .replaceAll('{{AUTH_TOKEN}}', authToken)
    .replaceAll('{{DEFAULT_DB_NAME}}', defaultDbName)
    .replaceAll('{{SQL_FILENAME}}', sqlFilename)
    .replaceAll('{{GENERATED_TIMESTAMP}}', timestamp)
    .replaceAll('{{CREATED_AT}}', timestamp);

  // 8. Đảm bảo thư mục target tồn tại và ghi file setup.php
  fs.mkdirSync(resolvedTargetDir, { recursive: true });
  const installerPath = path.join(resolvedTargetDir, 'setup.php');
  fs.writeFileSync(installerPath, renderedContent, 'utf8');

  return {
    installerPath,
    authToken
  };
}
