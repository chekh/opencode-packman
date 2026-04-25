import { Command } from 'commander';

import { listModelAliases, removeModelAlias, setModelAlias } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

export function registerModelCommands(program: Command): void {
  const model = program
    .command('model')
    .description('Manage model aliases used by installed packages')
    .addHelpText(
      'after',
      `
Model alias config file:
  ~/.opencode-packman/model-aliases.yaml

Examples:
  opm model set reviewer openai/gpt-4o
  opm model list
  opm model remove reviewer`
    );

  model
    .command('set <alias> <model>')
    .description('Create or update a model alias')
    .addHelpText(
      'after',
      `
Arguments:
  alias  Short alias name used in package.yaml (e.g. reviewer)
  model  Provider/model string (e.g. openai/gpt-4o, anthropic/claude-3-5-sonnet)

Examples:
  opm model set reviewer openai/gpt-4o
  opm model set fast-agent anthropic/claude-3-5-haiku`
    )
    .action(async (alias: string, modelStr: string) => {
      try {
        const config = await setModelAlias({ alias, model: modelStr });
        const lines = [
          'Model alias set',
          '',
          `Alias: ${alias}`,
          `Model: ${config.aliases[alias] ?? modelStr}`,
          '',
          'Next:',
          '  opm model list'
        ];
        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Model set failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  model
    .command('list')
    .description('List all configured model aliases')
    .addHelpText(
      'after',
      `
Examples:
  opm model list`
    )
    .action(async () => {
      try {
        const config = await listModelAliases();
        const entries = Object.entries(config.aliases).sort(([a], [b]) => a.localeCompare(b));

        const lines = ['Model aliases', ''];
        if (entries.length === 0) {
          lines.push('none');
          process.stdout.write(`${lines.join('\n')}\n`);
          process.exitCode = 0;
          return;
        }

        for (const [alias, modelStr] of entries) {
          lines.push(`${alias}`);
          lines.push(`  Model: ${modelStr}`);
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Model list failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });

  model
    .command('remove <alias>')
    .description('Remove a model alias')
    .addHelpText(
      'after',
      `
Arguments:
  alias  Alias name to remove

Example:
  opm model remove reviewer`
    )
    .action(async (alias: string) => {
      try {
        await removeModelAlias({ alias });
        process.stdout.write(`Model alias removed\n\nAlias: ${alias}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Model remove failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
