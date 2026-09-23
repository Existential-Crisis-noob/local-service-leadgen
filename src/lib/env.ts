import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  // Required starting with the auth phase; left optional here so early scaffolding
  // (`npm run dev` with only DATABASE_URL set) doesn't fail validation.
  AUTH_SECRET: z.string().optional().default(""),
  AUTH_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  // Required starting with the Gmail-mailbox phase.
  TOKEN_ENCRYPTION_KEY: z.string().optional().default(""),
  // Optional — enables real Lighthouse audits (via PageSpeed Insights) in
  // website inspection. Without it, the existing heuristics still run.
  PAGESPEED_API_KEY: z.string().optional().default(""),
});

export const env = envSchema.parse(process.env);
