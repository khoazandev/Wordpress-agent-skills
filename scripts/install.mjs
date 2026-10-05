#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveInstallTargets, pluginInstallPaths } from './lib/targets.mjs';
import { atomicInstallSkill, createBackup, readMarker, cleanLeftoverStaging } from './lib/fs-utils.mjs';

const HELP_TEXT = `Usage:
node scripts/install.mjs [options]
npx github:khoazandev/Wordpress-agent-skills [options]

--agents=<list>     antigravity,claude,codex (default: all three)
--project=<path>    install into project repo instead of global
--skills=<list>     install only specified skills (default: all)
--dry-run           print plan, do not write
--uninstall         remove skills installed by this tool
--force             replace unmanaged dirs with a backup / ignore plugin detection
--help

Exit codes: 0 ok, 1 error, 2 conflicts remain`;

function getRepoRoot(metaUrl) {
  return path.dirname(path.dirname(fileURLToPath(metaUrl)));
}

function getAvailableSkills(repoRoot, fsImpl) {
  const skillsDir = path.join(repoRoot, 'skills');
  if (!fsImpl.existsSync(skillsDir)) return [];
  return fsImpl.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && fsImpl.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
    .map(d => d.name);
}

function getVersion(repoRoot, fsImpl) {
  try {
    const pkg = JSON.parse(fsImpl.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return '1.0.0';
  }
}

function isClaudePluginInstalled(claudePluginsDir, fsImpl) {
  const installedJsonPath = path.join(claudePluginsDir, 'installed_plugins.json');
  if (fsImpl.existsSync(installedJsonPath)) {
    try {
      const data = JSON.parse(fsImpl.readFileSync(installedJsonPath, 'utf8'));
      const keys = Array.isArray(data) ? data.map(item => item.name || '') : Object.keys(data);
      for (const key of keys) {
        if (key === 'wordpress-agent-skills' || key.startsWith('wordpress-agent-skills@')) {
          return true;
        }
      }
    } catch {}
  } else {
    // Recursive search up to depth 6
    function searchDepth(dir, depth) {
      if (depth > 6) return false;
      if (!fsImpl.existsSync(dir)) return false;
      let entries = [];
      try { entries = fsImpl.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginJsonPath = path.join(dir, entry.name, 'plugin.json');
          if (entry.name === '.claude-plugin' && fsImpl.existsSync(pluginJsonPath)) {
            try {
               const pData = JSON.parse(fsImpl.readFileSync(pluginJsonPath, 'utf8'));
               if (pData.name === 'wordpress-agent-skills') return true;
            } catch {}
          } else {
             if (searchDepth(path.join(dir, entry.name), depth + 1)) return true;
          }
        }
      }
      return false;
    }
    return searchDepth(claudePluginsDir, 1);
  }
  return false;
}

export async function main(argv, deps = {}) {
  const env = deps.env || process.env;
  const stdout = deps.stdout || ((msg) => process.stdout.write(msg + '\n'));
  const stderr = deps.stderr || ((msg) => process.stderr.write(msg + '\n'));
  const fsImpl = deps.fsImpl || fs;
  const now = deps.now || new Date();
  const cwd = deps.cwd || process.cwd();

  const args = {
    agents: null,
    project: null,
    skills: null,
    dryRun: false,
    uninstall: false,
    force: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') {
      stdout(HELP_TEXT);
      return 0;
    } else if (arg.startsWith('--agents=')) {
      args.agents = arg.split('=')[1];
    } else if (arg.startsWith('--project=')) {
      args.project = arg.split('=')[1];
    } else if (arg === '--project' && i + 1 < argv.length && !argv[i+1].startsWith('--')) {
      args.project = argv[++i];
    } else if (arg.startsWith('--skills=')) {
      args.skills = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--uninstall') {
      args.uninstall = true;
    } else if (arg === '--force') {
      args.force = true;
    } else {
      stderr(`Unknown option: ${arg}`);
      return 1;
    }
  }

  const repoRoot = getRepoRoot(import.meta.url);
  const version = getVersion(repoRoot, fsImpl);
  const availableSkills = getAvailableSkills(repoRoot, fsImpl);
  
  let targetSkills = availableSkills;
  if (args.skills) {
    const requestedSkills = args.skills.split(',').map(s => s.trim()).filter(Boolean);
    for (const s of requestedSkills) {
      if (!availableSkills.includes(s)) {
        stderr(`Unknown skill: ${s}`);
        return 1;
      }
    }
    targetSkills = requestedSkills;
  }

  const homedirFn = deps.homedir || os.homedir;
  const homeDir = env.WAS_HOME || homedirFn();
  const pluginPaths = pluginInstallPaths({ env, homeDir });

  function maskHome(fullPath) {
    const platform = deps.platform || process.platform;
    const p = platform === 'win32' ? path.win32 : path.posix;
    
    // Normalize both paths using the appropriate path module
    const resolvedHome = p.resolve(homeDir);
    const resolvedPath = p.resolve(fullPath);
    let homeStr = resolvedHome;
    let pathStr = resolvedPath;
    
    if (platform === 'win32') {
      homeStr = homeStr.toLowerCase();
      pathStr = pathStr.toLowerCase();
    }
    
    if (pathStr === homeStr) return '~';
    if (pathStr.startsWith(homeStr + p.sep)) {
      return '~' + p.sep + resolvedPath.substring(resolvedHome.length + 1);
    }
    return resolvedPath;
  }
  // Export maskHome for testing if needed
  if (deps._export_maskHome) deps._export_maskHome(maskHome);

  let targets = [];
  try {
    targets = resolveInstallTargets({
      agents: args.agents,
      projectPath: args.project,
      env,
      homeDir,
      exists: fsImpl.existsSync
    });
  } catch (err) {
    stderr(err.message);
    return 1;
  }

  // Identify plugin installations for targets
  for (const target of targets) {
    let allAgentsPluginInstalled = true;
    for (const agent of target.agents) {
      let isPlugin = false;
      if (agent === 'antigravity') {
        isPlugin = fsImpl.existsSync(pluginPaths.antigravity);
      } else if (agent === 'claude') {
        isPlugin = isClaudePluginInstalled(pluginPaths.claudePluginsDir, fsImpl);
      } else if (agent === 'codex') {
        isPlugin = false; // Codex has no plugin detection in v1.0
      }
      if (!isPlugin) {
        allAgentsPluginInstalled = false;
        break;
      }
    }
    target.skipPlugin = allAgentsPluginInstalled;
  }

  const plan = [];
  let conflictsCount = 0;

  for (const target of targets) {
    if (!args.dryRun) {
      cleanLeftoverStaging(target.targetDir, fsImpl);
    }
    
    for (const skill of targetSkills) {
      const destPath = path.join(target.targetDir, skill);
      const exists = fsImpl.existsSync(destPath);
      const marker = readMarker(destPath, fsImpl);
      
      let action = 'new';
      if (exists) {
        if (marker) {
          action = 'update';
        } else {
          action = 'conflict';
        }
      }

      if (action === 'conflict' && !args.force && !args.uninstall) {
        conflictsCount++;
      } else if (target.skipPlugin && action !== 'conflict' && !args.force && !args.uninstall) {
        action = 'skip-plugin';
      }

      if (args.uninstall) {
        if (exists && marker) {
          action = 'uninstall';
        } else {
          action = 'skip (not managed)';
        }
      }

      plan.push({
        agents: target.agents.join(','),
        skill,
        dest: maskHome(destPath),
        realDest: destPath,
        action,
        targetDir: target.targetDir,
        agent: target.agents[0]
      });
    }
  }

  stdout(`agent | skill | dest | action`);
  for (const item of plan) {
    stdout(`${item.agents} | ${item.skill} | ${item.dest} | ${item.action}`);
  }

  if (args.dryRun) {
    return 0;
  }

  let hasError = false;

  for (const item of plan) {
    if (args.uninstall) {
      if (item.action === 'uninstall') {
        try {
          fsImpl.rmSync(item.realDest, { recursive: true, force: true });
        } catch (e) {
          stderr(`Failed to uninstall ${item.skill}: ${e.message}`);
          hasError = true;
        }
      }
      continue;
    }

    if (item.action === 'conflict' && !args.force) continue;
    if (item.action === 'skip-plugin' && !args.force) continue;

    try {
      const srcDir = path.join(repoRoot, 'skills', item.skill);
      atomicInstallSkill({
        skillName: item.skill,
        srcDir,
        destSkillsRoot: item.targetDir,
        version,
        agent: item.agent,
        homeDir,
        backupOld: item.action === 'conflict' && args.force,
        fsImpl,
        now
      });
    } catch (e) {
      stderr(e.message);
      if (env.WAS_DEBUG === '1') stderr(e.stack);
      hasError = true;
    }
  }

  if (hasError) return 1;
  if (conflictsCount > 0 && !args.uninstall) return 2;
  return 0;
}

if (import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then(code => process.exitCode = code).catch(err => {
    console.error(err.message);
    if (process.env.WAS_DEBUG === '1') console.error(err.stack);
    process.exitCode = 1;
  });
}
