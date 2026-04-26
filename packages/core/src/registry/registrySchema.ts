import { z } from 'zod';

export const SUPPORTED_REGISTRY_SCHEMA = 'opencode-packman/registries/v1';

export const registryEntrySchema = z.object({
  type: z.literal('local'),
  path: z.string().min(1),
});

export const registryConfigSchema = z.object({
  schema: z.literal(SUPPORTED_REGISTRY_SCHEMA),
  registries: z.record(z.string(), registryEntrySchema),
});

export type RegistryEntry = z.infer<typeof registryEntrySchema>;
export type RegistryConfig = z.infer<typeof registryConfigSchema>;
