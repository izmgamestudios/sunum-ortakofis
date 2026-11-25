// client/src/lib/report.ts
import type { Emotion, NoteKind, Presentation, Swot, TopicNode } from '../types';
import { speechStats, type SpeechStats } from './speechMatch';

export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function fmtClock(ms: number): string {
  const neg = ms < 0;
  const s = Math.ceil(Math.abs(ms) / 1000);
  return `${neg ? '+' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function countNodes(nodes: TopicNode[]): { total: number; visited: number } {
  return nodes.reduce(
    (acc, n) => {
      const c = countNodes(n.children);
      return { total: acc.total + 1 + c.total, visited: acc.visited + (n.visited ? 1 : 0) + c.visited };
    },
    { total: 0, visited: 0 },
  );
}

export interface StepReport {
  index: number;
  title: string;
  plannedSec: number;
  actualSec: number | null;
  deviationPct: number | null;
  roleplay?: string;
  emotion?: Emotion;
  wordsTotal: number;
  wordsDrawn: number;
  wordsMarked: number;
  nodesTotal: number;
  nodesVisited: number;
  notes: number;
  chat: number;
}

export interface Report {
  steps: StepReport[];
  plannedSec: number;
  actualSec: number;
  breakSec: number;
  breaksTaken: number;
  timeScore: number;
  engagementScore: number;
  contentScore: number;
  overallScore: number;
  reactionTotal: number;
  topReaction: string | null;
  questions: number;
  notesByKind: Record<NoteKind, number>;
  emotionsUsed: Emotion[];
  swot: Swot;
  autoSwot: Swot;
  badges: { emoji: string; label: string }[];
  speech: SpeechStats & { wpm: number | null; autoMarked: number; segments: number };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function buildReport(p: Presentation): Report {
  const steps: StepReport[] = p.steps.map((s, i) => {
    const runs = p.run.steps.filter((r) => r.stepIndex === i);
    const actual = runs.length ? runs.reduce((a, r) => a + (r.actualSec ?? 0), 0) : null;
    const last = runs[runs.length - 1];
    const nodes = countNodes(s.topicTree);
    return {
      index: i,
      title: s.title,
      plannedSec: s.durationSec,
      actualSec: actual,
      deviationPct: actual != null && s.durationSec ? Math.round(((actual - s.durationSec) / s.durationSec) * 100) : null,
      roleplay: last?.roleplay,
      emotion: last?.emotion,
      wordsTotal: s.words.length,
      wordsDrawn: s.drawnWords.length,
      wordsMarked: s.markedWords.length,
      nodesTotal: nodes.total,
      nodesVisited: nodes.visited,
      notes: p.notes.filter((n) => n.stepIndex === i).length,
      chat: p.chat.filter((c) => c.stepIndex === i).length,
    };
  });

  const done = steps.filter((s) => s.actualSec != null);
  const plannedSec = steps.reduce((a, s) => a + s.plannedSec, 0);
  const actualSec = done.reduce((a, s) => a + (s.actualSec ?? 0), 0);
  const breakSec = p.run.breaks.reduce((a, b) => a + (b.actualSec ?? 0), 0);
  const avgDev = done.length ? done.reduce((a, s) => a + Math.abs(s.deviationPct ?? 0), 0) / done.length : 100;
  const completion = steps.length ? done.length / steps.length : 0;
  const timeScore = Math.round(clamp(100 - avgDev) * completion);

  const reactionEntries = Object.entries(p.run.reactions).sort((a, b) => b[1] - a[1]);
  const reactionTotal = reactionEntries.reduce((a, [, n]) => a + n, 0);
  const questions = p.chat.filter((c) => !c.fromPresenter && c.text.includes('?')).length;
  const audienceMsgs = p.chat.filter((c) => !c.fromPresenter).length;
  const engagementScore = Math.round(clamp(reactionTotal * 2 + audienceMsgs * 5 + questions * 5 + p.run.suggestedWords.length * 3));

  const wordsTotal = steps.reduce((a, s) => a + s.wordsDrawn, 0);
  const wordsMarked = steps.reduce((a, s) => a + s.wordsMarked, 0);
  const nodesTotal = steps.reduce((a, s) => a + s.nodesTotal, 0);
  const nodesVisited = steps.reduce((a, s) => a + s.nodesVisited, 0);
  const wordCov = wordsTotal ? wordsMarked / wordsTotal : null;
  const treeCov = nodesTotal ? nodesVisited / nodesTotal : null;
  const covs = [wordCov, treeCov].filter((x): x is number => x != null);
  const contentScore = Math.round(clamp((covs.length ? (covs.reduce((a, b) => a + b, 0) / covs.length) * 70 : 50) + Math.min(30, p.notes.length * 5)));
  const overallScore = Math.round(timeScore * 0.4 + engagementScore * 0.3 + contentScore * 0.3);

  const notesByKind = { note: 0, quote: 0, action: 0, idea: 0, question: 0 } as Record<NoteKind, number>;
  p.notes.forEach((n) => (notesByKind[n.kind] = (notesByKind[n.kind] ?? 0) + 1));
  const emotionsUsed = Array.from(new Set(p.run.steps.map((r) => r.emotion).filter((e): e is Emotion => !!e)));

  /* ---------- speech ---------- */
  const st = speechStats((p.transcript ?? []).map((t) => t.text));
  const speechSec = (p.transcript ?? []).length ? actualSec : 0;
  const speech = {
    ...st,
    wpm: st.words >= 30 && speechSec > 0 ? Math.round(st.words / (speechSec / 60)) : null,
    autoMarked: p.run.autoMarked ?? 0,
    segments: (p.transcript ?? []).length,
  };

  /* ---------- automatic SWOT ---------- */
  const auto: Swot = { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  const over = done.filter((s) => (s.deviationPct ?? 0) > 15);
  const under = done.filter((s) => (s.deviationPct ?? 0) < -30);
  const skippedBreaks = p.run.breaks.filter((b) => (b.actualSec ?? 0) < 5).length;

  if (timeScore >= 80) auto.strengths.push(`Zaman yönetimi güçlü (skor ${timeScore}/100) — adımlar plana sadık kaldı.`);
  if (reactionTotal >= 10) auto.strengths.push(`Kitle etkileşimi yüksek: ${reactionTotal} tepki${reactionEntries[0] ? `, en çok ${reactionEntries[0][0]}` : ''}.`);
  if (wordCov != null && wordCov >= 0.7) auto.strengths.push(`Tombala kelimelerinin %${Math.round(wordCov * 100)}'ini akışa bağladın — doğaçlama becerisi yüksek.`);
  if (treeCov != null && treeCov >= 0.8) auto.strengths.push(`Konu ağacının %${Math.round(treeCov * 100)}'i işlendi — yapı eksiksiz.`);
  if (emotionsUsed.length >= 3) auto.strengths.push(`${emotionsUsed.length} farklı duygu ile sunum yaptın — sahne esnekliği.`);
  if (notesByKind.quote >= 2) auto.strengths.push(`${notesByKind.quote} alıntılanabilir cümle üretildi.`);
  if (p.run.breaks.length && !skippedBreaks) auto.strengths.push('Molalar düzenli kullanıldı — enerji yönetimi iyi.');
  if (speech.words >= 100 && speech.fillerRate < 0.015) auto.strengths.push(`Akıcı konuşma: dolgu kelimesi oranı %${(speech.fillerRate * 100).toFixed(1)}.`);
  if (speech.wpm != null && speech.wpm >= 110 && speech.wpm <= 160) auto.strengths.push(`Konuşma hızı ideal aralıkta (${speech.wpm} kelime/dk).`);
  if (speech.autoMarked >= 3) auto.strengths.push(`${speech.autoMarked} anahtar kelime/başlık konuşmada doğal olarak geçti (otomatik tespit).`);

  over.forEach((s) => auto.weaknesses.push(`${s.index + 1}. adım planı %${s.deviationPct} aştı (${fmtDuration(s.actualSec ?? 0)} / ${fmtDuration(s.plannedSec)}).`));
  if (under.length) auto.weaknesses.push(`${under.length} adım erken bitti — içerik derinliği artırılabilir.`);
  if (completion < 1) auto.weaknesses.push(`${steps.length - done.length} adım tamamlanmadı.`);
  if (wordCov != null && wordCov < 0.4) auto.weaknesses.push('Çekilen tombala kelimelerinin çoğu konuşmaya bağlanamadı.');
  if (skippedBreaks) auto.weaknesses.push(`${skippedBreaks} mola atlandı / çok kısa tutuldu.`);
  if (!p.notes.length) auto.weaknesses.push('Sunum sırasında hiç not alınmadı — kazanımlar kaybolabilir.');
  if (speech.words >= 50 && speech.fillerRate >= 0.03)
    auto.weaknesses.push(`Dolgu kelimeleri yüksek (%${(speech.fillerRate * 100).toFixed(1)}${speech.topFillers[0] ? `, en çok “${speech.topFillers[0][0]}”` : ''}) — duraksamayı sessizlikle değiştir.`);
  if (speech.wpm != null && speech.wpm > 170) auto.weaknesses.push(`Konuşma hızı yüksek (${speech.wpm} kelime/dk) — kitle takip etmekte zorlanabilir.`);
  if (speech.wpm != null && speech.wpm < 90) auto.weaknesses.push(`Konuşma hızı düşük (${speech.wpm} kelime/dk) — enerji düşük algılanabilir.`);

  if (questions) auto.opportunities.push(`Kitleden ${questions} soru geldi — SSS, blog veya takip içeriğine dönüştür.`);
  if (notesByKind.action) auto.opportunities.push(`${notesByKind.action} aksiyon maddesi çıktı — sprint backlog'una aktar.`);
  if (notesByKind.idea) auto.opportunities.push(`${notesByKind.idea} yeni fikir not edildi — sonraki sunumun konusu olabilir.`);
  if (p.run.suggestedWords.length) auto.opportunities.push(`Kitle ${p.run.suggestedWords.length} kelime önerdi — bir sonraki tombala havuzuna ekle.`);
  if (audienceMsgs >= 5) auto.opportunities.push('Aktif sohbet katılımcılarını topluluk kanalına davet et.');
  if (p.run.audiencePeak > 0) auto.opportunities.push(`Zirvede ${p.run.audiencePeak} eş zamanlı bağlantı — tekrar eden etkinliğe dönüştürülebilir.`);
  if (speech.words >= 200) auto.opportunities.push(`${speech.words} kelimelik döküm hazır — blog yazısı, bülten veya altyazıya dönüştür.`);
  if (!speech.segments) auto.opportunities.push('Döküm sekmesinden canlı yazıya dökmeyi aç — konuşma hızı ve dolgu kelimesi analizi alırsın.');
  if (!p.roleplay.enabled) auto.opportunities.push('Rol yapma modunu dene — farklı duygu/ortam provası anlatımı güçlendirir.');

  if (actualSec > plannedSec * 1.1) auto.threats.push(`Toplam süre planı %${Math.round(((actualSec - plannedSec) / plannedSec) * 100)} aştı — gerçek etkinlikte programdan sarkma riski.`);
  const confused = (p.run.reactions['🤔'] ?? 0) + (p.run.reactions['🤯'] ?? 0);
  if (reactionTotal >= 5 && confused / reactionTotal > 0.4) auto.threats.push('Kafa karışıklığı tepkileri yüksek — anlaşılırlık riski.');
  if (p.run.audiencePeak > 1 && audienceMsgs === 0 && reactionTotal === 0) auto.threats.push('Kitle bağlıydı ama pasif kaldı — ilgi kaybı riski.');
  const pausedSec = p.run.steps.reduce((a, s) => a + s.pausedSec, 0);
  if (pausedSec > 120) auto.threats.push(`Toplam ${fmtDuration(pausedSec)} duraklatma — akış kesintiye uğramış olabilir.`);

  const swot: Swot = {
    strengths: [...auto.strengths, ...p.swot.strengths],
    weaknesses: [...auto.weaknesses, ...p.swot.weaknesses],
    opportunities: [...auto.opportunities, ...p.swot.opportunities],
    threats: [...auto.threats, ...p.swot.threats],
  };

  /* ---------- gamification badges ---------- */
  const badges: Report['badges'] = [];
  if (timeScore >= 90) badges.push({ emoji: '⏱️', label: 'Saat Ustası' });
  if (emotionsUsed.length >= 4) badges.push({ emoji: '🎭', label: 'Bin Surat' });
  if (p.run.bingoCount > 0) badges.push({ emoji: '🎱', label: `Tombala ×${p.run.bingoCount}` });
  if (reactionTotal >= 25) badges.push({ emoji: '🔥', label: 'Salonu Ateşledin' });
  if (questions >= 3) badges.push({ emoji: '🙋', label: 'Merak Uyandırıcı' });
  if (p.run.breaks.length && !skippedBreaks) badges.push({ emoji: '🫁', label: 'Nefes Disiplini' });
  if (p.notes.length >= 10) badges.push({ emoji: '📝', label: 'Kayıt Makinesi' });
  if (completion === 1) badges.push({ emoji: '🏁', label: 'Tüm Adımlar Tamam' });
  if (speech.words >= 100 && speech.fillerRate < 0.01) badges.push({ emoji: '🎙️', label: 'Akıcı Konuşmacı' });
  if (speech.autoMarked >= 5) badges.push({ emoji: '🎯', label: 'Kelime Avcısı' });

  return {
    steps,
    plannedSec,
    actualSec,
    breakSec,
    breaksTaken: p.run.breaks.length,
    timeScore,
    engagementScore,
    contentScore,
    overallScore,
    reactionTotal,
    topReaction: reactionEntries[0]?.[0] ?? null,
    questions,
    notesByKind,
    emotionsUsed,
    swot,
    autoSwot: auto,
    badges,
    speech,
  };
}
