import { Command } from 'commander';
import { registerCreateCommand } from './commands/create.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerInitCommand } from './commands/init.js';
import { registerInstallCommand } from './commands/install.js';
import { registerPreviewCommand } from './commands/preview.js';
import { registerRegistryCommands } from './commands/registry.js';
import { registerRemoveCommand } from './commands/remove.js';
import { registerSearchCommand } from './commands/search.js';

const program = new Command();

program
  .name('opm')
  .description('OpenCode package manager for local configuration packages')
  .version('0.0.0')
  .showHelpAfterError('(run with --help for usage)')
  .showSuggestionAfterError(true)
  .addHelpText(
    'after',
    `
Quick start:
  opm init
  opm create package demo-review --type bundle
  opm preview ./demo-review
  opm install ./demo-review --yes
  opm doctor

Registry workflow:
  opm registry add personal ~/dev/opencode-packs
  opm registry packages personal
  opm search review
  opm install personal/backend-review --yes`
  );

registerInitCommand(program);
registerCreateCommand(program);
registerPreviewCommand(program);
registerInstallCommand(program);
registerDoctorCommand(program);
registerRemoveCommand(program);
registerRegistryCommands(program);
registerSearchCommand(program);

const rawArgv = process.argv.slice(2);
const argv = rawArgv[0] === '--' ? rawArgv.slice(1) : rawArgv;

if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
  program.outputHelp();
  process.exitCode = 0;
} else {
  await program.parseAsync(argv, { from: 'user' });
}
