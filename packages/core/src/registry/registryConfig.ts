import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import YAML from 'yaml';

import {
  registryConfigSchema,
  SUPPORTED_REGISTRY_SCHEMA,
  type RegistryConfig
} from './registrySchema.js';

export function getDefaultRegistryConfigPath(): string {
  return path.join(os.homedir(), '.opencode-packman', 'registries.yaml');
}

function emptyRegistryConfig(): RegistryConfig {
  return {
    schema: SUPPORTED_REGISTRY_SCHEMA,
    registries: {}
  };
}

export async function readRegistryConfig(configPath?: string): Promise<RegistryConfig> {
  const targetConfigPath = path.resolve(configPath ?? getDefaultRegistryConfigPath());
  if (!(await fs.pathExists(targetConfigPath))) {
    return emptyRegistryConfig();
  }

  const raw = await fs.readFile(targetConfigPath, 'utf8');
  const parsed = YAML.parse(raw);
  const validated = registryConfigSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid registry config format at ${targetConfigPath}`);
  }

  return validated.data;
}

export async function writeRegistryConfig(config: RegistryConfig, configPath?: string): Promise<void> {
  const targetConfigPath = path.resolve(configPath ?? getDefaultRegistryConfigPath());
  const validated = registryConfigSchema.safeParse(config);
  if (!validated.success) {
    throw new Error('Invalid registry config payload.');
  }

  await fs.ensureDir(path.dirname(targetConfigPath));
  await fs.writeFile(targetConfigPath, YAML.stringify(validated.data), 'utf8');
}

export async function addLocalRegistry(input: {
  name: string;
  path: string;
  configPath?: string;
  force?: boolean;
}): Promise<RegistryConfig> {
  const registryName = input.name.trim();
  if (registryName === '') {
    throw new Error('Registry name cannot be empty.');
  }

  const resolvedPath = path.resolve(input.path);
  if (!(await fs.pathExists(resolvedPath))) {
    throw new Error(`Registry path does not exist: ${resolvedPath}`);
  }

  const stat = await fs.stat(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Registry path must be a directory: ${resolvedPath}`);
  }

  const config = await readRegistryConfig(input.configPath);
  if (config.registries[registryName] !== undefined && !input.force) {
    throw new Error(`Registry '${registryName}' already exists. Use --force to overwrite.`);
  }

  config.registries[registryName] = {
    type: 'local',
    path: resolvedPath
  };

  await writeRegistryConfig(config, input.configPath);
  return config;
}

export async function removeRegistry(input: { name: string; configPath?: string }): Promise<RegistryConfig> {
  const registryName = input.name.trim();
  if (registryName === '') {
    throw new Error('Registry name cannot be empty.');
  }

  const config = await readRegistryConfig(input.configPath);
  if (config.registries[registryName] === undefined) {
    throw new Error(`Registry '${registryName}' does not exist.`);
  }

  delete config.registries[registryName];
  await writeRegistryConfig(config, input.configPath);
  return config;
}

export async function listRegistries(input?: { configPath?: string }): Promise<RegistryConfig> {
  return readRegistryConfig(input?.configPath);
}
