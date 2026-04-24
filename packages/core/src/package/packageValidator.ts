import path from 'node:path';
import fs from 'fs-extra';
import YAML, { YAMLParseError } from 'yaml';

import type { LoadedPackage } from './packageLoader.js';
import type { ExportStrategy } from './packageSchema.js';

export type ValidationMessage = {
  code: string;
  message: string;
  path?: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
};

function isAllowedStrategy(strategy: ExportStrategy, allowed: Array<'add' | 'replace' | 'patch'>): boolean {
  return allowed.includes(strategy);
}

function addError(
  errors: ValidationMessage[],
  code: string,
  message: string,
  targetPath?: string
): void {
  errors.push(targetPath === undefined ? { code, message } : { code, message, path: targetPath });
}

function parseSkillFrontmatter(raw: string): { name?: unknown; description?: unknown } | null {
  const frontmatterMatch = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(raw);
  if (frontmatterMatch === null) {
    return null;
  }

  const frontmatterBody = frontmatterMatch[1];
  if (frontmatterBody === undefined) {
    return null;
  }

  const parsed = YAML.parse(frontmatterBody);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  return parsed as { name?: unknown; description?: unknown };
}

export async function validatePackage(pkg: LoadedPackage): Promise<ValidationResult> {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const exportsConfig = pkg.manifest.exports;

  for (const agentExport of exportsConfig.agents ?? []) {
    const absolutePath = path.resolve(pkg.packageRoot, agentExport.path);
    const exists = await fs.pathExists(absolutePath);
    if (!exists) {
      addError(errors, 'EXPORT_PATH_MISSING', `Agent export path does not exist: ${agentExport.path}`, absolutePath);
      continue;
    }

    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      addError(errors, 'AGENT_NOT_FILE', `Agent export must point to a file: ${agentExport.path}`, absolutePath);
    }

    if (!isAllowedStrategy(agentExport.strategy, ['add', 'replace'])) {
      addError(
        errors,
        'INVALID_STRATEGY',
        `Agent strategy must be add or replace, got: ${agentExport.strategy}`,
        absolutePath
      );
    }
  }

  for (const commandExport of exportsConfig.commands ?? []) {
    const absolutePath = path.resolve(pkg.packageRoot, commandExport.path);
    const exists = await fs.pathExists(absolutePath);
    if (!exists) {
      addError(
        errors,
        'EXPORT_PATH_MISSING',
        `Command export path does not exist: ${commandExport.path}`,
        absolutePath
      );
      continue;
    }

    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      addError(errors, 'COMMAND_NOT_FILE', `Command export must point to a file: ${commandExport.path}`, absolutePath);
    }

    if (!isAllowedStrategy(commandExport.strategy, ['add', 'replace'])) {
      addError(
        errors,
        'INVALID_STRATEGY',
        `Command strategy must be add or replace, got: ${commandExport.strategy}`,
        absolutePath
      );
    }
  }

  for (const skillExport of exportsConfig.skills ?? []) {
    const absolutePath = path.resolve(pkg.packageRoot, skillExport.path);
    const exists = await fs.pathExists(absolutePath);
    if (!exists) {
      addError(errors, 'EXPORT_PATH_MISSING', `Skill export path does not exist: ${skillExport.path}`, absolutePath);
      continue;
    }

    const stat = await fs.stat(absolutePath);
    if (!stat.isDirectory()) {
      addError(
        errors,
        'SKILL_NOT_DIRECTORY',
        `Skill export must point to a directory: ${skillExport.path}`,
        absolutePath
      );
      continue;
    }

    const skillManifestPath = path.join(absolutePath, 'SKILL.md');
    const skillManifestExists = await fs.pathExists(skillManifestPath);
    if (!skillManifestExists) {
      addError(errors, 'SKILL_MISSING_SKILL_MD', `Skill directory must contain SKILL.md: ${skillExport.path}`, absolutePath);
    } else {
      try {
        const rawSkillManifest = await fs.readFile(skillManifestPath, 'utf8');
        const frontmatter = parseSkillFrontmatter(rawSkillManifest);
        if (frontmatter === null) {
          addError(
            errors,
            'SKILL_INVALID_FRONTMATTER',
            `SKILL.md must contain YAML frontmatter with name and description: ${skillExport.path}`,
            skillManifestPath
          );
        } else {
          const nameValue = frontmatter.name;
          const descriptionValue = frontmatter.description;

          if (typeof nameValue !== 'string' || nameValue.trim() === '') {
            addError(
              errors,
              'SKILL_FRONTMATTER_NAME_REQUIRED',
              `SKILL.md frontmatter must define non-empty 'name': ${skillExport.path}`,
              skillManifestPath
            );
          }

          if (typeof descriptionValue !== 'string' || descriptionValue.trim() === '') {
            addError(
              errors,
              'SKILL_FRONTMATTER_DESCRIPTION_REQUIRED',
              `SKILL.md frontmatter must define non-empty 'description': ${skillExport.path}`,
              skillManifestPath
            );
          }
        }
      } catch (error) {
        if (error instanceof YAMLParseError) {
          addError(
            errors,
            'SKILL_INVALID_FRONTMATTER',
            `SKILL.md frontmatter is invalid YAML: ${skillExport.path}`,
            skillManifestPath
          );
        } else {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to read SKILL.md at '${skillManifestPath}': ${message}`);
        }
      }
    }

    if (!isAllowedStrategy(skillExport.strategy, ['add', 'replace'])) {
      addError(
        errors,
        'INVALID_STRATEGY',
        `Skill strategy must be add or replace, got: ${skillExport.strategy}`,
        absolutePath
      );
    }
  }

  for (const configExport of exportsConfig.config ?? []) {
    const absolutePath = path.resolve(pkg.packageRoot, configExport.path);
    const exists = await fs.pathExists(absolutePath);
    if (!exists) {
      addError(errors, 'EXPORT_PATH_MISSING', `Config export path does not exist: ${configExport.path}`, absolutePath);
      continue;
    }

    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      addError(errors, 'CONFIG_NOT_FILE', `Config export must point to a JSON file: ${configExport.path}`, absolutePath);
      continue;
    }

    if (path.extname(absolutePath).toLowerCase() !== '.json') {
      addError(errors, 'CONFIG_NOT_JSON_FILE', `Config export must point to a .json file: ${configExport.path}`, absolutePath);
      continue;
    }

    try {
      const rawConfig = await fs.readFile(absolutePath, 'utf8');
      const parsedConfig = JSON.parse(rawConfig) as unknown;
      const isObject = typeof parsedConfig === 'object' && parsedConfig !== null && !Array.isArray(parsedConfig);
      if (!isObject) {
        addError(
          errors,
          'CONFIG_JSON_NOT_OBJECT',
          `Config export JSON must be an object (not array): ${configExport.path}`,
          absolutePath
        );
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        addError(errors, 'CONFIG_JSON_INVALID', `Config export JSON is invalid: ${configExport.path}`, absolutePath);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read config export file '${absolutePath}': ${message}`);
      }
    }

    if (!isAllowedStrategy(configExport.strategy, ['patch'])) {
      addError(
        errors,
        'INVALID_STRATEGY',
        `Config strategy must be patch, got: ${configExport.strategy}`,
        absolutePath
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
