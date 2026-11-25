// client/src/lib/shortcuts.ts — single source of truth for keyboard shortcuts (handler, modal, guide, search)

export type ShortcutScope = 'Genel' | 'Gezinme' | 'Sunum' | 'Tuval' | 'Slayt & PDF' | 'Not & Döküm';

export interface Shortcut {
  id: string;
  /** display keys, e.g. ['Ctrl', 'K'] — 'Mod' renders as ⌘ on macOS, Ctrl elsewhere */
  keys: string[][];
  label: string;
  scope: ShortcutScope;
}

export const SHORTCUTS: Shortcut[] = [
  { id: 'search', keys: [['Mod', 'K'], ['/']], label: 'Arama / komut paletini aç', scope: 'Genel' },
  { id: 'help', keys: [['?']], label: 'Kısayol listesini göster', scope: 'Genel' },
  { id: 'theme', keys: [['Shift', 'T']], label: 'Temayı değiştir (açık → koyu → sistem)', scope: 'Genel' },
  { id: 'export', keys: [['Mod', 'S']], label: 'Sunumu .snmtdz olarak kaydet', scope: 'Genel' },
  { id: 'import', keys: [['Mod', 'O']], label: '.snmtdz / .json içe aktar', scope: 'Genel' },
  { id: 'start', keys: [['Mod', 'Enter']], label: 'Sunumu başlat / sunuma dön', scope: 'Genel' },
  { id: 'esc', keys: [['Esc']], label: 'Pencereyi, menüyü veya tam ekranı kapat', scope: 'Genel' },

  { id: 'go-setup', keys: [['G', 'H']], label: 'Hazırlık', scope: 'Gezinme' },
  { id: 'go-live', keys: [['G', 'S']], label: 'Sunum', scope: 'Gezinme' },
  { id: 'go-report', keys: [['G', 'R']], label: 'Rapor & SWOT', scope: 'Gezinme' },
  { id: 'go-templates', keys: [['G', 'T']], label: 'Şablonlar', scope: 'Gezinme' },
  { id: 'go-models', keys: [['G', 'M']], label: 'Çerçeveler & modeller', scope: 'Gezinme' },
  { id: 'go-help', keys: [['G', 'Y']], label: 'Yardım merkezi', scope: 'Gezinme' },

  { id: 'next', keys: [['→'], ['PgDn']], label: 'Sonraki adım', scope: 'Sunum' },
  { id: 'prev', keys: [['←'], ['PgUp']], label: 'Önceki adım', scope: 'Sunum' },
  { id: 'pause', keys: [['Boşluk']], label: 'Duraklat / devam (duraklatınca adım numaralarıyla gezin)', scope: 'Sunum' },
  { id: 'fullscreen', keys: [['F']], label: 'Tam ekran sahne', scope: 'Sunum' },
  { id: 'bell', keys: [['B']], label: 'Zili aç / kapat', scope: 'Sunum' },

  { id: 'c-select', keys: [['V']], label: 'Seç / taşı / döndür', scope: 'Tuval' },
  { id: 'c-pen', keys: [['P']], label: 'Kalem', scope: 'Tuval' },
  { id: 'c-hl', keys: [['H']], label: 'Fosforlu kalem', scope: 'Tuval' },
  { id: 'c-eraser', keys: [['E']], label: 'Silgi', scope: 'Tuval' },
  { id: 'c-line', keys: [['L']], label: 'Çizgi', scope: 'Tuval' },
  { id: 'c-arrow', keys: [['A']], label: 'Ok', scope: 'Tuval' },
  { id: 'c-rect', keys: [['R']], label: 'Dikdörtgen', scope: 'Tuval' },
  { id: 'c-ellipse', keys: [['O']], label: 'Elips', scope: 'Tuval' },
  { id: 'c-text', keys: [['T']], label: 'Yazı — tıkla ve yaz', scope: 'Tuval' },
  { id: 'c-sticky', keys: [['N']], label: 'Not kağıdı', scope: 'Tuval' },
  { id: 'c-edit', keys: [['Enter'], ['Çift tık']], label: 'Seçili yazıyı / notu düzenle', scope: 'Tuval' },
  { id: 'c-commit', keys: [['Mod', 'Enter']], label: 'Yazıyı bitir (Esc: vazgeç)', scope: 'Tuval' },
  { id: 'c-del', keys: [['Del'], ['Backspace']], label: 'Seçili öğeyi sil', scope: 'Tuval' },
  { id: 'c-dup', keys: [['Mod', 'D']], label: 'Çoğalt', scope: 'Tuval' },
  { id: 'c-undo', keys: [['Mod', 'Z']], label: 'Geri al', scope: 'Tuval' },
  { id: 'c-redo', keys: [['Mod', 'Y'], ['Mod', 'Shift', 'Z']], label: 'Yinele', scope: 'Tuval' },
  { id: 'c-nudge', keys: [['Ok tuşları'], ['Shift', 'Ok']], label: 'Seçili öğeyi kaydır (4 / 20 birim)', scope: 'Tuval' },
  { id: 'c-shift', keys: [['Shift', 'Sürükle']], label: 'Döndürürken 15° adım · boyutlarken oran kilidini değiştir', scope: 'Tuval' },

  { id: 's-next', keys: [['→'], ['PgDn']], label: 'Sonraki slayt / PDF sayfası (slayt odaktayken)', scope: 'Slayt & PDF' },
  { id: 's-prev', keys: [['←'], ['PgUp']], label: 'Önceki slayt / sayfa', scope: 'Slayt & PDF' },
  { id: 's-zoom', keys: [['+'], ['−']], label: 'Yakınlaştır / uzaklaştır', scope: 'Slayt & PDF' },
  { id: 's-swipe', keys: [['Kaydır']], label: 'Dokunmatikte sağa-sola kaydırarak geç', scope: 'Slayt & PDF' },

  { id: 'n-add', keys: [['Mod', 'Enter']], label: 'Notu ekle', scope: 'Not & Döküm' },
];

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const keyLabel = (k: string) => (k === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : k);
export const comboText = (combo: string[]) => combo.map(keyLabel).join(' + ');
export const shortcutText = (s: Shortcut) => s.keys.map(comboText).join('  /  ');
