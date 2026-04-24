import path from 'node:path';

import fs from 'fs-extra';
import { Command } from 'commander';

import {
  addLocalRegistry,
  listRegistries,
  listRegistryPackages,
  removeRegistry,
  type RegistryPackageSummary
} from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

type RegistryAddOptions = {
  force?: boolean;
};

export function registerRegistryCommands(program: Command): void {
  const registry = program.command('registry').description('Manage local package registries');

  registry
    .command('add <name> <registryPath>')
    .description('Add local registry')
    .option('--force', 'Overwrite registry when name already exists', false)
    .action(async (name: string, registryPath: string, options: RegistryAddOptions) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolvedPath = path.resolve(invocationRoot, registryPath);

        const addInput = {
          name,
          path: resolvedPath,
          ...(options.force === undefined ? {} : { force: options.force })
        };

        const config = await addLocalRegistry(addInput);

        const packagesDir = path.join(resolvedPath, 'packages');
        const hasPackagesDir = await fs.pathExists(packagesDir);

        const lines = [
          'Registry added',
          '',
          `Name: ${name}`,
          'Type: local',
          `Path: ${config.registries[name]?.path ?? resolvedPath}`,
          '',
          'Next:',
          '  opm registry list',
          `  opm install ${name}/backend-review --yes`
        ];

        if (!hasPackagesDir) {
          lines.push('', 'Warning:', `  packages/ directory was not found at ${packagesDir}`);
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Registry add failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  registry
    .command('list')
    .description('List configured registries')
    .action(async () => {
      try {
        const config = await listRegistries();
        const names = Object.keys(config.registries).sort();

        const lines = ['Registries', ''];
        if (names.length === 0) {
          lines.push('none');
          process.stdout.write(`${lines.join('\n')}\n`);
          process.exitCode = 0;
          return;
        }

        for (const name of names) {
          const entry = config.registries[name];
          if (entry === undefined) {
            continue;
          }

          lines.push(name);
          lines.push(`  Type: ${entry.type}`);
          lines.push(`  Path: ${entry.path}`);
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Registry list failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  registry
    .command('remove <name>')
    .description('Remove configured registry')
    .action(async (name: string) => {
      try {
        await removeRegistry({ name });
        process.stdout.write(`Registry removed\n\nName: ${name}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Registry remove failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  registry
    .command('packages <name>')
    .description('List packages in a registry')
    .action(async (name: string) => {
      try {
        const packages = await listRegistryPackages({ registryName: name });
        const lines = ['Registry packages', '', `Registry: ${name}`, ''];

        if (packages.length === 0) {
          lines.push('none');
          process.stdout.write(`${lines.join('\n')}\n`);
          process.exitCode = 0;
          return;
        }

        for (const item of packages) {
          lines.push(renderPackageItem(item));
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Registry packages failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}

function renderPackageItem(item: RegistryPackageSummary): string {
  const description = item.description === undefined || item.description.trim() === '' ? 'n/a' : item.description;
  return [
    item.packageName,
    `  Version: ${item.version}`,
    `  Type: ${item.type}`,
    `  Description: ${description}`,
    `  Install: opm install ${item.registryName}/${item.packageName} --yes`,
    ''
  ].join('\n');
}
