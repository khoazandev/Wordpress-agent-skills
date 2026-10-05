import assert from 'node:assert';
import test from 'node:test';
import path from 'node:path';
import os from 'node:os';
import { resolveInstallTargets, pluginInstallPaths } from '../scripts/lib/targets.mjs';

test('resolveInstallTargets returns global targets for all 3 agents by default', () => {
  const fakeHome = path.join(os.tmpdir(), 'fake_home');
  const env = {};
  const exists = (p) => p === path.join(fakeHome, '.gemini', 'config');
  const targets = resolveInstallTargets({ homeDir: fakeHome, env, exists });
  
  assert.strictEqual(targets.length, 3);
  assert.ok(targets.some(t => t.agents.includes('antigravity') && t.targetDir === path.join(fakeHome, '.gemini', 'config', 'skills')));
  assert.ok(targets.some(t => t.agents.includes('claude') && t.targetDir === path.join(fakeHome, '.claude', 'skills')));
  assert.ok(targets.some(t => t.agents.includes('codex') && t.targetDir === path.join(fakeHome, '.codex', 'skills')));
});

test('resolveInstallTargets handles config-layout absent for antigravity', () => {
  const fakeHome = path.join(os.tmpdir(), 'fake_home_absent');
  const env = {};
  const exists = () => false;
  const targets = resolveInstallTargets({ homeDir: fakeHome, env, exists, agents: ['antigravity'] });
  assert.strictEqual(targets[0].targetDir, path.join(fakeHome, '.gemini', 'antigravity', 'skills'));
});

test('resolveInstallTargets consolidates shared project directories', () => {
  const projectPath = path.join(os.tmpdir(), 'test_proj');
  const targets = resolveInstallTargets({ projectPath, env: {} });
  
  assert.strictEqual(targets.length, 2);
  const ac = targets.find(t => t.agents.includes('antigravity'));
  assert.deepStrictEqual(ac.agents, ['antigravity', 'codex']);
  assert.strictEqual(ac.targetDir, path.resolve(path.join(projectPath, '.agents', 'skills')));
  
  const cl = targets.find(t => t.agents.includes('claude'));
  assert.deepStrictEqual(cl.agents, ['claude']);
  assert.strictEqual(cl.targetDir, path.resolve(path.join(projectPath, '.claude', 'skills')));
});

test('resolveInstallTargets applies env overrides', () => {
  const fakeHome = path.join(os.tmpdir(), 'fake_home');
  const env = {
    ANTIGRAVITY_SKILLS_DIR: path.join(os.tmpdir(), 'anti'),
    CLAUDE_CONFIG_DIR: path.join(os.tmpdir(), 'claude_cfg'),
    CODEX_HOME: path.join(os.tmpdir(), 'codex_home')
  };
  const targets = resolveInstallTargets({ homeDir: fakeHome, env, exists: () => false });
  assert.ok(targets.some(t => t.agents.includes('antigravity') && t.targetDir === path.resolve(env.ANTIGRAVITY_SKILLS_DIR)));
  assert.ok(targets.some(t => t.agents.includes('claude') && t.targetDir === path.join(env.CLAUDE_CONFIG_DIR, 'skills')));
  assert.ok(targets.some(t => t.agents.includes('codex') && t.targetDir === path.join(env.CODEX_HOME, 'skills')));
});

test('resolveInstallTargets throws on unknown agent', () => {
  assert.throws(() => {
    resolveInstallTargets({ agents: ['claude', 'foo'], env: {} });
  }, /Unknown agent: foo/);
});

test('resolveInstallTargets parses comma string', () => {
  const fakeHome = path.join(os.tmpdir(), 'fake_home');
  const targets = resolveInstallTargets({ agents: 'claude,codex', homeDir: fakeHome, env: {} });
  assert.strictEqual(targets.length, 2);
  assert.ok(targets.some(t => t.agents.includes('claude')));
  assert.ok(targets.some(t => t.agents.includes('codex')));
  assert.ok(!targets.some(t => t.agents.includes('antigravity')));
});

test('pluginInstallPaths returns correct paths', () => {
  const fakeHome = path.join(os.tmpdir(), 'fake_home');
  const env = { CLAUDE_CONFIG_DIR: path.join(os.tmpdir(), 'claude_cfg') };
  const paths = pluginInstallPaths({ homeDir: fakeHome, env });
  assert.strictEqual(paths.antigravity, path.join(fakeHome, '.gemini', 'config', 'plugins', 'wordpress-agent-skills', 'plugin.json'));
  assert.strictEqual(paths.claudePluginsDir, path.join(env.CLAUDE_CONFIG_DIR, 'plugins'));
});
