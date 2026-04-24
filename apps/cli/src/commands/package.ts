import path from 'node:path';

import { Command } from 'commander';

import {
  loadPackage,
  validatePackage,
  resolvePackageReference,
  createPackageScaffold,
  resolveCreatePackageTarget,
  publishPackage,
  type CreatePackageType
} from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

type CreateOptions = {
  type?: CreatePackageType;
  dir?: string;
  registry?: string;
  force?: boolean;
};

type PublishOptions = {
  registry: string;
  force?: boolean;
  as?: string;
};

export function registerPackageCommands(program: Command): void {
  const pkgCmd = program
    .command('package')
    .description('Package authoring commands')
    .addHelpText(
      'after',
      `
Examples:
  opm package create base-review
  opm package validate ./base-review
  opm package inspect ./base-review
  opm package publish ./base-review --registry personal`
    );

  pkgCmd
    .command('create <name>')
    .description('Create a new OpenCode package scaffold')
    .option('--type <type>', 'Scaffold type: skill|agent|command|bundle|profile', 'bundle')
    .option('--dir <path>', 'Parent directory for created package (default: current directory)')
    .option('--registry <name>', 'Create at <registry.path>/packages/<name>')
    .option('--force', 'Allow non-empty target directory', false)
    .action(async (name: string, options: CreateOptions) => {
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

        const createdFiles = createResult.filesCreated.map((fp) => path.relative(createResult.packageRoot, fp));
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
          lines.push(`  opm package publish ${createResult.packageRoot} --registry ${resolvedTarget.registryName}`);
        } else {
          lines.push(`  opm package validate ${createResult.packageRoot}`);
          lines.push(`  opm package publish ${createResult.packageRoot} --registry <registry>`);
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Create failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  pkgCmd
    .command('validate <packageRef>')
    .description('Load and validate a package, showing errors and warnings')
    .action(async (packageRef: string) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolved = await resolvePackageReference({ reference: packageRef, baseDir: invocationRoot });
        const loaded = await loadPackage(resolved.packageRoot);
        const result = await validatePackage(loaded);

        const lines: string[] = [
          `Package: ${loaded.manifest.name} v${loaded.manifest.version}`,
          `Path:    ${loaded.packageRoot}`,
          `Status:  ${result.ok ? 'valid' : 'invalid'}`
        ];

        if (result.errors.length > 0) {
          lines.push('', 'Errors:');
          for (const err of result.errors) {
            lines.push(`  [${err.code}] ${err.message}${err.path ? ` (${err.path})` : ''}`);
          }
        }

        if (result.warnings.length > 0) {
          lines.push('', 'Warnings:');
          for (const warn of result.warnings) {
            lines.push(`  [${warn.code}] ${warn.message}${warn.path ? ` (${warn.path})` : ''}`);
          }
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = result.ok ? 0 : 1;
      } catch (error) {
        process.stderr.write(`Validate failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  pkgCmd
    .command('inspect <packageRef>')
    .description('Show package manifest contents')
    .action(async (packageRef: string) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolved = await resolvePackageReference({ reference: packageRef, baseDir: invocationRoot });
        const loaded = await loadPackage(resolved.packageRoot);
        const m = loaded.manifest;

        const exportEntryNames = (entries: Array<{ name: string }> | undefined): string | null => {
          if (entries === undefined || entries.length === 0) return null;
          return entries.map((e) => e.name).join(', ');
        };

        const lines: string[] = [
          `Name:        ${m.name}`,
          `Version:     ${m.version}`,
          `Type:        ${m.type}`,
          ...(m.description !== undefined ? [`Description: ${m.description}`] : []),
          `Path:        ${loaded.packageRoot}`,
          '',
          'Exports:'
        ];

        const agentNames = exportEntryNames(m.exports.agents);
        const commandNames = exportEntryNames(m.exports.commands);
        const skillNames = exportEntryNames(m.exports.skills);
        const configCount = m.exports.config?.length ?? 0;

        const exportLines = [
          agentNames !== null ? `agents: ${agentNames}` : null,
          commandNames !== null ? `commands: ${commandNames}` : null,
          skillNames !== null ? `skills: ${skillNames}` : null,
          configCount > 0 ? `config patches: ${configCount}` : null
        ].filter((l): l is string => l !== null);

        if (exportLines.length === 0) {
          lines.push('  (none)');
        } else {
          lines.push(...exportLines.map((l) => `  ${l}`));
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Inspect failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  pkgCmd
    .command('publish <packagePath>')
    .description('Publish a package to a local registry')
    .requiredOption('--registry <name>', 'Target registry name')
    .option('--force', 'Overwrite if package already exists', false)
    .option('--as <name>', 'Publish under a different package name')
    .addHelpText(
      'after',
      `
Examples:
  opm package publish ./base-review --registry personal
  opm package publish ./base-review --registry personal --force
  opm package publish ./base-review --registry personal --as base-review-v2`
    )
    .action(async (packagePath: string, options: PublishOptions) => {
      try {
        const result = await publishPackage({
          packagePath,
          registryName: options.registry,
          ...(options.force === undefined ? {} : { force: options.force }),
          ...(options.as === undefined ? {} : { asName: options.as })
        });

        if (!result.ok) {
          process.stderr.write(`Publish failed: ${result.error}\n`);
          process.exitCode = 1;
          return;
        }

        const lines = [
          'Package published',
          '',
          `Name:     ${result.packageName}`,
          `Version:  ${result.version}`,
          `Registry: ${result.registryName}`,
          `Path:     ${result.targetDir}`,
          '',
          'Next:',
          `  opm install ${result.registryName}/${result.packageName} --yes`
        ];

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Publish failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
