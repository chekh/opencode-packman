export function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes('package.yaml not found')) {
    return `${raw}\nHint: pass a package folder that contains package.yaml.`;
  }

  if (raw.includes('Invalid package.yaml format')) {
    return `${raw}\nHint: validate package.yaml fields against docs/reference/package-format.md.`;
  }

  if (raw.includes('Invalid YAML')) {
    return `${raw}\nHint: fix YAML syntax in package.yaml.`;
  }

  if (raw.includes('Unsupported package schema')) {
    return `${raw}\nHint: use schema opencode-packman/package/v1.`;
  }

  if (raw.includes('Invalid lockfile format')) {
    return `${raw}\nHint: remove or fix .opencode-packman/lock.yaml.`;
  }

  if (raw.includes('Invalid registry config format')) {
    return `${raw}\nHint: remove or fix ~/.opencode-packman/registries.yaml.`;
  }

  if (raw.includes('Unknown registry')) {
    return `${raw}\nHint: add it with 'opm registry add <name> <path>' or run 'opm registry list'.`;
  }

  if (raw.includes('already exists. Use --force')) {
    return `${raw}\nHint: rerun with --force to overwrite the registry entry.`;
  }

  if (raw.includes('Cannot resolve package reference')) {
    return `${raw}\nHint: use an existing path or a <registry>/<package> reference.`;
  }

  return raw;
}
