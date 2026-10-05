import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { listTestFiles } from '../scripts/run-tests.mjs';

test('listTestFiles discovers tests in tests/ and skills/*/tests/', () => {
  const files = listTestFiles(process.cwd());
  assert.ok(Array.isArray(files), 'Must return an array of file paths');
  assert.ok(files.some(f => f.includes('run-tests.test.mjs')), 'Must include run-tests.test.mjs');
});

test('listTestFiles does not throw and returns empty array when tests/ or skills/ is absent', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'was-test-runner-'));
  try {
    const files = listTestFiles(tempDir);
    assert.deepStrictEqual(files, []);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
