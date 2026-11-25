// client/src/components/PixelWorld.tsx — "1 piksel = 1 insan": world population as a screen + step-by-step pixel expansion
import { useEffect, useMemo, useRef, useState } from 'react';

export const WORLD_POPULATION = 8_330_000_000;

type Ratio = '16:9' | '21:9' | '4:3' | '1:1';
const RATIOS: Record<Ratio, { w: number; h: number; name: string }> = {
  '16:9': { w: 16, h: 9, name: 'Standart geniş ekran' },
  '21:9': { w: 21, h: 9, name: 'Ultra geniş' },
  '4:3': { w: 4, h: 3, name: 'Klasik' },
  '1:1': { w: 1, h: 1, name: 'Kare' },
};

const SCREENS = [
  { name: 'Full HD', w: 1920, h: 1080 },
  { name: '4K UHD', w: 3840, h: 2160 },
  { name: '8K UHD', w: 7680, h: 4320 },
];

/** physical size of the world screen at a given pixel density */
const DEVICES = [
  { name: 'Telefon (≈ 460 ppi)', mmPerPx: 25.4 / 460 },
  { name: 'Laptop (≈ 140 ppi)', mmPerPx: 25.4 / 140 },
  { name: 'Monitör (≈ 96 ppi)', mmPerPx: 25.4 / 96 },
  { name: 'LED billboard (10 mm piksel)', mmPerPx: 10 },
];

const nf = new Intl.NumberFormat('tr-TR');
const fmt = (n: number) => nf.format(Math.round(n));
const fmt1 = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(n);
const meters = (mm: number) => (mm >= 1_000_000 ? `${fmt1(mm / 1_000_000)} km` : mm >= 1000 ? `${fmt1(mm / 1000)} m` : `${fmt1(mm / 10)} cm`);

export function worldScreen(population: number, r: Ratio) {
  const { w, h } = RATIOS[r];
  const W = Math.round(Math.sqrt((population * w) / h));
  return { W, H: Math.round(population / W) };
}

/** what one pixel stands for, in human terms */
function scaleOf(perPixel: number): string {
  if (perPixel >= 1e9) return 'bir kıta';
  if (perPixel >= 7e7) return 'Türkiye büyüklüğünde bir ülke';
  if (perPixel >= 1.2e7) return 'İstanbul gibi bir megakent';
  if (perPixel >= 1e6) return 'büyük bir şehir';
  if (perPixel >= 1e5) return 'bir ilçe';
  if (perPixel >= 2e4) return 'dolu bir stadyum';
  if (perPixel >= 1000) return 'bir kasaba ya da köy';
  if (perPixel >= 100) return 'bir mahalle, bir okul';
  if (perPixel >= 8) return 'geniş bir aile, bir apartman';
  if (perPixel > 1.5) return 'bir hane';
  return 'tek bir insan — sen';
}

/** An original, procedurally drawn cozy-home scene (default image; users can load their own picture). */
function drawHomeScene(w = 1280, h = 720): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, '#2b3a67');
  sky.addColorStop(0.55, '#e07a5f');
  sky.addColorStop(1, '#f2cc8f');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff4d6';
  g.beginPath();
  g.arc(w * 0.82, h * 0.22, h * 0.07, 0, Math.PI * 2);
  g.fill();
  // hills
  const hill = (y: number, color: string, amp: number, ph: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / (w / 3) + ph) * amp);
    g.lineTo(w, h);
    g.fill();
  };
  hill(h * 0.58, '#6a994e', 26, 0.3);
  hill(h * 0.7, '#386641', 18, 2.1);
  // path
  g.fillStyle = '#ddb892';
  g.beginPath();
  g.moveTo(w * 0.45, h * 0.73);
  g.lineTo(w * 0.52, h * 0.73);
  g.lineTo(w * 0.66, h);
  g.lineTo(w * 0.32, h);
  g.fill();
  // house
  const hx = w * 0.33, hy = h * 0.42, hw = w * 0.3, hh = h * 0.31;
  g.fillStyle = '#f4e1c1';
  g.fillRect(hx, hy, hw, hh);
  g.fillStyle = '#9b2226';
  g.beginPath();
  g.moveTo(hx - hw * 0.08, hy);
  g.lineTo(hx + hw / 2, hy - hh * 0.62);
  g.lineTo(hx + hw * 1.08, hy);
  g.fill();
  g.fillStyle = '#6b4226';
  g.fillRect(hx + hw * 0.72, hy - hh * 0.55, hw * 0.08, hh * 0.35);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  [0, 1, 2].forEach((i) => {
    g.beginPath();
    g.arc(hx + hw * 0.76 + i * 14, hy - hh * 0.65 - i * 26, 12 + i * 5, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = '#7f5539';
  g.fillRect(hx + hw * 0.43, hy + hh * 0.45, hw * 0.14, hh * 0.55);
  const win = (x: number) => {
    g.fillStyle = '#ffd166';
    g.fillRect(x, hy + hh * 0.22, hw * 0.18, hh * 0.3);
    g.strokeStyle = '#7f5539';
    g.lineWidth = 4;
    g.strokeRect(x, hy + hh * 0.22, hw * 0.18, hh * 0.3);
    g.beginPath();
    g.moveTo(x + hw * 0.09, hy + hh * 0.22);
    g.lineTo(x + hw * 0.09, hy + hh * 0.52);
    g.stroke();
  };
  win(hx + hw * 0.1);
  win(hx + hw * 0.72);
  // tree
  g.fillStyle = '#6b4226';
  g.fillRect(w * 0.14, h * 0.48, w * 0.022, h * 0.26);
  g.fillStyle = '#2d6a4f';
  [[0.125, 0.45, 0.075], [0.16, 0.4, 0.08], [0.105, 0.38, 0.06], [0.145, 0.33, 0.065]].forEach(([x, y, r]) => {
    g.beginPath();
    g.arc(w * x, h * y, h * r * 1.6, 0, Math.PI * 2);
    g.fill();
  });
  // family
  const person = (x: number, s: number, shirt: string) => {
    const y = h * 0.9;
    g.fillStyle = shirt;
    g.beginPath();
    g.moveTo(x - 18 * s, y);
    g.lineTo(x - 13 * s, y - 62 * s);
    g.lineTo(x + 13 * s, y - 62 * s);
    g.lineTo(x + 18 * s, y);
    g.fill();
    g.fillStyle = '#e8b796';
    g.beginPath();
    g.arc(x, y - 76 * s, 14 * s, 0, Math.PI * 2);
    g.fill();
  };
  person(w * 0.42, 1.25, '#3d5a80');
  person(w * 0.47, 1.15, '#e76f51');
  person(w * 0.52, 0.8, '#2a9d8f');
  person(w * 0.555, 0.7, '#f4a261');
  // flowers
  for (let i = 0; i < 40; i++) {
    g.fillStyle = ['#ff70a6', '#ffd670', '#ffffff', '#ff9770'][i % 4];
    const x = ((i * 97) % w) * 1, y = h * 0.78 + ((i * 53) % (h * 0.2));
    if (x > w * 0.3 && x < w * 0.7) continue;
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** grid sizes 1, 2, 4 … up to the source width (height follows the aspect ratio) */
function levelsFor(srcW: number, ratio: Ratio): { w: number; h: number }[] {
  const { w: rw, h: rh } = RATIOS[ratio];
  const out: { w: number; h: number }[] = [];
  for (let w = 1; w <= Math.min(srcW, 2048); w *= 2) out.push({ w, h: Math.max(1, Math.round((w * rh) / rw)) });
  return out;
}

export interface PixelImage {
  name: string;
  src: string;
}

interface Props {
  /** extra images to choose from (e.g. the step's attachments) */
  images?: PixelImage[];
  /** pin the current frame onto the step canvas */
  onPin?: (dataUrl: string, name: string) => void;
}

export function PixelWorld({ images = [], onPin }: Props) {
  const [population, setPopulation] = useState(WORLD_POPULATION);
  const [ratio, setRatio] = useState<Ratio>('16:9');
  const [level, setLevel] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [grid, setGrid] = useState(true);
  const [src, setSrc] = useState<PixelImage | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { W, H } = worldScreen(population, ratio);
  const total = W * H;

  /* source image → cropped to the chosen aspect ratio */
  useEffect(() => {
    let cancelled = false;
    const crop = (img: CanvasImageSource, iw: number, ih: number) => {
      const { w: rw, h: rh } = RATIOS[ratio];
      let cw = iw, ch = (iw * rh) / rw;
      if (ch > ih) {
        ch = ih;
        cw = (ih * rw) / rh;
      }
      const c = document.createElement('canvas');
      c.width = Math.round(cw);
      c.height = Math.round(ch);
      c.getContext('2d')!.drawImage(img, (iw - cw) / 2, (ih - ch) / 2, cw, ch, 0, 0, c.width, c.height);
      if (!cancelled) setSource(c);
    };
    if (!src) {
      const scene = drawHomeScene();
      crop(scene, scene.width, scene.height);
    } else {
      const img = new Image();
      img.onload = () => crop(img, img.naturalWidth, img.naturalHeight);
      img.onerror = () => alert('Görsel açılamadı.');
      img.src = src.src;
    }
    return () => {
      cancelled = true;
    };
  }, [src, ratio]);

  const levels = useMemo(() => (source ? levelsFor(source.width, ratio) : [{ w: 1, h: 1 }]), [source, ratio]);
  const lv = levels[Math.min(level, levels.length - 1)];
  const pixels = lv.w * lv.h;
  const perPixel = population / pixels;
  const isLast = level >= levels.length - 1;

  useEffect(() => {
    if (level > levels.length - 1) setLevel(levels.length - 1);
  }, [levels, level]);

  /* render the current level: downscale with averaging, upscale with hard edges */
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !source) return;
    const small = document.createElement('canvas');
    small.width = lv.w;
    small.height = lv.h;
    const sg = small.getContext('2d')!;
    sg.imageSmoothingEnabled = true;
    sg.imageSmoothingQuality = 'high';
    // halve repeatedly for a true average colour per cell
    let cur: HTMLCanvasElement = source;
    while (cur.width / 2 >= lv.w * 2) {
      const half = document.createElement('canvas');
      half.width = Math.max(lv.w, Math.round(cur.width / 2));
      half.height = Math.max(lv.h, Math.round(cur.height / 2));
      const hg = half.getContext('2d')!;
      hg.imageSmoothingQuality = 'high';
      hg.drawImage(cur, 0, 0, half.width, half.height);
      cur = half;
    }
    sg.drawImage(cur, 0, 0, lv.w, lv.h);
    const vw = 1280, vh = Math.round((1280 * RATIOS[ratio].h) / RATIOS[ratio].w);
    view.width = vw;
    view.height = vh;
    const g = view.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, vw, vh);
    if (grid && lv.w <= 64) {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      for (let i = 1; i < lv.w; i++) {
        const x = Math.round((i * vw) / lv.w) + 0.5;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, vh);
        g.stroke();
      }
      for (let j = 1; j < lv.h; j++) {
        const y = Math.round((j * vh) / lv.h) + 0.5;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(vw, y);
        g.stroke();
      }
    }
  }, [source, lv, ratio, grid]);

  /* auto play */
  useEffect(() => {
    if (!playing) return;
    if (isLast) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setLevel((l) => l + 1), 1600);
    return () => clearTimeout(t);
  }, [playing, level, isLast]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return alert('Lütfen bir görsel seç.');
    setSrc({ name: f.name, src: URL.createObjectURL(f) });
    setLevel(0);
  };

  const frameUrl = () => viewRef.current?.toDataURL('image/png') ?? '';
  const download = () => {
    const a = document.createElement('a');
    a.href = frameUrl();
    a.download = `piksel-${lv.w}x${lv.h}.png`;
    a.click();
  };

  const imgScale = source ? Math.ceil(total / (source.width * source.height)) : 0;

  return (
    <div className="pixel-world stack">
      <header className="pixel-head">
        <div>
          <p className="eyebrow">🌍 1 piksel = 1 insan</p>
          <h2>
            {fmt(W)} × {fmt(H)} <small className="muted">({ratio})</small>
          </h2>
          <p className="muted small">
            {fmt(population)} insan ≈ {fmt1(total / 1e9)} gigapiksel ≈ {fmt(total / 1e6)} megapiksel — sıkıştırılmamış 24-bit hâli ≈ {fmt1((total * 3) / 1e9)} GB.
          </p>
        </div>
        <div className="row gap-s wrap">
          <label className="stack pixel-field">
            <span className="small muted">Nüfus</span>
            <input className="input" type="number" min={1} step={1_000_000} value={population} onChange={(e) => setPopulation(Math.max(1, Number(e.target.value) || 1))} aria-label="Nüfus" />
          </label>
          <div className="seg-control" role="radiogroup" aria-label="En-boy oranı">
            {(Object.keys(RATIOS) as Ratio[]).map((r) => (
              <button key={r} role="radio" aria-checked={ratio === r} className={ratio === r ? 'is-active' : ''} onClick={() => setRatio(r)} title={RATIOS[r].name}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="pixel-stage">
        <canvas ref={viewRef} className="pixel-canvas" aria-label={`${lv.w} × ${lv.h} piksel görünüm`} />
        <div className="pixel-badge">
          <b>
            {fmt(lv.w)} × {fmt(lv.h)} = {fmt(pixels)} piksel
          </b>
          <span>
            1 piksel ≈ {perPixel >= 1 ? `${fmt(perPixel)} insan` : '1 insan'} · <i>{scaleOf(perPixel)}</i>
          </span>
        </div>
      </div>

      <div className="row gap-s wrap center">
        <button className="btn" onClick={() => setLevel((l) => Math.max(0, l - 1))} disabled={level === 0} aria-label="Önceki ölçek">
          ◀ Uzaklaş
        </button>
        <button className="btn btn-primary" onClick={() => (isLast ? (setLevel(0), setPlaying(true)) : setPlaying((p) => !p))}>
          {playing ? '⏸ Durdur' : isLast ? '↺ Baştan oynat' : '▶ Adım adım aç'}
        </button>
        <button className="btn" onClick={() => setLevel((l) => Math.min(levels.length - 1, l + 1))} disabled={isLast} aria-label="Sonraki ölçek">
          Yakınlaş ▶
        </button>
        <input type="range" min={0} max={levels.length - 1} value={Math.min(level, levels.length - 1)} onChange={(e) => (setPlaying(false), setLevel(Number(e.target.value)))} aria-label="Ölçek" className="pixel-range" />
        <label className="switch small">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
          <span>Izgara</span>
        </label>
      </div>

      {isLast && source && (
        <p className="callout small">
          🔍 Bu görselin kendi çözünürlüğü {fmt(source.width)} × {fmt(source.height)}. Her piksel tek bir insan olsaydı, bu resmin <b>{fmt(imgScale)} katı</b> büyüklüğünde bir tuval gerekirdi:{' '}
          <b>
            {fmt(W)} × {fmt(H)}
          </b>
          . Uzaktan bakınca tek bir resim; yaklaştıkça her nokta bir hayat.
        </p>
      )}

      <div className="pixel-grid">
        <section className="card stack">
          <h3>🖥️ Kaç ekran gerekir?</h3>
          <table className="pixel-table">
            <tbody>
              {SCREENS.map((s) => (
                <tr key={s.name}>
                  <td>
                    {s.name} <small className="muted">({fmt(s.w)} × {fmt(s.h)})</small>
                  </td>
                  <td>
                    <b>{fmt(Math.ceil(total / (s.w * s.h)))}</b> ekran
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>📏 Fiziksel boyut</h3>
          <table className="pixel-table">
            <tbody>
              {DEVICES.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td>
                    <b>
                      {meters(W * d.mmPerPx)} × {meters(H * d.mmPerPx)}
                    </b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>📐 Diğer oranlar</h3>
          <table className="pixel-table">
            <tbody>
              {(Object.keys(RATIOS) as Ratio[]).map((r) => {
                const s = worldScreen(population, r);
                return (
                  <tr key={r}>
                    <td>
                      {r} <small className="muted">{RATIOS[r].name}</small>
                    </td>
                    <td>
                      <b>
                        {fmt(s.W)} × {fmt(s.H)}
                      </b>{' '}
                      <small className="muted">~{Math.round(s.W / 1000)}K</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card stack">
          <h3>🖼️ Görsel</h3>
          <div className="row gap-s wrap">
            <button className={`btn btn-sm ${!src ? 'btn-primary' : ''}`} onClick={() => (setSrc(null), setLevel(0))}>
              🏡 Ev, tatlı ev (çizim)
            </button>
            {images.map((im) => (
              <button key={im.src} className={`btn btn-sm ${src?.src === im.src ? 'btn-primary' : ''}`} onClick={() => (setSrc(im), setLevel(0))}>
                🖼️ {im.name.slice(0, 24)}
              </button>
            ))}
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              📂 Görsel yükle
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => (pickFile(e.target.files?.[0]), (e.target.value = ''))} />
          </div>
          <p className="small muted">
            Örnek fikir: Türkiye’de “Mutluluğun Resmi” olarak bilinen yağlıboya tablo <b>Home Sweet Home</b>, Amerikalı ressam <b>Dianne Dengel</b>’e aittir. Tablo telifli olduğu için
            uygulamaya gömülmedi; kendi kopyanı yükleyip tek pikselden bütün tabloya adım adım açabilirsin. Görsel cihazında kalır, sunucuya gönderilmez.
          </p>
          <ol className="small pixel-story">
            <li>
              <b>1 piksel:</b> bütün insanlık tek bir renk. Ortalama bir ton — kimse görünmüyor.
            </li>
            <li>
              <b>Birkaç piksel:</b> kıtalar, ülkeler. Bir ev mi, bir manzara mı? Henüz belli değil.
            </li>
            <li>
              <b>Yüzlerce piksel:</b> şehirler, mahalleler. Pencere ışığı, figürler beliriyor.
            </li>
            <li>
              <b>Tam çözünürlük:</b> her piksel bir insan. “Mutluluğun resmi” ancak hepimiz yerimizdeyken tamamlanır.
            </li>
          </ol>
          <div className="row gap-s wrap">
            <button className="btn btn-sm" onClick={download}>
              ⬇️ PNG indir
            </button>
            {onPin && (
              <button className="btn btn-sm" onClick={() => onPin(frameUrl(), `piksel-${lv.w}x${lv.h}.png`)}>
                📌 Tuvale ekle
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
