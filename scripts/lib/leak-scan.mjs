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
  new RegExp('[A-Za-z]:[\\\\/]+Us' + 'ers[\\\\/]+(?!<|(?:Public|Default)(?:[\\\\/]|$))[^\\\\/\\s"\'`]+'),
  new RegExp('/ho' + 'me/[^/\\s<]+/'),
  new RegExp('/Us' + 'ers/[^/\\s<]+/')
];

export function scanText(text, relativePath = '', denylist = []) {
  const hits = [];
  if (typeof text !== 'string') return hits;

  // Normalise relative paths to forward slashes before checking. (R2)
  const normPath = relativePath.replace(/\\/g, '/');
  const isFixture = normPath.startsWith('tests/fixtures/');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const hasPragma = line.includes('validate-allow-path');

    // Pattern check (exempt for fixture or pragma) applies to PATH PATTERNS ONLY (R2)
    if (!isFixture && !hasPragma) {
      for (const pattern of PATH_PATTERNS) {
        if (pattern.test(line)) {
          hits.push({
            type: 'PATH',
            line: lineNum,
            message: `Personal path detected matching ${pattern.toString()}`
          });
          break;
        }
      }
    }

    // Denylist check (NO EXEMPTIONS) (R2)
    if (denylist && denylist.length > 0) {
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
