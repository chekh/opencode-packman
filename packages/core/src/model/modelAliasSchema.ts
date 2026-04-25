import { z } from 'zod';

export const SUPPORTED_MODEL_ALIAS_SCHEMA = 'opencode-packman/model-aliases/v1';

export const modelAliasConfigSchema = z.object({
  schema: z.literal(SUPPORTED_MODEL_ALIAS_SCHEMA),
  aliases: z.record(z.string().min(1), z.string().min(1))
});

export type ModelAliasConfig = z.infer<typeof modelAliasConfigSchema>;
