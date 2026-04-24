import path from 'node:path';
import fs from 'fs-extra';

import type { PatchJsonAction } from '../plan/installPlan.js';

type JsonObject = Record<string, unknown>;

export type JsonPatchResult = {
  ok: boolean;
  action?: PatchJsonAction;
  written?: string[];
  error?: string;
};

export type ApplyJsonPatchFileInput = {
  projectRoot: string;
  targetPath: string;
  patchFilePath: string;
  action?: PatchJsonAction;
};

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPathInsideRoot(projectRoot: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

export async function readJsonObject(filePath: string): Promise<JsonObject> {
  const parsed = await fs.readJson(filePath);
  if (!isPlainObject(parsed)) {
    throw new Error(`JSON file must contain an object: ${filePath}`);
  }
  return parsed;
}

export async function writeJsonObject(filePath: string, value: JsonObject): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function deepMergeJsonObjects(base: JsonObject, patch: JsonObject): JsonObject {
  const result: JsonObject = { ...base };

  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = result[key];
    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      result[key] = deepMergeJsonObjects(baseValue, patchValue);
      continue;
    }

    result[key] = patchValue;
  }

  return result;
}

export async function applyJsonPatchFile(input: ApplyJsonPatchFileInput): Promise<JsonPatchResult> {
  const targetPath = path.resolve(input.targetPath);
  const actionPart = input.action === undefined ? {} : { action: input.action };
  if (!isPathInsideRoot(input.projectRoot, targetPath)) {
    return {
      ok: false,
      ...actionPart,
      error: `Patch target is outside project root: ${targetPath}`
    };
  }

  try {
    const patchObject = await readJsonObject(path.resolve(input.patchFilePath));
    let baseObject: JsonObject = {};

    if (await fs.pathExists(targetPath)) {
      baseObject = await readJsonObject(targetPath);
    }

    const merged = deepMergeJsonObjects(baseObject, patchObject);
    await writeJsonObject(targetPath, merged);

    return {
      ok: true,
      ...actionPart,
      written: [targetPath]
    };
  } catch (error) {
    return {
      ok: false,
      ...actionPart,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
