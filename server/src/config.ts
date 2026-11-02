export interface Config {
  databaseUrl: string;
  adminPassword: string;
  sessionSecret: string;
  webOrigin: string;
  port: number;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const required = ['DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET', 'WEB_ORIGIN'];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return {
    databaseUrl: env.DATABASE_URL!,
    adminPassword: env.ADMIN_PASSWORD!,
    sessionSecret: env.SESSION_SECRET!,
    webOrigin: env.WEB_ORIGIN!,
    port: env.PORT ? Number(env.PORT) : 3000,
  };
}
