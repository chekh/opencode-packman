import { Command } from 'commander';
import { buildInstallPlan, listModelAliases, renderInstallPlan, resolvePackageReference } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

export function registerPreviewCommand(program: Command): void {
  program
    .command('preview <packageRef>')
    .description('Show install plan without writing files')
    .option('--global', 'Preview install into global OpenCode config (~/.config/opencode)', false)
    .addHelpText(
      'after',
      `
Arguments:
  packageRef  Package folder path or registry reference (<registry>/<package>)

Examples:
  opm preview ./examples/packages/backend-review
  opm preview personal/backend-review
  opm preview personal/backend-review --global

Notes:
  This command never writes files.`
    )
    .action(async (packageRef: string, options: { global?: boolean }) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolved = await resolvePackageReference({
          reference: packageRef,
          baseDir: invocationRoot
        });
        const plan = await buildInstallPlan({
          packageRoot: resolved.packageRoot,
          projectRoot: invocationRoot,
          scope: options.global ? 'global' : 'project'
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
