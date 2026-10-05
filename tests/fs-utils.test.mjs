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
    
    const fakeNow = new Date('2026-10-05T10:00:00Z');
    
    atomicInstallSkill({
      skillName: 'test-skill',
      srcDir: srcUpdate,
      destSkillsRoot: destDir,
      version: '1.0.1',
      homeDir,
      agent: 'antigravity',
      backupOld: true,
      now: fakeNow
    });
    
    assert.ok(fs.existsSync(path.join(destDir, 'test-skill', 'NEW_FILE.md')));
    assert.ok(!fs.existsSync(path.join(destDir, 'test-skill', 'SKILL.md'))); // Old file removed
    
    const markerUpdate = readMarker(path.join(destDir, 'test-skill'));
    assert.strictEqual(markerUpdate.version, '1.0.1');
    
    // Backup was created
    const backupBase = path.join(homeDir, '.wordpress-agent-skills', 'backups');
    const pad = (n) => String(n).padStart(2, '0');
    const expectedTimestamp = `${fakeNow.getFullYear()}${pad(fakeNow.getMonth() + 1)}${pad(fakeNow.getDate())}-${pad(fakeNow.getHours())}${pad(fakeNow.getMinutes())}${pad(fakeNow.getSeconds())}`;
    
    const backupPath = path.join(backupBase, expectedTimestamp, 'antigravity', 'test-skill');
    assert.ok(fs.existsSync(path.join(backupPath, 'SKILL.md')), 'Backup created with specific timestamp');
    
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

test('cleanLeftoverStaging recovers missing dest and deletes existing dest leftovers', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-utils-clean-'));
  try {
    const skillsRoot = path.join(tmpRoot, 'skills');
    const stagingRoot = path.join(tmpRoot, '.wordpress-agent-skills-staging');
    
    fs.mkdirSync(skillsRoot, { recursive: true });
    fs.mkdirSync(stagingRoot, { recursive: true });
    
    // a) Leftover -old- dir with missing dest -> recovered
    const recoverName = 'skill-recover-old-deadbeef';
    fs.mkdirSync(path.join(stagingRoot, recoverName), { recursive: true });
    fs.writeFileSync(path.join(stagingRoot, recoverName, 'OK.md'), 'recover me', 'utf8');
    
    // b) Leftover -old- dir whose dest exists -> deleted
    const deleteOldName = 'skill-delete-old-deadbeef';
    fs.mkdirSync(path.join(stagingRoot, deleteOldName), { recursive: true });
    fs.mkdirSync(path.join(skillsRoot, 'skill-delete'), { recursive: true }); // dest exists
    fs.writeFileSync(path.join(skillsRoot, 'skill-delete', 'EXIST.md'), 'here', 'utf8');
    
    // Plain leftover stage dir -> deleted
    const plainName = 'skill-plain-deadbeef';
    fs.mkdirSync(path.join(stagingRoot, plainName), { recursive: true });
    
    cleanLeftoverStaging(skillsRoot);
    
    // Check (a)
    assert.ok(fs.existsSync(path.join(skillsRoot, 'skill-recover', 'OK.md')), 'Should recover missing dest');
    assert.ok(!fs.existsSync(path.join(stagingRoot, recoverName)), 'Staging for recovered should be gone');
    
    // Check (b)
    assert.ok(!fs.existsSync(path.join(stagingRoot, deleteOldName)), 'Should delete leftover old if dest exists');
    assert.ok(!fs.existsSync(path.join(stagingRoot, plainName)), 'Should delete plain leftover stage dir');
    
    // Staging root empty -> deleted
    assert.ok(!fs.existsSync(stagingRoot), 'Staging root should be deleted');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('cleanLeftoverStaging preserves -old- dir if renameSync throws', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-utils-clean-fail-'));
  try {
    const skillsRoot = path.join(tmpRoot, 'skills');
    const stagingRoot = path.join(tmpRoot, '.wordpress-agent-skills-staging');
    
    fs.mkdirSync(skillsRoot, { recursive: true });
    fs.mkdirSync(stagingRoot, { recursive: true });
    
    const recoverName = 'skill-fail-old-deadbeef';
    fs.mkdirSync(path.join(stagingRoot, recoverName), { recursive: true });
    fs.writeFileSync(path.join(stagingRoot, recoverName, 'OK.md'), 'recover me', 'utf8');
    
    const fsMock = { ...fs };
    const originalRenameSync = fs.renameSync;
    fsMock.renameSync = (src, dest) => {
      throw new Error('Injected rename failure');
    };
    
    cleanLeftoverStaging(skillsRoot, fsMock);
    
    assert.ok(fs.existsSync(path.join(stagingRoot, recoverName)), '-old- dir must still exist after rename failure');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
