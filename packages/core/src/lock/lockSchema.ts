import { z } from 'zod';

export const SUPPORTED_LOCK_SCHEMA = 'opencode-packman/lock/v1';

export const lockPackageEntrySchema = z.object({
  version: z.string(),
  source: z.string(),
  installedAt: z.string(),
  scope: z.enum(['project', 'global']),
});

export const lockFileOwnerEntrySchema = z.object({
  owner: z.string(),
  version: z.string(),
  strategy: z.enum(['add', 'replace']),
  checksum: z.string().optional(),
  modelAlias: z.string().optional(),
  resolvedModel: z.string().optional(),
});

export const lockPatchEntrySchema = z.object({
  owner: z.string(),
  version: z.string(),
  patchFile: z.string(),
});

export const lockfileSchema = z.object({
  schema: z.literal(SUPPORTED_LOCK_SCHEMA),
  packages: z.record(z.string(), lockPackageEntrySchema),
  files: z.record(z.string(), lockFileOwnerEntrySchema),
  patches: z.record(z.string(), z.array(lockPatchEntrySchema)),
});

export type LockPackageEntry = z.infer<typeof lockPackageEntrySchema>;
export type LockFileOwnerEntry = z.infer<typeof lockFileOwnerEntrySchema>;
export type LockPatchEntry = z.infer<typeof lockPatchEntrySchema>;
export type Lockfile = z.infer<typeof lockfileSchema>;
