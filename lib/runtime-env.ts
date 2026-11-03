import { getCloudflareContext } from '@opennextjs/cloudflare';

export function workerContext() {
  try { return getCloudflareContext(); }
  catch {
    if (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') {
      throw new Error('Worker request context is unavailable. Use the configured Worker entry.');
    }
    return undefined;
  }
}

export function runtimeSecret(name: 'DATABASE_URL' | 'ADMIN_AUTH_SECRET'): string | undefined {
  const context = workerContext();
  // Never fall back to bundled/build-time secrets in a Worker.
  const value = context ? (context.env as unknown as Record<string, unknown>)[name] : process.env[name];
  return typeof value === 'string' && value.length ? value : undefined;
}
