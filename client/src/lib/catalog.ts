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

/* ---------------- transitions (breaks): breathing, calm, focus, body, care ---------------- */
export type BreathShape = 'in' | 'hold' | 'out' | 'rest';
export interface BreathPattern {
  phases: { label: string; sec: number; shape: BreathShape }[];
  rounds: number;
  tip: string;
}
/** paced breathing — the circle follows the phases */
export const BREATH_PATTERNS: Partial<Record<BreakActivity, BreathPattern>> = {
  box: {
    phases: [
      { label: 'Nefes al', sec: 4, shape: 'in' },
      { label: 'Tut', sec: 4, shape: 'hold' },
      { label: 'Bırak', sec: 4, shape: 'out' },
      { label: 'Boş bekle', sec: 4, shape: 'rest' },
    ],
    rounds: 2,
    tip: 'Kutu nefesi: 4 al · 4 tut · 4 ver · 4 bekle. Sinirleri yatıştırır, odak getirir.',
  },
  relax478: {
    phases: [
      { label: 'Burnundan al', sec: 4, shape: 'in' },
      { label: 'Tut', sec: 7, shape: 'hold' },
      { label: 'Ağzından yavaşça ver', sec: 8, shape: 'out' },
    ],
    rounds: 2,
    tip: '4-7-8 rahatlama nefesi: uzun nefes verişi bedeni sakinleştirir.',
  },
  coherent: {
    phases: [
      { label: 'Nefes al', sec: 5, shape: 'in' },
      { label: 'Nefes ver', sec: 5, shape: 'out' },
    ],
    rounds: 3,
    tip: 'Uyum nefesi: dakikada ~6 nefes; kalp ritmini dengeler, dinginlik verir.',
  },
  sigh: {
    phases: [
      { label: 'Derin al', sec: 2, shape: 'in' },
      { label: 'Bir yudum daha al', sec: 1, shape: 'hold' },
      { label: 'Uzun uzun ver', sec: 6, shape: 'out' },
    ],
    rounds: 3,
    tip: 'Fizyolojik iç çekiş: iki kısa alış, bir uzun veriş. Stresi en hızlı düşüren nefes.',
  },
};

export interface GuidedStep {
  emoji: string;
  text: string;
  sec: number;
}
/** guided micro-routines — one prompt after another */
export const GUIDED: Partial<Record<BreakActivity, GuidedStep[]>> = {
  bodyscan: [
    { emoji: '🧠', text: 'Dikkatini başının tepesine getir, alnını gevşet', sec: 5 },
    { emoji: '😌', text: 'Çeneni bırak, dişlerini ayır, dilini gevşet', sec: 5 },
    { emoji: '🫳', text: 'Omuzlarını kulaklarından uzaklaştır', sec: 5 },
    { emoji: '🫁', text: 'Göğsünün inip kalkışını sadece izle', sec: 5 },
    { emoji: '🤲', text: 'Ellerini ve parmaklarını yumuşat', sec: 5 },
    { emoji: '🦶', text: 'Ayak tabanlarının yere bastığını hisset', sec: 5 },
  ],
  grounding: [
    { emoji: '👀', text: 'Çevrende gördüğün 5 şeyi sessizce say', sec: 6 },
    { emoji: '✋', text: 'Dokunduğun 4 şeyi hisset', sec: 6 },
    { emoji: '👂', text: 'Duyduğun 3 sesi fark et', sec: 6 },
    { emoji: '👃', text: 'Aldığın 2 kokuyu bul', sec: 5 },
    { emoji: '👅', text: 'Ağzındaki 1 tadı fark et', sec: 5 },
  ],
  gratitude: [
    { emoji: '🙏', text: 'Bugün minnettar olduğun bir şeyi düşün', sec: 7 },
    { emoji: '💛', text: 'Hayatına değer katan bir kişiyi hatırla', sec: 7 },
    { emoji: '🌱', text: 'Kendinde takdir ettiğin bir özelliği söyle', sec: 7 },
  ],
  affirm: [
    { emoji: '✨', text: 'Hazırım. Bu konuyu biliyorum.', sec: 5 },
    { emoji: '🎯', text: 'Mesajım net, sesim sakin.', sec: 5 },
    { emoji: '🤝', text: 'Dinleyenlerim bana destek oluyor.', sec: 5 },
    { emoji: '🌊', text: 'Hata olursa akışla devam ederim.', sec: 5 },
  ],
  focus: [
    { emoji: '🎯', text: 'Bakışını ortadaki noktaya sabitle', sec: 6 },
    { emoji: '🫁', text: 'Her nefeste dikkatini noktaya geri getir', sec: 7 },
    { emoji: '🧘', text: 'Düşünceler gelirse sadece fark et, bırak', sec: 7 },
  ],
  visualize: [
    { emoji: '🎬', text: 'Bir sonraki adımı akıcı anlattığını gör', sec: 6 },
    { emoji: '😊', text: 'Dinleyenlerin başını salladığını hayal et', sec: 6 },
    { emoji: '🏁', text: 'Adımı güvenle bitirdiğin anı hisset', sec: 6 },
  ],
  intention: [
    { emoji: '💡', text: 'Bir sonraki adımda vereceğin tek mesaj ne?', sec: 7 },
    { emoji: '👥', text: 'Dinleyen ondan ne alıp gidecek?', sec: 7 },
    { emoji: '✍️', text: 'O mesajı tek cümleyle içinden söyle', sec: 6 },
  ],
  eyes: [
    { emoji: '🔭', text: 'Ekrandan başını kaldır, 6 metre uzağa bak', sec: 8 },
    { emoji: '😌', text: 'Gözlerini yavaşça 5 kez kırp', sec: 5 },
    { emoji: '🙈', text: 'Avuçlarını ısıt, gözlerine kapat', sec: 7 },
  ],
  posture: [
    { emoji: '🦶', text: 'İki ayağını yere sağlam bas', sec: 4 },
    { emoji: '🧍', text: 'Omurganı uzat, başının tepesinden çekiliyor gibi', sec: 5 },
    { emoji: '🫳', text: 'Omuzları geri ve aşağı bırak', sec: 4 },
    { emoji: '🙂', text: 'Çeneni yere paralel tut, gülümse', sec: 4 },
  ],
  shake: [
    { emoji: '👐', text: 'Ellerini 5 saniye silkele', sec: 5 },
    { emoji: '💪', text: 'Omuzlarını yukarı çek, bırak — 3 kez', sec: 5 },
    { emoji: '🦵', text: 'Dizlerini hafifçe esnetip yaylan', sec: 5 },
    { emoji: '⚡', text: 'Derin bir nefes al, enerjiyi hisset', sec: 4 },
  ],
  smile: [
    { emoji: '😁', text: 'Kocaman gülümse, 3 saniye tut', sec: 4 },
    { emoji: '😮', text: 'Ağzını genişçe aç, yanaklarını gevşet', sec: 4 },
    { emoji: '😗', text: 'Dudaklarını titreterek “brrr” yap — ses ısınması', sec: 5 },
    { emoji: '🙂', text: 'Yüzünü bırak, hafif bir gülümsemeyle kal', sec: 4 },
  ],
};

const sumPattern = (p?: BreathPattern) => (p ? p.phases.reduce((a, x) => a + x.sec, 0) * p.rounds : 0);
const sumGuided = (g?: GuidedStep[]) => (g ? g.reduce((a, x) => a + x.sec, 0) : 0);

export const BREAK_ACTIVITIES: Record<BreakActivity, { label: string; emoji: string; minSec: number }> = {
  breathing: { label: 'Nefes 4-4-4 × 2', emoji: '🫁', minSec: 24 },
  box: { label: 'Kutu nefesi 4-4-4-4', emoji: '⬜', minSec: sumPattern(BREATH_PATTERNS.box) },
  relax478: { label: '4-7-8 rahatlama', emoji: '🌙', minSec: sumPattern(BREATH_PATTERNS.relax478) },
  coherent: { label: 'Uyum nefesi 5-5', emoji: '🌊', minSec: sumPattern(BREATH_PATTERNS.coherent) },
  sigh: { label: 'Fizyolojik iç çekiş', emoji: '😮‍💨', minSec: sumPattern(BREATH_PATTERNS.sigh) },
  bodyscan: { label: 'Beden taraması', emoji: '🧘', minSec: sumGuided(GUIDED.bodyscan) },
  grounding: { label: '5-4-3-2-1 topraklanma', emoji: '🌿', minSec: sumGuided(GUIDED.grounding) },
  gratitude: { label: 'Şükran anı', emoji: '🙏', minSec: sumGuided(GUIDED.gratitude) },
  affirm: { label: 'Olumlamalar', emoji: '✨', minSec: sumGuided(GUIDED.affirm) },
  focus: { label: 'Tek nokta odak', emoji: '🎯', minSec: sumGuided(GUIDED.focus) },
  visualize: { label: 'Başarı imgeleme', emoji: '🎬', minSec: sumGuided(GUIDED.visualize) },
  intention: { label: 'Niyet: tek mesaj', emoji: '💡', minSec: sumGuided(GUIDED.intention) },
  stretch: { label: 'El, kol, boyun esneme', emoji: '🤸', minSec: 15 },
  eyes: { label: 'Göz dinlendirme 20-20-20', emoji: '👀', minSec: sumGuided(GUIDED.eyes) },
  posture: { label: 'Duruş kontrolü', emoji: '🧍', minSec: sumGuided(GUIDED.posture) },
  shake: { label: 'Enerji silkelenmesi', emoji: '⚡', minSec: sumGuided(GUIDED.shake) },
  smile: { label: 'Gülümse & yüz/ses ısınması', emoji: '😁', minSec: sumGuided(GUIDED.smile) },
  water: { label: 'Su iç', emoji: '💧', minSec: 10 },
  silent: { label: 'Sessiz bekleme', emoji: '🤫', minSec: 0 },
};

/** grouped for the setup picker */
export const BREAK_GROUPS: { label: string; emoji: string; acts: BreakActivity[] }[] = [
  { label: 'Nefes', emoji: '🫁', acts: ['breathing', 'box', 'relax478', 'coherent', 'sigh'] },
  { label: 'Dinginlik & wellness', emoji: '🧘', acts: ['bodyscan', 'grounding', 'gratitude', 'affirm'] },
  { label: 'Odaklanma', emoji: '🎯', acts: ['focus', 'visualize', 'intention'] },
  { label: 'Beden & enerji', emoji: '💪', acts: ['stretch', 'eyes', 'posture', 'shake', 'smile'] },
  { label: 'Mola', emoji: '☕', acts: ['water', 'silent'] },
];

/** ready-made mixes */
export const BREAK_PRESETS: { label: string; acts: BreakActivity[] }[] = [
  { label: '🧘 Dingin', acts: ['coherent', 'bodyscan', 'relax478', 'grounding'] },
  { label: '🎯 Odak', acts: ['box', 'intention', 'focus', 'visualize'] },
  { label: '⚡ Enerji', acts: ['sigh', 'shake', 'posture', 'smile'] },
  { label: '🌿 Wellness', acts: ['breathing', 'gratitude', 'eyes', 'water'] },
];

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
