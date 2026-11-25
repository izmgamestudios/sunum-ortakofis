// client/src/lib/auth.ts — e-mail code login (session is an httpOnly cookie set by the server)
async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? `Hata ${res.status}`);
  return data as T;
}

export const authMe = () => call<{ email: string | null; mailReady: boolean }>('/me');
export const requestCode = (email: string) => call<{ ok: boolean; dev?: boolean }>('/request', { email });
export const verifyCode = (email: string, code: string) => call<{ email: string }>('/verify', { email, code });
export const logout = () => call<{ ok: boolean }>('/logout', {});

/** split a pasted list ("a@x.com, b@y.com; c@z.com\nd@…") into unique, valid, lower-case e-mails */
export function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const re = /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
  const valid = new Set<string>();
  const invalid: string[] = [];
  raw
    .split(/[\s,;]+/)
    .map((x) => x.trim().replace(/^<|>$/g, '').toLowerCase())
    .filter(Boolean)
    .forEach((e) => (re.test(e) ? valid.add(e) : invalid.push(e)));
  return { valid: [...valid], invalid };
}
