/**
 * Test Suite: Safe Serialized URL Replacer (safe_replacer.mjs)
 * Module: scripts/safe_replacer.mjs
 */

import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { safeReplaceSerialized } from '../scripts/safe_replacer.mjs';
import { findBinary } from '../scripts/lib/find-binary.mjs';

const oldUrl = 'http://localhost/demo_site';
const newUrl = 'http://localhost/new_app';

console.log('=== RUNNING SAFE SERIALIZED REPLACER TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${testName}`);
    console.error(`       Error: ${err.message}`);
    failCount++;
  }
}

runTest('Test 0: Fixture byte lengths are what the serialized headers claim', () => {
  assert.strictEqual(Buffer.byteLength(oldUrl, 'utf8'), 26);
  assert.strictEqual(Buffer.byteLength(`${oldUrl}/wp-content`, 'utf8'), 37);
  assert.strictEqual(Buffer.byteLength('Phố Cổ Tươi Đẹp Lắm', 'utf8'), 30);
  assert.strictEqual(Buffer.byteLength(`Chào mừng bạn đến ${oldUrl}`, 'utf8'), 52);
});

// -----------------------------------------------------------------------------
// Test 1: Simple serialized string replacement
// -----------------------------------------------------------------------------
runTest('Test 1a: Simple serialized string replacement (http://localhost/new_app -> length 24)', () => {
  const input = 's:26:"http://localhost/demo_site";';
  const result = safeReplaceSerialized(input, oldUrl, newUrl);
  // "http://localhost/new_app" has exactly 24 UTF-8 bytes
  const expectedByteLen = Buffer.byteLength(newUrl, 'utf8');
  assert.strictEqual(expectedByteLen, 24, 'newUrl byte length should be 24');
  assert.strictEqual(result, `s:24:"${newUrl}";`);
});

runTest('Test 1b: 22-byte target URL produces exact s:22 (as illustrated in brief)', () => {
  const input = 's:26:"http://localhost/demo_site";';
  const targetUrl22 = 'http://localhost/app12'; // exactly 22 bytes in UTF-8
  assert.strictEqual(Buffer.byteLength(targetUrl22, 'utf8'), 22, 'targetUrl22 must be exactly 22 bytes');
  const result = safeReplaceSerialized(input, oldUrl, targetUrl22);
  assert.strictEqual(result, `s:22:"${targetUrl22}";`);
});

// -----------------------------------------------------------------------------
// Test 2: Complex nested serialized array with multiple URLs
// -----------------------------------------------------------------------------
runTest('Test 2a: Complex nested serialized array with multiple URLs', () => {
  const input = 'a:2:{s:4:"site";s:26:"http://localhost/demo_site";s:3:"sub";s:37:"http://localhost/demo_site/wp-content";}';
  const result = safeReplaceSerialized(input, oldUrl, newUrl);
  const expected = 'a:2:{s:4:"site";s:24:"http://localhost/new_app";s:3:"sub";s:35:"http://localhost/new_app/wp-content";}';
  assert.strictEqual(result, expected);
});

runTest('Test 2b: Nested serialized array with a wrong declared length (s:36 for 37 bytes) is repaired', () => {
  const input = 'a:2:{s:4:"site";s:26:"http://localhost/demo_site";s:3:"sub";s:36:"http://localhost/demo_site/wp-content";}';
  const result = safeReplaceSerialized(input, oldUrl, newUrl);
  const expected = 'a:2:{s:4:"site";s:24:"http://localhost/new_app";s:3:"sub";s:35:"http://localhost/new_app/wp-content";}';
  assert.strictEqual(result, expected);
});

// -----------------------------------------------------------------------------
// Test 3: Multibyte UTF-8 characters (Vietnamese accents)
// -----------------------------------------------------------------------------
runTest('Test 3a: Multibyte Vietnamese text in adjacent serialized fields preserved intact', () => {
  const input = 'a:2:{s:5:"title";s:30:"Phố Cổ Tươi Đẹp Lắm";s:4:"link";s:26:"http://localhost/demo_site";}';
  const result = safeReplaceSerialized(input, oldUrl, newUrl);
  const expected = 'a:2:{s:5:"title";s:30:"Phố Cổ Tươi Đẹp Lắm";s:4:"link";s:24:"http://localhost/new_app";}';
  assert.strictEqual(result, expected);
});

runTest('Test 3b: Serialized string containing Vietnamese accents AND target URL (byte counting vs char counting)', () => {
  const input = 's:52:"Chào mừng bạn đến http://localhost/demo_site";';
  const result = safeReplaceSerialized(input, oldUrl, newUrl);
  const expected = 's:50:"Chào mừng bạn đến http://localhost/new_app";';
  assert.strictEqual(result, expected);

  const replacedContent = 'Chào mừng bạn đến http://localhost/new_app';
  assert.strictEqual(Buffer.byteLength(replacedContent, 'utf8'), 50, 'Byte count must be 50');
  assert.strictEqual(replacedContent.length, 42, 'Character count is 42 (differs from byte count due to multibyte accents)');
});

// -----------------------------------------------------------------------------
// Test 4: Non-serialized string replacements in the same raw content
// -----------------------------------------------------------------------------
runTest('Test 4: Mixed raw content (HTML post_content and serialized meta_value in SQL statement)', () => {
  const input = "INSERT INTO wp_posts (post_content, meta_value) VALUES ('<a href=\"http://localhost/demo_site\">Trang chủ</a>', 'a:1:{s:4:\"site\";s:26:\"http://localhost/demo_site\";}');";
  const result = safeReplaceSerialized(input, oldUrl, newUrl);
  const expected = "INSERT INTO wp_posts (post_content, meta_value) VALUES ('<a href=\"http://localhost/new_app\">Trang chủ</a>', 'a:1:{s:4:\"site\";s:24:\"http://localhost/new_app\";}');";
  assert.strictEqual(result, expected);
});

// -----------------------------------------------------------------------------
// Test 5: Escaped quotes in MySQL dump
// -----------------------------------------------------------------------------
runTest('Test 5: Escaped quotes in SQL dump serialized strings', () => {
  const input = "INSERT INTO wp_options VALUES (1, 's:26:\\\"http://localhost/demo_site\\\";');";
  const result = safeReplaceSerialized(input, oldUrl, newUrl);
  const expected = "INSERT INTO wp_options VALUES (1, 's:24:\\\"http://localhost/new_app\\\";');";
  assert.strictEqual(result, expected);
});

// -----------------------------------------------------------------------------
// Test 6: Flatsome shortcode with quotes in serialized data
// -----------------------------------------------------------------------------
runTest('Test 6: Flatsome UX Builder shortcodes with inner quotes in serialized data', () => {
  const input = 's:65:"[ux_banner bg=\\"http://localhost/demo_site/img.jpg\\"][/ux_banner]";';
  const result = safeReplaceSerialized(input, oldUrl, newUrl);
  const expected = 's:63:"[ux_banner bg=\\"http://localhost/new_app/img.jpg\\"][/ux_banner]";';
  assert.strictEqual(result, expected);
});

// -----------------------------------------------------------------------------
// Test 7: Physical verification with PHP CLI unserialize()
// -----------------------------------------------------------------------------
const PHP_BIN = findBinary('php');
if (!PHP_BIN) {
  console.log('[SKIP] Test 7: PHP CLI not found (set PHP_BIN or add php to PATH)');
  skipCount++;
} else {
  runTest('Test 7: Physical verification with PHP CLI unserialize() engine', () => {
    const serializedArray = 'a:2:{s:4:"site";s:26:"http://localhost/demo_site";s:3:"sub";s:37:"http://localhost/demo_site/wp-content";}';
    const replaced = safeReplaceSerialized(serializedArray, oldUrl, newUrl);

    const phpScript = `<?php
      $res = unserialize('${replaced}');
      if ($res === false) {
        echo "PHP_UNSERIALIZE_FAILED";
        exit(1);
      }
      if ($res['site'] !== '${newUrl}' || $res['sub'] !== '${newUrl}/wp-content') {
        echo "VALUES_MISMATCH";
        exit(2);
      }
      echo "PHP_UNSERIALIZE_SUCCESS";
    `;
    const output = execFileSync(PHP_BIN, [], { input: phpScript }).toString();
    assert(output.includes('PHP_UNSERIALIZE_SUCCESS'), 'PHP unserialize must succeed without notice/error');
  });
}

// -----------------------------------------------------------------------------
// Test 8: Edge cases and safeguards
// -----------------------------------------------------------------------------
runTest('Test 8: Safeguards and edge cases (empty url, null input, non-string, missing search string)', () => {
  assert.strictEqual(safeReplaceSerialized(null, oldUrl, newUrl), null);
  assert.strictEqual(safeReplaceSerialized(12345, oldUrl, newUrl), 12345);
  assert.strictEqual(safeReplaceSerialized('Hello World', '', newUrl), 'Hello World');
  assert.strictEqual(safeReplaceSerialized('Hello World', oldUrl, oldUrl), 'Hello World');
  assert.strictEqual(safeReplaceSerialized('Plain text with no target', oldUrl, newUrl), 'Plain text with no target');
  assert.strictEqual(safeReplaceSerialized('Plain URL: http://localhost/demo_site', oldUrl, newUrl), 'Plain URL: http://localhost/new_app');
});

console.log('\n===================================================');
console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED, ${skipCount} SKIPPED out of ${passCount + failCount + skipCount} tests`);
console.log('===================================================');

if (failCount > 0) {
  process.exit(1);
}
