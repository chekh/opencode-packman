import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { registerConfigCommands } from './commands/config.js';
import { registerCreateCommand } from './commands/create.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerInitCommand } from './commands/init.js';
import { registerInstallCommand } from './commands/install.js';
import { registerModelCommands } from './commands/model.js';
import { registerPackageCommands } from './commands/package.js';
import { registerPreviewCommand } from './commands/preview.js';
import { registerProjectCommands } from './commands/project.js';
import { registerRegistryCommands } from './commands/registry.js';
import { registerRemoveCommand } from './commands/remove.js';
import { registerSearchCommand } from './commands/search.js';

const DEFAULT_VERSION = '0.0.0';

async function resolveCliVersion(): Promise<string> {
  try {
    const packageJsonUrl = new URL('../package.json', import.meta.url);
    const packageJsonRaw = await readFile(packageJsonUrl, 'utf8');
    const packageJson = JSON.parse(packageJsonRaw) as { version?: unknown };

    return typeof packageJson.version === 'string'
      ? packageJson.version
      : DEFAULT_VERSION;
  } catch {
    return DEFAULT_VERSION;
  }
}

const program = new Command();
const cliVersion = await resolveCliVersion();

program
  .name('opm')
  .description('OpenCode package manager for local configuration packages')
  .version(cliVersion)
  .showHelpAfterError('(run with --help for usage)')
  .showSuggestionAfterError(true)
  .addHelpText(
    'after',
    `
Quick start:
  opm init
  opm project status
  opm create package demo-review --type bundle
  opm preview ./demo-review
  opm install ./demo-review --yes
  opm doctor
  opm config paths

Registry workflow:
  opm registry add personal ~/dev/opencode-packs
  opm registry packages personal
  opm search review
  opm install personal/backend-review --yes`,
  );

registerInitCommand(program);
registerProjectCommands(program);
registerCreateCommand(program);
registerPackageCommands(program);
registerPreviewCommand(program);
registerInstallCommand(program);
registerDoctorCommand(program);
registerRemoveCommand(program);
registerRegistryCommands(program);
registerSearchCommand(program);
registerConfigCommands(program);
registerModelCommands(program);

const rawArgv = process.argv.slice(2);
const argv = rawArgv[0] === '--' ? rawArgv.slice(1) : rawArgv;

if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
  program.outputHelp();
  process.exitCode = 0;
} else {
  await program.parseAsync(argv, { from: 'user' });
}
