/** Verify real HTTP login without saving or printing a password/session cookie. */
export async function verifyLocalSignIn({ name, password, userId, port = 3000 }) {
  if (![3000, 3003].includes(port)) throw new Error('Only the canonical local app or isolated auth test server is allowed.');
  const origin = `http://127.0.0.1:${port}`;
  try {
    const page = await fetch(`${origin}/admin/login`, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    if (page.status !== 200) return false;
    const html = await page.text();
    const action = html.match(/name="(\$ACTION_ID_[^"]+)"/);
    if (!action) return false;
    const form = new FormData();
    form.set(action[1], ''); form.set('adminUser', name); form.set('password', password);
    const login = await fetch(`${origin}/admin/login`, { method: 'POST', headers: { origin }, body: form, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    const setCookie = login.headers.get('set-cookie') ?? '';
    const cookie = setCookie.match(/(?:^|,\s*)(admin_session=[^;]+)/)?.[1];
    if (!cookie || ![303, 307].includes(login.status) || !login.headers.get('location')?.endsWith('/admin/overview')) return false;
    const claims = JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[1], 'base64url').toString());
    if (claims.userId !== userId) return false;
    const protectedPage = await fetch(`${origin}/admin/overview`, { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    return protectedPage.status === 200;
  } catch { return false; }
}
