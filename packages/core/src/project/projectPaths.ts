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
};

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
    lockfilePath: path.join(packmanDir, 'lock.yaml')
  };
}
