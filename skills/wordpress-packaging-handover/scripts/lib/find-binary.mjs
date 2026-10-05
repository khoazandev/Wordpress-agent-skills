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
  const pathVal = env.Path ?? env.PATH ?? '';
  const delimiter = isWin ? ';' : ':';
  const dirs = pathVal.split(delimiter).filter(Boolean);
  
  if (isWin) {
    const rawExts = (env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';');
    const extensions = [];
    for (const ext of rawExts) {
      if (ext) {
        extensions.push(ext.toLowerCase());
        if (ext.toLowerCase() !== ext) {
          extensions.push(ext);
        }
      }
    }
    // Deduplicate extensions
    const uniqueExtensions = [...new Set(extensions)];

    for (const dir of dirs) {
      for (const ext of uniqueExtensions) {
        const candidate = pathModule.join(dir, `${name}${ext}`);
        if (exists(candidate)) return candidate;
      }
    }
  } else {
    for (const dir of dirs) {
      const candidate = pathModule.join(dir, name);
      if (exists(candidate)) return candidate;
    }
  }

  // 3. Known standard application locations
  const sortDesc = (a, b) => b.localeCompare(a, undefined, { numeric: true });

  if (isWin) {
    if (name === 'php') {
      const xampp = 'C:\\xampp\\php\\php.exe';
      if (exists(xampp)) return xampp;

      // Laragon version scan
      const laragonDir = 'C:\\laragon\\bin\\php';
      const versions = listDir(laragonDir).sort(sortDesc);
      for (const v of versions) {
        const cand = pathModule.join(laragonDir, v, 'php.exe');
        if (exists(cand)) return cand;
      }
    } else if (name === 'mysqldump' || name === 'mysql') {
      const xampp = `C:\\xampp\\mysql\\bin\\${name}.exe`;
      if (exists(xampp)) return xampp;

      const laragonDir = 'C:\\laragon\\bin\\mysql';
      const versions = listDir(laragonDir).sort(sortDesc);
      for (const v of versions) {
        const cand = pathModule.join(laragonDir, v, 'bin', `${name}.exe`);
        if (exists(cand)) return cand;
      }

      const progFilesMysql = 'C:\\Program Files\\MySQL';
      const pfVersions = listDir(progFilesMysql).sort(sortDesc);
      for (const v of pfVersions) {
        const cand = pathModule.join(progFilesMysql, v, 'bin', `${name}.exe`);
        if (exists(cand)) return cand;
      }
    }
  } else if (platform === 'darwin') {
    if (name === 'php') {
      const mampDir = '/Applications/MAMP/bin/php';
      const versions = listDir(mampDir).sort(sortDesc);
      for (const v of versions) {
        const cand = pathModule.join(mampDir, v, 'bin', 'php');
        if (exists(cand)) return cand;
      }
    } else if (name === 'mysqldump' || name === 'mysql') {
      const mampCand = `/Applications/MAMP/Library/bin/${name}`;
      if (exists(mampCand)) return mampCand;
    }

    const candidates = [
      `/opt/homebrew/bin/${name}`,
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`
    ];
    for (const c of candidates) {
      if (exists(c)) return c;
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
