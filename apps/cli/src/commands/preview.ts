import { Command } from 'commander';
import { buildInstallPlan, renderInstallPlan, resolvePackageReference } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

export function registerPreviewCommand(program: Command): void {
  program
    .command('preview <packageRef>')
    .description('Preview package install plan')
    .action(async (packageRef: string) => {
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
          process.stderr.write('Preview found problems and cannot continue.\n');
          for (const error of plan.validation.errors) {
            process.stderr.write(`- validation: ${error.message}${error.path ? ` (${error.path})` : ''}\n`);
          }
          for (const conflict of plan.conflicts) {
            process.stderr.write(`- conflict: ${conflict.message}${conflict.path ? ` (${conflict.path})` : ''}\n`);
          }
          process.exitCode = 1;
          return;
        }

        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Preview failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
