import path from 'node:path';

import { Command, InvalidArgumentError } from 'commander';

import {
  createPackageScaffold,
  resolveCreatePackageTarget,
  type CreatePackageType
} from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

type CreatePackageOptions = {
  type?: CreatePackageType;
  dir?: string;
  registry?: string;
  force?: boolean;
};

const ALLOWED_TYPES: CreatePackageType[] = ['skill', 'agent', 'command', 'bundle', 'profile'];

function parseCreateType(value: string): CreatePackageType {
  if ((ALLOWED_TYPES as string[]).includes(value)) {
    return value as CreatePackageType;
  }

  throw new InvalidArgumentError(`Invalid package type '${value}'. Allowed: ${ALLOWED_TYPES.join(', ')}`);
}

export function registerCreateCommand(program: Command): void {
  const create = program.command('create').description('Create package scaffolds');

  create
    .command('package <name>')
    .description('Create a new OpenCode package scaffold')
    .option('--type <type>', 'Package type', parseCreateType, 'bundle')
    .option('--dir <path>', 'Target parent directory')
    .option('--registry <name>', 'Create package under registry packages directory')
    .option('--force', 'Allow non-empty target directory', false)
    .action(async (name: string, options: CreatePackageOptions) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolvedTarget = await resolveCreatePackageTarget({
          name,
          baseDir: invocationRoot,
          ...(options.dir === undefined ? {} : { dir: options.dir }),
          ...(options.registry === undefined ? {} : { registryName: options.registry })
        });

        const createResult = await createPackageScaffold({
          name,
          type: options.type ?? 'bundle',
          targetDir: resolvedTarget.targetDir,
          ...(options.force === undefined ? {} : { force: options.force })
        });

        if (!createResult.ok) {
          for (const error of createResult.errors) {
            process.stderr.write(`Create failed: [${error.code}] ${error.message}${error.path ? ` (${error.path})` : ''}\n`);
          }
          process.exitCode = 1;
          return;
        }

        const createdFiles = createResult.filesCreated.map((filePath) => path.relative(createResult.packageRoot, filePath));
        const lines = [
          'Package scaffold created',
          '',
          `Name: ${createResult.packageName}`,
          `Type: ${options.type ?? 'bundle'}`,
          `Path: ${createResult.packageRoot}`,
          '',
          'Created:'
        ];

        if (createdFiles.length === 0) {
          lines.push('  none');
        } else {
          lines.push(...createdFiles.map((entry) => `  ${entry}`));
        }

        lines.push('', 'Next:');
        if (resolvedTarget.registryName !== undefined) {
          lines.push(`  opm preview ${resolvedTarget.registryName}/${createResult.packageName}`);
          lines.push(`  opm install ${resolvedTarget.registryName}/${createResult.packageName} --yes`);
        } else {
          lines.push(`  opm preview ${createResult.packageRoot}`);
          lines.push(`  opm install ${createResult.packageRoot} --yes`);
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Create failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
