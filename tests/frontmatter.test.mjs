import assert from 'node:assert';
import test from 'node:test';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';

test('parseFrontmatter parses valid strict frontmatter with single-line quoted description', () => {
  const text = `---
name: my-skill
description: "A valid description: with colon and \\"escaped quotes\\" and \\\\ backslash"
compatibility: WordPress 6.0+, PHP 7.4+
---
# Content Title
Body text.`;
  const result = parseFrontmatter(text);
  assert.strictEqual(result.error, null);
  assert.strictEqual(result.data.name, 'my-skill');
  assert.strictEqual(result.data.description, 'A valid description: with colon and "escaped quotes" and \\ backslash');
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

  const blockScalarFolded = `---
name: bad-skill
description: >
  Folded text
compatibility: all
---`;
  const r2 = parseFrontmatter(blockScalarFolded);
  assert.ok(r2.error && r2.error.includes('unsupported frontmatter syntax; use a single-line double-quoted string'));

  const blockScalarLiteral = `---
name: bad-skill
description: |
  Literal block
compatibility: all
---`;
  const r3 = parseFrontmatter(blockScalarLiteral);
  assert.ok(r3.error && r3.error.includes('unsupported frontmatter syntax; use a single-line double-quoted string'));
});

test('parseFrontmatter rejects single quotes', () => {
  const singleQuoted = `---
name: single-quoted
description: 'Single quotes are forbidden'
compatibility: all
---`;
  const res = parseFrontmatter(singleQuoted);
  assert.ok(res.error && res.error.includes('unsupported frontmatter syntax; use a single-line double-quoted string'));
});

test('parseFrontmatter rejects multi-line or indented continuation lines', () => {
  const indented = `---
name: my-skill
description: "A valid description"
  indented continuation line
compatibility: all
---`;
  const res = parseFrontmatter(indented);
  assert.ok(res.error && res.error.includes('unsupported frontmatter syntax; use a single-line double-quoted string'));
});

test('parseFrontmatter rejects plain scalar containing ": "', () => {
  const colonInPlain = `---
name: bad-plain
description: "Valid description"
compatibility: WordPress: 6.0
---`;
  const res = parseFrontmatter(colonInPlain);
  assert.ok(res.error && res.error.includes("cannot contain ': '"));
});

test('parseFrontmatter rejects invalid escape sequences in double-quoted strings', () => {
  const invalidEscape = `---
name: bad-escape
description: "Invalid \\n newline escape"
compatibility: all
---`;
  const res = parseFrontmatter(invalidEscape);
  assert.ok(res.error && res.error.includes('Invalid escape sequence'));
});

test('parseFrontmatter rejects unescaped quotes inside double-quoted strings', () => {
  const unescapedQuote = `---
name: bad-quote
description: "Unescaped " quote inside"
compatibility: all
---`;
  const res = parseFrontmatter(unescapedQuote);
  assert.ok(res.error && res.error.includes('Unescaped quote'));
});

test('parseFrontmatter rejects missing closing fence', () => {
  const unclosed = `---
name: unclosed
description: "Missing closing fence"
compatibility: all`;
  const res = parseFrontmatter(unclosed);
  assert.ok(res.error && res.error.includes('Unclosed frontmatter fence'));
});

test('parseFrontmatter rejects missing opening fence or non-string input', () => {
  const missingOpen = `name: no-fence
description: "Missing open fence"
---`;
  const r1 = parseFrontmatter(missingOpen);
  assert.ok(r1.error && r1.error.includes('Document must begin with --- frontmatter fence'));

  const nonString = parseFrontmatter(null);
  assert.ok(nonString.error && nonString.error.includes('Input must be a string'));
});

test('parseFrontmatter rejects duplicate keys', () => {
  const duplicate = `---
name: skill-one
name: skill-two
description: "Valid description"
compatibility: all
---`;
  const res = parseFrontmatter(duplicate);
  assert.ok(res.error && res.error.includes('Duplicate key "name"'));
});

test('parseFrontmatter strips BOM correctly', () => {
  const bomText = `\uFEFF---
name: bom-skill
description: "Valid description"
compatibility: all
---
Body with BOM stripped`;
  const res = parseFrontmatter(bomText);
  assert.strictEqual(res.error, null);
  assert.strictEqual(res.data.name, 'bom-skill');
});
