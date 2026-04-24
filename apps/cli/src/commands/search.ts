import { Command } from 'commander';

import { searchRegistryPackages } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search [query]')
    .description('Search packages across configured local registries')
    .action(async (query?: string) => {
      try {
        const normalizedQuery = query ?? '';
        const items = await searchRegistryPackages({ query: normalizedQuery });

        const lines = ['Package search', '', `Query: ${normalizedQuery === '' ? '(all)' : normalizedQuery}`, ''];
        if (items.length === 0) {
          lines.push('No packages found.');
          process.stdout.write(`${lines.join('\n')}\n`);
          process.exitCode = 0;
          return;
        }

        for (const item of items) {
          const description = item.description === undefined || item.description.trim() === '' ? 'n/a' : item.description;
          lines.push(`${item.registryName}/${item.packageName}`);
          lines.push(`  Version: ${item.version}`);
          lines.push(`  Type: ${item.type}`);
          lines.push(`  Description: ${description}`);
          lines.push(`  Install: opm install ${item.registryName}/${item.packageName} --yes`);
          lines.push('');
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Search failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
