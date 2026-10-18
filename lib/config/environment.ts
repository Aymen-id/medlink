import { z } from 'zod';

type Environment = Readonly<Record<string, string | undefined>>;
const required = z.string().trim().min(1);
const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required,
});
const billingSchema = z.object({
  STRIPE_SECRET_KEY: z.string().regex(/^(?:sk|rk)_(?:test|live)_/),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_PRICE_PRO_MONTHLY: z.string().startsWith('price_'),
  STRIPE_PRICE_PRO_ANNUAL: z.string().startsWith('price_'),
  STRIPE_PRICE_CLINIC_MONTHLY: z.string().startsWith('price_'),
  STRIPE_PRICE_CLINIC_ANNUAL: z.string().startsWith('price_'),
  STRIPE_PORTAL_CONFIGURATION_ID:z.string().startsWith('bpc_').optional(),
});
const schemas = {
  billing: billingSchema,
  admin: z.object({ SUPABASE_SERVICE_ROLE_KEY: required }),
  analytics: z.object({ IP_HASH_SALT: z.string().min(32) }),
  cleanup:z.object({ CRON_SECRET:z.string().min(32) }),
};

function validate<T extends z.ZodType>(schema: T, source: Environment): z.output<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid or missing configuration: ${names.join(', ')}. See .env.example.`);
  }
  return parsed.data;
}

export function parseSupabaseConfig(source: Environment) {
  return validate(supabaseSchema, source);
}

export function parseAppOrigin(value: string | undefined): string {
  try {
    const url = new URL(value ?? '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new Error('Invalid or missing configuration: NEXT_PUBLIC_APP_URL must be an HTTP(S) origin. See .env.example.');
  }
}

/** Existing deployments used public price names; accept them during migration. */
export function parseServerConfig<K extends keyof typeof schemas>(source: Environment, scope: K): z.output<(typeof schemas)[K]> {
  const normalized = { ...source };
  if (scope === 'billing') {
    const aliases: Record<string, string> = {
      STRIPE_PRICE_PRO_MONTHLY: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
      STRIPE_PRICE_PRO_ANNUAL: 'NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID',
      STRIPE_PRICE_CLINIC_MONTHLY: 'NEXT_PUBLIC_STRIPE_CLINIC_PRICE_ID',
      STRIPE_PRICE_CLINIC_ANNUAL: 'NEXT_PUBLIC_STRIPE_CLINIC_ANNUAL_PRICE_ID',
    };
    for (const [canonical, alias] of Object.entries(aliases)) {
      if (source[canonical] && source[alias] && source[canonical] !== source[alias]) {
        throw new Error(`Conflicting configuration: ${canonical} and ${alias}. Use the canonical name in .env.example.`);
      }
      normalized[canonical] = source[canonical] || source[alias];
    }
  }
  return validate(schemas[scope], normalized) as z.output<(typeof schemas)[K]>;
}
