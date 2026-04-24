import { Command } from 'commander';
import prompts from 'prompts';

import { applyInstallPlan, buildInstallPlan, renderInstallPlan, resolvePackageReference } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

type InstallOptions = {
  yes?: boolean;
  dryRun?: boolean;
};

export function registerInstallCommand(program: Command): void {
  program
    .command('install <packageRef>')
    .description('Install a package')
    .option('--yes', 'Skip confirmation prompt', false)
    .option('--dry-run', 'Only build and print install plan', false)
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
          scope: 'project'
        });

        process.stdout.write(`${renderInstallPlan(plan)}\n`);

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
          '  none'
        ];
        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Install failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
