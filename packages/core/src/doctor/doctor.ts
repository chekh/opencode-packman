import path from 'node:path';

import fs from 'fs-extra';

import { readLockfile } from '../lock/lockfile.js';
import type { Lockfile } from '../lock/lockSchema.js';
import { getProjectPaths } from '../project/projectPaths.js';
import {
  createCheck,
  escalateCheck,
  resolveDoctorStatus,
  type DoctorCheck,
  type DoctorIssue,
  type DoctorReport
} from './checks.js';

function isPathInsideRoot(projectRoot: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function parseSkillRoot(projectRoot: string, lockedPath: string): string | null {
  const relative = path.relative(path.resolve(projectRoot), path.resolve(projectRoot, lockedPath)).replaceAll('\\', '/');
  const parts = relative.split('/');
  const dotIndex = parts.findIndex((part) => part === '.opencode');
  if (dotIndex < 0 || parts[dotIndex + 1] !== 'skills') {
    return null;
  }

  const skillName = parts[dotIndex + 2];
  if (!skillName) {
    return null;
  }

  return path.resolve(projectRoot, '.opencode', 'skills', skillName);
}

function formatIssueMessage(issue: DoctorIssue): string {
  return `${issue.code}: ${issue.message}`;
}

function looksLikeSkillLockedPath(lockedPath: string): boolean {
  const normalized = lockedPath.replaceAll('\\', '/');
  return normalized.startsWith('.opencode/skills/') || normalized.includes('/.opencode/skills/');
}

export async function runDoctor(projectRoot: string): Promise<DoctorReport> {
  const paths = getProjectPaths(projectRoot);
  const issues: DoctorIssue[] = [];
  let opencodeJsonCheck: DoctorCheck = createCheck('opencode_json', 'opencode.json is present and valid');
  let opencodeDirCheck: DoctorCheck = createCheck('opencode_dir', '.opencode directory exists');
  let lockfileCheck: DoctorCheck = createCheck('lockfile', 'lockfile exists and is valid');
  let lockedTargetsCheck: DoctorCheck = createCheck('locked_targets', 'locked files and directories exist');
  let lockedSkillsCheck: DoctorCheck = createCheck('locked_skills', 'locked skills contain SKILL.md');
  let packageEntriesCheck: DoctorCheck = createCheck('package_entries', 'package entries have owned targets');
  let patchesCheck: DoctorCheck = createCheck('patches', 'patch targets are present');

  if (!(await fs.pathExists(paths.opencodeJsonPath))) {
    const issue: DoctorIssue = {
      severity: 'warning',
      code: 'missing_opencode_json',
      message: 'opencode.json is missing.',
      path: 'opencode.json',
      hint: 'run opm init or install a package'
    };
    issues.push(issue);
    opencodeJsonCheck = escalateCheck(opencodeJsonCheck, issue.severity, formatIssueMessage(issue));
  } else {
    try {
      const content = await fs.readFile(paths.opencodeJsonPath, 'utf8');
      const parsed = JSON.parse(content) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        const issue: DoctorIssue = {
          severity: 'error',
          code: 'invalid_opencode_json_shape',
          message: 'opencode.json root value must be a JSON object.',
          path: 'opencode.json'
        };
        issues.push(issue);
        opencodeJsonCheck = escalateCheck(opencodeJsonCheck, issue.severity, formatIssueMessage(issue));
      }
    } catch {
      const issue: DoctorIssue = {
        severity: 'error',
        code: 'invalid_opencode_json',
        message: 'opencode.json cannot be parsed as JSON.',
        path: 'opencode.json'
      };
      issues.push(issue);
      opencodeJsonCheck = escalateCheck(opencodeJsonCheck, issue.severity, formatIssueMessage(issue));
    }
  }

  if (!(await fs.pathExists(paths.opencodeDir))) {
    const issue: DoctorIssue = {
      severity: 'warning',
      code: 'missing_opencode_dir',
      message: '.opencode directory is missing.',
      path: '.opencode'
    };
    issues.push(issue);
    opencodeDirCheck = escalateCheck(opencodeDirCheck, issue.severity, formatIssueMessage(issue));
  }

  const hasLockfile = await fs.pathExists(paths.lockfilePath);
  let lockfile: Lockfile | null = null;

  if (!hasLockfile) {
    const issue: DoctorIssue = {
      severity: 'warning',
      code: 'missing_lockfile',
      message: 'Lockfile is missing.',
      path: '.opencode-packman/lock.yaml',
      hint: 'no packages are tracked yet'
    };
    issues.push(issue);
    lockfileCheck = escalateCheck(lockfileCheck, issue.severity, formatIssueMessage(issue));
  } else {
    try {
      lockfile = await readLockfile(paths.projectRoot);
    } catch {
      const issue: DoctorIssue = {
        severity: 'error',
        code: 'invalid_lockfile',
        message: 'Lockfile is invalid and cannot be parsed.',
        path: '.opencode-packman/lock.yaml'
      };
      issues.push(issue);
      lockfileCheck = escalateCheck(lockfileCheck, issue.severity, formatIssueMessage(issue));
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
          path: relativeTarget
        };
        issues.push(issue);
        lockedTargetsCheck = escalateCheck(lockedTargetsCheck, issue.severity, formatIssueMessage(issue));
        continue;
      }

      if (!(await fs.pathExists(resolvedTarget))) {
        const issue: DoctorIssue = {
          severity: 'error',
          code: 'missing_locked_target',
          message: 'File is tracked in lockfile but does not exist.',
          path: relativeTarget,
          hint: 'reinstall package or remove stale lockfile entry'
        };
        issues.push(issue);
        lockedTargetsCheck = escalateCheck(lockedTargetsCheck, issue.severity, formatIssueMessage(issue));
      }

      const owners = ownerByTarget.get(relativeTarget) ?? new Set<string>();
      owners.add(entry.owner);
      ownerByTarget.set(relativeTarget, owners);

      if (looksLikeSkillLockedPath(relativeTarget)) {
        const skillRoot = parseSkillRoot(paths.projectRoot, relativeTarget);
        if (skillRoot !== null) {
          const skillFile = path.join(skillRoot, 'SKILL.md');
          if (!(await fs.pathExists(skillFile))) {
            const issue: DoctorIssue = {
              severity: 'error',
              code: 'missing_skill_file',
              message: 'Locked skill directory does not contain SKILL.md.',
              path: path.relative(paths.projectRoot, skillRoot).replaceAll('\\', '/')
            };
            issues.push(issue);
            lockedSkillsCheck = escalateCheck(lockedSkillsCheck, issue.severity, formatIssueMessage(issue));
          }
        }
      }
    }

    for (const [target, patchEntries] of Object.entries(lockfile.patches)) {
      const owners = ownerByTarget.get(target) ?? new Set<string>();
      for (const patchEntry of patchEntries) {
        owners.add(patchEntry.owner);
      }
      ownerByTarget.set(target, owners);

      if (target === 'opencode.json' && !(await fs.pathExists(paths.opencodeJsonPath))) {
        const issue: DoctorIssue = {
          severity: 'warning',
          code: 'patch_target_missing',
          message: 'Patch target opencode.json is missing.',
          path: 'opencode.json'
        };
        issues.push(issue);
        patchesCheck = escalateCheck(patchesCheck, issue.severity, formatIssueMessage(issue));
      }
    }

    for (const [targetPath, owners] of ownerByTarget.entries()) {
      if (owners.size > 1) {
        const issue: DoctorIssue = {
          severity: 'error',
          code: 'duplicate_target_ownership',
          message: `Target is owned by multiple packages: ${Array.from(owners).join(', ')}`,
          path: targetPath
        };
        issues.push(issue);
        packageEntriesCheck = escalateCheck(packageEntriesCheck, issue.severity, formatIssueMessage(issue));
      }
    }

    for (const packageName of Object.keys(lockfile.packages)) {
      const hasOwnedFile = Object.values(lockfile.files).some((entry) => entry.owner === packageName);
      const hasOwnedPatch = Object.values(lockfile.patches)
        .flatMap((patches) => patches)
        .some((patchEntry) => patchEntry.owner === packageName);

      if (!hasOwnedFile && !hasOwnedPatch) {
        const issue: DoctorIssue = {
          severity: 'warning',
          code: 'package_has_no_owned_targets',
          message: 'Package entry exists but has no owned files or patches.',
          path: `.opencode-packman/lock.yaml#packages.${packageName}`
        };
        issues.push(issue);
        packageEntriesCheck = escalateCheck(packageEntriesCheck, issue.severity, formatIssueMessage(issue));
      }
    }
  }

  const orderedChecks: DoctorCheck[] = [
    opencodeJsonCheck,
    opencodeDirCheck,
    lockfileCheck,
    lockedTargetsCheck,
    lockedSkillsCheck,
    packageEntriesCheck,
    patchesCheck
  ];

  return {
    status: resolveDoctorStatus(issues),
    projectRoot: paths.projectRoot,
    checks: orderedChecks,
    issues
  };
}
