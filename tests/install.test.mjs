import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { main } from '../scripts/install.mjs';

function setupTempHome() {
  const tmpdir = os.tmpdir();
  const dir = fs.mkdtempSync(path.join(tmpdir, 'was-test-'));
  return dir;
}

test('CLI dry-run prints action table with zero writes', async () => {
  const home = setupTempHome();
  try {
    const stdoutArr = [];
    const stderrArr = [];
    const exitCode = await main(['--dry-run'], {
      env: { WAS_HOME: home },
      stdout: msg => stdoutArr.push(msg),
      stderr: msg => stderrArr.push(msg)
    });
    
    assert.strictEqual(exitCode, 0);
    assert.ok(stdoutArr.some(msg => msg.includes('agent | skill | dest | action')));
    
    // Check nothing was written
    const gemini = path.join(home, '.gemini');
    const claude = path.join(home, '.claude');
    const codex = path.join(home, '.codex');
    assert.strictEqual(fs.existsSync(gemini), false);
    assert.strictEqual(fs.existsSync(claude), false);
    assert.strictEqual(fs.existsSync(codex), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('Global installation puts marker and skills into destination', async () => {
  const home = setupTempHome();
  try {
    const exitCode = await main([], {
      env: { WAS_HOME: home },
      stdout: () => {},
      stderr: () => {}
    });
    
    assert.strictEqual(exitCode, 0);
    
    // Verify marker in Antigravity
    const agyPath = path.join(home, '.gemini', 'antigravity', 'skills', 'wp-agency-router');
    assert.ok(fs.existsSync(agyPath));
    assert.ok(fs.existsSync(path.join(agyPath, '.wordpress-agent-skills.json')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('Conflict exit code 2 when non-marker directory exists without --force', async () => {
  const home = setupTempHome();
  try {
    const agyPath = path.join(home, '.gemini', 'antigravity', 'skills', 'wp-agency-router');
    fs.mkdirSync(agyPath, { recursive: true });
    fs.writeFileSync(path.join(agyPath, 'dummy.txt'), 'test');
    
    const exitCode = await main([], {
      env: { WAS_HOME: home },
      stdout: () => {},
      stderr: () => {}
    });
    
    assert.strictEqual(exitCode, 2);
    // Should still exist and no marker
    assert.ok(fs.existsSync(path.join(agyPath, 'dummy.txt')));
    assert.strictEqual(fs.existsSync(path.join(agyPath, '.wordpress-agent-skills.json')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('Uninstall removes only marked directories', async () => {
  const home = setupTempHome();
  try {
    // Install first
    await main([], {
      env: { WAS_HOME: home },
      stdout: () => {},
      stderr: () => {}
    });
    
    const agyPath = path.join(home, '.gemini', 'antigravity', 'skills', 'wp-agency-router');
    assert.ok(fs.existsSync(agyPath));
    
    const fakePath = path.join(home, '.gemini', 'antigravity', 'skills', 'other-skill');
    fs.mkdirSync(fakePath, { recursive: true });
    
    const exitCode = await main(['--uninstall'], {
      env: { WAS_HOME: home },
      stdout: () => {},
      stderr: () => {}
    });
    
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(fs.existsSync(agyPath), false);
    assert.ok(fs.existsSync(fakePath));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

import { execSync } from 'node:child_process';
test('Smoke spawn --help', async () => {
  const stdout = execSync(`node scripts/install.mjs --help`).toString();
  assert.ok(stdout.includes('Usage:'));
});
