// client/src/lib/catalog.ts
import type { BreakActivity, Emotion, RoleplayConfig, Setting, TimeOfDay, Tone } from '../types';

export const EMOTIONS: Record<Emotion, { label: string; emoji: string; tip: string; color: string }> = {
  neutral: { label: 'Nötr', emoji: '😐', tip: 'Dengeli ses tonu, net cümleler.', color: '#64748b' },
  sad: { label: 'Üzgün', emoji: '😢', tip: 'Yavaş konuş, duraksamaları kullan, omuzları hafif düşür.', color: '#3b82f6' },
  angry: { label: 'Kızgın', emoji: '😠', tip: 'Kısa ve vurgulu cümleler, sert jestler, yüksek tempo.', color: '#ef4444' },
  joyful: { label: 'Sevinçli', emoji: '😄', tip: 'Gülümse, açık beden dili, melodik ses.', color: '#f59e0b' },
  excited: { label: 'Heyecanlı', emoji: '🤩', tip: 'Hızlı tempo, yükselen ton, el hareketleri bol.', color: '#ec4899' },
  scared: { label: 'Korkmuş', emoji: '😨', tip: 'Fısıltıya yakın ses, temkinli bakışlar, kısa nefesler.', color: '#8b5cf6' },
  surprised: { label: 'Şaşkın', emoji: '😲', tip: 'Kaşlar yukarı, ani duraksamalar, soru cümleleri.', color: '#14b8a6' },
  calm: { label: 'Sakin', emoji: '😌', tip: 'Derin nefes, yumuşak ses, yavaş el hareketleri.', color: '#22c55e' },
  nostalgic: { label: 'Nostaljik', emoji: '🥹', tip: '“Hatırlıyorum da…” diye başla, hikâye anlat.', color: '#a16207' },
};

export const TONES: Record<Tone, { label: string; tip: string }> = {
  serious: { label: 'Ciddi', tip: 'Veriye dayan, şakadan kaçın.' },
  friendly: { label: 'Samimi', tip: '“Biz” dili kullan, göz teması kur.' },
  humorous: { label: 'Esprili', tip: 'Her bölümde bir espri ya da benzetme ekle.' },
  formal: { label: 'Resmi', tip: 'Hitap kurallarına uy, kısaltma kullanma.' },
  inspiring: { label: 'İlham verici', tip: 'Vizyon cümleleri ve güçlü kapanışlar.' },
};

export const SETTINGS: Record<Setting, { label: string; emoji: string; tip: string }> = {
  stage: { label: 'Sahnede', emoji: '🎤', tip: 'Sahneyi kullan, sesini arka sıraya ulaştır.' },
  family: { label: 'Aile ortamı', emoji: '🏡', tip: 'Jargon yok; büyükannenin anlayacağı dil.' },
  elevator: { label: 'Asansörde yabancılarla', emoji: '🛗', tip: 'Her şey 30 saniyede anlaşılmalı — özle başla.' },
  meeting: { label: 'Toplantı odası', emoji: '💼', tip: 'Karar ve aksiyon odaklı konuş.' },
  cafe: { label: 'Kafede', emoji: '☕', tip: 'Rahat, sohbet havasında, sorular sor.' },
  classroom: { label: 'Sınıfta', emoji: '🏫', tip: 'Örnekle öğret, kontrol soruları sor.' },
  online: { label: 'Online toplantı', emoji: '💻', tip: 'Kameraya bak, ekranı aktif kullan.' },
  interview: { label: 'Mülakatta', emoji: '🧑‍💼', tip: 'STAR yöntemi: Durum-Görev-Aksiyon-Sonuç.' },
  street: { label: 'Sokak röportajı', emoji: '🚶', tip: 'Dikkat süresi kısa, merak uyandır.' },
};

export const TIMES: Record<TimeOfDay, { label: string; emoji: string }> = {
  morning: { label: 'Sabah', emoji: '🌅' },
  noon: { label: 'Öğle', emoji: '☀️' },
  evening: { label: 'Akşam', emoji: '🌇' },
  night: { label: 'Gece', emoji: '🌙' },
};

export const CROWD: Record<number, string> = {
  1: 'Birebir',
  2: 'Küçük grup (3-5)',
  3: 'Ekip (10-20)',
  4: 'Salon (50+)',
  5: 'Kalabalık (500+)',
};

export const BREAK_ACTIVITIES: Record<BreakActivity, { label: string; emoji: string; minSec: number }> = {
  breathing: { label: 'Nefes 4-4-4 × 2', emoji: '🫁', minSec: 24 },
  stretch: { label: 'El, kol, boyun esneme', emoji: '🤸', minSec: 15 },
  water: { label: 'Su iç', emoji: '💧', minSec: 10 },
  silent: { label: 'Sessiz bekleme', emoji: '🤫', minSec: 0 },
};

export const STRETCH_MOVES = [
  { emoji: '🙆', text: 'Kollarını yukarı uzat, parmaklarını kenetle' },
  { emoji: '↔️', text: 'Boynunu yavaşça sağa eğ… sonra sola' },
  { emoji: '🔄', text: 'Omuzlarını geriye doğru 5 kez çevir' },
  { emoji: '✋', text: 'Ellerini aç-kapa, bileklerini çevir' },
  { emoji: '🤲', text: 'Kollarını öne uzat, avuç içlerini kendine çek' },
  { emoji: '🧘', text: 'Dik otur, sırtını hafifçe geriye esnet' },
];

export const WORD_BANK = [
  'gelecek', 'cesaret', 'deneyim', 'hata', 'ekip', 'kahve', 'yolculuk', 'müşteri', 'fikir', 'zaman',
  'oyun', 'topluluk', 'veri', 'risk', 'hayal', 'başarısızlık', 'ilham', 'merak', 'çocukluk', 'teknoloji',
  'dönüm noktası', 'sürpriz', 'bütçe', 'empati', 'rekabet', 'mentor', 'alışkanlık', 'kriz', 'odak', 'sabır',
  'yapay zekâ', 'harita', 'köprü', 'rüzgâr', 'tohum', 'pusula', 'anahtar', 'ayna', 'merdiven', 'deniz',
];

export const REACTIONS = ['👏', '❤️', '😂', '🤯', '🔥', '🤔', '👍', '🎉'] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomRoleplay(base: RoleplayConfig): RoleplayConfig {
  return {
    ...base,
    emotion: pick(Object.keys(EMOTIONS) as Emotion[]),
    tone: pick(Object.keys(TONES) as Tone[]),
    setting: pick(Object.keys(SETTINGS) as Setting[]),
    timeOfDay: pick(Object.keys(TIMES) as TimeOfDay[]),
    crowd: pick([1, 2, 3, 4, 5] as const),
  };
}

export function roleplaySentence(r: RoleplayConfig): string {
  const e = EMOTIONS[r.emotion];
  const s = SETTINGS[r.setting];
  const t = TIMES[r.timeOfDay];
  return `${e.emoji} ${e.label} bir ruh hâliyle, ${TONES[r.tone].label.toLocaleLowerCase('tr-TR')} bir tonda — ${s.emoji} ${s.label.toLocaleLowerCase('tr-TR')}, ${t.emoji} ${t.label.toLocaleLowerCase('tr-TR')} saatinde, ${CROWD[r.crowd].toLocaleLowerCase('tr-TR')} kitleye anlat.`;
}

export function roleplayTips(r: RoleplayConfig): string[] {
  const crowdTip =
    r.crowd <= 2 ? 'Az kişi: göz teması ve isimle hitap.' : r.crowd >= 4 ? 'Büyük kitle: jestleri büyüt, salonu bölgelere ayırıp bak.' : 'Orta grup: soru sorarak katılımı artır.';
  return [EMOTIONS[r.emotion].tip, TONES[r.tone].tip, SETTINGS[r.setting].tip, crowdTip];
}
