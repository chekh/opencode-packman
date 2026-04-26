import path from 'node:path';

import { Command } from 'commander';

import {
  loadPackage,
  validatePackage,
  resolvePackageReference,
  createPackageScaffold,
  resolveCreatePackageTarget,
  publishPackage,
  runPackageSandboxTest,
  type CreatePackageType,
  type PackageManifest,
} from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';
import {
  printJson,
  formatValidationIssues,
  type CommandJsonResult,
} from './jsonOutput.js';

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

type ValidateOptions = {
  json?: boolean;
};

type InspectOptions = {
  json?: boolean;
};

type PackageInspectData = {
  packageRoot: string;
  manifest: {
    name: string;
    version: string;
    type: string;
    description?: string;
    exports: {
      agents?: Array<{ name: string; path: string; strategy: string }>;
      commands?: Array<{ name: string; path: string; strategy: string }>;
      skills?: Array<{ name: string; path: string; strategy: string }>;
      config?: Array<{ path: string; strategy: string }>;
    };
    metadata?: {
      author?: string;
      license?: string;
      tags?: string[];
    };
    compatibility?: {
      opencode?: string;
    };
    env?: {
      required?: string[];
      optional?: string[];
    };
    risk?: {
      level?: string;
    };
  };
  publish?: {
    status: 'published' | 'unpublished';
    registry?: string;
    publishedAt?: string;
  };
};

function buildInspectData(
  packageRoot: string,
  manifest: PackageManifest,
  publishedMeta?: { registryName: string; publishedAt: string } | undefined,
): PackageInspectData {
  const data: PackageInspectData = {
    packageRoot,
    manifest: {
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      exports: {},
    },
    publish: {
      status: publishedMeta !== undefined ? 'published' : 'unpublished',
    },
  };

  if (manifest.description !== undefined) {
    data.manifest.description = manifest.description;
  }

  if (
    manifest.exports.agents !== undefined &&
    manifest.exports.agents.length > 0
  ) {
    data.manifest.exports.agents = manifest.exports.agents.map((a) => ({
      name: a.name,
      path: a.path,
      strategy: a.strategy,
    }));
  }

  if (
    manifest.exports.commands !== undefined &&
    manifest.exports.commands.length > 0
  ) {
    data.manifest.exports.commands = manifest.exports.commands.map((c) => ({
      name: c.name,
      path: c.path,
      strategy: c.strategy,
    }));
  }

  if (
    manifest.exports.skills !== undefined &&
    manifest.exports.skills.length > 0
  ) {
    data.manifest.exports.skills = manifest.exports.skills.map((s) => ({
      name: s.name,
      path: s.path,
      strategy: s.strategy,
    }));
  }

  if (
    manifest.exports.config !== undefined &&
    manifest.exports.config.length > 0
  ) {
    data.manifest.exports.config = manifest.exports.config.map((c) => ({
      path: c.path,
      strategy: c.strategy,
    }));
  }

  if (manifest.metadata !== undefined) {
    data.manifest.metadata = {};
    if (manifest.metadata.author !== undefined) {
      data.manifest.metadata.author = manifest.metadata.author;
    }
    if (manifest.metadata.license !== undefined) {
      data.manifest.metadata.license = manifest.metadata.license;
    }
    if (
      manifest.metadata.tags !== undefined &&
      manifest.metadata.tags.length > 0
    ) {
      data.manifest.metadata.tags = manifest.metadata.tags;
    }
  }

  if (
    manifest.compatibility !== undefined &&
    manifest.compatibility.opencode !== undefined
  ) {
    data.manifest.compatibility = { opencode: manifest.compatibility.opencode };
  }

  if (manifest.env !== undefined) {
    data.manifest.env = {};
    if (
      manifest.env.required !== undefined &&
      manifest.env.required.length > 0
    ) {
      data.manifest.env.required = manifest.env.required;
    }
    if (
      manifest.env.optional !== undefined &&
      manifest.env.optional.length > 0
    ) {
      data.manifest.env.optional = manifest.env.optional;
    }
  }

  if (manifest.risk !== undefined && manifest.risk.level !== undefined) {
    data.manifest.risk = { level: manifest.risk.level };
  }

  if (publishedMeta !== undefined) {
    data.publish = {
      status: 'published',
      registry: publishedMeta.registryName,
      publishedAt: publishedMeta.publishedAt,
    };
  }

  return data;
}

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
  opm package publish ./base-review --registry personal`,
    );

  pkgCmd
    .command('create <name>')
    .description('Create a new OpenCode package scaffold')
    .option(
      '--type <type>',
      'Scaffold type: skill|agent|command|bundle|profile',
      'bundle',
    )
    .option(
      '--dir <path>',
      'Parent directory for created package (default: current directory)',
    )
    .option('--registry <name>', 'Create at <registry.path>/packages/<name>')
    .option('--force', 'Allow non-empty target directory', false)
    .action(async (name: string, options: CreateOptions) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolvedTarget = await resolveCreatePackageTarget({
          name,
          baseDir: invocationRoot,
          ...(options.dir === undefined ? {} : { dir: options.dir }),
          ...(options.registry === undefined
            ? {}
            : { registryName: options.registry }),
        });

        const createResult = await createPackageScaffold({
          name,
          type: options.type ?? 'bundle',
          targetDir: resolvedTarget.targetDir,
          ...(options.force === undefined ? {} : { force: options.force }),
        });

        if (!createResult.ok) {
          for (const error of createResult.errors) {
            process.stderr.write(
              `Create failed: [${error.code}] ${error.message}${error.path ? ` (${error.path})` : ''}\n`,
            );
          }
          process.exitCode = 1;
          return;
        }

        const createdFiles = createResult.filesCreated.map((fp) =>
          path.relative(createResult.packageRoot, fp),
        );
        const lines = [
          'Package scaffold created',
          '',
          `Name: ${createResult.packageName}`,
          `Type: ${options.type ?? 'bundle'}`,
          `Path: ${createResult.packageRoot}`,
          '',
          'Created:',
        ];

        if (createdFiles.length === 0) {
          lines.push('  none');
        } else {
          lines.push(...createdFiles.map((entry) => `  ${entry}`));
        }

        lines.push('', 'Next:');
        if (resolvedTarget.registryName !== undefined) {
          lines.push(
            `  opm package publish ${createResult.packageRoot} --registry ${resolvedTarget.registryName}`,
          );
        } else {
          lines.push(`  opm package validate ${createResult.packageRoot}`);
          lines.push(
            `  opm package publish ${createResult.packageRoot} --registry <registry>`,
          );
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
    .option('--json', 'Output as JSON', false)
    .action(async (packageRef: string, options: ValidateOptions) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolved = await resolvePackageReference({
          reference: packageRef,
          baseDir: invocationRoot,
        });
        const loaded = await loadPackage(resolved.packageRoot);
        const result = await validatePackage(loaded);

        if (options.json) {
          const jsonResult: CommandJsonResult<{
            packageRef: string;
            packageRoot: string;
            packageName: string;
            version: string;
            valid: boolean;
            errors: Array<{ code: string; message: string; path?: string }>;
            warnings: Array<{ code: string; message: string; path?: string }>;
          }> = {
            ok: result.ok,
            command: 'package validate',
            data: {
              packageRef,
              packageRoot: loaded.packageRoot,
              packageName: loaded.manifest.name,
              version: loaded.manifest.version,
              valid: result.ok,
              errors: result.errors,
              warnings: result.warnings,
            },
          };

          if (!result.ok) {
            jsonResult.issues = formatValidationIssues(
              result.errors,
              result.warnings,
            );
          }

          printJson(jsonResult);
          process.exitCode = result.ok ? 0 : 1;
          return;
        }

        const lines: string[] = [
          `Package: ${loaded.manifest.name} v${loaded.manifest.version}`,
          `Path:    ${loaded.packageRoot}`,
          `Status:  ${result.ok ? 'valid' : 'invalid'}`,
        ];

        if (result.errors.length > 0) {
          lines.push('', 'Errors:');
          for (const err of result.errors) {
            lines.push(
              `  [${err.code}] ${err.message}${err.path ? ` (${err.path})` : ''}`,
            );
          }
        }

        if (result.warnings.length > 0) {
          lines.push('', 'Warnings:');
          for (const warn of result.warnings) {
            lines.push(
              `  [${warn.code}] ${warn.message}${warn.path ? ` (${warn.path})` : ''}`,
            );
          }
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = result.ok ? 0 : 1;
      } catch (error) {
        if (options.json) {
          printJson({
            ok: false,
            command: 'package validate',
            issues: [
              {
                severity: 'error',
                code: 'validate_failed',
                message: toErrorMessage(error),
              },
            ],
          });
        } else {
          process.stderr.write(`Validate failed: ${toErrorMessage(error)}\n`);
        }
        process.exitCode = 1;
      }
    });

  pkgCmd
    .command('test <packageRef>')
    .description(
      'Run sandboxed OpenCode package test (validate -> init sandbox -> install -> doctor -> remove -> doctor)',
    )
    .action(async (packageRef: string) => {
      try {
        const baseDir = process.env.INIT_CWD ?? process.cwd();
        const result = await runPackageSandboxTest({ packageRef, baseDir });

        process.stdout.write(`Sandbox status: ${result.status}\n`);
        for (let i = 0; i < result.steps.length; i++) {
          const s = result.steps[i];
          if (s !== undefined) {
            process.stdout.write(`Step ${i + 1}: ${s.stage} - ${s.status}\n`);
          }
        }
        if (result.warnings.length > 0) {
          process.stdout.write('Warnings:\n');
          for (const w of result.warnings) {
            process.stdout.write(
              `- ${w.code}: ${w.message}${w.path ? ` (${w.path})` : ''}\n`,
            );
          }
        }
        if (result.errors.length > 0) {
          process.stdout.write('Errors:\n');
          for (const e of result.errors) {
            process.stdout.write(`- ${e}\n`);
          }
        }
        process.exitCode = result.status === 'broken' ? 1 : 0;
      } catch (error) {
        process.stderr.write(`Package test failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  pkgCmd
    .command('inspect <packageRef>')
    .description('Show package manifest contents')
    .option('--json', 'Output as JSON', false)
    .action(async (packageRef: string, options: InspectOptions) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const resolved = await resolvePackageReference({
          reference: packageRef,
          baseDir: invocationRoot,
        });
        const loaded = await loadPackage(resolved.packageRoot);
        const m = loaded.manifest;

        if (options.json) {
          const data = buildInspectData(loaded.packageRoot, m);
          printJson({
            ok: true,
            command: 'package inspect',
            data,
          });
          process.exitCode = 0;
          return;
        }

        const exportEntryNames = (
          entries: Array<{ name: string }> | undefined,
        ): string | null => {
          if (entries === undefined || entries.length === 0) return null;
          return entries.map((e) => e.name).join(', ');
        };

        const lines: string[] = [
          `Name:        ${m.name}`,
          `Version:     ${m.version}`,
          `Type:        ${m.type}`,
          ...(m.description !== undefined
            ? [`Description: ${m.description}`]
            : []),
          `Path:        ${loaded.packageRoot}`,
          '',
          'Exports:',
        ];

        const agentNames = exportEntryNames(m.exports.agents);
        const commandNames = exportEntryNames(m.exports.commands);
        const skillNames = exportEntryNames(m.exports.skills);
        const configCount = m.exports.config?.length ?? 0;

        const exportLines = [
          agentNames !== null ? `agents: ${agentNames}` : null,
          commandNames !== null ? `commands: ${commandNames}` : null,
          skillNames !== null ? `skills: ${skillNames}` : null,
          configCount > 0 ? `config patches: ${configCount}` : null,
        ].filter((l): l is string => l !== null);

        if (exportLines.length === 0) {
          lines.push('  (none)');
        } else {
          lines.push(...exportLines.map((l) => `  ${l}`));
        }

        if (m.metadata !== undefined) {
          lines.push('', 'Metadata:');
          if (m.metadata.author !== undefined)
            lines.push(`  Author:  ${m.metadata.author}`);
          if (m.metadata.license !== undefined)
            lines.push(`  License: ${m.metadata.license}`);
          if (m.metadata.tags !== undefined && m.metadata.tags.length > 0) {
            lines.push(`  Tags:    ${m.metadata.tags.join(', ')}`);
          }
        }

        if (
          m.compatibility !== undefined &&
          m.compatibility.opencode !== undefined
        ) {
          lines.push('', 'Compatibility:');
          lines.push(`  OpenCode: ${m.compatibility.opencode}`);
        }

        if (m.env !== undefined) {
          const reqVars = m.env.required ?? [];
          const optVars = m.env.optional ?? [];
          if (reqVars.length > 0 || optVars.length > 0) {
            lines.push('', 'Env:');
            if (reqVars.length > 0)
              lines.push(`  Required: ${reqVars.join(', ')}`);
            if (optVars.length > 0)
              lines.push(`  Optional: ${optVars.join(', ')}`);
          }
        }

        if (m.risk?.level !== undefined) {
          lines.push('', `Risk: ${m.risk.level}`);
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        if (options.json) {
          printJson({
            ok: false,
            command: 'package inspect',
            issues: [
              {
                severity: 'error',
                code: 'inspect_failed',
                message: toErrorMessage(error),
              },
            ],
          });
        } else {
          process.stderr.write(`Inspect failed: ${toErrorMessage(error)}\n`);
        }
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
  opm package publish ./base-review --registry personal --as base-review-v2`,
    )
    .action(async (packagePath: string, options: PublishOptions) => {
      try {
        const result = await publishPackage({
          packagePath,
          registryName: options.registry,
          ...(options.force === undefined ? {} : { force: options.force }),
          ...(options.as === undefined ? {} : { asName: options.as }),
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
          `  opm install ${result.registryName}/${result.packageName} --yes`,
        ];

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Publish failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
