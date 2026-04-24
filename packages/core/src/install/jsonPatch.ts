import path from 'node:path';
import fs from 'fs-extra';

import type { PatchJsonAction } from '../plan/installPlan.js';
import { isPathInsideRoot, isRealPathInsideRoot, validateWritablePathInsideRoot } from '../utils/pathSafety.js';

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
  sourceRoot?: string;
  action?: PatchJsonAction;
};

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const resolvedProjectRoot = path.resolve(input.projectRoot);
  const targetPath = path.resolve(input.targetPath);
  const patchFilePath = path.resolve(input.patchFilePath);
  const actionPart = input.action === undefined ? {} : { action: input.action };

  if (input.sourceRoot !== undefined) {
    if (!isPathInsideRoot(input.sourceRoot, patchFilePath)) {
      return {
        ok: false,
        ...actionPart,
        error: `Patch source is outside package root: ${patchFilePath}`
      };
    }

    if (!(await fs.pathExists(patchFilePath))) {
      return {
        ok: false,
        ...actionPart,
        error: `Patch source does not exist: ${patchFilePath}`
      };
    }

    if (!(await isRealPathInsideRoot(input.sourceRoot, patchFilePath))) {
      return {
        ok: false,
        ...actionPart,
        error: `Patch source points outside package root after resolving symlinks: ${patchFilePath}`
      };
    }
  }

  if (!isPathInsideRoot(input.projectRoot, targetPath)) {
    return {
      ok: false,
      ...actionPart,
      error: `Patch target is outside project root: ${targetPath}`
    };
  }

  if (targetPath === resolvedProjectRoot) {
    return {
      ok: false,
      ...actionPart,
      error: `Patch target resolves to project root and cannot be modified as JSON: ${targetPath}`
    };
  }

  const targetSafety = await validateWritablePathInsideRoot(input.projectRoot, targetPath);
  if (!targetSafety.ok) {
    return {
      ok: false,
      ...actionPart,
      error: `Unsafe patch target path: ${targetSafety.message}`
    };
  }

  try {
    const patchObject = await readJsonObject(patchFilePath);
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
