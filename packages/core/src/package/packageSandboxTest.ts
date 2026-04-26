import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';

import { applyInstallPlan } from '../install/installer.js';
import { runDoctor } from '../doctor/doctor.js';
import { applyRemovePlan, buildRemovePlan } from '../remove/remover.js';
import { initProject } from '../project/initProject.js';
import { resolvePackageReference } from '../registry/registryResolver.js';
import { buildInstallPlan } from '../plan/planBuilder.js';
import { loadPackage } from './packageLoader.js';
import {
  validatePackage,
  type ValidationMessage,
  type ValidationResult,
} from './packageValidator.js';

export type PackageSandboxTestStepStatus = 'ok' | 'warning' | 'broken';

export type PackageSandboxTestStep = {
  stage: string;
  status: PackageSandboxTestStepStatus;
  message?: string;
};

export type PackageSandboxTestResult = {
  packageRef: string;
  packageRoot?: string;
  packageName?: string;
  packageVersion?: string;
  sandboxRoot?: string;
  validation?: ValidationResult;
  steps: PackageSandboxTestStep[];
  status: PackageSandboxTestStepStatus;
  errors: string[];
  warnings: ValidationMessage[];
};

async function createSandboxRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'opm-package-test-'));
}

function appendStep(
  steps: PackageSandboxTestStep[],
  stage: string,
  status: PackageSandboxTestStepStatus,
  message?: string,
): void {
  steps.push(
    message === undefined ? { stage, status } : { stage, status, message },
  );
}

function hasBrokenValidation(validation: ValidationResult): boolean {
  return validation.errors.length > 0;
}

export async function runPackageSandboxTest(input: {
  packageRef: string;
  baseDir?: string;
}): Promise<PackageSandboxTestResult> {
  const steps: PackageSandboxTestStep[] = [];
  const sandboxRoot = await createSandboxRoot();
  let packageRoot: string | undefined;
  let packageName: string | undefined;
  let packageVersion: string | undefined;
  let validation: ValidationResult | undefined;
  const warnings: ValidationMessage[] = [];
  const errors: string[] = [];

  function buildResult(
    status: PackageSandboxTestStepStatus,
  ): PackageSandboxTestResult {
    return {
      packageRef: input.packageRef,
      steps,
      status,
      errors,
      warnings,
      ...(packageRoot === undefined ? {} : { packageRoot }),
      ...(packageName === undefined ? {} : { packageName }),
      ...(packageVersion === undefined ? {} : { packageVersion }),
      ...(validation === undefined ? {} : { validation }),
      ...(sandboxRoot === undefined ? {} : { sandboxRoot }),
    };
  }

  try {
    const resolved =
      input.baseDir === undefined
        ? await resolvePackageReference({ reference: input.packageRef })
        : await resolvePackageReference({
            reference: input.packageRef,
            baseDir: input.baseDir,
          });
    packageRoot = resolved.packageRoot;

    const loaded = await loadPackage(packageRoot);
    packageName = loaded.manifest.name;
    packageVersion = loaded.manifest.version;

    validation = await validatePackage(loaded);
    warnings.push(...validation.warnings);
    appendStep(steps, 'validate package', validation.ok ? 'ok' : 'broken');
    if (hasBrokenValidation(validation)) {
      errors.push('Package validation failed.');
      return buildResult('broken');
    }

    await initProject(sandboxRoot);
    appendStep(steps, 'init sandbox', 'ok');

    const installPlan = await buildInstallPlan({
      packageRoot,
      projectRoot: sandboxRoot,
    });
    if (!installPlan.validation.ok || installPlan.conflicts.length > 0) {
      const detail =
        installPlan.conflicts.length > 0
          ? 'Install plan has conflicts.'
          : 'Install plan validation failed.';
      errors.push(detail);
      appendStep(steps, 'build install plan', 'broken', detail);
      return buildResult('broken');
    }
    appendStep(steps, 'build install plan', 'ok');

    const installResult = await applyInstallPlan(installPlan);
    if (!installResult.ok) {
      const detail = installResult.errors
        .map((error) => error.message)
        .join('; ');
      errors.push(detail);
      appendStep(steps, 'install package', 'broken', detail);
      return buildResult('broken');
    }
    appendStep(steps, 'install package', 'ok');

    const doctorBeforeRemove = await runDoctor(sandboxRoot);
    warnings.push(
      ...doctorBeforeRemove.issues.filter(
        (issue) => issue.severity === 'warning',
      ),
    );
    if (doctorBeforeRemove.status === 'broken') {
      const detail = 'Doctor failed before remove.';
      errors.push(detail);
      appendStep(steps, 'doctor before remove', 'broken', detail);
      return buildResult('broken');
    }
    appendStep(
      steps,
      'doctor before remove',
      doctorBeforeRemove.status === 'warning' ? 'warning' : 'ok',
    );

    const removePlan = await buildRemovePlan({
      projectRoot: sandboxRoot,
      packageName: loaded.manifest.name,
    });
    if (removePlan.errors.length > 0) {
      const detail = removePlan.errors.map((error) => error.message).join('; ');
      errors.push(detail);
      appendStep(steps, 'build remove plan', 'broken', detail);
      return buildResult('broken');
    }
    appendStep(steps, 'build remove plan', 'ok');

    const removeResult = await applyRemovePlan(removePlan);
    if (!removeResult.ok) {
      const detail = removeResult.errors
        .map((error) => error.message)
        .join('; ');
      errors.push(detail);
      appendStep(steps, 'remove package', 'broken', detail);
      return buildResult('broken');
    }
    appendStep(steps, 'remove package', 'ok');

    const doctorAfterRemove = await runDoctor(sandboxRoot);
    warnings.push(
      ...doctorAfterRemove.issues.filter(
        (issue) => issue.severity === 'warning',
      ),
    );
    if (doctorAfterRemove.status === 'broken') {
      const detail = 'Doctor failed after remove.';
      errors.push(detail);
      appendStep(steps, 'doctor after remove', 'broken', detail);
      return buildResult('broken');
    }
    appendStep(
      steps,
      'doctor after remove',
      doctorAfterRemove.status === 'warning' ? 'warning' : 'ok',
    );

    const status: PackageSandboxTestStepStatus =
      warnings.length > 0 || steps.some((step) => step.status === 'warning')
        ? 'warning'
        : 'ok';

    return buildResult(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    appendStep(steps, 'package sandbox test', 'broken', message);

    return buildResult('broken');
  } finally {
    await fs.remove(sandboxRoot);
  }
}
