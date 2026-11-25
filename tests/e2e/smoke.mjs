// tests/e2e/smoke.mjs — end-to-end smoke test of the core flows against the built app.
// Usage: npm run build && npm run test:e2e   (starts its own server on a free port with a temp data dir)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(path.join(tmpdir(), 'sunum-e2e-'));

let failures = 0;
const results = [];
async function check(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push(`✅ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    failures++;
    results.push(`❌ ${name}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// ---------- server ----------
let serverLog = '';
const server = spawn(process.execPath, ['dist-server/index.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, NODE_ENV: 'test', SMTP_USER: '', SMTP_PASS: '' },
});
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
for (let i = 0; i < 50; i++) {
  const ok = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false);
  if (ok) break;
  await new Promise((r) => setTimeout(r, 200));
}
const codeFor = async (email) => {
  for (let i = 0; i < 40; i++) {
    const m = [...serverLog.matchAll(new RegExp(`mail to ${email.replace(/[.]/g, '\\.')}: Giriş kodun: (\\d{6})`, 'g'))].pop();
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`no login code for ${email}`);
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const errors = [];
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', (d) => d.accept());
  return p;
};

try {
  const page = await newPage();
  await page.clock.install(); // lets tests fast-forward the presentation timer

  await check('home loads (setup view, header, logo)', async () => {
    await page.goto(BASE);
    await page.waitForSelector('.hero-title', { timeout: 15000 });
    expect(await page.locator('img[alt="Teknodoz"]').count(), 'logo missing');
  });

  await check('presentation: consent → steps → break → outro-less finish → report', async () => {
    await page.locator('.start-bar').getByRole('button', { name: /Sunumu başlat/ }).click();
    await page.getByRole('button', { name: /Hayır, kayıt alma/ }).click();
    await page.waitForSelector('.stage');
    expect((await page.locator('.hud .step-dot').count()) === 6, 'expected 6 step chips');
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('.break-screen');
    await page.getByRole('button', { name: /Hazırım, devam/ }).click();
    expect((await page.locator('.hud .step-dot.is-current .dot-num').innerText()) === '2', 'not on step 2');
    await page.clock.fastForward(45_000); // runs < 30 s don't count toward progress
    await page.getByRole('button', { name: 'Sunumu bitir' }).click();
    await page.waitForSelector('.report', { timeout: 10000 });
    await page.waitForSelector('.fresh-badges', { timeout: 5000 });
    expect((await page.locator('.fresh-badges').innerText()).includes('İlk Pitch'), 'first-run badge banner missing');
  });

  await check('per-gap break toggle skips the break', async () => {
    await page.getByRole('button', { name: 'Hazırlık' }).first().click();
    await page.locator('.timeline-gap .gap-toggle').first().click();
    await page.locator('.start-bar').getByRole('button', { name: /Sunumu başlat/ }).click();
    await page.getByRole('button', { name: /Hayır, kayıt alma/ }).click();
    await page.waitForSelector('.stage');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    expect((await page.locator('.break-screen').count()) === 0, 'break shown although switched off');
    await page.clock.fastForward(45_000);
    await page.getByRole('button', { name: 'Sunumu bitir' }).click();
    await page.waitForSelector('.report');
  });

  await check('progress dashboard: runs, streak, level, career badges', async () => {
    await page.locator('.main-nav').getByRole('button', { name: 'Gelişimim' }).click();
    await page.waitForSelector('.progress-page .level-card');
    const rows = await page.locator('.progress-table tbody tr').count();
    expect(rows >= 2, `expected >= 2 runs, got ${rows}`);
    expect((await page.locator('.streak-num').innerText()).includes('1'), 'weekly streak should be 1');
    expect((await page.locator('.career-badge.is-earned', { hasText: 'İlk Pitch' }).count()) === 1, 'İlk Pitch not earned');
    expect((await page.locator('.trend').count()) === 5, 'expected 5 trend cards');
  });

  await check('templates: search + start Lean Canvas (9 steps)', async () => {
    await page.keyboard.press('Control+k');
    await page.keyboard.type('Lean Canvas Sunumu');
    await page.waitForTimeout(400);
    await page.locator('.search-item, [role=option]').first().click();
    await page.locator('.tpl-card', { hasText: 'Lean Canvas Sunumu' }).first().getByRole('button', { name: /Bu şablonla başla/ }).click();
    await page.waitForSelector('.timeline-item');
    expect((await page.locator('.timeline-item').count()) === 9, 'template should have 9 steps');
  });

  let shareUrl = '';
  await check('share: invite-only link is not public, anonymous access denied', async () => {
    await page.getByRole('button', { name: /Paylaş/ }).first().click();
    await page.getByRole('button', { name: /Yalnızca davet edilenler/ }).click();
    await page.getByLabel('Davet edilecek e-postalar').fill('davetli@ornek.com');
    await page.getByRole('button', { name: '＋ Ekle' }).click();
    await page.getByRole('button', { name: /Paylaş ve bağlantı oluştur/ }).click();
    await page.waitForSelector('.share-link input', { timeout: 8000 }).catch(async (e) => {
      await page.screenshot({ path: process.env.E2E_SHOT ?? '/tmp/e2e-share.png' });
      throw new Error(`share link not created: ${(await page.locator('.share-modal .error').allInnerTexts()).join(' ') || e.message}`);
    });
    shareUrl = (await page.locator('.share-link input').first().inputValue()).replace(/^https?:\/\/[^/]+/, BASE);
    await page.keyboard.press('Escape');
    const id = shareUrl.split('?s=')[1];
    const pub = await (await fetch(`${BASE}/api/shares/public`)).json();
    expect(!pub.items.some((x) => x.id === id), 'invite-only share listed publicly');
    const anon = await fetch(`${BASE}/api/shares/${id}/access`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(anon.status === 401, `anonymous access should be 401, got ${anon.status}`);
  });

  await check('invite login: wrong e-mail refused, invited e-mail opens', async () => {
    const v = await newPage({ viewport: { width: 1100, height: 850 } });
    await v.goto(shareUrl);
    await v.getByLabel('E-posta').fill('baskasi@ornek.com');
    await v.getByRole('button', { name: /Kod gönder/ }).click();
    await v.getByLabel('6 haneli kod').fill(await codeFor('baskasi@ornek.com'));
    await v.getByRole('button', { name: /Giriş yap ve aç/ }).click();
    await v.waitForSelector('text=Başka e-postayla giriş yap');
    await v.getByRole('button', { name: /Başka e-postayla giriş yap/ }).click();
    await v.getByLabel('E-posta').fill('davetli@ornek.com');
    await v.getByRole('button', { name: /Kod gönder/ }).click();
    await v.getByLabel('6 haneli kod').fill(await codeFor('davetli@ornek.com'));
    await v.getByRole('button', { name: /Giriş yap ve aç/ }).click();
    await v.waitForSelector('.follow-switch', { timeout: 10000 });
  });

  await check('library: merge 2 presentations without step cap', async () => {
    await page.getByRole('button', { name: 'Sunumlarım' }).first().click();
    const cards = page.locator('.lib-card .lib-pick input');
    await page.waitForTimeout(300);
    expect((await cards.count()) >= 2, `need at least two presentations, have: ${(await page.locator('.lib-card h3').allInnerTexts()).join(', ')}`);
    await cards.nth(0).check();
    await cards.nth(1).check();
    await page.getByRole('button', { name: /🔗 Birleştir/ }).first().click();
    await page.waitForSelector('.step-check');
    const picked = await page.locator('.step-check input:checked').count();
    await page.locator('.steptools-modal').getByRole('button', { name: /🔗 Birleştir/ }).click();
    await page.waitForSelector('.timeline-item');
    expect((await page.locator('.timeline-item').count()) === picked, 'merged step count mismatch');
  });

  await check('account sync: move to account on device A, open on device B, live update back', async () => {
    const email = 'senkron@ornek.com';
    const login = async (p) => {
      await p.locator('.account-chip').first().click();
      await p.getByLabel('E-posta').fill(email);
      await p.getByRole('button', { name: /Kod gönder/ }).click();
      const before = [...serverLog.matchAll(/mail to senkron@ornek\.com: Giriş kodun: (\d{6})/g)].length;
      let code = '';
      for (let i = 0; i < 40 && !code; i++) {
        const all = [...serverLog.matchAll(/mail to senkron@ornek\.com: Giriş kodun: (\d{6})/g)];
        if (all.length > before - 1 && all.length) code = all[all.length - 1][1];
        else await new Promise((r) => setTimeout(r, 150));
      }
      await p.getByLabel('6 haneli kod').fill(code);
      await p.getByRole('button', { name: /^Giriş yap$/ }).click();
    };
    const A = await newPage();
    await A.goto(BASE);
    await A.waitForSelector('.hero-title');
    await A.locator('.hero-title').fill('Senkron testi');
    await A.waitForTimeout(600);
    await login(A);
    await A.getByRole('button', { name: /Hesabıma taşı/ }).click();
    await A.waitForTimeout(1500);
    const B = await newPage();
    await B.goto(BASE);
    await B.waitForSelector('.hero-title');
    await login(B);
    const later = B.getByRole('button', { name: /Şimdilik değil/ });
    await later.waitFor({ timeout: 5000 }).catch(() => undefined);
    if (await later.count()) await later.click();
    await B.getByRole('button', { name: 'Sunumlarım' }).first().click();
    const card = B.locator('.lib-card', { hasText: 'Senkron testi' });
    await card.waitFor({ timeout: 8000 });
    await card.getByRole('button', { name: 'Aç' }).click();
    await B.waitForTimeout(800);
    expect((await B.locator('.hero-title').inputValue()) === 'Senkron testi', 'device B did not get the presentation');
    await B.locator('.hero-title').fill('Senkron testi (B)');
    await A.waitForFunction(() => document.querySelector('.hero-title')?.value === 'Senkron testi (B)', null, { timeout: 10000 });
  });

  await check('live quiz + pitch jury (PIN): vote, points, ranking, report', async () => {
    const P = await newPage();
    await P.goto(BASE);
    await P.waitForSelector('.hero-title');
    await P.getByRole('button', { name: 'Sunumlarım' }).first().click();
    await P.getByRole('button', { name: /Yeni sunum/ }).click();
    await P.getByRole('button', { name: 'Hazırlık' }).first().click();
    await P.locator('.count-picker button', { hasText: '2' }).first().click();
    await P.locator('.step-editor-head .input--title').fill('Takım Alfa');
    await P.getByRole('tab', { name: /Etkileşim/ }).click();
    await P.getByRole('button', { name: /＋ 🏆 Quiz/ }).click();
    const q = P.locator('.q-item').first();
    await q.getByLabel('Soru metni').fill('2 + 2 = ?');
    await q.getByLabel('1. seçenek', { exact: true }).fill('3');
    await q.getByLabel('2. seçenek', { exact: true }).fill('4');
    await q.getByLabel('Doğru cevap: 2. seçenek').check();
    await P.getByText('Pitch günü: her adım bir takımın pitch’i').click();
    const pin = await P.getByLabel('Jüri PIN').inputValue();
    await P.locator('.start-bar').getByRole('button', { name: /Sunumu başlat/ }).click();
    await P.getByRole('button', { name: /Hayır, kayıt alma/ }).click();
    await P.locator('.dock-btn', { hasText: 'Etkileşim' }).click();
    await P.locator('.q-row', { hasText: '2 + 2' }).getByRole('button', { name: /Başlat/ }).click();
    await P.waitForSelector('.room-code-inline', { timeout: 10000 });
    const code = (await P.locator('.room-code-inline').innerText()).trim();
    const A = await newPage({ viewport: { width: 390, height: 844 } });
    await A.goto(`${BASE}/?join=${code}`);
    await A.waitForSelector('.aud-poll', { timeout: 10000 });
    await A.getByRole('button', { name: '4', exact: true }).click();
    await P.getByRole('button', { name: /Bitir ve sonuçları göster/ }).click();
    await A.waitForSelector('.quiz-right', { timeout: 5000 });
    expect((await P.locator('.leaderboard .podium-col').count()) >= 1, 'no leaderboard');
    await P.locator('.dock-btn', { hasText: 'Jüri' }).click();
    await P.waitForSelector('.jury-panel');
    await A.getByRole('tab', { name: /Jüri/ }).click();
    await A.getByRole('button', { name: /PIN ile/ }).click();
    await A.getByLabel('Jüri PIN').fill(pin);
    await A.getByRole('button', { name: 'Gir' }).click();
    await A.waitForSelector('.jury-scale');
    const crits = A.locator('.jury-crit');
    for (let i = 0; i < (await crits.count()); i++) await crits.nth(i).getByRole('radio', { name: '8', exact: true }).click();
    await A.getByRole('button', { name: /Puanı gönder/ }).click();
    await P.waitForFunction(() => document.querySelector('.jury-table tbody tr td:nth-last-child(2)')?.textContent?.trim() === '8.00', null, { timeout: 5000 });
    await P.keyboard.press('Escape');
    await P.getByRole('button', { name: 'Sunumu bitir' }).click();
    await P.waitForSelector('[data-anchor="report-jury"]', { timeout: 8000 });
    await P.waitForSelector('[data-anchor="report-polls"]');
  });

  await check('audience page loads with a room code', async () => {
    const a = await newPage({ viewport: { width: 390, height: 844 } });
    await a.goto(`${BASE}/?join=ABC123`);
    await a.waitForSelector('.aud-page', { timeout: 10000 });
  });

  await check('no uncaught page errors', async () => {
    expect(errors.length === 0, errors.join(' | '));
  });
} finally {
  await browser.close();
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} test başarısız` : '\nTüm testler geçti');
process.exit(failures ? 1 : 0);
