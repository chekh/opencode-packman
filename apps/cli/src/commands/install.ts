import { Command } from 'commander';
import prompts from 'prompts';

import {
  applyInstallPlan,
  buildInstallPlan,
  listModelAliases,
  renderInstallPlan,
  resolvePackageReference
} from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

type InstallOptions = {
  yes?: boolean;
  dryRun?: boolean;
  reinstall?: boolean;
  global?: boolean;
};

export function registerInstallCommand(program: Command): void {
  program
    .command('install <packageRef>')
    .description('Install package into current project scope')
    .option('--yes', 'Skip confirmation prompt and apply immediately', false)
    .option('--dry-run', 'Only print install preview without changes', false)
    .option('--reinstall', 'Re-install package, treating owned add targets as replace', false)
    .option('--global', 'Install into global OpenCode config (~/.config/opencode)', false)
    .addHelpText(
      'after',
      `
Arguments:
  packageRef  Package folder path or registry reference (<registry>/<package>)

Examples:
  opm install ./examples/packages/backend-review --yes
  opm install personal/backend-review --dry-run
  opm install personal/backend-review --yes
  opm install personal/backend-review --global --yes

Notes:
  Always review preview output before applying in real projects.`
    )
    .action(async (packageRef: string, options: InstallOptions) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolved = await resolvePackageReference({
          reference: packageRef,
          baseDir: invocationRoot
        });
        const plan = await buildInstallPlan({
          packageRoot: resolved.packageRoot,
          projectRoot: invocationRoot,
          scope: options.global ? 'global' : 'project',
          ...(options.reinstall === true ? { reinstall: true } : {})
        });

        let aliasMap: Record<string, string> | undefined;
        try {
          const aliasConfig = await listModelAliases();
          aliasMap = aliasConfig.aliases;
        } catch {
          // non-fatal: preview renders without alias resolution
        }

        process.stdout.write(`${renderInstallPlan(plan, aliasMap)}\n`);

        if (!plan.validation.ok || plan.conflicts.length > 0) {
          process.stderr.write('Install aborted: plan has validation errors or conflicts.\n');
          for (const error of plan.validation.errors) {
            process.stderr.write(`- validation: ${error.message}${error.path ? ` (${error.path})` : ''}\n`);
          }
          for (const conflict of plan.conflicts) {
            process.stderr.write(`- conflict: ${conflict.message}${conflict.path ? ` (${conflict.path})` : ''}\n`);
          }
          process.exitCode = 1;
          return;
        }

        if (options.dryRun) {
          process.exitCode = 0;
          return;
        }

        if (options.global) {
          process.stdout.write('⚠ This will modify your global OpenCode config at ~/.config/opencode\n\n');
        }

        if (!options.yes) {
          const answer = await prompts({
            type: 'confirm',
            name: 'confirmInstall',
            message: `Install ${plan.packageName}@${plan.packageVersion} into ${plan.projectRoot}?`,
            initial: true
          });

          if (!answer.confirmInstall) {
            process.stderr.write('Installation cancelled.\n');
            process.exitCode = 1;
            return;
          }
        }

        const installResult = await applyInstallPlan(plan);
        if (!installResult.ok) {
          for (const error of installResult.errors) {
            process.stderr.write(`Install error: ${error.message}${error.path ? ` (${error.path})` : ''}\n`);
          }
          process.exitCode = 1;
          return;
        }

        const warningLines =
          plan.warnings.length > 0
            ? plan.warnings.map((w) => `  [${w.code}] ${w.message}${w.path ? ` (${w.path})` : ''}`)
            : ['  none'];

        const lines = [
          'Install result',
          '',
          `Package: ${installResult.packageName}@${installResult.packageVersion}`,
          'Status: installed',
          '',
          `Files written: ${installResult.filesWritten.length}`,
          `Patches applied: ${installResult.patchesApplied.length}`,
          'Lockfile: .opencode-packman/lock.yaml',
          '',
          'Warnings:',
          ...warningLines
        ];
        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Install failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
