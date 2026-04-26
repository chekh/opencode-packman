import os from 'node:os';
import path from 'node:path';

export type ProjectPaths = {
  projectRoot: string;
  opencodeJsonPath: string;
  opencodeDir: string;
  agentsDir: string;
  commandsDir: string;
  skillsDir: string;
  packmanDir: string;
  lockfilePath: string;
  baselinePath: string;
};

export type Scope = 'project' | 'global';

export function getProjectPaths(projectRoot: string): ProjectPaths {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const opencodeDir = path.join(resolvedProjectRoot, '.opencode');
  const packmanDir = path.join(resolvedProjectRoot, '.opencode-packman');

  return {
    projectRoot: resolvedProjectRoot,
    opencodeJsonPath: path.join(resolvedProjectRoot, 'opencode.json'),
    opencodeDir,
    agentsDir: path.join(opencodeDir, 'agents'),
    commandsDir: path.join(opencodeDir, 'commands'),
    skillsDir: path.join(opencodeDir, 'skills'),
    packmanDir,
    lockfilePath: path.join(packmanDir, 'lock.yaml'),
    baselinePath: path.join(packmanDir, 'baseline.yaml'),
  };
}

export function getGlobalPaths(): ProjectPaths {
  const globalRoot = path.join(os.homedir(), '.config', 'opencode');
  const packmanDir = path.join(globalRoot, '.opencode-packman');

  return {
    projectRoot: globalRoot,
    opencodeJsonPath: path.join(globalRoot, 'opencode.json'),
    opencodeDir: globalRoot,
    agentsDir: path.join(globalRoot, 'agents'),
    commandsDir: path.join(globalRoot, 'commands'),
    skillsDir: path.join(globalRoot, 'skills'),
    packmanDir,
    lockfilePath: path.join(packmanDir, 'lock.yaml'),
    baselinePath: path.join(packmanDir, 'baseline.yaml'),
  };
}

export function getPathsByScope(cwd: string, scope: Scope): ProjectPaths {
  return scope === 'global' ? getGlobalPaths() : getProjectPaths(cwd);
}
