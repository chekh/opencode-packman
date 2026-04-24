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

program.name('opm').description('OpenCode package manager').version('0.0.0');

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

if (argv.includes('--help') || argv.includes('-h')) {
  program.outputHelp();
  process.exitCode = 0;
} else {
  await program.parseAsync(argv, { from: 'user' });
}
