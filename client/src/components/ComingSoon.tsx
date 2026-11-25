// client/src/components/ComingSoon.tsx — blurred teaser for the upcoming AI coach (no API calls, purely visual)
export function AiCoachTeaser({ variant }: { variant: 'report' | 'setup' }) {
  const lines =
    variant === 'report'
      ? [
          ['🎯 Net mesaj', 'Ana fikrin ilk 40 saniyede netleşti; kapanışta tekrar vurgula.'],
          ['⏱️ Hız', 'Dakikada 148 kelime — 3. adımda biraz yavaşla.'],
          ['🧹 Dolgu kelimeler', '“yani” 12 kez, “şey” 7 kez geçti.'],
          ['💡 Öneri', 'Değer önerini müşteri acısıyla açarak başla.'],
        ]
      : [
          ['📝 Konudan taslak', 'Başlık + kitle + süre gir, adımlar ve metinler hazır gelsin.'],
          ['🧩 Çerçeve önerisi', 'Konuna uygun kanvas ve şablon önerisi.'],
          ['🎤 Prova geri bildirimi', 'Dökümünden 3 somut gelişim önerisi.'],
        ];
  return (
    <section className="card coming-soon" data-anchor={`ai-coach-${variant}`} aria-label="AI Koç — pek yakında">
      <div className="coming-soon__blur" aria-hidden="true">
        <h3 className="card-title">🤖 AI Koç notları</h3>
        {lines.map(([k, v]) => (
          <p key={k}>
            <b>{k}:</b> {v}
          </p>
        ))}
      </div>
      <div className="coming-soon__overlay">
        <span className="coming-soon__badge">✨ Pek yakında</span>
        <strong>🤖 AI Sunum Koçu</strong>
        <span className="muted small">{variant === 'report' ? 'Sunumun bittiğinde kişisel koç notların burada olacak.' : 'Konundan taslak çıkaran ve provanı değerlendiren yapay zekâ koçu geliyor.'}</span>
      </div>
    </section>
  );
}
