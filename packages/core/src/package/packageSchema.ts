import { z } from 'zod';

export const SUPPORTED_PACKAGE_SCHEMA = 'opencode-packman/package/v1';

export const packageTypeSchema = z.enum([
  'skill',
  'agent',
  'command',
  'bundle',
  'profile',
]);
export const exportStrategySchema = z.enum(['add', 'replace', 'patch']);

const namedExportSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  strategy: exportStrategySchema,
  model: z.string().min(1).optional(),
});

const configExportSchema = z.object({
  path: z.string().min(1),
  strategy: exportStrategySchema,
});

const packageMetadataSchema = z.object({
  tags: z.array(z.string().min(1)).optional(),
  author: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
});

const packageCompatibilitySchema = z.object({
  opencode: z.string().min(1).optional(),
});

const packageEnvSchema = z.object({
  required: z.array(z.string().min(1)).optional(),
  optional: z.array(z.string().min(1)).optional(),
});

const packageRiskSchema = z.object({
  level: z.enum(['low', 'medium', 'high']).optional(),
});

export const packageManifestSchema = z.object({
  schema: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  type: packageTypeSchema,
  description: z.string().min(1).optional(),
  metadata: packageMetadataSchema.optional(),
  compatibility: packageCompatibilitySchema.optional(),
  env: packageEnvSchema.optional(),
  risk: packageRiskSchema.optional(),
  exports: z.object({
    agents: z.array(namedExportSchema).optional(),
    commands: z.array(namedExportSchema).optional(),
    skills: z.array(namedExportSchema).optional(),
    config: z.array(configExportSchema).optional(),
  }),
});

export type ExportStrategy = z.infer<typeof exportStrategySchema>;
export type PackageType = z.infer<typeof packageTypeSchema>;
export type NamedExport = z.infer<typeof namedExportSchema>;
export type ConfigExport = z.infer<typeof configExportSchema>;
export type PackageMetadata = z.infer<typeof packageMetadataSchema>;
export type PackageCompatibility = z.infer<typeof packageCompatibilitySchema>;
export type PackageEnv = z.infer<typeof packageEnvSchema>;
export type PackageRisk = z.infer<typeof packageRiskSchema>;
export type PackageManifest = z.infer<typeof packageManifestSchema>;
