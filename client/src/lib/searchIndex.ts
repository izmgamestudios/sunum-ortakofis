// client/src/lib/searchIndex.ts — everything searchable: menus, settings, commands, templates, models, guide, FAQ, shortcuts, own content
import { useApp } from '../store';
import { useTheme } from './theme';
import { useSettings } from './settings';
import { exportJson, exportMarkdown, exportSnmtdz } from './io';
import { goTo, emit, APP_EVENTS } from './nav';
import { CATEGORIES, TEMPLATES } from './templates';
import { FRAMEWORKS, FW_GROUPS } from './frameworks';
import { FAQS, GUIDE, TROUBLESHOOT } from './help';
import { SHORTCUTS, shortcutText } from './shortcuts';
import { BREAK_ACTIVITIES, EMOTIONS, SETTINGS, TIMES, TONES } from './catalog';
import { foldTr } from './speechMatch';
import { AUTHOR, REPO } from './about';
import type { View } from '../types';

export type SearchType = 'menu' | 'command' | 'content' | 'template' | 'model' | 'guide' | 'faq' | 'shortcut';

export const TYPE_META: Record<SearchType, { label: string; icon: string; order: number }> = {
  menu: { label: 'Menüler & ayarlar', icon: '🧭', order: 0 },
  command: { label: 'Komutlar', icon: '⚡', order: 1 },
  content: { label: 'Sunumum', icon: '📝', order: 2 },
  template: { label: 'Şablonlar', icon: '📚', order: 3 },
  model: { label: 'Modeller', icon: '🧩', order: 4 },
  guide: { label: 'Kılavuz', icon: '📖', order: 5 },
  faq: { label: 'SSS & sorun giderme', icon: '❓', order: 6 },
  shortcut: { label: 'Kısayollar', icon: '⌨️', order: 7 },
};

export interface SearchItem {
  id: string;
  type: SearchType;
  title: string;
  path: string[];
  body?: string;
  keywords?: string;
  icon?: string;
  run: () => void;
  /* pre-folded fields (filled by buildIndex) */
  _t?: string;
  _p?: string;
  _k?: string;
  _b?: string;
}

const nav = (view: View, anchor?: string) => () => goTo(view, anchor);

/* ------------------------------------------------------------------ */
/* static part: built once                                             */
/* ------------------------------------------------------------------ */
let staticCache: SearchItem[] | null = null;

function staticItems(): SearchItem[] {
  if (staticCache) return staticCache;
  const app = () => useApp.getState();
  const out: SearchItem[] = [];
  const add = (i: SearchItem) => out.push(i);

  /* --- menus --- */
  const top: [string, View, string][] = [
    ['Hazırlık', 'setup', '🛠️'],
    ['Sunum', 'live', '🎤'],
    ['Rapor', 'report', '📊'],
    ['Şablonlar', 'templates', '📚'],
    ['Yardım merkezi', 'faq', '❓'],
    ['Hakkında & Credits', 'credits', '🙏'],
  ];
  top.forEach(([t, v, ic]) => add({ id: `m-top-${v}`, type: 'menu', title: t, path: ['Menüler', 'Üst menü'], icon: ic, run: nav(v) }));
  Object.entries(CATEGORIES).forEach(([k, c]) =>
    add({ id: `m-mega-${k}`, type: 'menu', title: c.label, path: ['Menüler', 'Üst menü', 'Şablonlar (mega menü)'], icon: c.emoji, run: () => app().openTemplates(k) }),
  );
  [
    ['Sıkça Sorulan Sorular', () => app().openHelp('faq')],
    ['Kılavuz', () => app().openHelp('guide')],
    ['Kısayollar', () => app().openHelp('shortcuts')],
    ['Sorun giderme', () => app().openHelp('troubleshoot')],
    ['Destek', () => app().openHelp('support')],
    ['Rapor & SWOT', nav('report')],
    ['Şablon galerisi', () => app().openTemplates()],
    ['Credits', nav('credits')],
  ].forEach(([t, run], i) => add({ id: `m-res-${i}`, type: 'menu', title: t as string, path: ['Menüler', 'Üst menü', 'Kaynaklar (mega menü)'], run: run as () => void }));
  [['Hazırlık', 'setup'], ['Şablonlar', 'templates'], ['Başlat', 'live'], ['Rapor', 'report'], ['Menü', 'setup']].forEach(([t, v]) =>
    add({ id: `m-bottom-${t}`, type: 'menu', title: t, path: ['Menüler', 'Mobil alt menü'], run: t === 'Menü' ? () => app().setDrawer(true) : nav(v as View) }),
  );
  [['Genel ayarlar', 'setup'], ['Canlı sunum', 'live'], ['Rapor & SWOT', 'report']].forEach(([t, v]) =>
    add({ id: `m-side-${t}`, type: 'menu', title: t, path: ['Menüler', 'Kenar menü'], run: nav(v as View) }),
  );
  [['Hazırlık', 'setup'], ['Canlı sunum', 'live'], ['Rapor & SWOT', 'report'], ['SSS', 'faq'], ['Credits', 'credits']].forEach(([t, v]) =>
    add({ id: `m-foot-${t}`, type: 'menu', title: t, path: ['Menüler', 'Footer'], run: nav(v as View) }),
  );

  /* --- setup settings (deep links) --- */
  const setup = (title: string, anchor: string, path: string[], keywords = '', icon = '⚙️') =>
    add({ id: `s-${anchor}-${title}`, type: 'menu', title, path: ['Hazırlık', ...path], keywords, icon, run: nav('setup', anchor) });
  setup('Adım sayısı (1–9)', 'setup-steps', ['Ayarlar'], 'adim sure dakika zaman cizelgesi timeline', '⏳');
  setup('Süreleri 1-2-3… dk yap', 'setup-steps', ['Ayarlar', 'Adım sayısı'], 'varsayilan sure');
  setup('Adımlar arası geçiş', 'setup-breaks', ['Ayarlar'], 'mola gecis bekleme', '🫁');
  ['Geçiş yok', 'Manuel bekle', 'Otomatik', '15 sn', '30 sn', '45 sn', '60 sn', 'Sırayla', 'Rastgele'].forEach((t) => setup(t, 'setup-breaks', ['Ayarlar', 'Adımlar arası geçiş'], 'mola'));
  Object.values(BREAK_ACTIVITIES).forEach((a) => setup(a.label, 'setup-breaks', ['Ayarlar', 'Adımlar arası geçiş', 'Aktiviteler'], 'mola aktivite', a.emoji));
  setup('Rol yapma / drama modu', 'setup-roleplay', ['Ayarlar', 'Sunum şekli'], 'drama rol duygu', '🎭');
  Object.values(EMOTIONS).forEach((e) => setup(e.label, 'setup-roleplay', ['Ayarlar', 'Sunum şekli', 'Duygu'], 'duygu emotion', e.emoji));
  Object.values(TONES).forEach((t) => setup(t.label, 'setup-roleplay', ['Ayarlar', 'Sunum şekli', 'Ton'], 'ton'));
  Object.values(SETTINGS).forEach((s) => setup(s.label, 'setup-roleplay', ['Ayarlar', 'Sunum şekli', 'Mekân'], 'mekan ortam', s.emoji));
  Object.values(TIMES).forEach((t) => setup(t.label, 'setup-roleplay', ['Ayarlar', 'Sunum şekli', 'Zaman'], 'zaman', t.emoji));
  setup('Kalabalık seviyesi', 'setup-roleplay', ['Ayarlar', 'Sunum şekli'], 'kitle kalabalik');
  setup('Her adımda senaryo zarı at', 'setup-roleplay', ['Ayarlar', 'Sunum şekli'], 'rastgele zar');
  setup('Süre bitince otomatik geç', 'setup-auto', ['Ayarlar'], 'otomatik ilerle', '⏭️');
  setup('Son saniyelerde zil', 'setup-auto', ['Ayarlar', 'Zil'], 'zil ses bildirim uyari bell alarm', '🔔');
  ['10 sn kala', '30 sn kala', '60 sn kala', 'Zil sesi seviyesi', 'Zili dene'].forEach((t) => setup(t, 'setup-auto', ['Ayarlar', 'Zil'], 'zil ses', '🔔'));
  [['Metin', '✍️'], ['Medya', '🗂️'], ['Tuval', '🎨'], ['Konu akışı', '🧭'], ['Kelime tombalası', '🎱'], ['Konu ağacı', '🌳'], ['Girintili listeden içe aktar', '📋'], ['Hazır havuzdan 9 kelime', '🎲']].forEach(([t, ic]) =>
    setup(t, 'setup-editor', ['Adım editörü'], 'adim icerik', ic),
  );

  /* --- live / canvas / report UI --- */
  const live = (title: string, path: string[], keywords = '', icon = '🎤') =>
    add({ id: `l-${path.join('-')}-${title}`, type: 'menu', title, path: ['Sunum', ...path], keywords, icon, run: nav('live') });
  ['Tuval', 'Slayt', 'Duvar', 'Metin'].forEach((t) => live(t, ['Sahne sekmeleri'], 'sahne'));
  ['Akış / Tombala / Ağaç', 'Döküm', 'Not', 'Sohbet', 'Oda'].forEach((t) => live(t, ['Yan panel'], 'panel'));
  ['Önceki adım', 'Duraklat / devam', 'Sonraki adım', 'Zil aç/kapat', 'Sunumu bitir', 'Tam ekran'].forEach((t) => live(t, ['Kontroller'], 'kontrol'));
  ['Canlı oda aç', 'QR kod', 'Sohbeti kilitle', 'Dinlemeye başla', 'Ses kaydını da sakla', 'Metin yapıştır', 'Kelime çek'].forEach((t) => live(t, ['Etkileşim'], 'oda qr dokum mikrofon'));
  [
    ['Seç / taşı / döndür', '🖐️'], ['Kalem', '✏️'], ['Fosforlu', '🖍️'], ['Silgi', '🧽'], ['Çizgi', '╱'], ['Ok', '➜'], ['Dikdörtgen', '▭'], ['Elips', '◯'], ['Yazı — tıkla ve yaz', '𝐓'], ['Not kağıdı', '📌'],
    ['Medya ekle', '🖼️'], ['Çerçeve / model ekle', '🧩'], ['Katmanlar', '🗂️'], ['Geri al', '↶'], ['Yinele', '↷'], ['PNG indir', '⬇️'], ['Tuvali temizle', '🗑️'], ['Çoğalt', '⧉'], ['Kilitle', '🔒'], ['En öne getir', '⤒'], ['En arkaya gönder', '⤓'],
  ].forEach(([t, ic]) => add({ id: `c-${t}`, type: 'menu', title: t, path: ['Tuval', 'Araç çubuğu'], keywords: 'tuval canvas cizim', icon: ic, run: nav('setup', 'setup-editor') }));
  [
    ['Skorlar & rozetler', 'report-scores'], ['Adım adım zaman', 'report-time'], ['SWOT analizi', 'report-swot'], ['Adım detayları', 'report-steps'],
    ['Notlar & alıntılar', 'report-notes'], ['Anonim sohbet dökümü', 'report-chat'], ['Konuşma dökümü', 'report-transcript'], ['Öz değerlendirme', 'report-reflection'], ['PDF / .snmtdz / JSON / Markdown', 'report-export'],
  ].forEach(([t, a]) => add({ id: `r-${a}`, type: 'menu', title: t, path: ['Rapor'], keywords: 'rapor analiz', icon: '📊', run: nav('report', a) }));

  /* --- about / contact / open source --- */
  const ext = (url: string) => () => window.open(url, '_blank', 'noopener,noreferrer');
  add({ id: 'about-oss', type: 'menu', title: 'Açık kaynak — GitHub', path: ['Hakkında'], keywords: 'github repo kaynak kod katki fork klon pull request mit lisans', icon: '⭐', run: ext(REPO.url) });
  add({ id: 'about-issues', type: 'menu', title: 'Hata bildir / öneri (GitHub Issues)', path: ['Hakkında', 'Destek'], keywords: 'issue hata bug oneri', icon: '🐛', run: ext(REPO.issues) });
  add({ id: 'about-author', type: 'menu', title: AUTHOR.name, path: ['Hakkında', 'Geliştirici'], keywords: 'iletisim linkedin gelistirici kurucu', icon: '💼', run: nav('credits') });
  add({ id: 'about-wa', type: 'menu', title: 'WhatsApp ile iletişim', path: ['Hakkında', 'İletişim'], keywords: 'whatsapp iletisim telefon destek', icon: '💬', run: ext(AUTHOR.whatsapp) });
  add({ id: 'about-mail', type: 'menu', title: 'E-posta ile iletişim', path: ['Hakkında', 'İletişim'], keywords: `eposta mail iletisim ${AUTHOR.email}`, icon: '✉️', run: () => (window.location.href = `mailto:${AUTHOR.email}`) });

  /* --- commands --- */
  const cmd = (title: string, run: () => void, keywords = '', icon = '⚡') => add({ id: `cmd-${title}`, type: 'command', title, path: ['Komut'], keywords, icon, run });
  cmd('Tema: Açık', () => useTheme.getState().setMode('light'), 'tema light acik', '☀️');
  cmd('Tema: Koyu', () => useTheme.getState().setMode('dark'), 'tema dark koyu gece', '🌙');
  cmd('Tema: Sistem', () => useTheme.getState().setMode('system'), 'tema system otomatik', '💻');
  cmd('Zili aç / kapat', () => useSettings.getState().set({ bell: !useSettings.getState().bell }), 'zil ses bell', '🔔');
  cmd('Sunumu başlat', () => (['step', 'break'].includes(app().live.phase) ? app().setView('live') : app().start()), 'baslat start', '▶');
  cmd('Yeni sunum', () => confirm('Yeni boş sunum açılsın mı?') && app().newPresentation(), 'yeni bos', '🆕');
  cmd('İçe aktar (.snmtdz / .json)', () => emit(APP_EVENTS.import), 'import ice aktar dosya ac', '📥');
  cmd('Dışa aktar: .snmtdz', () => void exportSnmtdz(app().pres), 'export kaydet', '💾');
  cmd('Dışa aktar: JSON', () => exportJson(app().pres), 'export json', '🧾');
  cmd('Dışa aktar: Markdown', () => exportMarkdown(app().pres), 'export md', '📝');
  cmd('PDF rapor oluştur', nav('report', 'report-export'), 'pdf yazdir', '📄');
  cmd('Kısayolları göster', () => app().setShortcutsOpen(true), 'klavye', '⌨️');
  cmd('Tam ekran sahne', () => {
    goTo('live');
    setTimeout(() => emit(APP_EVENTS.fullscreen), 120);
  }, 'fullscreen buyut', '⛶');

  /* --- templates & models --- */
  TEMPLATES.filter((t) => t.category !== 'cerceve').forEach((t) =>
    add({
      id: `t-${t.id}`,
      type: 'template',
      title: t.title,
      path: ['Şablonlar', CATEGORIES[t.category].label],
      body: `${t.description} ${t.steps.map((s) => `${s.title} ${s.text} ${(s.words ?? []).join(' ')}`).join(' ')}`,
      keywords: `${t.audience} ${t.level}`,
      icon: CATEGORIES[t.category].emoji,
      run: () => app().openTemplates(t.category, t.title),
    }),
  );
  FRAMEWORKS.forEach((f) =>
    add({
      id: `fw-${f.id}`,
      type: 'model',
      title: f.name,
      path: ['Modeller', FW_GROUPS[f.group].label],
      body: `${f.subtitle} ${f.desc} ${f.parts.join(' ')}`,
      keywords: f.subtitle,
      icon: FW_GROUPS[f.group].emoji,
      run: () => app().openTemplates('cerceve', f.name),
    }),
  );

  /* --- help --- */
  GUIDE.forEach((g) => {
    add({ id: `g-${g.id}`, type: 'guide', title: g.title, path: ['Kılavuz', g.category], body: g.summary, icon: g.emoji, run: () => app().openHelp('guide', g.id) });
    g.sections.forEach((s, i) =>
      add({
        id: `g-${g.id}-${i}`,
        type: 'guide',
        title: s.h,
        path: ['Kılavuz', g.category, g.title],
        body: [...(s.p ?? []), ...(s.ul ?? [])].join(' '),
        icon: '📖',
        run: () => {
          app().openHelp('guide', g.id);
          goTo('faq', `guide-${g.id}-${i}`);
        },
      }),
    );
  });
  FAQS.forEach((f, i) => add({ id: `faq-${i}`, type: 'faq', title: f.q, path: ['SSS', f.tag], body: f.a, icon: '❓', run: () => app().openHelp('faq', `faq-${i}`) }));
  TROUBLESHOOT.forEach((t, i) =>
    add({ id: `ts-${i}`, type: 'faq', title: t.symptom, path: ['Sorun giderme'], body: t.fixes.join(' '), icon: '🩺', run: () => app().openHelp('troubleshoot', `ts-${i}`) }),
  );
  SHORTCUTS.forEach((s) =>
    add({ id: `k-${s.id}`, type: 'shortcut', title: s.label, path: ['Kısayollar', s.scope], body: shortcutText(s), keywords: shortcutText(s), icon: '⌨️', run: () => app().setShortcutsOpen(true) }),
  );

  staticCache = out.map(fold);
  return staticCache;
}

/* ------------------------------------------------------------------ */
/* dynamic part: the user's own presentation                           */
/* ------------------------------------------------------------------ */
function contentItems(): SearchItem[] {
  const { pres, setActiveStep } = useApp.getState();
  const out: SearchItem[] = [];
  out.push({ id: 'p-title', type: 'content', title: pres.title, path: ['Sunumum'], body: `${pres.presenter} ${pres.audience}`, icon: '🎤', run: nav('setup') });
  pres.steps.forEach((s, i) => {
    const stepPath = ['Sunumum', `${i + 1}. adım`];
    out.push({ id: `p-step-${s.id}`, type: 'content', title: s.title, path: ['Sunumum', 'Adımlar'], body: s.text, icon: '⏳', run: () => setActiveStep(i) });
    s.canvas.forEach((el) => {
      if ((el.type === 'text' || el.type === 'sticky') && el.text)
        out.push({ id: `p-el-${el.id}`, type: 'content', title: el.text.split('\n')[0].slice(0, 80), path: [...stepPath, el.type === 'sticky' ? 'Tuval › Not kağıdı' : 'Tuval › Yazı'], body: el.text, icon: el.type === 'sticky' ? '📌' : '𝐓', run: () => setActiveStep(i) });
    });
    s.attachments.forEach((a) => out.push({ id: `p-att-${a.id}`, type: 'content', title: a.name, path: [...stepPath, 'Medya'], icon: '🗂️', run: () => setActiveStep(i) }));
    s.words.forEach((w) => out.push({ id: `p-w-${s.id}-${w}`, type: 'content', title: w, path: [...stepPath, 'Kelime tombalası'], icon: '🎱', run: () => setActiveStep(i) }));
    const walk = (nodes: typeof s.topicTree, trail: string[]) =>
      nodes.forEach((n) => {
        out.push({ id: `p-n-${n.id}`, type: 'content', title: n.label, path: [...stepPath, 'Konu ağacı', ...trail], icon: '🌳', run: () => setActiveStep(i) });
        walk(n.children, [...trail, n.label]);
      });
    walk(s.topicTree, []);
  });
  pres.notes.forEach((n) => out.push({ id: `p-note-${n.id}`, type: 'content', title: n.text.slice(0, 90), path: ['Sunumum', 'Notlar', `${n.stepIndex + 1}. adım`], body: n.text, icon: '📝', run: nav('report', 'report-notes') }));
  pres.chat.forEach((c) => out.push({ id: `p-chat-${c.id}`, type: 'content', title: c.text.slice(0, 90), path: ['Sunumum', 'Sohbet', c.name], body: c.text, icon: '💬', run: nav('report', 'report-chat') }));
  pres.transcript.forEach((t) => out.push({ id: `p-tr-${t.id}`, type: 'content', title: t.text.slice(0, 90), path: ['Sunumum', 'Döküm', `${t.stepIndex + 1}. adım`], body: t.text, icon: '🎙️', run: nav('report', 'report-transcript') }));
  return out.map(fold);
}

function fold(i: SearchItem): SearchItem {
  return { ...i, _t: foldTr(i.title), _p: foldTr(i.path.join(' ')), _k: foldTr(i.keywords ?? ''), _b: foldTr(i.body ?? '') };
}

export function buildIndex(): SearchItem[] {
  return [...contentItems(), ...staticItems()];
}

/* ------------------------------------------------------------------ */
/* scoring                                                             */
/* ------------------------------------------------------------------ */
/** Compact subsequence: all letters in order, spread over at most ~2× the query length (no scattered noise). */
export function subsequence(hay: string, needle: string): boolean {
  for (let start = hay.indexOf(needle[0]); start >= 0; start = hay.indexOf(needle[0], start + 1)) {
    let j = 1;
    let i = start + 1;
    for (; i < hay.length && j < needle.length && i - start < needle.length * 2; i++) if (hay[i] === needle[j]) j++;
    if (j === needle.length) return true;
  }
  return false;
}

/** Navigation-type results first: people mostly search to *go somewhere* or *do something*. */
const TYPE_BOOST: Record<SearchType, number> = { menu: 15, command: 14, content: 10, template: 6, model: 6, guide: 2, faq: 0, shortcut: -4 };

export function scoreItem(item: SearchItem, tokens: string[]): number {
  let score = 0;
  for (const tk of tokens) {
    const t = item._t!;
    let s = 0;
    if (t.startsWith(tk)) s += 40;
    else if (t.includes(` ${tk}`)) s += 26;
    else if (t.includes(tk)) s += 16;
    // fields add up: a setting whose keywords AND title mention the word beats a lone heading
    if (item._k!.includes(tk)) s += 9;
    if (item._p!.includes(tk)) s += 4;
    if (!s && item._b!.includes(tk)) s += 3;
    if (!s && tokens.length === 1 && tk.length >= 2 && subsequence(t, tk)) s += 1;
    if (!s) return 0;
    score += s;
  }
  if (item._t === tokens.join(' ')) score += 12;
  // guide sub-sections (path: Kılavuz › kategori › makale) rank below whole articles
  if (item.type === 'guide' && item.path.length > 2) score -= 6;
  return score + TYPE_BOOST[item.type] - Math.min(10, item.title.length / 12);
}

/** Character-level fold that keeps string length (for highlighting). */
export function foldChars(s: string): string {
  return Array.from(s, (ch) => {
    const f = foldTr(ch);
    if (f.length === 1) return f;
    // keep length identical (emoji / surrogate pairs stay as-is)
    return ch.length === 1 ? ch.toLocaleLowerCase('tr-TR').charAt(0) || ch : ch;
  }).join('');
}
