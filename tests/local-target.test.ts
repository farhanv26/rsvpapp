// @vitest-environment node
import { expect,it } from 'vitest';
import { assertDevelopmentDatabase,assertLocalAccountSetup,LOCAL_ACCOUNT_URL } from '../scripts/local-target.mjs';
it('pins normal and demo development to distinct isolated databases',()=>{
 expect(assertDevelopmentDatabase(LOCAL_ACCOUNT_URL).pathname).toBe('/rsvp_dev');
 expect(assertDevelopmentDatabase(LOCAL_ACCOUNT_URL.replace('rsvp_dev','rsvp_demo'),true).pathname).toBe('/rsvp_demo');
 for(const url of ['postgresql://example.invalid/rsvp_dev',LOCAL_ACCOUNT_URL.replace('rsvp_dev','rsvp_demo'),LOCAL_ACCOUNT_URL.replace('54330','5432'),LOCAL_ACCOUNT_URL.replace('postgresql:','https:')])expect(()=>assertDevelopmentDatabase(url)).toThrow();
});
it('refuses production/CI and ignores inherited hosted credentials in local setup',()=>{
 expect(()=>assertLocalAccountSetup({NODE_ENV:'production',VOWPAL_LOCAL_ACCOUNT_SETUP:'interactive'})).toThrow();
 expect(()=>assertLocalAccountSetup({VERCEL:'1',VOWPAL_LOCAL_ACCOUNT_SETUP:'interactive'})).toThrow();
 expect(()=>assertLocalAccountSetup({CI:'true',VOWPAL_LOCAL_ACCOUNT_SETUP:'interactive'})).toThrow();
 expect(()=>assertLocalAccountSetup({})).toThrow();
 expect(assertLocalAccountSetup({VOWPAL_LOCAL_ACCOUNT_SETUP:'interactive',DATABASE_URL:'postgresql://example.invalid/hosted'})).toBe(LOCAL_ACCOUNT_URL);
});
