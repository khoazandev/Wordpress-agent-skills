import assert from 'node:assert';
import test from 'node:test';
import { findBinary } from '../scripts/lib/find-binary.mjs';
import path from 'node:path';

function createFakeDeps(platform, env, pathsSet, dirsMap = {}) {
  return {
    platform,
    env,
    exists: (p) => pathsSet.has(p),
    listDir: (d) => {
      if (dirsMap[d]) return dirsMap[d];
      return [];
    }
  };
}

test('findBinary respects environment variable overrides (win32)', () => {
  const deps = createFakeDeps('win32', { PHP_BIN: 'C:\\custom\\php.exe' }, new Set(['C:\\custom\\php.exe']));
  assert.strictEqual(findBinary('php', deps), 'C:\\custom\\php.exe');
});

test('findBinary ignores environment variable if file does not exist', () => {
  const deps = createFakeDeps('linux', { PHP_BIN: '/custom/php' }, new Set(['/usr/bin/php']));
  assert.strictEqual(findBinary('php', deps), '/usr/bin/php');
});

test('findBinary searches PATH (win32 with PATHEXT)', () => {
  const deps = createFakeDeps('win32', 
    { PATH: 'C:\\Windows;C:\\Program Files\\Nodejs', PATHEXT: '.EXE;.CMD' }, 
    new Set(['C:\\Program Files\\Nodejs\\php.exe'])
  );
  assert.strictEqual(findBinary('php', deps), 'C:\\Program Files\\Nodejs\\php.exe');
});

test('findBinary searches PATH (linux)', () => {
  const deps = createFakeDeps('linux', 
    { PATH: '/usr/local/bin:/usr/bin' }, 
    new Set(['/usr/local/bin/php'])
  );
  assert.strictEqual(findBinary('php', deps), '/usr/local/bin/php');
});

test('findBinary uses XAMPP fallback (win32)', () => {
  const deps = createFakeDeps('win32', {}, new Set(['C:\\xampp\\php\\php.exe']));
  assert.strictEqual(findBinary('php', deps), 'C:\\xampp\\php\\php.exe');
});

test('findBinary uses Laragon fallback and picks highest version (win32)', () => {
  const deps = createFakeDeps('win32', {}, 
    new Set([
      'C:\\laragon\\bin\\php\\php-8.1.10\\php.exe',
      'C:\\laragon\\bin\\php\\php-8.3.2\\php.exe',
      'C:\\laragon\\bin\\php\\php-8.10.0\\php.exe'
    ]),
    {
      'C:\\laragon\\bin\\php': ['php-8.1.10', 'php-8.10.0', 'php-8.3.2']
    }
  );
  assert.strictEqual(findBinary('php', deps), 'C:\\laragon\\bin\\php\\php-8.10.0\\php.exe');
});

test('findBinary uses MAMP fallback (darwin)', () => {
  const deps = createFakeDeps('darwin', {}, 
    new Set([
      '/Applications/MAMP/bin/php/php8.1.0/bin/php',
      '/Applications/MAMP/bin/php/php8.2.0/bin/php'
    ]),
    {
      '/Applications/MAMP/bin/php': ['php8.1.0', 'php8.2.0']
    }
  );
  assert.strictEqual(findBinary('php', deps), '/Applications/MAMP/bin/php/php8.2.0/bin/php');
});

test('findBinary uses /usr/bin fallback (linux)', () => {
  const deps = createFakeDeps('linux', {}, new Set(['/usr/bin/php']));
  assert.strictEqual(findBinary('php', deps), '/usr/bin/php');
});

test('findBinary returns null when not found', () => {
  const deps = createFakeDeps('win32', {}, new Set());
  assert.strictEqual(findBinary('php', deps), null);
});

