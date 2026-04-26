import crypto from 'node:crypto';
import path from 'node:path';

import fs from 'fs-extra';
import YAML from 'yaml';
import { z } from 'zod';

import { getProjectPaths, type ProjectPaths } from './projectPaths.js';

export const SUPPORTED_BASELINE_SCHEMA = 'opencode-packman/baseline/v1';

const baselineEntrySchema = z.object({
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

const baselineSchema = z.object({
  schema: z.literal(SUPPORTED_BASELINE_SCHEMA),
  createdAt: z.string(),
  files: z.record(z.string(), baselineEntrySchema),
});

export type ProjectBaseline = z.infer<typeof baselineSchema>;

async function listFilesRecursively(rootDir: string): Promise<string[]> {
  if (!(await fs.pathExists(rootDir))) {
    return [];
  }

  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isFile()) {
        results.push(entryPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

export async function computeFileChecksum(filePath: string): Promise<string> {
  const fileContent = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
  return `sha256:${hash}`;
}

export async function computeDirectoryChecksum(
  dirPath: string,
): Promise<string> {
  const absoluteFiles = await listFilesRecursively(dirPath);
  absoluteFiles.sort();

  const hasher = crypto.createHash('sha256');
  for (const filePath of absoluteFiles) {
    const relPath = path.relative(dirPath, filePath).replaceAll('\\', '/');
    const content = await fs.readFile(filePath);
    const fileHash = crypto.createHash('sha256').update(content).digest('hex');
    hasher.update(`${relPath}:${fileHash}\n`);
  }

  return `sha256:${hasher.digest('hex')}`;
}

export async function computeTargetChecksum(
  targetPath: string,
): Promise<string> {
  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    return computeDirectoryChecksum(targetPath);
  }

  return computeFileChecksum(targetPath);
}

export async function createProjectBaseline(
  paths: ProjectPaths,
): Promise<ProjectBaseline> {
  const candidateFiles = [
    paths.opencodeJsonPath,
    ...(await listFilesRecursively(paths.agentsDir)),
    ...(await listFilesRecursively(paths.commandsDir)),
    ...(await listFilesRecursively(paths.skillsDir)),
  ];

  const files: Record<string, { checksum: string }> = {};
  for (const absoluteFile of candidateFiles.sort()) {
    if (!(await fs.pathExists(absoluteFile))) {
      continue;
    }

    const relativePath = path
      .relative(paths.projectRoot, absoluteFile)
      .replaceAll('\\', '/');
    files[relativePath] = {
      checksum: await computeFileChecksum(absoluteFile),
    };
  }

  return {
    schema: SUPPORTED_BASELINE_SCHEMA,
    createdAt: new Date().toISOString(),
    files,
  };
}

export async function readProjectBaseline(
  projectRoot: string,
): Promise<ProjectBaseline | null> {
  const { baselinePath } = getProjectPaths(projectRoot);
  if (!(await fs.pathExists(baselinePath))) {
    return null;
  }

  const raw = await fs.readFile(baselinePath, 'utf8');
  const parsed = YAML.parse(raw);
  const validated = baselineSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid baseline format at ${baselinePath}`);
  }

  return validated.data;
}

export async function writeProjectBaseline(
  projectRoot: string,
  baseline: ProjectBaseline,
): Promise<void> {
  const { packmanDir, baselinePath } = getProjectPaths(projectRoot);
  const validated = baselineSchema.safeParse(baseline);
  if (!validated.success) {
    throw new Error('Invalid baseline payload.');
  }

  await fs.ensureDir(packmanDir);
  await fs.writeFile(baselinePath, YAML.stringify(validated.data), 'utf8');
}
