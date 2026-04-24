import { Command } from 'commander';

const program = new Command();

program.name('opm').description('OpenCode package manager').version('0.0.0');

program.command('init').description('Initialize project layout').action(() => {
  process.stdout.write('init\n');
});

program
  .command('preview <packagePath>')
  .description('Preview package install plan')
  .action((packagePath) => {
    process.stdout.write(`preview ${packagePath}\n`);
  });

program
  .command('install <packagePath>')
  .description('Install a package')
  .action((packagePath) => {
    process.stdout.write(`install ${packagePath}\n`);
  });

program
  .command('remove <packageName>')
  .description('Remove an installed package')
  .action((packageName) => {
    process.stdout.write(`remove ${packageName}\n`);
  });

program.command('doctor').description('Check project health').action(() => {
  process.stdout.write('doctor\n');
});

program.parse(process.argv.slice(2));
process.exitCode = 0;
