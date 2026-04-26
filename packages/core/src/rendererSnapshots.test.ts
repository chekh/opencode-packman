import { describe, expect, it } from 'vitest';

import { renderInstallPlan } from './diff/diffRenderer.js';
import { renderDoctorReport } from './doctor/doctorRenderer.js';
import {
  renderRemovePlan,
  renderRemoveResult,
} from './remove/removeRenderer.js';
import type { DoctorReport } from './doctor/checks.js';
import type { InstallPlan } from './plan/installPlan.js';
import type { RemovePlan, RemoveResult } from './remove/remover.js';

describe('renderer snapshots', () => {
  it('renderInstallPlan snapshot for healthy preview', () => {
    const plan: InstallPlan = {
      packageName: 'backend-review',
      packageVersion: '0.1.0',
      packageRoot: '/packages/backend-review',
      projectRoot: '/project',
      scope: 'project',
      actions: [
        {
          type: 'copyFile',
          from: '/packages/backend-review/commands/review.md',
          to: '/project/.opencode/commands/review.md',
          strategy: 'add',
          objectType: 'command',
          objectName: 'review',
        },
        {
          type: 'copyFile',
          from: '/packages/backend-review/agents/code-reviewer.md',
          to: '/project/.opencode/agents/code-reviewer.md',
          strategy: 'replace',
          objectType: 'agent',
          objectName: 'code-reviewer',
        },
        {
          type: 'copyDirectory',
          from: '/packages/backend-review/skills/api-review',
          to: '/project/.opencode/skills/api-review',
          strategy: 'replace',
          objectType: 'skill',
          objectName: 'api-review',
        },
        {
          type: 'patchJson',
          from: '/packages/backend-review/opencode.patch.json',
          to: '/project/opencode.json',
          strategy: 'patch',
          objectType: 'config',
        },
      ],
      conflicts: [],
      warnings: [],
      validation: {
        ok: true,
        errors: [],
        warnings: [],
      },
    };

    expect(renderInstallPlan(plan)).toMatchInlineSnapshot(`
      "Install preview

      Package: backend-review@0.1.0
      Scope: project

      Will add:
        .opencode/commands/review.md

      Will replace:
        .opencode/agents/code-reviewer.md
        .opencode/skills/api-review/

      Will patch:
        opencode.json <- opencode.patch.json

      Conflicts:
        none

      Validation:
        OK"
    `);
  });

  it('renderInstallPlan snapshot with conflicts', () => {
    const plan: InstallPlan = {
      packageName: 'backend-review',
      packageVersion: '0.1.0',
      packageRoot: '/packages/backend-review',
      projectRoot: '/project',
      scope: 'project',
      actions: [],
      conflicts: [
        {
          code: 'ADD_TARGET_EXISTS',
          message:
            'Target already exists for add strategy: .opencode/commands/review.md',
          path: '/project/.opencode/commands/review.md',
        },
      ],
      warnings: [],
      validation: {
        ok: true,
        errors: [],
        warnings: [],
      },
    };

    expect(renderInstallPlan(plan)).toMatchInlineSnapshot(`
      "Install preview

      Package: backend-review@0.1.0
      Scope: project

      Will add:
        none

      Will replace:
        none

      Will patch:
        none

      Conflicts:
        Target already exists for add strategy: .opencode/commands/review.md

      Validation:
        OK"
    `);
  });

  it('renderDoctorReport snapshot for healthy report', () => {
    const report: DoctorReport = {
      status: 'healthy',
      projectRoot: '/project',
      checks: [
        { code: 'opencode_json', label: 'opencode.json exists', status: 'ok' },
        {
          code: 'opencode_dir',
          label: '.opencode directory exists',
          status: 'ok',
        },
        { code: 'lockfile', label: 'lockfile exists', status: 'ok' },
      ],
      issues: [],
    };

    expect(renderDoctorReport(report)).toMatchInlineSnapshot(`
      "Doctor report

      Status: healthy

      Checks:
        OK       opencode.json exists
        OK       .opencode directory exists
        OK       lockfile exists

      Issues:
        none"
    `);
  });

  it('renderDoctorReport snapshot for broken missing locked target', () => {
    const report: DoctorReport = {
      status: 'broken',
      projectRoot: '/project',
      checks: [
        { code: 'opencode_json', label: 'opencode.json exists', status: 'ok' },
        {
          code: 'locked_targets',
          label: 'locked files exist',
          status: 'error',
          message: 'missing_locked_target',
        },
      ],
      issues: [
        {
          severity: 'error',
          code: 'missing_locked_target',
          message: 'File is tracked in lockfile but does not exist.',
          path: '.opencode/agents/code-reviewer.md',
          hint: 'reinstall package or remove stale lockfile entry',
        },
      ],
    };

    expect(renderDoctorReport(report)).toMatchInlineSnapshot(`
      "Doctor report

      Status: broken

      Checks:
        OK       opencode.json exists
        ERROR    missing_locked_target

      Issues:
        ERROR missing_locked_target
          Path: .opencode/agents/code-reviewer.md
          File is tracked in lockfile but does not exist.
          Hint: reinstall package or remove stale lockfile entry"
    `);
  });

  it('renderRemovePlan snapshot with manual patch notice', () => {
    const plan: RemovePlan = {
      packageName: 'backend-review',
      projectRoot: '/project',
      actions: [
        {
          type: 'deleteFile',
          path: '/project/.opencode/agents/code-reviewer.md',
        },
        { type: 'deleteFile', path: '/project/.opencode/commands/review.md' },
        {
          type: 'deleteDirectory',
          path: '/project/.opencode/skills/api-review',
        },
        {
          type: 'manualPatchNotice',
          target: 'opencode.json',
          message: 'Patch target opencode.json was modified by this package.',
        },
      ],
      warnings: [],
      errors: [],
    };

    expect(renderRemovePlan(plan)).toMatchInlineSnapshot(`
      "Remove preview

      Package: backend-review

      Will delete files:
        .opencode/agents/code-reviewer.md
        .opencode/commands/review.md

      Will delete directories:
        .opencode/skills/api-review/

      Manual steps:
        opencode.json was patched by this package.
        Automatic JSON patch rollback is not available in MVP.
        Review opencode.json manually.

      Warnings:
        none

      Errors:
        none"
    `);
  });

  it('renderRemoveResult snapshot with JSON patch warning', () => {
    const result: RemoveResult = {
      ok: true,
      packageName: 'backend-review',
      actionsApplied: [
        {
          type: 'deleteFile',
          path: '/project/.opencode/agents/code-reviewer.md',
        },
        {
          type: 'deleteDirectory',
          path: '/project/.opencode/skills/api-review',
        },
        {
          type: 'manualPatchNotice',
          target: 'opencode.json',
          message: 'Patch target opencode.json was modified by this package.',
        },
      ],
      filesDeleted: ['.opencode/agents/code-reviewer.md'],
      directoriesDeleted: ['.opencode/skills/api-review'],
      warnings: [
        {
          code: 'manual_patch_notice',
          message: 'Patch target opencode.json was modified by this package.',
          path: 'opencode.json',
        },
      ],
      errors: [],
    };

    expect(renderRemoveResult(result)).toMatchInlineSnapshot(`
      "Remove result

      Package: backend-review
      Status: removed

      Deleted files: 1
      Deleted directories: 1

      Warnings:
        [manual_patch_notice] Patch target opencode.json was modified by this package.
        JSON patches were not automatically reverted.
        Please review opencode.json manually.

      Errors:
        none"
    `);
  });
});
