// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ env: undefined as Record<string, string> | undefined }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext() {
  if (!state.env) throw new Error('Not in a Worker request');
  return {env: state.env, ctx: {}};
} }));
import { runtimeSecret } from '@/lib/runtime-env';
afterEach(() => {state.env=undefined;vi.unstubAllEnvs();});
describe('runtime secrets', () => {
  it('reads Node environment lazily outside Workers', () => {
    vi.stubEnv('DATABASE_URL','test-node-value');expect(runtimeSecret('DATABASE_URL')).toBe('test-node-value');
  });
  it('uses request bindings instead of build/Node environment in Workers', () => {
    vi.stubEnv('DATABASE_URL','test-build-value');state.env={DATABASE_URL:'test-request-value'};
    expect(runtimeSecret('DATABASE_URL')).toBe('test-request-value');
  });
  it('does not fall back to build secrets when a Worker binding is missing', () => {
    vi.stubEnv('ADMIN_AUTH_SECRET','test-build-secret');state.env={};
    expect(runtimeSecret('ADMIN_AUTH_SECRET')).toBeUndefined();
  });
});
