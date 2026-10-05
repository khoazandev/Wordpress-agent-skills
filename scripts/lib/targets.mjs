import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const VALID_AGENTS = ['antigravity', 'claude', 'codex'];

export function resolveInstallTargets(options = {}) {
  const env = options.env || process.env;
  const homeDir = options.homeDir || env.WAS_HOME || os.homedir();
  const exists = options.exists || fs.existsSync;
  const projectPath = options.projectPath ? path.resolve(options.projectPath) : null;
  
  let reqAgents = options.agents || VALID_AGENTS;
  if (typeof reqAgents === 'string') {
    reqAgents = reqAgents.split(',');
  }
  
  const requestedAgents = reqAgents
    .map(a => a.trim().toLowerCase())
    .filter(Boolean);
    
  for (const agent of requestedAgents) {
    if (!VALID_AGENTS.includes(agent)) {
      throw new Error(`Unknown agent: ${agent}. Valid agents are: ${VALID_AGENTS.join(', ')}`);
    }
  }

  const targetsByPath = new Map();

  for (const agent of requestedAgents) {
    let targetDir = null;

    if (projectPath) {
      if (agent === 'antigravity' || agent === 'codex') {
        targetDir = path.join(projectPath, '.agents', 'skills');
      } else if (agent === 'claude') {
        targetDir = path.join(projectPath, '.claude', 'skills');
      }
    } else {
      if (agent === 'antigravity') {
        if (env.ANTIGRAVITY_SKILLS_DIR) {
          targetDir = path.resolve(env.ANTIGRAVITY_SKILLS_DIR);
        } else {
          const configDir = path.join(homeDir, '.gemini', 'config');
          if (exists(configDir)) {
            targetDir = path.join(configDir, 'skills');
          } else {
            targetDir = path.join(homeDir, '.gemini', 'antigravity', 'skills');
          }
        }
      } else if (agent === 'claude') {
        const claudeHome = env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
        targetDir = path.join(claudeHome, 'skills');
      } else if (agent === 'codex') {
        const codexHome = env.CODEX_HOME || path.join(homeDir, '.codex');
        targetDir = path.join(codexHome, 'skills');
      }
    }

    if (targetDir) {
      const normalized = path.resolve(targetDir);
      if (!targetsByPath.has(normalized)) {
        targetsByPath.set(normalized, {
          agents: [agent],
          scope: projectPath ? 'project' : 'global',
          targetDir: normalized
        });
      } else {
        targetsByPath.get(normalized).agents.push(agent);
      }
    }
  }

  return Array.from(targetsByPath.values());
}

export function pluginInstallPaths(options = {}) {
  const env = options.env || process.env;
  const homeDir = options.homeDir || env.WAS_HOME || os.homedir();
  const claudeHome = env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
  return {
    antigravity: path.join(homeDir, '.gemini', 'config', 'plugins', 'wordpress-agent-skills', 'plugin.json'),
    claudePluginsDir: path.join(claudeHome, 'plugins')
  };
}
