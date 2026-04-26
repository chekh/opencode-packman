import path from 'node:path';

import fs from 'fs-extra';

import { readLockfile } from '../lock/lockfile.js';
import type { Lockfile } from '../lock/lockSchema.js';
import { readModelAliases } from '../model/modelAliases.js';
import {
  computeTargetChecksum,
  readProjectBaseline,
  type ProjectBaseline,
} from '../project/baseline.js';
import {
  getPathsByScope,
  type ProjectPaths,
  type Scope,
} from '../project/projectPaths.js';
import {
  createCheck,
  escalateCheck,
  resolveDoctorStatus,
  type DoctorCheck,
  type DoctorIssue,
  type DoctorReport,
} from './checks.js';

function isPathInsideRoot(projectRoot: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  );
}

function parseSkillRoot(
  paths: ProjectPaths,
  lockedPath: string,
): string | null {
  const absoluteTarget = path.resolve(paths.projectRoot, lockedPath);
  const skillsDir = path.resolve(paths.skillsDir);

  if (
    absoluteTarget !== skillsDir &&
    !absoluteTarget.startsWith(skillsDir + path.sep)
  ) {
    return null;
  }

  const relative = path
    .relative(skillsDir, absoluteTarget)
    .replaceAll('\\', '/');
  const skillName = relative.split('/')[0];
  if (!skillName || skillName === '..') {
    return null;
  }

  return path.join(skillsDir, skillName);
}

function formatIssueMessage(issue: DoctorIssue): string {
  return `${issue.code}: ${issue.message}`;
}

export async function runDoctor(
  projectRoot: string,
  scope?: Scope,
): Promise<DoctorReport> {
  const paths = getPathsByScope(projectRoot, scope ?? 'project');
  const issues: DoctorIssue[] = [];
  let opencodeJsonCheck: DoctorCheck = createCheck(
    'opencode_json',
    'opencode.json is present and valid',
  );
  let opencodeDirCheck: DoctorCheck = createCheck(
    'opencode_dir',
    '.opencode directory exists',
  );
  let lockfileCheck: DoctorCheck = createCheck(
    'lockfile',
    'lockfile exists and is valid',
  );
  let baselineCheck: DoctorCheck = createCheck(
    'baseline',
    'baseline exists and tracked files are unchanged',
  );
  let lockedTargetsCheck: DoctorCheck = createCheck(
    'locked_targets',
    'locked files and directories exist',
  );
  let lockedIntegrityCheck: DoctorCheck = createCheck(
    'locked_integrity',
    'locked files match install checksums',
  );
  let lockedSkillsCheck: DoctorCheck = createCheck(
    'locked_skills',
    'locked skills contain SKILL.md',
  );
  let packageEntriesCheck: DoctorCheck = createCheck(
    'package_entries',
    'package entries have owned targets',
  );
  let patchesCheck: DoctorCheck = createCheck(
    'patches',
    'patch targets are present',
  );
  let modelAliasesCheck: DoctorCheck = createCheck(
    'model_aliases',
    'model aliases referenced by installed packages are defined',
  );

  if (!(await fs.pathExists(paths.opencodeJsonPath))) {
    const issue: DoctorIssue = {
      severity: 'warning',
      code: 'missing_opencode_json',
      message: 'opencode.json is missing.',
      path: 'opencode.json',
      hint: 'run opm init or install a package',
    };
    issues.push(issue);
    opencodeJsonCheck = escalateCheck(
      opencodeJsonCheck,
      issue.severity,
      formatIssueMessage(issue),
    );
  } else {
    try {
      const content = await fs.readFile(paths.opencodeJsonPath, 'utf8');
      const parsed = JSON.parse(content) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        const issue: DoctorIssue = {
          severity: 'error',
          code: 'invalid_opencode_json_shape',
          message: 'opencode.json root value must be a JSON object.',
          path: 'opencode.json',
        };
        issues.push(issue);
        opencodeJsonCheck = escalateCheck(
          opencodeJsonCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
      }
    } catch {
      const issue: DoctorIssue = {
        severity: 'error',
        code: 'invalid_opencode_json',
        message: 'opencode.json cannot be parsed as JSON.',
        path: 'opencode.json',
      };
      issues.push(issue);
      opencodeJsonCheck = escalateCheck(
        opencodeJsonCheck,
        issue.severity,
        formatIssueMessage(issue),
      );
    }
  }

  if (!(await fs.pathExists(paths.opencodeDir))) {
    const issue: DoctorIssue = {
      severity: 'warning',
      code: 'missing_opencode_dir',
      message: '.opencode directory is missing.',
      path: '.opencode',
    };
    issues.push(issue);
    opencodeDirCheck = escalateCheck(
      opencodeDirCheck,
      issue.severity,
      formatIssueMessage(issue),
    );
  }

  const hasLockfile = await fs.pathExists(paths.lockfilePath);
  const hasPackmanDir = await fs.pathExists(paths.packmanDir);
  const hasBaseline = await fs.pathExists(paths.baselinePath);
  let lockfile: Lockfile | null = null;
  let baseline: ProjectBaseline | null = null;

  if (!hasLockfile) {
    const issue: DoctorIssue = {
      severity: 'warning',
      code: 'missing_lockfile',
      message: 'Lockfile is missing.',
      path: '.opencode-packman/lock.yaml',
      hint: 'no packages are tracked yet',
    };
    issues.push(issue);
    lockfileCheck = escalateCheck(
      lockfileCheck,
      issue.severity,
      formatIssueMessage(issue),
    );
  } else {
    try {
      lockfile = await readLockfile(paths.projectRoot);
    } catch {
      const issue: DoctorIssue = {
        severity: 'error',
        code: 'invalid_lockfile',
        message: 'Lockfile is invalid and cannot be parsed.',
        path: '.opencode-packman/lock.yaml',
      };
      issues.push(issue);
      lockfileCheck = escalateCheck(
        lockfileCheck,
        issue.severity,
        formatIssueMessage(issue),
      );
    }
  }

  if (!hasBaseline && (hasPackmanDir || hasLockfile)) {
    const issue: DoctorIssue = {
      severity: 'warning',
      code: 'missing_baseline',
      message: 'Baseline file is missing.',
      path: '.opencode-packman/baseline.yaml',
      hint: 'run opm init to create baseline snapshot',
    };
    issues.push(issue);
    baselineCheck = escalateCheck(
      baselineCheck,
      issue.severity,
      formatIssueMessage(issue),
    );
  }

  if (hasBaseline) {
    try {
      baseline = await readProjectBaseline(paths.projectRoot);
    } catch {
      const issue: DoctorIssue = {
        severity: 'error',
        code: 'invalid_baseline',
        message: 'Baseline file is invalid and cannot be parsed.',
        path: '.opencode-packman/baseline.yaml',
      };
      issues.push(issue);
      baselineCheck = escalateCheck(
        baselineCheck,
        issue.severity,
        formatIssueMessage(issue),
      );
    }
  }

  if (lockfile !== null) {
    const ownerByTarget = new Map<string, Set<string>>();

    for (const [relativeTarget, entry] of Object.entries(lockfile.files)) {
      const resolvedTarget = path.resolve(paths.projectRoot, relativeTarget);
      if (!isPathInsideRoot(paths.projectRoot, resolvedTarget)) {
        const issue: DoctorIssue = {
          severity: 'error',
          code: 'unsafe_locked_target',
          message: 'Locked target resolves outside project root.',
          path: relativeTarget,
        };
        issues.push(issue);
        lockedTargetsCheck = escalateCheck(
          lockedTargetsCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
        continue;
      }

      if (!(await fs.pathExists(resolvedTarget))) {
        const issue: DoctorIssue = {
          severity: 'error',
          code: 'missing_locked_target',
          message: 'File is tracked in lockfile but does not exist.',
          path: relativeTarget,
          hint: 'reinstall package or remove stale lockfile entry',
        };
        issues.push(issue);
        lockedTargetsCheck = escalateCheck(
          lockedTargetsCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
      } else if (entry.checksum !== undefined) {
        try {
          const currentChecksum = await computeTargetChecksum(resolvedTarget);
          if (currentChecksum !== entry.checksum) {
            const issue: DoctorIssue = {
              severity: 'warning',
              code: 'locked_target_modified',
              message: 'Installed file has been modified since install.',
              path: relativeTarget,
              hint: `expected ${entry.checksum}, got ${currentChecksum}`,
            };
            issues.push(issue);
            lockedIntegrityCheck = escalateCheck(
              lockedIntegrityCheck,
              issue.severity,
              formatIssueMessage(issue),
            );
          }
        } catch {
          const issue: DoctorIssue = {
            severity: 'warning',
            code: 'locked_target_checksum_error',
            message: 'Could not compute checksum for locked target.',
            path: relativeTarget,
          };
          issues.push(issue);
          lockedIntegrityCheck = escalateCheck(
            lockedIntegrityCheck,
            issue.severity,
            formatIssueMessage(issue),
          );
        }
      }

      const owners = ownerByTarget.get(relativeTarget) ?? new Set<string>();
      owners.add(entry.owner);
      ownerByTarget.set(relativeTarget, owners);

      const skillRoot = parseSkillRoot(paths, relativeTarget);
      if (skillRoot !== null) {
        const skillFile = path.join(skillRoot, 'SKILL.md');
        if (!(await fs.pathExists(skillFile))) {
          const issue: DoctorIssue = {
            severity: 'error',
            code: 'missing_skill_file',
            message: 'Locked skill directory does not contain SKILL.md.',
            path: path
              .relative(paths.projectRoot, skillRoot)
              .replaceAll('\\', '/'),
          };
          issues.push(issue);
          lockedSkillsCheck = escalateCheck(
            lockedSkillsCheck,
            issue.severity,
            formatIssueMessage(issue),
          );
        }
      }
    }

    for (const [target, patchEntries] of Object.entries(lockfile.patches)) {
      const owners = ownerByTarget.get(target) ?? new Set<string>();
      for (const patchEntry of patchEntries) {
        owners.add(patchEntry.owner);
      }
      ownerByTarget.set(target, owners);

      if (
        target === 'opencode.json' &&
        !(await fs.pathExists(paths.opencodeJsonPath))
      ) {
        const issue: DoctorIssue = {
          severity: 'warning',
          code: 'patch_target_missing',
          message: 'Patch target opencode.json is missing.',
          path: 'opencode.json',
        };
        issues.push(issue);
        patchesCheck = escalateCheck(
          patchesCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
      }
    }

    for (const [targetPath, owners] of ownerByTarget.entries()) {
      if (owners.size > 1) {
        const issue: DoctorIssue = {
          severity: 'error',
          code: 'duplicate_target_ownership',
          message: `Target is owned by multiple packages: ${Array.from(owners).join(', ')}`,
          path: targetPath,
        };
        issues.push(issue);
        packageEntriesCheck = escalateCheck(
          packageEntriesCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
      }
    }

    for (const packageName of Object.keys(lockfile.packages)) {
      const hasOwnedFile = Object.values(lockfile.files).some(
        (entry) => entry.owner === packageName,
      );
      const hasOwnedPatch = Object.values(lockfile.patches)
        .flatMap((patches) => patches)
        .some((patchEntry) => patchEntry.owner === packageName);

      if (!hasOwnedFile && !hasOwnedPatch) {
        const issue: DoctorIssue = {
          severity: 'warning',
          code: 'package_has_no_owned_targets',
          message: 'Package entry exists but has no owned files or patches.',
          path: `.opencode-packman/lock.yaml#packages.${packageName}`,
        };
        issues.push(issue);
        packageEntriesCheck = escalateCheck(
          packageEntriesCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
      }
    }
  }

  if (lockfile !== null) {
    const usedAliases = new Set<string>();
    for (const entry of Object.values(lockfile.files)) {
      if (entry.modelAlias !== undefined) {
        usedAliases.add(entry.modelAlias);
      }
    }

    if (usedAliases.size > 0) {
      let aliasConfig;
      try {
        aliasConfig = await readModelAliases();
      } catch {
        aliasConfig = null;
      }

      for (const alias of usedAliases) {
        if (aliasConfig === null || aliasConfig.aliases[alias] === undefined) {
          const issue: DoctorIssue = {
            severity: 'warning',
            code: 'unknown_model_alias',
            message: `Model alias '${alias}' is referenced by an installed package but not defined.`,
            hint: `run opm model set ${alias} <provider/model> to define it`,
          };
          issues.push(issue);
          modelAliasesCheck = escalateCheck(
            modelAliasesCheck,
            issue.severity,
            formatIssueMessage(issue),
          );
        }
      }
    }
  }

  if (baseline !== null) {
    const managedTargets = new Set<string>();
    if (lockfile !== null) {
      for (const lockedFilePath of Object.keys(lockfile.files)) {
        managedTargets.add(lockedFilePath);
      }
      for (const patchTargetPath of Object.keys(lockfile.patches)) {
        managedTargets.add(patchTargetPath);
      }
    }

    for (const [relativePath, baselineEntry] of Object.entries(
      baseline.files,
    )) {
      if (managedTargets.has(relativePath)) {
        continue;
      }

      const resolvedTarget = path.resolve(paths.projectRoot, relativePath);
      if (!isPathInsideRoot(paths.projectRoot, resolvedTarget)) {
        const issue: DoctorIssue = {
          severity: 'error',
          code: 'unsafe_baseline_target',
          message: 'Baseline target resolves outside project root.',
          path: relativePath,
        };
        issues.push(issue);
        baselineCheck = escalateCheck(
          baselineCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
        continue;
      }

      if (!(await fs.pathExists(resolvedTarget))) {
        const issue: DoctorIssue = {
          severity: 'warning',
          code: 'baseline_file_missing',
          message: 'Baseline file is missing from disk.',
          path: relativePath,
        };
        issues.push(issue);
        baselineCheck = escalateCheck(
          baselineCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
        continue;
      }

      const currentChecksum = await computeTargetChecksum(resolvedTarget);
      if (currentChecksum !== baselineEntry.checksum) {
        const issue: DoctorIssue = {
          severity: 'warning',
          code: 'baseline_file_modified',
          message:
            'Baseline file checksum differs from initialization snapshot.',
          path: relativePath,
          hint: `expected ${baselineEntry.checksum}, got ${currentChecksum}`,
        };
        issues.push(issue);
        baselineCheck = escalateCheck(
          baselineCheck,
          issue.severity,
          formatIssueMessage(issue),
        );
      }
    }
  }

  const orderedChecks: DoctorCheck[] = [
    opencodeJsonCheck,
    opencodeDirCheck,
    lockfileCheck,
    baselineCheck,
    lockedTargetsCheck,
    lockedIntegrityCheck,
    lockedSkillsCheck,
    packageEntriesCheck,
    patchesCheck,
    modelAliasesCheck,
  ];

  return {
    status: resolveDoctorStatus(issues),
    projectRoot: paths.projectRoot,
    checks: orderedChecks,
    issues,
  };
}
