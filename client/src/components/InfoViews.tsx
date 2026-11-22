// client/src/components/InfoViews.tsx
import { useState } from 'react';
import { useApp } from '../store';
import { foldTr as normalizeTr } from '../lib/speechMatch';
import { TEMPLATES } from '../lib/templates';
import { BetaBadge, Logo } from './Header';

const APP_VERSION = '0.2.0-beta';

interface Faq {
  q: string;
  a: string;
  tag: 'Genel' | 'Sunum' | 'Kitle' | 'Döküm' | 'Veri' | 'Teknik';
}

const FAQS: Faq[] = [
  { tag: 'Genel', q: 'Teknodoz Sunum nedir?', a: 'Adım adım, zaman kutulu sunum pratiği ve canlı sunum aracıdır. Kum saati, molalar, rol yapma modu, kelime tombalası, anonim kitle sohbeti ve otomatik SWOT raporu tek yerde.' },
  { tag: 'Genel', q: 'Ücretli mi? Beta ne demek?', a: 'Erken erişim (beta) sürecinde ücretsizdir. Beta, özelliklerin hâlâ geliştiği ve geri bildiriminle şekillendiği anlamına gelir; arada değişiklikler olabilir.' },
  { tag: 'Sunum', q: 'Adım süreleri neden 1-2-3… dakika?', a: 'Varsayılan kural: N. adım N dakika. Böylece sunum ısınarak derinleşir (6 adım = 21 dk). Her adımın süresini Hazırlık ekranında istediğin gibi değiştirebilir, “Süreleri 1-2-3… dk yap” ile sıfırlayabilirsin.' },
  { tag: 'Sunum', q: 'Süre bitince ne olur?', a: 'Kum saati biter, sayaç kırmızıya döner ve aşım süresini (+0:12 gibi) gösterir. İstersen Hazırlık’ta “Süre bitince otomatik geç” seçeneğini aç.' },
  { tag: 'Sunum', q: 'Molalarda ne yapılıyor?', a: 'Geçiş yok / manuel bekleme / otomatik 15-60 sn seçebilirsin. Aktiviteler: 4 sn nefes al – 4 sn tut – 4 sn bırak (2 tur), el-kol-boyun esneme, su içme hatırlatması ya da sessiz bekleme. Sırayla veya rastgele döner.' },
  { tag: 'Sunum', q: 'Rol yapma (drama) modu nasıl çalışır?', a: 'Duygu (üzgün, kızgın, heyecanlı…), ton, mekân (aile ortamı, asansörde yabancılar…), zaman ve kalabalık seviyesini seçersin; sunum sırasında sana bir senaryo kartı ve ipuçları gösterilir. “Her adımda senaryo zarı at” ile her adım farklı bir duyguyla prova edilir.' },
  { tag: 'Sunum', q: 'Kelime tombalası ve konu ağacı farkı nedir?', a: 'Tombala doğaçlama içindir: torbadan rastgele kelime çekilir, onu konuşmana bağlarsın. 3×3 kartta bir sıra dolunca TOMBALA! Konu ağacı ise planlı anlatım içindir: iç içe başlıkları işledikçe işaretlersin. Rapor her ikisinin kapsama oranını hesaplar.' },
  { tag: 'Kitle', q: 'Dinleyiciler nasıl katılır?', a: 'Sunum ekranındaki “Oda” sekmesinden canlı oda aç. Dinleyiciler QR kodu okutur veya bağlantıya girer; uygulama indirmeden telefondan katılırlar.' },
  { tag: 'Kitle', q: 'Sohbet gerçekten anonim mi?', a: 'Evet. Katılımcılardan isim, e-posta veya hesap istenmez; her bağlantıya “Meraklı Baykuş #42” gibi rastgele bir takma ad verilir. Mesajlar sunucuda saklanmaz, yalnızca sunan kişinin cihazındaki sunum dosyasına yazılır.' },
  { tag: 'Kitle', q: 'Spam veya uygunsuz mesajları nasıl engellerim?', a: 'Sunucu kişi başına mesaj hızını sınırlar. Ayrıca Sohbet sekmesinden sohbeti tek tıkla kilitleyebilirsin.' },
  { tag: 'Döküm', q: 'Konuşmam nasıl yazıya dökülüyor?', a: 'Sunum ekranında “🎙️ Döküm” sekmesinden dinlemeyi başlat. Tarayıcının yerleşik konuşma tanıma özelliği (Web Speech API) kullanılır; Chrome, Edge ve Safari destekler.' },
  { tag: 'Döküm', q: 'Tombala kelimeleri otomatik nasıl işaretleniyor?', a: 'Söylediğin her cümle adımın tombala kelimeleri ve konu ağacı başlıklarıyla karşılaştırılır. Türkçe ekler de yakalanır: “girişim” → “girişimciler”, “kitap” → “kitabı”. Eşleşen kelime otomatik çekilir ve işaretlenir.' },
  { tag: 'Döküm', q: 'Ses kaydım nereye gidiyor?', a: '“Ses kaydını da sakla” açıksa her adımın kaydı o adımın Medya bölümüne eklenir ve yalnızca senin cihazında durur. Canlı yazıya dökme için tarayıcın sesi kendi konuşma tanıma servisine gönderebilir (ör. Chrome’da Google). Hassas içerikte bunu göz önünde bulundur.' },
  { tag: 'Döküm', q: 'Firefox’ta döküm çalışmıyor, ne yapmalıyım?', a: 'Firefox canlı konuşma tanımayı desteklemiyor. Chrome/Edge/Safari kullanabilir ya da başka bir araçtan aldığın dökümü “Metin yapıştır” alanına ekleyebilirsin; otomatik işaretleme yine çalışır.' },
  { tag: 'Döküm', q: 'Dolgu kelimesi ve kelime/dk ne işe yarar?', a: '“ııı, şey, yani, aslında” gibi dolgu kelimeleri ve konuşma hızın rapora ve SWOT analizine eklenir. İdeal hız genelde 110-160 kelime/dk aralığıdır.' },
  { tag: 'Veri', q: 'Verilerim nerede saklanıyor?', a: 'Sunumlar, medya dosyaları ve notlar tarayıcının IndexedDB deposunda, yani yalnızca senin cihazında tutulur. Sunucu sadece canlı oda mesajlarını anlık iletir.' },
  { tag: 'Veri', q: '.snmtdz dosyası nedir?', a: 'Teknodoz Sunum’un kendi dosya formatıdır: tüm sunum (adımlar, medya, tuval, notlar, sohbet, döküm, rapor) sıkıştırılmış tek bir dosyada. Başka bir cihazda Dosya → İçe aktar ile açabilirsin.' },
  { tag: 'Veri', q: 'Hangi formatlarda dışa aktarabilirim?', a: '.snmtdz, JSON, Markdown ve PDF rapor. Tuvaller PNG olarak, medya dosyaları tek tek indirilebilir.' },
  { tag: 'Veri', q: 'Tarayıcı verisini silersem ne olur?', a: 'Cihazdaki kayıtlar silinir. Önemli sunumları düzenli olarak .snmtdz olarak dışa aktar.' },
  { tag: 'Teknik', q: 'Mobilde kullanabilir miyim?', a: 'Evet. Arayüz telefon, tablet ve masaüstüne uyumludur; tuval dokunmatik çizimi destekler.' },
  { tag: 'Teknik', q: 'Kendi sunucumda çalıştırabilir miyim?', a: 'Evet: Node.js 20+ ile “npm install && npm run build && npm start” veya hazır Dockerfile ile. Canlı oda için WebSocket destekleyen bir sunucu gerekir.' },
  { tag: 'Teknik', q: 'Hazır şablonlar var mı?', a: `Evet, ${TEMPLATES.length} şablon: girişimcilik, ekonomi, eğitim, sağlık, bilim, teknoloji, finans, siyaset & kamu, inanç & değerler ve kişisel gelişim. Dosya menüsünden “Şablonlar”a git.` },
];

export function FaqView() {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<Faq['tag'] | 'Tümü'>('Tümü');
  const tags = ['Tümü', ...Array.from(new Set(FAQS.map((f) => f.tag)))] as (Faq['tag'] | 'Tümü')[];
  const list = FAQS.filter((f) => (tag === 'Tümü' || f.tag === tag) && (!q.trim() || normalizeTr(`${f.q} ${f.a}`).includes(normalizeTr(q))));
  return (
    <main className="page page--narrow">
      <header className="page-head">
        <h1>❓ Sıkça Sorulan Sorular</h1>
        <p className="muted">Aradığını bulamazsan sunum sonrası rapordaki öz değerlendirme alanına not düş — beta geri bildirimleri bu şekilde toplanıyor.</p>
      </header>
      <input className="input" placeholder="🔍 Soru ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pill-grid">
        {tags.map((t) => (
          <button key={t} className={`pill pill--sm ${tag === t ? 'is-active' : ''}`} onClick={() => setTag(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="faq-list">
        {list.map((f) => (
          <details key={f.q} className="faq">
            <summary>
              <span className="faq-tag">{f.tag}</span> {f.q}
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
        {!list.length && <p className="muted empty">Sonuç yok.</p>}
      </div>
    </main>
  );
}

const OSS = [
  { name: 'React', role: 'Arayüz', license: 'MIT' },
  { name: 'Vite', role: 'Derleme & geliştirme sunucusu', license: 'MIT' },
  { name: 'TypeScript', role: 'Tip güvenliği', license: 'Apache-2.0' },
  { name: 'Zustand', role: 'Durum yönetimi', license: 'MIT' },
  { name: 'Express', role: 'HTTP sunucusu', license: 'MIT' },
  { name: 'Socket.IO', role: 'Canlı oda, anonim sohbet', license: 'MIT' },
  { name: 'Helmet', role: 'Güvenlik başlıkları', license: 'MIT' },
  { name: 'compression', role: 'Gzip', license: 'MIT' },
  { name: 'idb-keyval', role: 'IndexedDB kalıcılık', license: 'Apache-2.0' },
  { name: 'jsPDF', role: 'PDF dışa aktarma', license: 'MIT' },
  { name: 'html2canvas-pro', role: 'Rapor görüntüleme', license: 'MIT' },
  { name: 'qrcode', role: 'Katılım QR kodu', license: 'MIT' },
];

const PLATFORM = [
  { name: 'Web Speech API', role: 'Canlı konuşma tanıma (tarayıcı)' },
  { name: 'MediaRecorder API', role: 'Ses kaydı' },
  { name: 'Compression Streams API', role: '.snmtdz sıkıştırma' },
  { name: 'Canvas 2D', role: 'Tuval ve kum saati' },
];

export function CreditsView() {
  const setView = useApp((s) => s.setView);
  return (
    <main className="page page--narrow">
      <header className="page-head center-text">
        <Logo />
        <BetaBadge />
        <h1>🙏 Credits</h1>
        <p className="muted">Teknodoz Sunum v{APP_VERSION}</p>
      </header>

      <section className="card stack">
        <h2 className="card-title">🧑‍💻 Ürün & geliştirme</h2>
        <p>
          <b>Teknodoz</b> ekosistemi tarafından tasarlandı ve geliştirildi. Topluluk odaklı, oyunlaştırılmış ve pozitif ürün yaklaşımıyla — sunum korkusunu
          oyuna, provayı alışkanlığa dönüştürmek için.
        </p>
      </section>

      <section className="card stack">
        <h2 className="card-title">💜 Erken erişim topluluğu</h2>
        <p>
          Beta sürecinde geri bildirim veren, hata bulan ve fikir öneren herkese teşekkürler. Senin adın da burada olabilir: sunum sonrası raporu öz değerlendirme notunla
          paylaş.
        </p>
      </section>

      <section className="card stack">
        <h2 className="card-title">📦 Açık kaynak kütüphaneler</h2>
        <ul className="credit-list">
          {OSS.map((o) => (
            <li key={o.name}>
              <b>{o.name}</b>
              <span className="muted small">{o.role}</span>
              <span className="lic">{o.license}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2 className="card-title">🌐 Web platformu</h2>
        <ul className="credit-list">
          {PLATFORM.map((o) => (
            <li key={o.name}>
              <b>{o.name}</b>
              <span className="muted small">{o.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2 className="card-title">🧘 İçerik ilhamı</h2>
        <ul className="small">
          <li>Kutu (4-4-4) nefes tekniği — yaygın kullanılan bir nefes egzersizi</li>
          <li>5E öğrenme modeli, STAR mülakat tekniği, Lean Canvas, Kahramanın Yolculuğu, Feynman tekniği — şablonlarda kullanılan genel çerçeveler</li>
          <li>Şablonlardaki sağlık ve finans içerikleri genel bilgilendirme amaçlıdır; tıbbi veya yatırım tavsiyesi değildir.</li>
        </ul>
      </section>

      <p className="center-text muted small">
        © {new Date().getFullYear()} izmgamestudios · Teknodoz · MIT Lisansı ·{' '}
        <button className="link-btn" onClick={() => setView('faq')}>
          SSS
        </button>
      </p>
    </main>
  );
}
