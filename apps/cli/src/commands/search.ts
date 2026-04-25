import { Command } from 'commander';

import { searchRegistryPackages } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

type SearchOptions = {
  tag?: string;
  type?: string;
};

export function registerSearchCommand(program: Command): void {
  program
    .command('search [query]')
    .description('Search packages across configured local registries')
    .option('--tag <tag>', 'Filter by tag (exact match)')
    .option('--type <type>', 'Filter by package type: skill|agent|command|bundle|profile')
    .addHelpText(
      'after',
      `
Arguments:
  query  Optional search text (case-insensitive).

Search fields:
  package folder name, description, type, and tags.

Examples:
  opm search
  opm search review
  opm search --tag review
  opm search --type bundle`
    )
    .action(async (query: string | undefined, options: SearchOptions) => {
      try {
        const normalizedQuery = query ?? '';
        const items = await searchRegistryPackages({
          query: normalizedQuery,
          ...(options.tag === undefined ? {} : { tag: options.tag }),
          ...(options.type === undefined ? {} : { typeFilter: options.type })
        });

        const filterParts: string[] = [];
        if (normalizedQuery !== '') filterParts.push(`query="${normalizedQuery}"`);
        if (options.tag !== undefined) filterParts.push(`tag="${options.tag}"`);
        if (options.type !== undefined) filterParts.push(`type="${options.type}"`);
        const filterLabel = filterParts.length > 0 ? filterParts.join(', ') : '(all)';

        const lines = ['Package search', '', `Filter: ${filterLabel}`, ''];
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
          lines.push(`  Type:    ${item.type}`);
          lines.push(`  Desc:    ${description}`);
          if (item.tags !== undefined && item.tags.length > 0) {
            lines.push(`  Tags:    ${item.tags.join(', ')}`);
          }
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
