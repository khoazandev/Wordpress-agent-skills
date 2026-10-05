import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export function copyFiltered(src, dest, fsImpl = fs) {
  fsImpl.mkdirSync(dest, { recursive: true });
  const entries = fsImpl.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'tests' || entry.name === 'node_modules') {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFiltered(srcPath, destPath, fsImpl);
    } else {
      fsImpl.copyFileSync(srcPath, destPath);
    }
  }
}

export function cleanLeftoverStaging(skillsRoot, fsImpl = fs) {
  const stagingRoot = path.join(path.dirname(skillsRoot), '.wordpress-agent-skills-staging');
  if (fsImpl.existsSync(stagingRoot)) {
    try {
      fsImpl.rmSync(stagingRoot, { recursive: true, force: true });
    } catch {}
  }
}

export function createBackup({ homeDir, agent, name, now = new Date() }, sourceDir, fsImpl = fs) {
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupPath = path.join(homeDir, '.wordpress-agent-skills', 'backups', timestamp, agent, name);
  
  fsImpl.mkdirSync(path.dirname(backupPath), { recursive: true });
  try {
    fsImpl.renameSync(sourceDir, backupPath);
  } catch (err) {
    if (err.code === 'EXDEV') {
      fsImpl.cpSync(sourceDir, backupPath, { recursive: true });
      fsImpl.rmSync(sourceDir, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
  return backupPath;
}

export function readMarker(dir, fsImpl = fs) {
  const markerPath = path.join(dir, '.wordpress-agent-skills.json');
  if (!fsImpl.existsSync(markerPath)) return null;
  try {
    const data = JSON.parse(fsImpl.readFileSync(markerPath, 'utf8'));
    if (data.package !== 'wordpress-agent-skills') return null;
    return data;
  } catch {
    return null;
  }
}

export function atomicInstallSkill({ skillName, srcDir, destSkillsRoot, version, agent, homeDir, backupOld = false, fsImpl = fs }) {
  cleanLeftoverStaging(destSkillsRoot, fsImpl);

  const stagingRoot = path.join(path.dirname(destSkillsRoot), '.wordpress-agent-skills-staging');
  const rand = crypto.randomBytes(4).toString('hex');
  const stageDir = path.join(stagingRoot, `${skillName}-${rand}`);
  const destDir = path.join(destSkillsRoot, skillName);

  fsImpl.mkdirSync(stageDir, { recursive: true });
  copyFiltered(srcDir, stageDir, fsImpl);

  const marker = {
    package: 'wordpress-agent-skills',
    version: version || '1.0.0',
    installedAt: new Date().toISOString()
  };
  fsImpl.writeFileSync(path.join(stageDir, '.wordpress-agent-skills.json'), JSON.stringify(marker, null, 2), 'utf8');

  fsImpl.mkdirSync(destSkillsRoot, { recursive: true });

  const oldBackupStaging = path.join(stagingRoot, `${skillName}-old-${rand}`);
  let hadExisting = false;

  if (fsImpl.existsSync(destDir)) {
    hadExisting = true;
    fsImpl.renameSync(destDir, oldBackupStaging);
  }
  
  try {
    fsImpl.renameSync(stageDir, destDir);
  } catch (err) {
    if (hadExisting && fsImpl.existsSync(oldBackupStaging)) {
      try {
        if (fsImpl.existsSync(destDir)) fsImpl.rmSync(destDir, { recursive: true, force: true });
        fsImpl.renameSync(oldBackupStaging, destDir);
      } catch {}
    }
    try {
      if (fsImpl.existsSync(stageDir)) fsImpl.rmSync(stageDir, { recursive: true, force: true });
      if (fsImpl.readdirSync(stagingRoot).length === 0) {
        fsImpl.rmSync(stagingRoot, { recursive: true, force: true });
      }
    } catch {}
    throw new Error(`Atomic installation of ${skillName} failed: ${err.message}`);
  }

  if (hadExisting && fsImpl.existsSync(oldBackupStaging)) {
    if (backupOld) {
      createBackup({ homeDir, agent, name: skillName }, oldBackupStaging, fsImpl);
    } else {
      try { fsImpl.rmSync(oldBackupStaging, { recursive: true, force: true }); } catch {}
    }
  }

  try {
    if (fsImpl.existsSync(stagingRoot) && fsImpl.readdirSync(stagingRoot).length === 0) {
      fsImpl.rmSync(stagingRoot, { recursive: true, force: true });
    }
  } catch {}

  return { success: true };
}
