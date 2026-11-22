// client/src/components/InfoViews.tsx
import { useApp } from '../store';
import { BetaBadge, Logo } from './Header';

const APP_VERSION = '0.3.0-beta';

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
        <button className="link-btn" onClick={() => useApp.getState().openHelp('faq')}>
          SSS
        </button>
      </p>
    </main>
  );
}
