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

const TEXT_EXTS = new Set(['.md', '.mjs', '.js', '.php', '.json', '.txt', '.yml', '.yaml']);

export async function validateRepository(options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT);
  const denylistPath = options.denylistPath || path.join(rootDir, '.validate-denylist');
  let denylist = [];
  if (fs.existsSync(denylistPath)) {
    denylist = loadDenylist(denylistPath);
  } else if (!options.suppressNoDenylistWarning) {
    console.error('note: no denylist file, private-name check skipped');
  }
  const checkHistory = Boolean(options.checkHistory);

  const errors = [];

  function addError(file, line, rule, message) {
    errors.push({ file, line, rule, message, formatted: `${file}:${line || 1}: [${rule}] ${message}` });
  }

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
          addError(path.relative(rootDir, skillPath).replace(/\\/g, '/'), 1, 'V1', `Missing SKILL.md in skills/${skillName}`);
          continue;
        }

        const rawBuffer = fs.readFileSync(skillFile);
        if (rawBuffer.length >= 3 && rawBuffer[0] === 0xEF && rawBuffer[1] === 0xBB && rawBuffer[2] === 0xBF) {
          addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), 1, 'V6', 'File contains UTF-8 BOM');
        }

        const skillContent = rawBuffer.toString('utf8');
        const parsed = parseFrontmatter(skillContent);
        if (parsed.error) {
          const lineMatch = parsed.error.match(/^Line (\d+):/);
          const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : 1;
          addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), lineNum, 'V1', parsed.error);
        } else {
          const { data } = parsed;
          if (data.name !== skillName) {
            addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), 1, 'V1', `name "${data.name}" must match directory "${skillName}"`);
          }
          if (!/^[a-z0-9-]+$/.test(data.name || '')) {
            addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), 1, 'V1', `name "${data.name}" must match ^[a-z0-9-]+$`);
          }
          if ((data.name || '').length < 1 || (data.name || '').length > 64) {
            addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), 1, 'V1', `name length must be 1-64`);
          }
          if ((data.name || '').startsWith('-') || (data.name || '').endsWith('-') || (data.name || '').includes('--')) {
            addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), 1, 'V1', `name cannot have leading/trailing hyphen or --`);
          }
          if (!data.description || data.description.length < 1 || data.description.length > 1024) {
            addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), 1, 'V1', 'description must be between 1 and 1024 characters');
          }
          if (!data.compatibility) {
            addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), 1, 'V1', 'Missing compatibility specification');
          } else if (data.compatibility.length < 1 || data.compatibility.length > 500) {
            addError(path.relative(rootDir, skillFile).replace(/\\/g, '/'), 1, 'V1', 'compatibility length must be 1-500');
          }
        }

        // V2: Relative paths in every .md file in the skill dir
        function scanV2Dir(dirPath) {
          for (const e of fs.readdirSync(dirPath, { withFileTypes: true })) {
            const fullP = path.join(dirPath, e.name);
            if (e.isDirectory()) {
              scanV2Dir(fullP);
            } else if (e.name.endsWith('.md')) {
              const relMd = path.relative(rootDir, fullP).replace(/\\/g, '/');
              const mdBuf = fs.readFileSync(fullP);
              const mdLines = mdBuf.toString('utf8').split(/\r?\n/);
              for (let i = 0; i < mdLines.length; i++) {
                const lineNum = i + 1;
                const tokens = mdLines[i].split(/[\s`()[\]'"]+/);
                for (const token of tokens) {
                  if (/<|\*|…/.test(token)) continue;
                  if (token === 'shared/scripts/x.mjs' || token.match(/^[^\/]+\/scripts\/x\.mjs$/)) continue; // V2 exemption per R13
                  
                  if (/^(references\/|scripts\/|templates\/|\.\/)/.test(token)) {
                    let cleanToken = token.replace(/[#?].*$/, '').replace(/[.,:;]+$/, '');
                    if (cleanToken.endsWith('/')) continue;
                    if (cleanToken === '.' || cleanToken === './') continue;
                    
                    const targetPath = path.resolve(skillPath, cleanToken);
                    const relToSkill = path.relative(path.resolve(skillPath), targetPath);
                    if (!fs.existsSync(targetPath)) {
                      addError(relMd, lineNum, 'V2', `Referenced path does not exist: "${token}"`);
                    } else if (relToSkill.startsWith('..') || path.isAbsolute(relToSkill)) {
                      addError(relMd, lineNum, 'V2', `Referenced path outside skill dir: "${token}"`);
                    }
                  }
                }
              }
            }
          }
        }
        scanV2Dir(skillPath);
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

  // V4: Manifest consistency
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const claudePkgPath = path.join(rootDir, '.claude-plugin', 'plugin.json');
  const claudeMktPath = path.join(rootDir, '.claude-plugin', 'marketplace.json');
  const codexPkgPath = path.join(rootDir, '.codex-plugin', 'plugin.json');

  if (fs.existsSync(claudePkgPath) || fs.existsSync(claudeMktPath) || fs.existsSync(codexPkgPath)) {
    let pkg = { version: '', name: '' };
    try { pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')); } catch {}
    
    if (fs.existsSync(claudePkgPath)) {
      try {
        const claudePkg = JSON.parse(fs.readFileSync(claudePkgPath, 'utf8'));
        if (claudePkg.version !== pkg.version || claudePkg.name !== pkg.name) {
          addError('.claude-plugin/plugin.json', 1, 'V4', `Version or name mismatch with package.json`);
        }
      } catch (e) {
        addError('.claude-plugin/plugin.json', 1, 'V4', `Invalid JSON`);
      }
    }
    if (fs.existsSync(claudeMktPath)) {
      try {
        const claudeMkt = JSON.parse(fs.readFileSync(claudeMktPath, 'utf8'));
        const item = claudeMkt.plugins?.[0];
        if (!item || item.version !== pkg.version || item.name !== pkg.name) {
          addError('.claude-plugin/marketplace.json', 1, 'V4', `Version or name mismatch in marketplace plugin entry`);
        }
      } catch (e) {
        addError('.claude-plugin/marketplace.json', 1, 'V4', `Invalid JSON`);
      }
    }
    if (fs.existsSync(codexPkgPath)) {
      try {
        const codexPkg = JSON.parse(fs.readFileSync(codexPkgPath, 'utf8'));
        if (codexPkg.version !== pkg.version || codexPkg.name !== pkg.name) {
          addError('.codex-plugin/plugin.json', 1, 'V4', `Version or name mismatch with package.json`);
        }
      } catch (e) {
        addError('.codex-plugin/plugin.json', 1, 'V4', `Invalid JSON`);
      }
    }
  }

  // File enumeration
  let filesToScan = [];
  try {
    const stdout = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    filesToScan = stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    function walk(dir) {
      const res = [];
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['.git', 'node_modules', '.superpowers', '.validate-denylist'].includes(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) res.push(...walk(p));
        else res.push(path.relative(rootDir, p));
      }
      return res;
    }
    filesToScan = walk(rootDir);
  }

  function shouldSkipFile(relPath) {
    const n = relPath.replace(/\\/g, '/');
    if (n === '.validate-denylist' || n.endsWith('.local.json') || n.includes('.local/') || n.startsWith('.local/')) return true;
    if (n.includes('node_modules/') || n.includes('.git/') || n.includes('.superpowers/')) return true;
    return false;
  }

  // V3 & V6 Current Working Tree
  for (const relFile of filesToScan) {
    if (shouldSkipFile(relFile)) continue;
    
    const fullPath = path.join(rootDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    const ext = path.extname(relFile).toLowerCase();
    const isTextExt = TEXT_EXTS.has(ext);
    const nFile = relFile.replace(/\\/g, '/');
    const isV6Target = isTextExt || nFile.startsWith('.githooks/') || ext === '.sh' || nFile === '.gitattributes' || nFile === '.gitignore';

    let buf;
    try {
      buf = fs.readFileSync(fullPath);
    } catch { continue; }

    if (isV6Target) {
      if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        if (!nFile.startsWith('tests/fixtures/')) {
          addError(nFile, 1, 'V6', 'File contains UTF-8 BOM');
        }
      }
      // if it's UTF-16LE BOM (FF FE)
      if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
        if (!nFile.startsWith('tests/fixtures/')) {
          addError(nFile, 1, 'V6', 'File is UTF-16LE');
        }
      }
      let text;
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        text = decoder.decode(buf);
      } catch (err) {
        addError(relFile.replace(/\\/g, '/'), 1, 'V6', 'File is not valid UTF-8');
        continue; // invalid utf-8, skip V3
      }
      const hits = scanText(text, relFile, denylist);
      for (const hit of hits) {
        addError(relFile.replace(/\\/g, '/'), hit.line, 'V3', hit.message);
      }
    } else {
      // For non-text exts, attempt decode to check if valid UTF-8, if not treat as binary
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const text = decoder.decode(buf);
        const hits = scanText(text, relFile, denylist);
        for (const hit of hits) {
          addError(relFile.replace(/\\/g, '/'), hit.line, 'V3', hit.message);
        }
      } catch (err) {
        // Binary, skip
      }
    }
  }

  // V3 History
  if (checkHistory) {
    try {
      const commitList = execFileSync('git', ['rev-list', '--all'], { cwd: rootDir, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
      const scannedBlobs = new Set();

      for (const commit of commitList) {
        const treeItems = execFileSync('git', ['ls-tree', '-r', commit], { cwd: rootDir, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
        for (const item of treeItems) {
          // format: 100644 blob sha1\tpath
          const parts = item.split('\t');
          if (parts.length < 2) continue;
          const meta = parts[0].split(' ');
          const sha = meta[2];
          const file = parts[1];

          if (shouldSkipFile(file)) continue;

          if (scannedBlobs.has(sha)) continue;
          scannedBlobs.add(sha);

          try {
            const blobBuf = execFileSync('git', ['cat-file', '-p', sha], { cwd: rootDir, maxBuffer: 64 << 20 });
            
            const ext = path.extname(file).toLowerCase();
            const isTextExt = TEXT_EXTS.has(ext);

            const isV6Target = isTextExt || file.startsWith('.githooks/') || ext === '.sh' || file === '.gitattributes' || file === '.gitignore';
            
            if (isV6Target) {
              if (blobBuf.length >= 3 && blobBuf[0] === 0xEF && blobBuf[1] === 0xBB && blobBuf[2] === 0xBF) {
                if (!file.startsWith('tests/fixtures/')) {
                  addError(`${commit.slice(0, 7)}:${file}`, 1, 'V6', 'File contains UTF-8 BOM');
                }
              }
              if (blobBuf.length >= 2 && blobBuf[0] === 0xFF && blobBuf[1] === 0xFE) {
                if (!file.startsWith('tests/fixtures/')) {
                  addError(`${commit.slice(0, 7)}:${file}`, 1, 'V6', 'File is UTF-16LE');
                }
              }
            }

            let text;
            try {
              const decoder = new TextDecoder('utf-8', { fatal: true });
              text = decoder.decode(blobBuf);
            } catch (err) {
              if (isV6Target) {
                addError(`${commit.slice(0, 7)}:${file}`, 1, 'V6', 'File is not valid UTF-8');
              }
              continue;
            }

            const hits = scanText(text, file, denylist);
            for (const hit of hits) {
              addError(`${commit.slice(0, 7)}:${file}`, hit.line, 'V3', `[git history] ${hit.message}`);
            }
          } catch (blobErr) {}
        }
      }
    } catch (gitErr) {
      // Ignored if not in git repo or git fails
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
