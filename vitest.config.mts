import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    env: {
      // Test-only placeholder values so modules that import src/lib/env.ts
      // (e.g. crypto.ts) can be unit tested without a real .env file.
      DATABASE_URL: "postgresql://leadgen:leadgen@localhost:5432/leadgen_test",
      AUTH_SECRET: "test-secret",
      AUTH_URL: "http://localhost:3000",
      TOKEN_ENCRYPTION_KEY: "RGdBF/j2nz0y74ppmZwAxZ98JXdJHgUr+CZ2OLXAKIE=",
    },
  },
});
