const runtimeEnv =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env ?? undefined;

const bunEnv = typeof Bun !== "undefined" ? Bun.env : undefined;

export const env = bunEnv ?? runtimeEnv ?? {};
