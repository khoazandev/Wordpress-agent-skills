#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export function listTestFiles(rootDir = REPO_ROOT) {
  const found = [];

  const rootTestsDir = path.join(rootDir, 'tests');
  if (fs.existsSync(rootTestsDir)) {
    for (const entry of fs.readdirSync(rootTestsDir, { withFileTypes: true })) {
      const isTest = entry.name.endsWith('.test.mjs') || (entry.name.startsWith('test_') && entry.name.endsWith('.mjs'));
      if (entry.isFile() && isTest) {
        found.push(path.join(rootTestsDir, entry.name));
      }
    }
  }

  const skillsDir = path.join(rootDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const skill of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (skill.isDirectory()) {
        const skillTestsDir = path.join(skillsDir, skill.name, 'tests');
        if (fs.existsSync(skillTestsDir)) {
          for (const entry of fs.readdirSync(skillTestsDir, { withFileTypes: true })) {
            const isTest = entry.name.endsWith('.test.mjs') || (entry.name.startsWith('test_') && entry.name.endsWith('.mjs'));
            if (entry.isFile() && isTest) {
              found.push(path.join(skillTestsDir, entry.name));
            }
          }
        }
      }
    }
  }

  return found.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const testFiles = listTestFiles(REPO_ROOT);
  if (testFiles.length === 0) {
    console.log('No test files found.');
    process.exit(0);
  }

  const relativeFiles = testFiles.map(f => path.relative(REPO_ROOT, f));
  console.log(`Running ${relativeFiles.length} test suite(s)...`);
  const result = spawnSync(process.execPath, ['--test', ...relativeFiles], {
    cwd: REPO_ROOT,
    stdio: 'inherit'
  });
  process.exit(result.status ?? 1);
}
