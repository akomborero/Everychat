import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "ENCRYPTION_KEY must be 32 bytes, base64 encoded"),
  META_APP_SECRET: z.string().min(1),
  META_VERIFY_TOKEN: z.string().min(8),
  GRAPH_API_VERSION: z.string().default("v25.0"),
  // Embedded Signup (one-click connect). Leave unset to offer manual connect only.
  META_APP_ID: z.string().optional(),
  META_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_CHAT_MODEL: z.string().min(1),
  // Must output 1536 dimensions to match the vector(1536) column.
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Public address of the web app, used in emailed links. Defaults to the first CORS origin.
  APP_URL: z.string().optional(),
  APP_NAME: z.string().default("Everychat"),
  // Email (Resend). Without a key, emails are skipped and, outside production, printed to the console.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Everychat <onboarding@resend.dev>"),
  // Comma-separated emails allowed to open the platform admin panel.
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
  // Sign-in cookie. Use "lax" when the web app and API share a site (for example app.example.com and api.example.com,
  // with COOKIE_DOMAIN=.example.com). "none" is for different sites and is blocked by some browsers, notably Safari.
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().optional(),
  // Error monitoring (Sentry). Leave unset to log errors to the console only.
  SENTRY_DSN: z.string().optional(),
  // Spend protection. Tokens per business per UTC day (0 = no limit) and AI replies per conversation per hour (0 = no limit).
  DEFAULT_DAILY_AI_TOKEN_LIMIT: z.coerce.number().int().min(0).default(1_000_000),
  AI_MAX_REPLIES_PER_CONVERSATION_PER_HOUR: z.coerce.number().int().min(0).default(20),
  // Re-tries customer messages that were saved but never answered (for example after a restart).
  RECOVERY_ENABLED: z.enum(["true", "false"]).default("true"),
  RECOVERY_MAX_AGE_MINUTES: z.coerce.number().int().min(5).max(1380).default(120),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
