import assert from 'node:assert';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { scanText, squashText } from '../scripts/lib/leak-scan.mjs';
import { validateRepository } from '../scripts/validate-skills.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');



test('squashText removes diacritics and non-alphanumeric chars', () => {
  assert.strictEqual(squashText('Đà Nẵng & Hội An!'), 'dananghoian');
});

test('scanText detects private paths and denylist items with squash matching', () => {
  const denylist = ['Hoa_Mai'];
  const hits = scanText('Welcome to hoamai.vn here\nAlso Hoa Mai is good', 'test.md', denylist);
  assert.strictEqual(hits.length, 2);
  assert.strictEqual(hits[0].type, 'DENY');
  assert.ok(hits[0].message.includes('entry #1'));
  assert.ok(!hits[0].message.includes('Hoa_Mai'));
});

test('scanText path patterns', () => {
  const cases = [
    ['C:', 'Users', 'x'].join('\\'),
    ['C:', 'Users', 'x'].join('/'),
    ['C:', 'Users', 'x'].join('\\\\'),
    ['', 'home', 'x', ''].join('/'),
    ['', 'Users', 'x', ''].join('/')
  ];
  for (const c of cases) {
    const hits = scanText(c, 'test.md', []);
    assert.strictEqual(hits.length, 1, `Failed to catch ${c}`);
  }

  const ignores = [
    ['C:', 'Users', '<user>'].join('\\'),
    ['C:', 'Users', 'Public'].join('\\'),
    ['D:', 'Users', 'Default'].join('/')
  ];
  for (const c of ignores) {
    const hits = scanText(c, 'test.md', []);
    assert.strictEqual(hits.length, 0, `Should ignore ${c}`);
  }

  const notIgnore = ['C:', 'Users', 'Publicity'].join('\\');
  assert.strictEqual(scanText(notIgnore, 'test.md', []).length, 1, `Should NOT ignore ${notIgnore}`);
  
  const skillFixtureLeak = ['C:', 'Users', 'x'].join('\\');
  const hits2 = scanText(skillFixtureLeak, 'skills/demo/fixtures/a.md', []);
  assert.strictEqual(hits2.length, 1, `Should NOT ignore skills/demo/fixtures/a.md`);
});

test('validateRepository verifies repo rules V1-V6 via fixtures', async () => {
  const tests = [
    { rule: 'V1', valid: 'v1-valid', invalid: 'v1-invalid' },
    { rule: 'V2', valid: 'v2-valid', invalid: 'v2-invalid' },
    { rule: 'V3', valid: 'v3-valid', invalid: 'v3-invalid', opts: { denylistPath: path.join(fixturesDir, 'v3-invalid', '.validate-denylist') } },
    { rule: 'V4', valid: 'v4-valid', invalid: 'v4-invalid' },
    { rule: 'V5', valid: 'v5-valid', invalid: 'v5-invalid' },
    { rule: 'V6', valid: 'v6-valid', invalid: 'v6-invalid' },
    { rule: 'V6', valid: 'v6-valid', invalid: 'v6-hook-invalid' }
  ];

  for (const t of tests) {
    const resValid = await validateRepository({ rootDir: path.join(fixturesDir, t.valid), suppressNoDenylistWarning: true });
    assert.strictEqual(resValid.errors.length, 0, `Expected 0 errors for ${t.valid}, got: ${JSON.stringify(resValid.errors)}`);

    const resInvalid = await validateRepository({ rootDir: path.join(fixturesDir, t.invalid), suppressNoDenylistWarning: true, ...t.opts });
    const ruleErrors = resInvalid.errors.filter(e => e.rule === t.rule);
    assert.ok(ruleErrors.length > 0, `Expected ${t.rule} errors for ${t.invalid}, got: ${JSON.stringify(resInvalid.errors)}`);
  }
});

test('validateRepository history check in temp repo', async () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'history-test-'));
  try {
    execSync('git init', { cwd: tmpRepo });
    execSync('git config user.name "Test"', { cwd: tmpRepo });
    execSync('git config user.email "test@example.com"', { cwd: tmpRepo });
    
    const denylistPath = path.join(tmpRepo, '.validate-denylist');
    fs.writeFileSync(denylistPath, 'Hoa_Mai');

    fs.writeFileSync(path.join(tmpRepo, 'file.md'), 'This has hoamai.vn inside');
    execSync('git add file.md', { cwd: tmpRepo });
    execSync('git commit -m "add file"', { cwd: tmpRepo });

    fs.unlinkSync(path.join(tmpRepo, 'file.md'));
    execSync('git add file.md', { cwd: tmpRepo });
    execSync('git commit -m "remove file"', { cwd: tmpRepo });

    // Assert worktree is clean
    const resWorktree = await validateRepository({ rootDir: tmpRepo, denylistPath, checkHistory: false });
    assert.strictEqual(resWorktree.errors.length, 0, `Worktree should be clean`);

    // Assert history detects it
    const result = await validateRepository({ rootDir: tmpRepo, denylistPath, checkHistory: true });
    const v3Errors = result.errors.filter(e => e.rule === 'V3');
    assert.ok(v3Errors.length > 0);
    assert.ok(v3Errors.some(e => e.message.includes('[git history]')));
    assert.ok(v3Errors.some(e => e.message.includes('entry #1')));
    assert.ok(!v3Errors.some(e => e.message.toLowerCase().includes('hoa_mai')));
  } finally {
    fs.rmSync(tmpRepo, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test('validateRepository verifies real repo root with 0 errors', async () => {
  const rootDir = path.resolve(__dirname, '..');
  const result = await validateRepository({ rootDir, suppressNoDenylistWarning: true });
  assert.strictEqual(result.errors.length, 0, `Real repo root should have 0 errors, got: ${JSON.stringify(result.errors)}`);
});
