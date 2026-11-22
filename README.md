# Teknodoz Sunum · Beta Erken Erişim

Adım adım, kum saatli, rol yapma destekli **Node.js sunum uygulaması**. Mobil + web responsive.

## Hızlı başlangıç

```bash
npm install
npm run dev          # client: http://localhost:5173  ·  server: :3001
# prod
npm run build && npm start   # http://localhost:3001
# docker
docker build -t teknodoz-sunum . && docker run -p 3001:3001 teknodoz-sunum
```

Kitle aynı ağdaysa telefondan `http://<bilgisayar-ip>:3001/?join=KOD` (veya QR) ile katılır.

## Özellikler

| Alan | Detay |
|---|---|
| Adımlar | 1–9 adım; N. adım varsayılan **N dakika** (6 adım → 1-2-3-4-5-6 dk), adım bazında düzenlenebilir |
| Kum saati | Üstte SVG kum saati: kum adımın süresiyle orantılı akar, her yeni adımda döner; süre aşımında kırmızı |
| Geçişler | Geçiş yok / manuel bekleme / otomatik 15-30-45-60 sn. Aktiviteler: **nefes 4-4-4 × 2**, el-kol-boyun esneme, su iç, sessiz. Sırayla veya rastgele |
| Rol yapma | Duygu (üzgün, kızgın, sevinçli, heyecanlı…), ton (ciddi, samimi…), mekân (aile, asansörde yabancılar…), zaman, kalabalık 1-5. Her adımda “senaryo zarı” opsiyonu |
| İçerik | Her adımda metin, medya (PNG/JPG, PDF, video, ses, link/YouTube), 2D tuval (kalem, fosforlu, şekil, ok, yazı, görsel, geri al, PNG indir) |
| Konu akışı | Serbest · **Kelime tombalası** (torba + 3×3 kart, TOMBALA rozeti) · **Hiyerarşik konu ağacı** (girintili listeden içe aktarma) |
| Canlı oda | Socket.IO: anonim sohbet, emoji tepkileri, kitleden tombala kelime önerisi, QR ile katılım, sohbet kilidi |
| Notlar | Not / alıntı / aksiyon / fikir / soru — zaman damgalı, adım etiketli |
| Rapor | Planlanan vs gerçekleşen, skorlar, rozetler, **otomatik + düzenlenebilir SWOT**, öz değerlendirme |
| Dışa aktarma | **.snmtdz** (gzip JSON, kendi formatı), JSON, Markdown, PDF, yazdır. İçe aktarma: .snmtdz / .json |

Kısayollar: `←/→` adım, `Boşluk` duraklat.

## Mimari

- `server/index.ts` — Express + Socket.IO, helmet CSP, token bucket rate-limit, oda TTL (6 saat), sunucu token’ı ile yetki.
- `client/src` — Vite + React + TypeScript + Zustand; veriler IndexedDB’de (medya dahil) saklanır.
- PDF, Türkçe karakter sorunu olmaması için `html2canvas-pro` + `jsPDF` ile rasterize edilir (lazy-load).
