// client/src/components/PixelView.tsx — standalone page for the "1 piksel = 1 insan" tool
import { useApp } from '../store';
import { PixelWorld } from './PixelWorld';

export function PixelView() {
  const openTemplates = useApp((s) => s.openTemplates);
  return (
    <main className="page">
      <header className="page-head">
        <h1>🌍 1 piksel = 1 insan</h1>
        <p className="muted">
          Dünyadaki her insan bir piksel olsaydı ekran ne büyüklükte olurdu? Tek bir pikselden bütün resme adım adım yaklaş: önce kıtalar, sonra şehirler, mahalleler… ve sonunda sen.
        </p>
        <div className="row gap-s wrap">
          <button className="btn btn-sm" onClick={() => openTemplates('kisisel', 'Mikrodan Makroya')}>
            🌌 “Mikrodan Makroya” sunum şablonunu aç
          </button>
        </div>
      </header>
      <PixelWorld />
    </main>
  );
}
