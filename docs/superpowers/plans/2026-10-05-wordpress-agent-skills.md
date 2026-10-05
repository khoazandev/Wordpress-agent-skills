# WordPress Agent Skills Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package 4 high-value custom WordPress skills and a new agency router into a production-ready, zero-dependency multi-agent skills repository for Antigravity, Claude Code, and Codex, with zero personal or client leaks in git history.

**Architecture:** A unified git repository configured simultaneously as an Antigravity plugin, a Claude Code plugin with marketplace manifest, and a Codex plugin, complemented by a zero-dependency ESM installer script (`scripts/install.mjs`) supporting global and per-project installation. An uncompromising 3-layer sanitization engine (regex patterns, denylist literal/squash matching, pre-commit/pre-push hooks, and CI) guarantees privacy before any skill content is committed.

**Tech Stack:** Node.js >= 20 (ES Modules, standard library only, 0 dependencies), PHP 7.4+ CLI (for WordPress packaging/linting checks), Git hooks, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-wordpress-agent-skills-design.md`

## Global Constraints

- **Node.js Floor:** Node.js >= 20.0.0. No external npm dependencies in production or testing.
- **Language Policy:** Bilingual: `description` in English + Vietnamese trigger sentence; SKILL.md body in Vietnamese; `README.md` (EN) and `README.vi.md` (VI).
- **Sanitization & Privacy:** ABSOLUTELY ZERO personal paths (e.g. Windows user directories) and ZERO client/project names in any commit in git history. Every commit must pass `validate-skills.mjs` with `.validate-denylist`.
- **Atomic Operations:** Skill installation must use temporary staging and rename with automatic rollback. No partial installs or overwrites of unmanaged skills without `--force` and timestamped backups.
- **Frontmatter Syntax:** Strict subset only: single-line double-quoted strings for `description` (`"..."`), plain single-line scalars for `name` and `compatibility`. No multiline block scalars (`|`, `>`) or unescaped colons.
- **No Upstream Duplication:** Never vendor or duplicate the 19 upstream WordPress/agent-skills. The agency router delegates to upstream by workflow group.

---

### Task 0: Step 0 Findings & Baseline Confirmation

**Files:**
- Create: `docs/superpowers/specs/step0-findings.md`
- Inspect: Source skills at `~/.gemini/config/skills/`

**Interfaces:**
- Consumes: Spec §0 verifications (S0.1–S0.5).
- Produces: Confirmed directory structures and baseline test report in `docs/superpowers/specs/step0-findings.md`.

- [ ] **Step 1: Inspect environment directories and document S0.1, S0.2, S0.3**

Check Antigravity global and project skill layout on the active system:
- Global: `~/.gemini/config/skills` (current layout indicated by `~/.gemini/config/.migrated`) and `~/.gemini/antigravity/skills` (legacy layout).
- Project: `.agents/skills` (standard), `.agent/skills` (legacy).
- Claude Code: `~/.claude/skills` (global), `<proj>/.claude/skills` (project).
- Codex: `${CODEX_HOME:-~/.codex}/skills` (global), `<proj>/.agents/skills` (project).

- [ ] **Step 2: Record baseline test results of legacy packaging skill (S0.4)**

Execute baseline tests in the source directory:
- `test_bundler.mjs`: 6 pass, 0 fail.
- `test_cleaner.mjs`: 6 pass, 0 fail.
- `test_config_patcher.mjs`: 6 pass, 0 fail.
- `test_db_sanitizer.mjs`: 5 pass, 7 fail without active `WP_LIVE_PROJECT` (confirming need for live gating).
- `test_handover.mjs`: 5 pass, 0 fail.
- `test_installer_builder.mjs`: 7 pass, 0 fail.
- `test_safe_replacer.mjs`: 11 pass, 0 fail.

- [ ] **Step 3: Record leak scan findings (S0.5)**

Document total leak occurrences across the 4 source skills (counts only, zero private strings mentioned) and confirm mapping in `.sanitize-map.local.json`.

- [ ] **Step 4: Write `docs/superpowers/specs/step0-findings.md`**

Write the markdown report documenting S0.1 through S0.5.

- [ ] **Step 5: Verify clean history and commit Task 0**

```bash
# Run scratch leak scan on repo root
git add docs/superpowers/specs/step0-findings.md
git commit -m "docs: record Step 0 environment and baseline findings"
```

---

### Task 1: Repository Scaffolding & Custom Test Runner

**Files:**
- Create: `package.json`
- Create: `.gitattributes`
- Create: `LICENSE`
- Create: `scripts/run-tests.mjs`
- Test: `tests/run-tests.test.mjs`

**Interfaces:**
- Consumes: Node.js standard libraries (`fs`, `path`, `child_process`).
- Produces: `listTestFiles(rootDir)` exported from `scripts/run-tests.mjs` and runnable `npm test`.

- [ ] **Step 1: Write failing test for `listTestFiles` in `tests/run-tests.test.mjs`**

```javascript
import assert from 'node:assert';
import test from 'node:test';
import { listTestFiles } from '../scripts/run-tests.mjs';

test('listTestFiles discovers tests in tests/ and skills/*/tests/', () => {
  const files = listTestFiles(process.cwd());
  assert.ok(Array.isArray(files), 'Must return an array of file paths');
  assert.ok(files.some(f => f.includes('run-tests.test.mjs')), 'Must include run-tests.test.mjs');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/run-tests.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/run-tests.mjs'`

- [ ] **Step 3: Implement `package.json`, `.gitattributes`, `LICENSE`, and `scripts/run-tests.mjs`**

`package.json`:
```json
{
  "name": "wordpress-agent-skills",
  "version": "1.0.0",
  "description": "Multi-agent WordPress skill pack for Antigravity, Claude Code, and Codex",
  "type": "module",
  "bin": {
    "wordpress-agent-skills": "scripts/install.mjs"
  },
  "scripts": {
    "test": "node scripts/run-tests.mjs",
    "validate": "node scripts/validate-skills.mjs",
    "setup-hooks": "git config core.hooksPath .githooks"
  },
  "engines": {
    "node": ">=20"
  },
  "license": "MIT",
  "author": "khoazandev",
  "repository": {
    "type": "git",
    "url": "https://github.com/khoazandev/Wordpress-agent-skills.git"
  },
  "files": [
    "skills",
    "scripts",
    "rules",
    "plugin.json",
    ".claude-plugin",
    ".codex-plugin",
    "LICENSE",
    "README.md",
    "README.vi.md"
  ]
}
```

`.gitattributes`:
```text
* text=auto eol=lf
*.bat text eol=crlf
*.cmd text eol=crlf
```

`LICENSE`:
```text
MIT License

Copyright (c) 2026 khoazandev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`scripts/run-tests.mjs`:
```javascript
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
      if (entry.isFile() && (entry.name.endsWith('.test.mjs') || entry.name.startsWith('test_') && entry.name.endsWith('.mjs'))) {
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
            if (entry.isFile() && (entry.name.endsWith('.test.mjs') || entry.name.startsWith('test_') && entry.name.endsWith('.mjs'))) {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/run-tests.test.mjs`
Expected: PASS

- [ ] **Step 5: Verify clean scan and commit Task 1**

```bash
npm test
git add package.json .gitattributes LICENSE scripts/run-tests.mjs tests/run-tests.test.mjs
git commit -m "build: scaffold package, license, gitattributes, and test runner"
```

---

### Task 2: Strict Frontmatter Parser

**Files:**
- Create: `scripts/lib/frontmatter.mjs`
- Test: `tests/frontmatter.test.mjs`

**Interfaces:**
- Consumes: Node.js string manipulation.
- Produces: `parseFrontmatter(markdownContent)` exported from `scripts/lib/frontmatter.mjs`. Returns `{ data, content, error }`.

- [ ] **Step 1: Write failing test in `tests/frontmatter.test.mjs`**

```javascript
import assert from 'node:assert';
import test from 'node:test';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';

test('parseFrontmatter parses valid strict frontmatter with single-line quoted description', () => {
  const text = `---
name: my-skill
description: "A valid description: with colon and \\"escaped quotes\\""
compatibility: WordPress 6.0+, PHP 7.4+
---
# Content Title
Body text.`;
  const result = parseFrontmatter(text);
  assert.strictEqual(result.error, null);
  assert.strictEqual(result.data.name, 'my-skill');
  assert.strictEqual(result.data.description, 'A valid description: with colon and "escaped quotes"');
  assert.strictEqual(result.data.compatibility, 'WordPress 6.0+, PHP 7.4+');
  assert.strictEqual(result.content.trim(), '# Content Title\nBody text.');
});

test('parseFrontmatter rejects multiline or unquoted description', () => {
  const unquoted = `---
name: bad-skill
description: Unquoted description with : colon
compatibility: all
---`;
  const r1 = parseFrontmatter(unquoted);
  assert.ok(r1.error && r1.error.includes('description must be a double-quoted string'));

  const blockScalar = `---
name: bad-skill
description: >
  Folded text
compatibility: all
---`;
  const r2 = parseFrontmatter(blockScalar);
  assert.ok(r2.error);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/frontmatter.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/lib/frontmatter.mjs'`

- [ ] **Step 3: Implement `scripts/lib/frontmatter.mjs`**

```javascript
/**
 * Strict subset frontmatter parser conforming to Spec §8.1.
 * Supported format:
 * ---
 * key: "double-quoted string with \\" or \\\\"
 * key2: plain scalar (cannot start with quotes, block markers, or contain ': ')
 * ---
 */

export function parseFrontmatter(markdownText) {
  if (typeof markdownText !== 'string') {
    return { data: null, content: '', error: 'Input must be a string' };
  }

  const normalized = markdownText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { data: null, content: normalized, error: 'Document must begin with --- frontmatter fence' };
  }

  const endFenceIndex = normalized.indexOf('\n---\n', 4);
  if (endFenceIndex === -1 && !normalized.endsWith('\n---')) {
    return { data: null, content: normalized, error: 'Unclosed frontmatter fence (missing closing ---)' };
  }

  const blockEnd = endFenceIndex !== -1 ? endFenceIndex : normalized.length - 4;
  const rawYaml = normalized.slice(4, blockEnd);
  const bodyContent = normalized.slice(blockEnd + 5);

  const lines = rawYaml.split('\n');
  const data = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      return { data: null, content: bodyContent, error: `Line ${i + 1}: Missing key-value colon separator: "${line}"` };
    }

    const key = line.slice(0, colonIndex).trim();
    if (!/^[a-z][a-z0-9_-]*$/.test(key)) {
      return { data: null, content: bodyContent, error: `Line ${i + 1}: Invalid key name "${key}" (must match ^[a-z][a-z0-9_-]*$)` };
    }

    const rawVal = line.slice(colonIndex + 1).trim();

    // Check for unsupported block scalar characters
    if (/^[>|&*{}[\]!]/.test(rawVal)) {
      return { data: null, content: bodyContent, error: `Line ${i + 1}: Unsupported frontmatter syntax; use a single-line double-quoted string` };
    }

    if (rawVal.startsWith('"')) {
      if (!rawVal.endsWith('"') || rawVal.length < 2) {
        return { data: null, content: bodyContent, error: `Line ${i + 1}: Unterminated double-quoted string for key "${key}"` };
      }
      const inner = rawVal.slice(1, -1);
      // Validate escape sequences
      try {
        const parsed = JSON.parse(`"${inner.replace(/"/g, '\\"')}"`); // unescape logic
      } catch {}
      // Safe custom unescape for \" and \\
      let unescaped = '';
      for (let j = 0; j < inner.length; j++) {
        if (inner[j] === '\\') {
          j++;
          if (j < inner.length) {
            const next = inner[j];
            if (next === '"' || next === '\\' || next === '/' || next === 'n' || next === 'r' || next === 't') {
              if (next === 'n') unescaped += '\n';
              else if (next === 'r') unescaped += '\r';
              else if (next === 't') unescaped += '\t';
              else unescaped += next;
            } else {
              unescaped += next;
            }
          }
        } else {
          unescaped += inner[j];
        }
      }
      data[key] = unescaped;
    } else {
      if (key === 'description') {
        return { data: null, content: bodyContent, error: `Line ${i + 1}: description must be a double-quoted string ("...")` };
      }
      if (rawVal.includes(': ') || rawVal.includes(' #')) {
        return { data: null, content: bodyContent, error: `Line ${i + 1}: Plain scalar for key "${key}" cannot contain ': ' or ' #'` };
      }
      data[key] = rawVal;
    }
  }

  return { data, content: bodyContent, error: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/frontmatter.test.mjs`
Expected: PASS

- [ ] **Step 5: Verify clean scan and commit Task 2**

```bash
npm test
git add scripts/lib/frontmatter.mjs tests/frontmatter.test.mjs
git commit -m "feat(validator): add strict subset frontmatter parser"
```

---

### Task 3: Leak-Scan Engine & Validation Script

**Files:**
- Create: `scripts/lib/leak-scan.mjs`
- Create: `scripts/validate-skills.mjs`
- Create: `tests/fixtures/valid-skill/SKILL.md`
- Create: `tests/fixtures/invalid-skills/...`
- Test: `tests/validate.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter` from `scripts/lib/frontmatter.mjs`.
- Produces: `scanText(text, filePath, denylist)` from `scripts/lib/leak-scan.mjs` and executable CLI `scripts/validate-skills.mjs` supporting `--root`, `--history`, `--denylist`.

- [ ] **Step 1: Write failing test in `tests/validate.test.mjs`**

```javascript
import assert from 'node:assert';
import test from 'node:test';
import path from 'node:path';
import { scanText, squashText } from '../scripts/lib/leak-scan.mjs';
import { validateRepository } from '../scripts/validate-skills.mjs';

test('squashText removes diacritics and non-alphanumeric chars', () => {
  assert.strictEqual(squashText('Đà Nẵng & Hội An!'), 'dananghoian');
});

test('scanText detects private paths and denylist items with squash matching', () => {
  const denylist = ['SecretClient'];
  const hits = scanText('Welcome to secretclient.vn here', 'test.md', denylist);
  assert.ok(hits.length > 0, 'Must detect squashed denylist hit');
  assert.ok(hits[0].type === 'DENY');
});

test('validateRepository verifies repo rules V1-V6', async () => {
  const result = await validateRepository({ rootDir: process.cwd() });
  assert.strictEqual(result.errors.length, 0, `Validation must pass with 0 errors: ${JSON.stringify(result.errors)}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/validate.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/lib/leak-scan.mjs'`

- [ ] **Step 3: Implement `scripts/lib/leak-scan.mjs`**

```javascript
import fs from 'node:fs';

export function squashText(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

export function loadDenylist(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

export const PATH_PATTERNS = [
  /[A-Za-z]:[\\/]+Users[\\/]+(?!<|(?:Public|Default)(?:[\\/]|$))[^\\/\s"'`]+/,
  /\/home\/[^/\s<]+\//,
  /\/Users\/[^/\s<]+\//
];

export function scanText(text, relativePath = '', denylist = []) {
  const hits = [];
  if (typeof text !== 'string') return hits;

  const isFixture = relativePath.startsWith('tests/fixtures/') || relativePath.includes('fixtures/');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const hasPragma = line.includes('validate-allow-path');

    // Pattern check (exempt for fixture or pragma)
    if (!isFixture && !hasPragma) {
      for (const pattern of PATH_PATTERNS) {
        if (pattern.test(line)) {
          hits.push({
            type: 'PATH',
            line: lineNum,
            message: `Personal path detected matching ${pattern}`
          });
          break;
        }
      }
    }

    // Denylist check (NO EXEMPTIONS)
    if (denylist.length > 0) {
      const lineLower = line.toLowerCase();
      const lineSquashed = squashText(line);

      for (let dIdx = 0; dIdx < denylist.length; dIdx++) {
        const item = denylist[dIdx];
        const itemLower = item.toLowerCase();
        const itemSquashed = squashText(item);

        let matched = lineLower.includes(itemLower);
        if (!matched && itemSquashed.length >= 5 && lineSquashed.includes(itemSquashed)) {
          matched = true;
        }

        if (matched) {
          hits.push({
            type: 'DENY',
            line: lineNum,
            message: `Private denylist violation [entry #${dIdx + 1}]`
          });
        }
      }
    }
  }

  return hits;
}
```

- [ ] **Step 4: Implement `scripts/validate-skills.mjs`**

```javascript
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { scanText, loadDenylist } from './lib/leak-scan.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(__dirname, '..');

export async function validateRepository(options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT);
  const denylistPath = options.denylistPath || path.join(rootDir, '.validate-denylist');
  const denylist = loadDenylist(denylistPath);
  const checkHistory = Boolean(options.checkHistory);

  const errors = [];

  // Helper to record errors
  function addError(file, line, rule, message) {
    errors.push({ file, line, rule, message, formatted: `${file}:${line || 1}: [${rule}] ${message}` });
  }

  // V1, V2, V5: Inspect skills/ directory
  const skillsDir = path.join(rootDir, 'skills');
  const skillNames = [];

  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const skillName = entry.name;
        skillNames.push(skillName);
        const skillPath = path.join(skillsDir, skillName);
        const skillFile = path.join(skillPath, 'SKILL.md');

        if (!fs.existsSync(skillFile)) {
          addError(path.relative(rootDir, skillPath), 1, 'V1', `Missing SKILL.md in skills/${skillName}`);
          continue;
        }

        // V6 check BOM
        const rawBuffer = fs.readFileSync(skillFile);
        if (rawBuffer.length >= 3 && rawBuffer[0] === 0xEF && rawBuffer[1] === 0xBB && rawBuffer[2] === 0xBF) {
          addError(path.relative(rootDir, skillFile), 1, 'V6', 'File contains UTF-8 BOM');
        }

        const skillContent = rawBuffer.toString('utf8');
        const parsed = parseFrontmatter(skillContent);
        if (parsed.error) {
          addError(path.relative(rootDir, skillFile), 1, 'V1', parsed.error);
        } else {
          const { data } = parsed;
          if (data.name !== skillName) {
            addError(path.relative(rootDir, skillFile), 1, 'V1', `name "${data.name}" must match directory "${skillName}"`);
          }
          if (!/^[a-z0-9-]+$/.test(data.name || '')) {
            addError(path.relative(rootDir, skillFile), 1, 'V1', `name "${data.name}" must match ^[a-z0-9-]+$`);
          }
          if (!data.description || data.description.length < 1 || data.description.length > 1024) {
            addError(path.relative(rootDir, skillFile), 1, 'V1', 'description must be between 1 and 1024 characters');
          }
          if (!data.compatibility) {
            addError(path.relative(rootDir, skillFile), 1, 'V1', 'Missing compatibility specification');
          }
        }

        // V2: Relative paths at start of token
        const tokens = skillContent.split(/[\s`()[\]'"]+/);
        for (const token of tokens) {
          if (/^(references|scripts|templates|\.\/)/.test(token)) {
            const cleanToken = token.replace(/[#?].*$/, '').replace(/[.,:;]+$/, '');
            const targetPath = path.resolve(skillPath, cleanToken);
            if (!fs.existsSync(targetPath)) {
              addError(path.relative(rootDir, skillFile), 1, 'V2', `Referenced path does not exist: "${token}"`);
            }
          }
        }
      }
    }
  }

  // V5: Router mentions all skills
  const routerSkill = path.join(skillsDir, 'wp-agency-router', 'SKILL.md');
  if (fs.existsSync(routerSkill)) {
    const routerContent = fs.readFileSync(routerSkill, 'utf8');
    for (const name of skillNames) {
      if (name !== 'wp-agency-router' && !routerContent.includes(name)) {
        addError('skills/wp-agency-router/SKILL.md', 1, 'V5', `Router SKILL.md must mention skill "${name}"`);
      }
    }
  }

  // V4: Manifest consistency (enforce if manifests exist)
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const claudePkgPath = path.join(rootDir, '.claude-plugin', 'plugin.json');
  const claudeMktPath = path.join(rootDir, '.claude-plugin', 'marketplace.json');
  const codexPkgPath = path.join(rootDir, '.codex-plugin', 'plugin.json');

  if (fs.existsSync(claudePkgPath) || fs.existsSync(codexPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (fs.existsSync(claudePkgPath)) {
      const claudePkg = JSON.parse(fs.readFileSync(claudePkgPath, 'utf8'));
      if (claudePkg.version !== pkg.version || claudePkg.name !== pkg.name) {
        addError('.claude-plugin/plugin.json', 1, 'V4', `Version or name mismatch with package.json`);
      }
    }
    if (fs.existsSync(claudeMktPath)) {
      const claudeMkt = JSON.parse(fs.readFileSync(claudeMktPath, 'utf8'));
      const item = claudeMkt.plugins?.[0];
      if (!item || item.version !== pkg.version) {
        addError('.claude-plugin/marketplace.json', 1, 'V4', `Version mismatch in marketplace plugin entry`);
      }
    }
    if (fs.existsSync(codexPkgPath)) {
      const codexPkg = JSON.parse(fs.readFileSync(codexPkgPath, 'utf8'));
      if (codexPkg.version !== pkg.version || codexPkg.name !== pkg.name) {
        addError('.codex-plugin/plugin.json', 1, 'V4', `Version or name mismatch with package.json`);
      }
    }
  }

  // V3 & V6 on tracked repository files
  let filesToScan = [];
  try {
    const stdout = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 32 << 20
    });
    filesToScan = stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    // Fallback if not a git repo
    function walk(dir) {
      const res = [];
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '.git' || e.name === 'node_modules' || e.name === '.validate-denylist') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) res.push(...walk(p));
        else res.push(path.relative(rootDir, p));
      }
      return res;
    }
    filesToScan = walk(rootDir);
  }

  for (const relFile of filesToScan) {
    if (relFile === '.validate-denylist' || relFile.startsWith('.local/') || relFile.endsWith('.local.json')) continue;
    const fullPath = path.join(rootDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    const buf = fs.readFileSync(fullPath);
    // V6 UTF-8 validation & BOM
    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      addError(relFile, 1, 'V6', 'File contains UTF-8 BOM');
    }

    const text = buf.toString('utf8');
    const hits = scanText(text, relFile, denylist);
    for (const hit of hits) {
      addError(relFile, hit.line, 'V3', hit.message);
    }
  }

  // V3 checkHistory if requested
  if (checkHistory) {
    try {
      const commitList = execFileSync('git', ['rev-list', '--all'], { cwd: rootDir, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
      for (const commit of commitList) {
        const treeFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', commit], { cwd: rootDir, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
        for (const file of treeFiles) {
          if (file === '.validate-denylist' || file.startsWith('tests/fixtures/')) continue;
          const blobText = execFileSync('git', ['show', `${commit}:${file}`], { cwd: rootDir, encoding: 'utf8', maxBuffer: 32 << 20 });
          const hits = scanText(blobText, file, denylist);
          for (const hit of hits) {
            addError(`${commit.slice(0, 7)}:${file}`, hit.line, 'V3', `[git history] ${hit.message}`);
          }
        }
      }
    } catch (gitErr) {
      addError('.git', 1, 'V3', `Failed to scan git history: ${gitErr.message}`);
    }
  }

  return { errors, clean: errors.length === 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  let rootDir = DEFAULT_ROOT;
  let denylistPath = undefined;
  let checkHistory = false;

  for (const arg of args) {
    if (arg.startsWith('--root=')) rootDir = arg.slice(7);
    else if (arg.startsWith('--denylist=')) denylistPath = arg.slice(11);
    else if (arg === '--history') checkHistory = true;
  }

  validateRepository({ rootDir, denylistPath, checkHistory }).then(result => {
    if (result.clean) {
      console.log('Validation passed: 0 errors detected.');
      process.exit(0);
    } else {
      console.error(`Validation failed with ${result.errors.length} error(s):`);
      for (const err of result.errors) {
        console.error(err.formatted);
      }
      process.exit(1);
    }
  }).catch(err => {
    console.error('Validation error:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/validate.test.mjs`
Expected: PASS

- [ ] **Step 6: Verify clean scan and commit Task 3**

```bash
node scripts/validate-skills.mjs --history
git add scripts/lib/leak-scan.mjs scripts/validate-skills.mjs tests/validate.test.mjs
git commit -m "feat(validator): implement V1-V6 validation and leak scan engine"
```

---

### Task 4: Git Hooks Configuration

**Files:**
- Create: `.githooks/pre-commit`
- Create: `.githooks/pre-push`
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/validate-skills.mjs`.
- Produces: Installed git hooks via `npm run setup-hooks`.

- [ ] **Step 1: Write `.githooks/pre-commit`**

```bash
#!/bin/sh
echo "Running pre-commit skills validation..."
node scripts/validate-skills.mjs
if [ $? -ne 0 ]; then
  echo "Commit rejected: validation errors detected."
  exit 1
fi
```

- [ ] **Step 2: Write `.githooks/pre-push`**

```bash
#!/bin/sh
echo "Running pre-push history leak validation..."
node scripts/validate-skills.mjs --history
if [ $? -ne 0 ]; then
  echo "Push rejected: history validation errors detected."
  exit 1
fi
```

- [ ] **Step 3: Activate git hooks and test execution**

```bash
npm run setup-hooks
git update-index --chmod=+x .githooks/pre-commit .githooks/pre-push
```

- [ ] **Step 4: Verify hook functionality and commit Task 4**

```bash
node scripts/validate-skills.mjs --history
git add .githooks/pre-commit .githooks/pre-push package.json
git commit -m "chore: configure pre-commit and pre-push validation hooks"
```

---

### Task 5: Platform-Independent Binary Discovery

**Files:**
- Create: `scripts/lib/find-binary.mjs`
- Test: `tests/find_binary.test.mjs`

**Interfaces:**
- Consumes: Node `path` (posix & win32) and dependency injection.
- Produces: `findBinary(name, deps)` exported from `scripts/lib/find-binary.mjs`.

- [ ] **Step 1: Write failing test in `tests/find_binary.test.mjs`**

```javascript
import assert from 'node:assert';
import test from 'node:test';
import { findBinary } from '../scripts/lib/find-binary.mjs';

test('findBinary respects environment variable overrides', () => {
  const fakeEnv = { PHP_BIN: 'C:\\custom\\php.exe' };
  const fakeExists = (p) => p === 'C:\\custom\\php.exe';
  const bin = findBinary('php', { env: fakeEnv, exists: fakeExists, platform: 'win32' });
  assert.strictEqual(bin, 'C:\\custom\\php.exe');
});

test('findBinary searches PATH before fallback locations', () => {
  const fakeEnv = { PATH: '/usr/local/bin:/usr/bin' };
  const fakeExists = (p) => p === '/usr/local/bin/php';
  const bin = findBinary('php', { env: fakeEnv, exists: fakeExists, platform: 'linux' });
  assert.strictEqual(bin, '/usr/local/bin/php');
});

test('findBinary returns null when binary is not found', () => {
  const bin = findBinary('mysqldump', { env: {}, exists: () => false, platform: 'win32' });
  assert.strictEqual(bin, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/find_binary.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/lib/find-binary.mjs'`

- [ ] **Step 3: Implement `scripts/lib/find-binary.mjs`**

```javascript
import fs from 'node:fs';
import path from 'node:path';

export function findBinary(name, deps = {}) {
  const env = deps.env || process.env;
  const platform = deps.platform || process.platform;
  const exists = deps.exists || fs.existsSync;
  const listDir = deps.listDir || ((d) => {
    try { return fs.readdirSync(d); } catch { return []; }
  });

  const pathModule = platform === 'win32' ? path.win32 : path.posix;
  const isWin = platform === 'win32';

  // 1. Env variable override
  const envKey = `${name.toUpperCase()}_BIN`;
  if (env[envKey] && exists(env[envKey])) {
    return env[envKey];
  }

  // 2. PATH resolution
  const pathVal = env.PATH || env.Path || '';
  const delimiter = isWin ? ';' : ':';
  const dirs = pathVal.split(delimiter).filter(Boolean);
  const extensions = isWin ? (env.PATHEXT || '.EXE;.BAT;.CMD').split(';').map(e => e.toLowerCase()) : [''];

  for (const dir of dirs) {
    if (isWin) {
      for (const ext of extensions) {
        const candidate = pathModule.join(dir, `${name}${ext}`);
        if (exists(candidate)) return candidate;
      }
    } else {
      const candidate = pathModule.join(dir, name);
      if (exists(candidate)) return candidate;
    }
  }

  // 3. Known standard application locations
  if (isWin) {
    if (name === 'php') {
      const xampp = 'C:\\xampp\\php\\php.exe';
      if (exists(xampp)) return xampp;

      // Laragon version scan
      const laragonDir = 'C:\\laragon\\bin\\php';
      const versions = listDir(laragonDir).sort().reverse();
      for (const v of versions) {
        const cand = pathModule.join(laragonDir, v, 'php.exe');
        if (exists(cand)) return cand;
      }
    } else if (name === 'mysqldump' || name === 'mysql') {
      const xampp = `C:\\xampp\\mysql\\bin\\${name}.exe`;
      if (exists(xampp)) return xampp;

      const laragonDir = 'C:\\laragon\\bin\\mysql';
      const versions = listDir(laragonDir).sort().reverse();
      for (const v of versions) {
        const cand = pathModule.join(laragonDir, v, 'bin', `${name}.exe`);
        if (exists(cand)) return cand;
      }
    }
  } else {
    // POSIX standard paths
    const candidates = [
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`,
      `/opt/homebrew/bin/${name}`
    ];
    for (const c of candidates) {
      if (exists(c)) return c;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/find_binary.test.mjs`
Expected: PASS

- [ ] **Step 5: Verify clean scan and commit Task 5**

```bash
npm run validate -- --history
git add scripts/lib/find-binary.mjs tests/find_binary.test.mjs
git commit -m "feat(ops): add cross-platform binary locator with dependency injection"
```

---

### Task 6: Agency Router Skill

**Files:**
- Create: `skills/wp-agency-router/SKILL.md`
- Create: `skills/wp-agency-router/references/decision-tree.md`

**Interfaces:**
- Consumes: Spec §5 requirements.
- Produces: `wp-agency-router` skill meeting V1, V2, V5, V6 rules.

- [ ] **Step 1: Write `skills/wp-agency-router/SKILL.md`**

Ensure frontmatter adheres to strict single-line double-quoted description, mentions all 4 skills, and contains no private leaks.

- [ ] **Step 2: Write `skills/wp-agency-router/references/decision-tree.md`**

Include comprehensive dispatch flow table for agency workflows and upstream handoffs.

- [ ] **Step 3: Run validation to verify V1, V2, V5 pass**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 4: Commit Task 6**

```bash
git add skills/wp-agency-router/
git commit -m "feat(skills): add wp-agency-router with decision tree references"
```

---

### Task 7: Skill Import & Sanitization

**Files:**
- Create: `skills/flatsome-css-architecture/SKILL.md`
- Create: `skills/flatsome-css-architecture/references/architecture-ruleset.md`
- Create: `skills/flatsome-uxbuilder-design/SKILL.md`
- Create: `skills/wordpress-functions-zero-hardcode/SKILL.md`
- Create: `skills/wordpress-packaging-handover/...` (scripts, templates, tests)

**Interfaces:**
- Consumes: Source skills and `.sanitize-map.local.json`.
- Produces: Clean, tested skills conforming to all repository guidelines.

- [ ] **Subtask 7.1: Import & sanitize `flatsome-css-architecture`**
  - Copy `SKILL.md` and `references/architecture-ruleset.md`.
  - Normalize line endings to LF, UTF-8 without BOM.
  - Verify zero personal paths and zero denylist items.
  - Run `npm run validate`.
  - Commit: `feat(skills): import flatsome-css-architecture`

- [ ] **Subtask 7.2: Import & sanitize `flatsome-uxbuilder-design`**
  - Copy `SKILL.md`.
  - Apply replacements from `.sanitize-map.local.json` to replace proprietary shortcodes with `acme_timeslot_grid`, and brand name with `Công ty ABC`.
  - Run `npm run validate`.
  - Commit: `feat(skills): import flatsome-uxbuilder-design with neutralized identifiers`

- [ ] **Subtask 7.3: Import & sanitize `wordpress-functions-zero-hardcode`**
  - Copy `SKILL.md`.
  - Apply replacements from `.sanitize-map.local.json` to replace demo mode constants with `ACME_DEMO_MODE`, function prefixes with `acme_`, and location buttons with `Chi nhánh A (11)`.
  - Run `npm run validate`.
  - Commit: `feat(skills): import wordpress-functions-zero-hardcode with neutralized identifiers`

- [ ] **Subtask 7.4: Import, sanitize, and wire `wordpress-packaging-handover`**
  - Copy scripts, templates, and tests.
  - In `SKILL.md`: update CLI examples from hard-coded local absolute paths to `node <skill-dir>/scripts/handover.mjs` and update description with Vietnamese trigger sentence.
  - In scripts (`bundler.mjs`, `cleaner.mjs`, `db_sanitizer.mjs`, `handover.mjs`):
    - Replace file headers `Module: <legacy-full-path>/scripts/...` with `Module: scripts/...`.
    - Replace hardcoded defaults with `demo_site` and `process.cwd()`.
    - Wire `findBinary` in `bundler.mjs`, `cleaner.mjs`, `db_sanitizer.mjs`.
  - In `templates/setup-template.php`:
    - Replace default db/sql fallback with `wordpress` and `database.sql`.
  - In tests:
    - Rewrite `test_safe_replacer.mjs` with neutralized lengths (oldUrl = `http://localhost/demo_site`, 26 bytes; Test 6 declared len 65; `findBinary('php')` guard).
    - Update `test_db_sanitizer.mjs` with `liveTest` helper and `WP_LIVE_PROJECT` gating.
    - Wire `findBinary('php')` into `test_config_patcher.mjs` and `test_installer_builder.mjs` with graceful skip guards.
  - Run `npm test` and `npm run validate`.
  - Commit: `feat(skills): import wordpress-packaging-handover with full sanitization and test suite`

---

### Task 8: Bundler & Cleaner Exclusion Fix

**Files:**
- Modify: `skills/wordpress-packaging-handover/scripts/bundler.mjs`
- Modify: `skills/wordpress-packaging-handover/scripts/cleaner.mjs`
- Modify: `skills/wordpress-packaging-handover/tests/test_bundler.mjs`

**Interfaces:**
- Consumes: Spec §4.1 correction.
- Produces: Exclusion of `.idea`, `.gemini`, `.claude`, `.codex`, `.agents`, `.cursor` from client packages.

- [ ] **Step 1: Write test in `test_bundler.mjs` asserting agent and IDE folder exclusion**

Add assertions verifying that `.idea`, `.gemini`, `.claude`, `.codex`, `.agents`, and `.cursor` in fixture projects are excluded from full website packages.

- [ ] **Step 2: Update `isIgnoredForStaging` in `bundler.mjs` and `ignoredDirNames` in `cleaner.mjs`**

```javascript
// In bundler.mjs:
if (['.git', '.github', '.vscode', '.idea', '.gemini', '.claude', '.codex', '.agents', '.cursor', 'node_modules', 'scratch'].includes(baseName)) return true;
```

- [ ] **Step 3: Run bundler tests**

Run: `node skills/wordpress-packaging-handover/tests/test_bundler.mjs`
Expected: PASS

- [ ] **Step 4: Commit Task 8**

```bash
npm run validate
git add skills/wordpress-packaging-handover/
git commit -m "fix(packaging): exclude IDE and agent metadata directories from client staging packages"
```

---

### Task 9: Agent Target Discovery Matrix

**Files:**
- Create: `scripts/lib/targets.mjs`
- Test: `tests/targets.test.mjs`

**Interfaces:**
- Consumes: Spec §6.2 target definitions.
- Produces: `resolveInstallTargets(options)` exported from `scripts/lib/targets.mjs`.

- [ ] **Step 1: Write failing test in `tests/targets.test.mjs`**

```javascript
import assert from 'node:assert';
import test from 'node:test';
import path from 'node:path';
import { resolveInstallTargets } from '../scripts/lib/targets.mjs';

test('resolveInstallTargets returns global targets for all 3 agents by default', () => {
  const targets = resolveInstallTargets({ wasHome: 'C:\\fake_home' });
  assert.ok(targets.some(t => t.agent === 'antigravity'));
  assert.ok(targets.some(t => t.agent === 'claude'));
  assert.ok(targets.some(t => t.agent === 'codex'));
});

test('resolveInstallTargets consolidates shared project directories', () => {
  const targets = resolveInstallTargets({ projectPath: 'C:\\test_proj' });
  const uniqueDirs = new Set(targets.map(t => path.resolve(t.targetDir)));
  assert.strictEqual(uniqueDirs.size, targets.length, 'Targets must be deduplicated by path');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/targets.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/lib/targets.mjs'`

- [ ] **Step 3: Implement `scripts/lib/targets.mjs`**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function resolveInstallTargets(options = {}) {
  const homeDir = options.wasHome || process.env.WAS_HOME || os.homedir();
  const projectPath = options.projectPath ? path.resolve(options.projectPath) : null;
  const requestedAgents = (options.agents || 'antigravity,claude,codex')
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(Boolean);

  const targets = [];
  const seenPaths = new Set();

  for (const agent of requestedAgents) {
    let targetDir = null;

    if (projectPath) {
      if (agent === 'antigravity' || agent === 'codex') {
        targetDir = path.join(projectPath, '.agents', 'skills');
      } else if (agent === 'claude') {
        targetDir = path.join(projectPath, '.claude', 'skills');
      }
    } else {
      // Global installation
      if (agent === 'antigravity') {
        const envOverride = process.env.ANTIGRAVITY_SKILLS_DIR;
        if (envOverride) {
          targetDir = path.resolve(envOverride);
        } else {
          const configDir = path.join(homeDir, '.gemini', 'config');
          if (fs.existsSync(configDir)) {
            targetDir = path.join(configDir, 'skills');
          } else {
            targetDir = path.join(homeDir, '.gemini', 'antigravity', 'skills');
          }
        }
      } else if (agent === 'claude') {
        const claudeHome = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
        targetDir = path.join(claudeHome, 'skills');
      } else if (agent === 'codex') {
        const codexHome = process.env.CODEX_HOME || path.join(homeDir, '.codex');
        targetDir = path.join(codexHome, 'skills');
      }
    }

    if (targetDir) {
      const normalized = path.resolve(targetDir);
      if (!seenPaths.has(normalized)) {
        seenPaths.add(normalized);
        targets.push({
          agent,
          scope: projectPath ? 'project' : 'global',
          targetDir: normalized
        });
      }
    }
  }

  return targets;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/targets.test.mjs`
Expected: PASS

- [ ] **Step 5: Verify clean scan and commit Task 9**

```bash
npm run validate -- --history
git add scripts/lib/targets.mjs tests/targets.test.mjs
git commit -m "feat(installer): implement target resolution matrix for agents and project scopes"
```

---

### Task 10: Atomic Filesystem & Backup Utilities

**Files:**
- Create: `scripts/lib/fs-utils.mjs`
- Test: `tests/fs-utils.test.mjs`

**Interfaces:**
- Consumes: Node `fs`, `path`, `crypto`.
- Produces: `atomicInstallSkill`, `createBackup`, `cleanLeftoverStaging` exported from `scripts/lib/fs-utils.mjs`.

- [ ] **Step 1: Write failing test in `tests/fs-utils.test.mjs`**

```javascript
import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { atomicInstallSkill, createBackup } from '../scripts/lib/fs-utils.mjs';

test('atomicInstallSkill stages and renames atomically with marker', async () => {
  const tmpRoot = path.join(os.tmpdir(), `fs-utils-test-${Date.now()}`);
  const srcSkill = path.join(tmpRoot, 'src-skill');
  const destDir = path.join(tmpRoot, 'installed-skills');
  fs.mkdirSync(srcSkill, { recursive: true });
  fs.writeFileSync(path.join(srcSkill, 'SKILL.md'), 'test skill content', 'utf8');

  const result = await atomicInstallSkill({
    skillName: 'test-skill',
    srcDir: srcSkill,
    destSkillsRoot: destDir,
    version: '1.0.0'
  });

  assert.strictEqual(result.success, true);
  const installedMarker = path.join(destDir, 'test-skill', '.wordpress-agent-skills.json');
  assert.ok(fs.existsSync(installedMarker), 'Marker must exist in installed skill directory');
  const markerData = JSON.parse(fs.readFileSync(installedMarker, 'utf8'));
  assert.strictEqual(markerData.package, 'wordpress-agent-skills');
  assert.strictEqual(markerData.version, '1.0.0');
  assert.strictEqual(markerData.source, undefined, 'Marker must NOT contain any source path');

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/fs-utils.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/lib/fs-utils.mjs'`

- [ ] **Step 3: Implement `scripts/lib/fs-utils.mjs`**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export function copyFiltered(src, dest, filterFn) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'tests' || entry.name === 'node_modules') {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFiltered(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function cleanLeftoverStaging(skillsRoot) {
  const stagingRoot = path.join(path.dirname(skillsRoot), '.wordpress-agent-skills-staging');
  if (fs.existsSync(stagingRoot)) {
    try {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    } catch {}
  }
}

export function createBackup(skillDestPath, wasHome = os.homedir()) {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const skillName = path.basename(skillDestPath);
  const backupDir = path.join(wasHome, '.wordpress-agent-skills', 'backups', timestamp, skillName);
  fs.mkdirSync(backupDir, { recursive: true });
  copyFiltered(skillDestPath, backupDir);
  return backupDir;
}

export async function atomicInstallSkill({ skillName, srcDir, destSkillsRoot, version, wasHome }) {
  cleanLeftoverStaging(destSkillsRoot);

  const stagingRoot = path.join(path.dirname(destSkillsRoot), '.wordpress-agent-skills-staging');
  const rand = crypto.randomBytes(4).toString('hex');
  const stageDir = path.join(stagingRoot, `${skillName}-${rand}`);
  const destDir = path.join(destSkillsRoot, skillName);

  fs.mkdirSync(stageDir, { recursive: true });
  copyFiltered(srcDir, stageDir);

  // Write safe marker (no host path!)
  const marker = {
    package: 'wordpress-agent-skills',
    version: version || '1.0.0',
    installedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(stageDir, '.wordpress-agent-skills.json'), JSON.stringify(marker, null, 2), 'utf8');

  fs.mkdirSync(destSkillsRoot, { recursive: true });

  const oldBackupStaging = path.join(stagingRoot, `${skillName}-old-${rand}`);
  let hadExisting = false;

  try {
    if (fs.existsSync(destDir)) {
      hadExisting = true;
      fs.renameSync(destDir, oldBackupStaging);
    }
    fs.renameSync(stageDir, destDir);
    if (hadExisting && fs.existsSync(oldBackupStaging)) {
      fs.rmSync(oldBackupStaging, { recursive: true, force: true });
    }
    cleanLeftoverStaging(destSkillsRoot);
    return { success: true };
  } catch (err) {
    // Rollback
    if (hadExisting && fs.existsSync(oldBackupStaging)) {
      try {
        if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
        fs.renameSync(oldBackupStaging, destDir);
      } catch {}
    }
    cleanLeftoverStaging(destSkillsRoot);
    throw new Error(`Atomic installation of ${skillName} failed: ${err.message}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/fs-utils.test.mjs`
Expected: PASS

- [ ] **Step 5: Verify clean scan and commit Task 10**

```bash
npm run validate -- --history
git add scripts/lib/fs-utils.mjs tests/fs-utils.test.mjs
git commit -m "feat(installer): add atomic installation and staging rollback utilities"
```

---

### Task 11: Multi-Agent Installer CLI

**Files:**
- Create: `scripts/install.mjs`
- Test: `tests/install.test.mjs`

**Interfaces:**
- Consumes: `targets.mjs`, `fs-utils.mjs`.
- Produces: Executable CLI `scripts/install.mjs` supporting `--agents`, `--project`, `--skills`, `--dry-run`, `--uninstall`, `--force`.

- [ ] **Step 1: Write failing test in `tests/install.test.mjs`**

Test scenarios:
- Dry-run prints action table with zero writes.
- Global installation puts marker and skills into destination.
- Conflict exit code 2 when non-marker directory exists without `--force`.
- Uninstall removes only marked directories.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/install.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/install.mjs'`

- [ ] **Step 3: Implement `scripts/install.mjs`**

Implement option parser, plugin detection (skip-plugin unless force), conflict handling, backup creation on force, atomic installs across targets, and human-readable output table.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/install.test.mjs`
Expected: PASS

- [ ] **Step 5: Verify clean scan and commit Task 11**

```bash
npm run validate -- --history
git add scripts/install.mjs tests/install.test.mjs
git commit -m "feat(installer): implement multi-agent install CLI with atomic updates and uninstaller"
```

---

### Task 12: Manifests & Agent Rule Configurations

**Files:**
- Create: `plugin.json`
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `.codex-plugin/plugin.json`
- Create: `rules/AGENTS.md`
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: Spec §3 manifests and rules specs.
- Produces: Manifests passing Rule V4 and contribution instructions.

- [ ] **Step 1: Create plugin manifests for Antigravity, Claude, and Codex**
  - `plugin.json`: `{ "name": "wordpress-agent-skills" }`
  - `.claude-plugin/plugin.json`: version 1.0.0, description, author, license MIT.
  - `.claude-plugin/marketplace.json`: plugins array with version 1.0.0.
  - `.codex-plugin/plugin.json`: version 1.0.0, skills pointing to `./skills/`.

- [ ] **Step 2: Create `rules/AGENTS.md` and repo root `AGENTS.md`**
  - `rules/AGENTS.md`: <= 15 lines guiding agents on agency vs upstream WordPress router routing.
  - `AGENTS.md`: guidelines for contributors (running `setup-hooks`, local `--history` checks when merging fork PRs, link to authoring guide).

- [ ] **Step 3: Run validation to verify V4 passes**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 4: Commit Task 12**

```bash
git add plugin.json .claude-plugin/ .codex-plugin/ rules/ AGENTS.md
git commit -m "feat(manifests): add multi-agent plugin descriptors and agent routing rules"
```

---

### Task 13: Documentation & Changelog

**Files:**
- Create: `README.md`
- Create: `README.vi.md`
- Create: `docs/authoring-guide.md`
- Create: `CHANGELOG.md`

**Interfaces:**
- Consumes: Spec §7, §11 guidelines.
- Produces: Bilingual documentation and authoring guide.

- [ ] **Step 1: Write `README.md` (English) and `README.vi.md` (Vietnamese)**
  - Recommended plugin install commands for all 3 agents.
  - NPX installer commands for global and project scopes.
  - Skill inventory and trigger examples.
  - Coexistence with official upstream WordPress/agent-skills.

- [ ] **Step 2: Write `docs/authoring-guide.md`**
  - Frontmatter requirements (strict subset, double-quoted descriptions).
  - Architecture standards for scripts, references, and tests.
  - Mandatory git hooks setup (`npm run setup-hooks`).

- [ ] **Step 3: Write `CHANGELOG.md`**
  - Version 1.0.0 initial release notes.
  - Include *Changed* section explicitly documenting the bundler staging exclusion list enhancements (`.idea`, `.gemini`, `.claude`, `.codex`, `.agents`, `.cursor`).

- [ ] **Step 4: Run validation to verify clean markdown**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 5: Commit Task 13**

```bash
git add README.md README.vi.md docs/authoring-guide.md CHANGELOG.md
git commit -m "docs: add bilingual READMEs, authoring guide, and changelog"
```

---

### Task 14: Continuous Integration Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: GitHub Actions matrix.
- Produces: Automated test & validate pipeline across OS and Node versions.

- [ ] **Step 1: Implement `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node-version: [20, 22, 24]
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Setup PHP (Node 22 only)
        if: matrix.node-version == 22
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          tools: php

      - name: Inject Denylist Secret if available
        shell: bash
        run: |
          if [ -n "$SECRET_DENYLIST" ]; then
            echo "$SECRET_DENYLIST" > .validate-denylist
            echo "Denylist injected for CI validation."
          else
            echo "::warning::VALIDATE_DENYLIST secret not set. Skipping private denylist check on fork."
          fi
        env:
          SECRET_DENYLIST: ${{ secrets.VALIDATE_DENYLIST }}

      - name: Validate Skills & History
        run: node scripts/validate-skills.mjs --history

      - name: Run Test Suite
        run: npm test

      - name: Verify Dry-Run Project Install
        run: node scripts/install.mjs --dry-run --project ./test-dryrun-proj
```

- [ ] **Step 2: Run validation and commit Task 14**

```bash
npm run validate -- --history
git add .github/workflows/ci.yml
git commit -m "ci: configure multi-OS GitHub Actions workflow with history validation"
```

---

### Task 15: Full Verification, Push Gate, and GitHub Secret Setup

**Files:**
- Verify: Full working tree and complete git history.

**Interfaces:**
- Consumes: Git hooks, full test suite, local denylist.
- Produces: Verified repository ready for push.

- [ ] **Step 1: Run comprehensive local test and history validation**

```bash
npm test
npm run validate -- --history
```
Expected: All suites PASS, 0 history violations.

- [ ] **Step 2: Instruct user on GitHub Secret creation**

Advise user to add `VALIDATE_DENYLIST` to GitHub repository secrets before pushing, containing the private denylist items.

- [ ] **Step 3: User approval gate before push**

Ask user for explicit confirmation before pushing commits to `origin/main`.

---

### Task 16: Acceptance Checklist & Author Migration Verification

**Files:**
- Create: `docs/superpowers/specs/acceptance-v1.0.0.md`

**Interfaces:**
- Consumes: Spec §13 checklist (M1–M7) and §7.1 migration instructions.
- Produces: Signed acceptance document and safely migrated author workspace.

- [ ] **Step 1: Fill out manual acceptance checklist (M1–M7)**

Document manual agent installation checks across Antigravity, Claude Code, and Codex.

- [ ] **Step 2: Execute author migration verification according to §7.1**
  1. Install as Antigravity plugin: clone into `~/.gemini/config/plugins/wordpress-agent-skills`.
  2. Verify Antigravity recognizes all 5 skills under the plugin namespace.
  3. Only after verification succeeds, move the 4 old standalone directories from `~/.gemini/config/skills/` into `~/.wordpress-agent-skills/backups/`.
  4. Confirm all 5 skills remain operational without collision.

- [ ] **Step 3: Commit acceptance document and tag `v1.0.0`**

```bash
git add docs/superpowers/specs/acceptance-v1.0.0.md
git commit -m "docs: complete manual acceptance checklist for v1.0.0 release"
git tag v1.0.0
```

---
