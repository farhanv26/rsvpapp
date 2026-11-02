export const LOCAL_ACCOUNT_URL = 'postgresql://postgres@127.0.0.1:54330/rsvp_dev';

export function assertDevelopmentDatabase(raw, demo = false) {
  let target;
  try { target = new URL(raw); } catch { throw new Error('Set up the local database with npm run db:local:setup.'); }
  const database = demo ? 'rsvp_demo' : 'rsvp_dev';
  if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(target.hostname)
    || target.port !== '54330' || target.pathname !== `/${database}`) {
    throw new Error(`This command requires local ${database} on port 54330. Use npm run dev:demo only for the separate demo environment.`);
  }
  return target;
}

/** @param {Record<string, string | undefined>} [environment] */
export function assertLocalAccountSetup(environment = process.env) {
  if (environment.NODE_ENV?.toLowerCase() === 'production' || environment.VERCEL || environment.CI
    || environment.VOWPAL_LOCAL_ACCOUNT_SETUP !== 'interactive') {
    throw new Error('Local account setup is available only through the interactive local terminal command, never in production or CI.');
  }
  return LOCAL_ACCOUNT_URL;
}
