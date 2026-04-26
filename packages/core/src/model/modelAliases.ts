import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import YAML from 'yaml';

import {
  modelAliasConfigSchema,
  SUPPORTED_MODEL_ALIAS_SCHEMA,
  type ModelAliasConfig,
} from './modelAliasSchema.js';

export function getDefaultModelAliasesPath(configPath?: string): string {
  return (
    configPath ??
    path.join(os.homedir(), '.opencode-packman', 'model-aliases.yaml')
  );
}

function emptyModelAliasConfig(): ModelAliasConfig {
  return {
    schema: SUPPORTED_MODEL_ALIAS_SCHEMA,
    aliases: {},
  };
}

export async function readModelAliases(
  configPath?: string,
): Promise<ModelAliasConfig> {
  const targetPath = getDefaultModelAliasesPath(configPath);
  if (!(await fs.pathExists(targetPath))) {
    return emptyModelAliasConfig();
  }

  const raw = await fs.readFile(targetPath, 'utf8');
  const parsed = YAML.parse(raw);
  const validated = modelAliasConfigSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid model aliases config at ${targetPath}`);
  }

  return validated.data;
}

export async function writeModelAliases(
  config: ModelAliasConfig,
  configPath?: string,
): Promise<void> {
  const targetPath = getDefaultModelAliasesPath(configPath);
  const validated = modelAliasConfigSchema.safeParse(config);
  if (!validated.success) {
    throw new Error('Invalid model aliases config payload.');
  }

  await fs.ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, YAML.stringify(validated.data), 'utf8');
}

export async function setModelAlias(input: {
  alias: string;
  model: string;
  configPath?: string;
}): Promise<ModelAliasConfig> {
  const alias = input.alias.trim();
  if (alias === '') {
    throw new Error('Alias name cannot be empty.');
  }

  const model = input.model.trim();
  if (model === '') {
    throw new Error('Model string cannot be empty.');
  }

  const config = await readModelAliases(input.configPath);
  config.aliases[alias] = model;
  await writeModelAliases(config, input.configPath);
  return config;
}

export async function removeModelAlias(input: {
  alias: string;
  configPath?: string;
}): Promise<ModelAliasConfig> {
  const alias = input.alias.trim();
  if (alias === '') {
    throw new Error('Alias name cannot be empty.');
  }

  const config = await readModelAliases(input.configPath);
  if (config.aliases[alias] === undefined) {
    throw new Error(`Model alias '${alias}' does not exist.`);
  }

  delete config.aliases[alias];
  await writeModelAliases(config, input.configPath);
  return config;
}

export async function listModelAliases(input?: {
  configPath?: string;
}): Promise<ModelAliasConfig> {
  return readModelAliases(input?.configPath);
}

export function extractAliasName(model: string): string | undefined {
  if (!model.startsWith('alias:')) {
    return undefined;
  }
  const name = model.slice('alias:'.length).trim();
  return name === '' ? undefined : name;
}
