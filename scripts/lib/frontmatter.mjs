/**
 * Strict subset frontmatter parser conforming to Spec §8.1 and Controller Ruling R1.
 * Supported format:
 * ---
 * key: "double-quoted string with \\" or \\\\"
 * key2: plain scalar (cannot start with quotes, block markers, or contain ': ' or ' #')
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

  let rawYaml;
  let bodyContent;
  const endFenceIndex = normalized.indexOf('\n---\n', 3);
  if (endFenceIndex !== -1) {
    rawYaml = normalized.slice(4, endFenceIndex);
    bodyContent = normalized.slice(endFenceIndex + 5);
  } else if (normalized.endsWith('\n---')) {
    rawYaml = normalized.slice(4, normalized.length - 4);
    bodyContent = '';
  } else {
    return { data: null, content: normalized, error: 'Unclosed frontmatter fence (missing closing ---)' };
  }

  const lines = rawYaml.split('\n');
  const data = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 2;

    // Skip empty lines or full-line comments
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    // Indented continuation lines, nested mappings, or lists
    if (line.startsWith(' ') || line.startsWith('\t')) {
      return {
        data: null,
        content: bodyContent,
        error: `Line ${lineNum}: unsupported frontmatter syntax; use a single-line double-quoted string`
      };
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      return {
        data: null,
        content: bodyContent,
        error: `Line ${lineNum}: unsupported frontmatter syntax; use a single-line double-quoted string`
      };
    }

    const key = line.slice(0, colonIndex).trim();
    if (!/^[a-z][a-z0-9_-]*$/.test(key)) {
      return {
        data: null,
        content: bodyContent,
        error: `Line ${lineNum}: Invalid key name "${key}" (must match ^[a-z][a-z0-9_-]*$)`
      };
    }

    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return {
        data: null,
        content: bodyContent,
        error: `Line ${lineNum}: Duplicate key "${key}"`
      };
    }

    const rawVal = line.slice(colonIndex + 1).trim();

    // Check for unsupported block scalars, single quotes, lists, maps, etc.
    if (/^['>|&*{}[\]!]/.test(rawVal)) {
      return {
        data: null,
        content: bodyContent,
        error: `Line ${lineNum}: unsupported frontmatter syntax; use a single-line double-quoted string`
      };
    }

    if (rawVal.startsWith('"')) {
      if (!rawVal.endsWith('"') || rawVal.length < 2) {
        return {
          data: null,
          content: bodyContent,
          error: `Line ${lineNum}: Unterminated double-quoted string for key "${key}"`
        };
      }

      // Parse inner content: only \" and \\ allowed, unescaped " is forbidden
      let unescaped = '';
      let inEscape = false;
      for (let j = 1; j < rawVal.length - 1; j++) {
        const char = rawVal[j];
        if (inEscape) {
          if (char === '"') {
            unescaped += '"';
          } else if (char === '\\') {
            unescaped += '\\';
          } else {
            return {
              data: null,
              content: bodyContent,
              error: `Line ${lineNum}: Invalid escape sequence "\\${char}" in key "${key}"; only \\" and \\\\ are allowed`
            };
          }
          inEscape = false;
        } else if (char === '\\') {
          inEscape = true;
        } else if (char === '"') {
          return {
            data: null,
            content: bodyContent,
            error: `Line ${lineNum}: Unescaped quote inside double-quoted string for key "${key}"`
          };
        } else {
          unescaped += char;
        }
      }

      if (inEscape) {
        // Trailing backslash escaped the closing quote, so it's not a closed string
        return {
          data: null,
          content: bodyContent,
          error: `Line ${lineNum}: Unterminated double-quoted string for key "${key}"`
        };
      }

      data[key] = unescaped;
    } else {
      if (key === 'description') {
        return {
          data: null,
          content: bodyContent,
          error: `Line ${lineNum}: description must be a double-quoted string ("...")`
        };
      }

      if (rawVal.includes(': ') || rawVal.includes(' #')) {
        return {
          data: null,
          content: bodyContent,
          error: `Line ${lineNum}: Plain scalar for key "${key}" cannot contain ': ' or ' #'`
        };
      }

      data[key] = rawVal;
    }
  }

  return { data, content: bodyContent, error: null };
}
