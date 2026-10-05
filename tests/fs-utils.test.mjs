import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { atomicInstallSkill, cleanLeftoverStaging, readMarker, createBackup } from '../scripts/lib/fs-utils.mjs';

test('atomicInstallSkill stages and renames atomically with marker, filter, backup', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-utils-test-'));
  try {
    const srcSkill = path.join(tmpRoot, 'src-skill');
    const destDir = path.join(tmpRoot, 'installed-skills');
    const homeDir = path.join(tmpRoot, 'home');
    fs.mkdirSync(srcSkill, { recursive: true });
    fs.writeFileSync(path.join(srcSkill, 'SKILL.md'), 'test skill content', 'utf8');
    fs.mkdirSync(path.join(srcSkill, 'tests'));
    fs.writeFileSync(path.join(srcSkill, 'tests', 'test.mjs'), 'console.log("test");', 'utf8');
    fs.writeFileSync(path.join(srcSkill, '.hidden'), 'hidden', 'utf8');

    const result = atomicInstallSkill({
      skillName: 'test-skill',
      srcDir: srcSkill,
      destSkillsRoot: destDir,
      version: '1.0.0',
      homeDir,
      agent: 'antigravity'
    });

    assert.strictEqual(result.success, true);
    
    const installedMarker = path.join(destDir, 'test-skill', '.wordpress-agent-skills.json');
    assert.ok(fs.existsSync(installedMarker), 'Marker must exist');
    const markerData = readMarker(path.join(destDir, 'test-skill'));
    assert.ok(markerData);
    assert.strictEqual(markerData.package, 'wordpress-agent-skills');
    assert.strictEqual(markerData.version, '1.0.0');
    assert.ok(markerData.installedAt);
    assert.strictEqual(Object.keys(markerData).length, 3);
    
    assert.ok(!fs.existsSync(path.join(destDir, 'test-skill', 'tests')));
    assert.ok(!fs.existsSync(path.join(destDir, 'test-skill', '.hidden')));
    
    // Update replaces content and removes old files
    const srcUpdate = path.join(tmpRoot, 'src-update');
    fs.mkdirSync(srcUpdate, { recursive: true });
    fs.writeFileSync(path.join(srcUpdate, 'NEW_FILE.md'), 'new content', 'utf8');
    
    atomicInstallSkill({
      skillName: 'test-skill',
      srcDir: srcUpdate,
      destSkillsRoot: destDir,
      version: '1.0.1',
      homeDir,
      agent: 'antigravity',
      backupOld: true
    });
    
    assert.ok(fs.existsSync(path.join(destDir, 'test-skill', 'NEW_FILE.md')));
    assert.ok(!fs.existsSync(path.join(destDir, 'test-skill', 'SKILL.md'))); // Old file removed
    
    const markerUpdate = readMarker(path.join(destDir, 'test-skill'));
    assert.strictEqual(markerUpdate.version, '1.0.1');
    
    // Backup was created
    const backupBase = path.join(homeDir, '.wordpress-agent-skills', 'backups');
    const timestamps = fs.readdirSync(backupBase);
    assert.strictEqual(timestamps.length, 1);
    const backupPath = path.join(backupBase, timestamps[0], 'antigravity', 'test-skill');
    assert.ok(fs.existsSync(path.join(backupPath, 'SKILL.md')));
    
    // Injected rename failure -> rollback
    const srcFail = path.join(tmpRoot, 'src-fail');
    fs.mkdirSync(srcFail, { recursive: true });
    fs.writeFileSync(path.join(srcFail, 'FAIL.md'), 'fail', 'utf8');
    
    const fsMock = { ...fs };
    const originalRenameSync = fs.renameSync;
    fsMock.renameSync = (src, dest) => {
      if (src.includes('test-skill-') && !src.includes('-old-')) {
        throw new Error('Injected rename error');
      }
      originalRenameSync(src, dest);
    };
    
    assert.throws(() => {
      atomicInstallSkill({
        skillName: 'test-skill',
        srcDir: srcFail,
        destSkillsRoot: destDir,
        version: '1.0.2',
        homeDir,
        agent: 'antigravity',
        fsImpl: fsMock
      });
    }, /Injected rename error/);
    
    // Dest intact
    assert.ok(fs.existsSync(path.join(destDir, 'test-skill', 'NEW_FILE.md')));
    assert.ok(!fs.existsSync(path.join(destDir, 'test-skill', 'FAIL.md')));
    assert.ok(!fs.existsSync(path.join(tmpRoot, '.wordpress-agent-skills-staging'))); // Cleaned up
    
    // readMarker null cases
    assert.strictEqual(readMarker(path.join(tmpRoot, 'non-existent')), null);
    fs.writeFileSync(path.join(destDir, 'test-skill', '.wordpress-agent-skills.json'), 'invalid', 'utf8');
    assert.strictEqual(readMarker(path.join(destDir, 'test-skill')), null);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
