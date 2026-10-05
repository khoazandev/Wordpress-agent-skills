/**
 * Module Database Sanitizer & MySQL Dump (db_sanitizer.mjs)
 * 
 * Chức năng:
 * 1. Đọc và phân tích thông tin kết nối từ wp-config.php (DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_CHARSET, table_prefix).
 * 2. Dọn rác cơ sở dữ liệu trước khi xuất (transients trong wp_options, logs trong actionscheduler_logs).
 * 3. Xuất MySQL Dump ưu tiên bằng mysqldump CLI tối ưu utf8mb4, single-transaction.
 * 4. Fallback tự động sang PHP dumper (PDO/mysqli) nếu không có mysqldump CLI hoặc được chỉ định forcePhpFallback.
 * 5. Tích hợp safeReplaceSerialized để cập nhật URL an toàn trong file dump mà không làm hỏng dữ liệu serialized.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { safeReplaceSerialized } from './safe_replacer.mjs';

/**
 * Tìm kiếm đường dẫn binary PHP khả dụng trên hệ thống.
 */
export function findPhpBinary() {
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
      // Tiếp tục kiểm tra ứng viên tiếp theo
    }
  }
  return null;
}

/**
 * Tìm kiếm đường dẫn binary mysqldump khả dụng trên hệ thống.
 */
export function findMysqldumpBinary() {
  const candidates = [
    'C:\\xampp\\mysql\\bin\\mysqldump.exe',
    'C:\\laragon\\bin\\mysql\\current\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
    'mysqldump'
  ];
  for (const bin of candidates) {
    try {
      execSync(`"${bin}" --version`, { stdio: 'ignore' });
      return bin;
    } catch {
      // Tiếp tục kiểm tra ứng viên tiếp theo
    }
  }
  return null;
}

/**
 * Đọc và phân tích cấu hình cơ sở dữ liệu từ wp-config.php.
 * 
 * @param {string} projectPath - Đường dẫn thư mục gốc WordPress
 * @returns {object} Thông tin cấu hình DB
 */
export function readDbConfig(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new Error('Invalid project path provided');
  }

  const resolvedPath = path.resolve(projectPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Project path not found: ${resolvedPath}`);
  }

  const wpConfigPath = path.join(resolvedPath, 'wp-config.php');
  if (!fs.existsSync(wpConfigPath)) {
    throw new Error(`wp-config.php not found in project path: ${resolvedPath}`);
  }

  const configContent = fs.readFileSync(wpConfigPath, 'utf8');

  const dbNameMatch = configContent.match(/define\s*\(\s*['"]DB_NAME['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
  const dbUserMatch = configContent.match(/define\s*\(\s*['"]DB_USER['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
  const dbPassMatch = configContent.match(/define\s*\(\s*['"]DB_PASSWORD['"]\s*,\s*['"]([^'"]*)['"]\s*\)/i);
  const dbHostMatch = configContent.match(/define\s*\(\s*['"]DB_HOST['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
  const dbCharsetMatch = configContent.match(/define\s*\(\s*['"]DB_CHARSET['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
  const dbCollateMatch = configContent.match(/define\s*\(\s*['"]DB_COLLATE['"]\s*,\s*['"]([^'"]*)['"]\s*\)/i);
  const prefixMatch = configContent.match(/\$table_prefix\s*=\s*['"]([^'"]+)['"]/i);

  if (!dbNameMatch || !dbUserMatch || !dbHostMatch) {
    throw new Error('Incomplete database credentials found in wp-config.php');
  }

  let host = dbHostMatch[1];
  let port = 3306;
  if (host.includes(':')) {
    const parts = host.split(':');
    host = parts[0];
    const parsedPort = parseInt(parts[1], 10);
    if (!isNaN(parsedPort)) {
      port = parsedPort;
    }
  }

  return {
    dbName: dbNameMatch[1],
    dbUser: dbUserMatch[1],
    dbPassword: dbPassMatch ? dbPassMatch[1] : '',
    dbHost: host,
    dbPort: port,
    rawHost: dbHostMatch[1],
    dbCharset: dbCharsetMatch ? dbCharsetMatch[1] : 'utf8mb4',
    dbCollate: dbCollateMatch ? dbCollateMatch[1] : '',
    tablePrefix: prefixMatch ? prefixMatch[1] : 'wp_'
  };
}

/**
 * Kiểm tra kết nối tới cơ sở dữ liệu MySQL bằng PHP PDO.
 */
function verifyDbConnection(dbConfig, phpBin) {
  const testPhp = `<?php
    $host = $argv[1];
    $port = (int)$argv[2];
    $dbname = $argv[3];
    $user = $argv[4];
    $pass = $argv[5];
    try {
      $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
      $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 3
      ]);
      echo json_encode(['connected' => true]);
      exit(0);
    } catch (Throwable $e) {
      echo json_encode(['connected' => false, 'error' => $e->getMessage()]);
      exit(1);
    }
  `;

  const tempScript = path.join(os.tmpdir(), `wp-db-verify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.php`);
  fs.writeFileSync(tempScript, testPhp, 'utf8');

  try {
    const output = execFileSync(phpBin, [
      tempScript,
      dbConfig.dbHost,
      String(dbConfig.dbPort),
      dbConfig.dbName,
      dbConfig.dbUser,
      dbConfig.dbPassword
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    const parsed = JSON.parse(output.trim());
    if (!parsed.connected) {
      throw new Error(`Database connection failed: ${parsed.error}`);
    }
  } catch (err) {
    let msg = err.message;
    if (err.stdout) {
      try {
        const json = JSON.parse(err.stdout.toString().trim());
        if (json.error) msg = json.error;
      } catch {}
    }
    throw new Error(`Database connection failed: ${msg}`);
  } finally {
    try {
      if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    } catch {}
  }
}

/**
 * Lấy danh sách tất cả các bảng trong database.
 */
function getDbTableList(dbConfig, phpBin) {
  const scriptPhp = `<?php
    $host = $argv[1];
    $port = (int)$argv[2];
    $dbname = $argv[3];
    $user = $argv[4];
    $pass = $argv[5];
    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo json_encode($tables);
  `;
  const tempScript = path.join(os.tmpdir(), `wp-db-tables-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.php`);
  fs.writeFileSync(tempScript, scriptPhp, 'utf8');

  try {
    const output = execFileSync(phpBin, [
      tempScript,
      dbConfig.dbHost,
      String(dbConfig.dbPort),
      dbConfig.dbName,
      dbConfig.dbUser,
      dbConfig.dbPassword
    ], { encoding: 'utf8' });
    return JSON.parse(output.trim());
  } finally {
    try {
      if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    } catch {}
  }
}

/**
 * Dọn dẹp các bản ghi tạm (transients) và nhật ký thừa trong cơ sở dữ liệu.
 * 
 * @param {object} dbConfig - Cấu hình DB từ readDbConfig()
 * @param {object} options - Các tùy chọn bổ sung
 * @returns {Promise<{transientsDeleted: number, logsDeleted: number}>}
 */
export async function purgeDatabaseTransients(dbConfig, options = {}) {
  const phpBin = findPhpBinary();
  if (!phpBin) {
    throw new Error('PHP binary not found for database purging');
  }

  const scriptPhp = `<?php
    $host = $argv[1];
    $port = (int)$argv[2];
    $dbname = $argv[3];
    $user = $argv[4];
    $pass = $argv[5];
    $prefix = $argv[6];

    try {
      $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
      $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 10
      ]);

      // 1. Xóa transients trong wp_options
      $delTransientsSql = "DELETE FROM \`{$prefix}options\` WHERE \`option_name\` LIKE '_transient_%' OR \`option_name\` LIKE '_site_transient_%'";
      $transientsCount = $pdo->exec($delTransientsSql);

      // 2. Xóa actionscheduler_logs nếu bảng tồn tại
      $logsCount = 0;
      $checkTable = $pdo->query("SHOW TABLES LIKE '{$prefix}actionscheduler_logs'");
      if ($checkTable && $checkTable->rowCount() > 0) {
        $logsCount = $pdo->exec("DELETE FROM \`{$prefix}actionscheduler_logs\`");
      }

      echo json_encode([
        'success' => true,
        'transientsDeleted' => (int)$transientsCount,
        'logsDeleted' => (int)$logsCount
      ]);
      exit(0);
    } catch (Throwable $e) {
      echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
      ]);
      exit(1);
    }
  `;

  const tempScript = path.join(os.tmpdir(), `wp-db-purge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.php`);
  fs.writeFileSync(tempScript, scriptPhp, 'utf8');

  try {
    const output = execFileSync(phpBin, [
      tempScript,
      dbConfig.dbHost,
      String(dbConfig.dbPort),
      dbConfig.dbName,
      dbConfig.dbUser,
      dbConfig.dbPassword,
      dbConfig.tablePrefix
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    const result = JSON.parse(output.trim());
    if (!result.success) {
      throw new Error(`Failed to purge database transients: ${result.error}`);
    }
    return {
      transientsDeleted: result.transientsDeleted,
      logsDeleted: result.logsDeleted
    };
  } catch (err) {
    let msg = err.message;
    if (err.stdout) {
      try {
        const json = JSON.parse(err.stdout.toString().trim());
        if (json.error) msg = json.error;
      } catch {}
    }
    throw new Error(`Failed to purge database transients: ${msg}`);
  } finally {
    try {
      if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    } catch {}
  }
}

/**
 * Thực hiện xuất database bằng công cụ mysqldump CLI chuẩn.
 */
function dumpWithMysqldump(dbConfig, outputPath, mysqldumpBin) {
  const args = [
    `--default-character-set=${dbConfig.dbCharset || 'utf8mb4'}`,
    '--add-drop-table',
    '--quick',
    '--single-transaction',
    `-h${dbConfig.dbHost}`,
    `-P${dbConfig.dbPort}`,
    `-u${dbConfig.dbUser}`,
  ];

  if (dbConfig.dbPassword) {
    args.push(`-p${dbConfig.dbPassword}`);
  }

  args.push(`--result-file=${outputPath}`);
  args.push(dbConfig.dbName);

  execFileSync(mysqldumpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error('mysqldump completed but output file is missing or empty');
  }
}

/**
 * Thực hiện xuất database bằng script PHP Fallback (PDO/mysqli) với phân trang theo lô 500 dòng.
 */
function dumpWithPhpFallback(dbConfig, outputPath, phpBin) {
  const fallbackPhp = `<?php
    $host = $argv[1];
    $port = (int)$argv[2];
    $dbname = $argv[3];
    $user = $argv[4];
    $pass = $argv[5];
    $charset = !empty($argv[6]) ? $argv[6] : 'utf8mb4';
    $outputPath = $argv[7];

    try {
      $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
      $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset}"
      ]);

      $fp = fopen($outputPath, 'w');
      if (!$fp) {
        throw new Exception("Unable to open output file: {$outputPath}");
      }

      $now = date('Y-m-d H:i:s');
      fwrite($fp, "-- WordPress Database Dump (PHP Fallback Batch Engine)\n");
      fwrite($fp, "-- Generated: {$now}\n");
      fwrite($fp, "-- Host: {$host}:{$port}    Database: {$dbname}\n");
      fwrite($fp, "-- ------------------------------------------------------\n\n");
      fwrite($fp, "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n");
      fwrite($fp, "/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n");
      fwrite($fp, "/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n");
      fwrite($fp, "/*!40101 SET NAMES {$charset} */;\n");
      fwrite($fp, "/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n");
      fwrite($fp, "/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n");
      fwrite($fp, "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n");
      fwrite($fp, "/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n");

      $stmt = $pdo->query("SHOW TABLES");
      $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

      foreach ($tables as $table) {
        fwrite($fp, "--\n-- Table structure for table \`{$table}\`\n--\n\n");
        fwrite($fp, "DROP TABLE IF EXISTS \`{$table}\`;\n");
        fwrite($fp, "/*!40101 SET @saved_cs_client     = @@character_set_client */;\n");
        fwrite($fp, "/*!40101 SET character_set_client = {$charset} */;\n");

        $createStmt = $pdo->query("SHOW CREATE TABLE \`{$table}\`");
        $createRow = $createStmt->fetch(PDO::FETCH_NUM);
        $createSql = $createRow[1];
        fwrite($fp, "{$createSql};\n");
        fwrite($fp, "/*!40101 SET character_set_client = @saved_cs_client */;\n\n");

        $countStmt = $pdo->query("SELECT COUNT(*) FROM \`{$table}\`");
        $totalRows = (int)$countStmt->fetchColumn();

        if ($totalRows > 0) {
          fwrite($fp, "--\n-- Dumping data for table \`{$table}\`\n--\n\n");
          fwrite($fp, "LOCK TABLES \`{$table}\` WRITE;\n");
          fwrite($fp, "/*!40000 ALTER TABLE \`{$table}\` DISABLE KEYS */;\n");

          $batchSize = 500;
          $offset = 0;
          while ($offset < $totalRows) {
            $dataStmt = $pdo->query("SELECT * FROM \`{$table}\` LIMIT {$batchSize} OFFSET {$offset}");
            $rows = $dataStmt->fetchAll(PDO::FETCH_NUM);
            if (empty($rows)) {
              break;
            }

            $rowStrings = [];
            foreach ($rows as $r) {
              $escapedVals = [];
              foreach ($r as $val) {
                if ($val === null) {
                  $escapedVals[] = 'NULL';
                } else {
                  $escapedVals[] = $pdo->quote($val);
                }
              }
              $rowStrings[] = '(' . implode(',', $escapedVals) . ')';
            }

            fwrite($fp, "INSERT INTO \`{$table}\` VALUES \n" . implode(",\n", $rowStrings) . ";\n");
            $offset += count($rows);
          }

          fwrite($fp, "/*!40000 ALTER TABLE \`{$table}\` ENABLE KEYS */;\n");
          fwrite($fp, "UNLOCK TABLES;\n\n");
        }
      }

      fwrite($fp, "/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n");
      fwrite($fp, "/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n");
      fwrite($fp, "/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n");
      fwrite($fp, "/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n");
      fwrite($fp, "/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n");
      fwrite($fp, "/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n");
      fwrite($fp, "/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n\n");
      fwrite($fp, "-- Dump completed on " . date('Y-m-d H:i:s') . "\n");

      fclose($fp);

      echo json_encode([
        'success' => true,
        'tableCount' => count($tables),
        'sizeBytes' => filesize($outputPath)
      ]);
      exit(0);
    } catch (Throwable $e) {
      if (isset($fp) && is_resource($fp)) {
        fclose($fp);
      }
      echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
      ]);
      exit(1);
    }
  `;

  const tempScript = path.join(os.tmpdir(), `wp-db-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.php`);
  fs.writeFileSync(tempScript, fallbackPhp, 'utf8');

  try {
    const output = execFileSync(phpBin, [
      tempScript,
      dbConfig.dbHost,
      String(dbConfig.dbPort),
      dbConfig.dbName,
      dbConfig.dbUser,
      dbConfig.dbPassword,
      dbConfig.dbCharset || 'utf8mb4',
      outputPath
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    const result = JSON.parse(output.trim());
    if (!result.success) {
      throw new Error(`PHP Fallback Dump error: ${result.error}`);
    }
    return result;
  } catch (err) {
    let msg = err.message;
    if (err.stdout) {
      try {
        const json = JSON.parse(err.stdout.toString().trim());
        if (json.error) msg = json.error;
      } catch {}
    }
    throw new Error(`PHP Fallback Dump error: ${msg}`);
  } finally {
    try {
      if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    } catch {}
  }
}

/**
 * Xuất toàn bộ cơ sở dữ liệu WordPress ra file .sql chuẩn và làm sạch dữ liệu rác.
 * 
 * @param {string} projectPath - Đường dẫn thư mục gốc WordPress chứa wp-config.php
 * @param {string} outputPath - Đường dẫn file .sql đầu ra cần ghi
 * @param {object} options - Các tùy chọn bổ sung:
 *        - forcePhpFallback: boolean (ép buộc sử dụng PHP Fallback thay vì mysqldump CLI)
 *        - purgeTransients: boolean (dọn rác transients và logs trước khi dump, mặc định true)
 *        - safeSerializedReplace: { oldUrl: string, newUrl: string } (thay thế URL an toàn sau khi dump)
 * @returns {Promise<{dumpPath: string, sizeBytes: number, tableCount: number, method: string, transientsPurged?: object}>}
 */
export async function dumpDatabase(projectPath, outputPath, options = {}) {
  const dbConfig = readDbConfig(projectPath);

  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('Invalid output path provided');
  }

  const resolvedOutputPath = path.resolve(outputPath);
  const outputDir = path.dirname(resolvedOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const phpBin = findPhpBinary();
  if (!phpBin) {
    throw new Error('PHP binary not found. PHP is required for database operations.');
  }

  // 1. Xác thực kết nối DB trước khi thực hiện
  verifyDbConnection(dbConfig, phpBin);

  // 2. Dọn rác transients nếu được bật (mặc định: true)
  let transientsPurged = { transientsDeleted: 0, logsDeleted: 0 };
  if (options.purgeTransients !== false) {
    transientsPurged = await purgeDatabaseTransients(dbConfig, options);
  }

  // 3. Lấy danh sách bảng để đối chiếu
  const tables = getDbTableList(dbConfig, phpBin);
  const totalTables = tables.length;

  // 4. Quyết định phương thức dump (ưu tiên mysqldump, fallback sang PHP)
  let method = 'mysqldump';
  const mysqldumpBin = findMysqldumpBinary();

  if (options.forcePhpFallback || !mysqldumpBin) {
    dumpWithPhpFallback(dbConfig, resolvedOutputPath, phpBin);
    method = 'php_fallback';
  } else {
    try {
      dumpWithMysqldump(dbConfig, resolvedOutputPath, mysqldumpBin);
    } catch {
      // Nếu mysqldump gặp lỗi, tự động chuyển sang PHP Fallback
      dumpWithPhpFallback(dbConfig, resolvedOutputPath, phpBin);
      method = 'php_fallback';
    }
  }

  // 5. Nếu có tùy chọn safeSerializedReplace, thay thế URL an toàn trong file .sql
  if (options.safeSerializedReplace && options.safeSerializedReplace.oldUrl && options.safeSerializedReplace.newUrl) {
    const rawSql = fs.readFileSync(resolvedOutputPath, 'utf8');
    const replacedSql = safeReplaceSerialized(
      rawSql,
      options.safeSerializedReplace.oldUrl,
      options.safeSerializedReplace.newUrl
    );
    fs.writeFileSync(resolvedOutputPath, replacedSql, 'utf8');
  }

  const stat = fs.statSync(resolvedOutputPath);

  return {
    dumpPath: resolvedOutputPath,
    sizeBytes: stat.size,
    tableCount: totalTables,
    method,
    transientsPurged
  };
}

// Hỗ trợ thực thi trực tiếp từ CLI nếu người dùng muốn test hoặc xuất nhanh
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const projectPath = args[0] || process.cwd();
  const outputPath = args[1] || path.join(projectPath, 'dong_goi_du_an', 'database.sql');

  console.log(`Starting Database Dump for: ${projectPath}`);
  console.log(`Output: ${outputPath}`);

  dumpDatabase(projectPath, outputPath)
    .then(result => {
      console.log('\n Dump successfully completed!');
      console.log(`- Method:      ${result.method}`);
      console.log(`- Tables:      ${result.tableCount}`);
      console.log(`- Size:        ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB (${result.sizeBytes.toLocaleString()} bytes)`);
      console.log(`- Path:        ${result.dumpPath}`);
      console.log(`- Transients:  ${result.transientsPurged.transientsDeleted} purged`);
      console.log(`- Action Logs: ${result.transientsPurged.logsDeleted} purged`);
    })
    .catch(err => {
      console.error('\n Dump failed:', err.message);
      process.exit(1);
    });
}
