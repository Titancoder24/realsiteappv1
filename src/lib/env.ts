import { z } from "zod";

const serverSchema = z.object({
  WORLD_LABS_API_KEY: z.string().min(1).optional(),
  WORLD_LABS_API_BASE: z.string().url().default("https://api.worldlabs.ai"),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_PRIMARY_MODEL: z.string().default("google/gemini-2.5-flash-preview"),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"),
  ELEVENLABS_TTS_MODEL: z.string().default("eleven_multilingual_v2"),
  ELEVENLABS_STT_MODEL: z.string().default("scribe_v2"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

/** Treat empty/whitespace-only env vars as unset so optional schemas don't reject "". */
function opt(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const env = {
  ...clientSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: opt(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: opt(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_APP_URL: opt(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000",
  }),
  server: serverSchema.parse({
    WORLD_LABS_API_KEY: opt(process.env.WORLD_LABS_API_KEY),
    WORLD_LABS_API_BASE: opt(process.env.WORLD_LABS_API_BASE) ?? "https://api.worldlabs.ai",
    OPENROUTER_API_KEY: opt(process.env.OPENROUTER_API_KEY),
    OPENROUTER_PRIMARY_MODEL: opt(process.env.OPENROUTER_PRIMARY_MODEL) ?? "google/gemini-2.5-flash-preview",
    ELEVENLABS_API_KEY: opt(process.env.ELEVENLABS_API_KEY),
    ELEVENLABS_VOICE_ID: opt(process.env.ELEVENLABS_VOICE_ID) ?? "21m00Tcm4TlvDq8ikWAM",
    ELEVENLABS_TTS_MODEL: opt(process.env.ELEVENLABS_TTS_MODEL) ?? "eleven_multilingual_v2",
    ELEVENLABS_STT_MODEL: opt(process.env.ELEVENLABS_STT_MODEL) ?? "scribe_v2",
    SUPABASE_SERVICE_ROLE_KEY: opt(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }),
};

export function requireServerKey(key: keyof typeof env.server, label: string): string {
  const value = env.server[key];
  if (!value) throw new Error(`${label} is not configured. Set ${key} in environment.`);
  return value as string;
}
