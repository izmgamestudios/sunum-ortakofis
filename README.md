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
| Konuşma dökümü | Web Speech API ile canlı yazıya dökme (tr-TR, en, de, ar). Söylenen **tombala kelimeleri ve konu ağacı başlıkları otomatik işaretlenir** (Türkçe ek/ünsüz yumuşaması duyarlı). Opsiyonel adım bazlı ses kaydı (MediaRecorder → Medya). Kelime/dk ve dolgu kelimesi analizi → rapor & SWOT. Firefox için metin yapıştırma yedeği |
| Şablonlar | 10 kategoride 20 hazır sunum: girişimcilik, ekonomi, eğitim, sağlık, bilim, teknoloji, finans, siyaset & kamu, inanç & değerler, kişisel gelişim. Arama, kategori filtresi, rastgele öneriler |
| Tuval | Tıkla-yaz, not kağıdı, seç/taşı/döndür/boyutlandır tutamaçları, katman paneli (sırala/gizle/kilitle), çoğalt, PNG |
| Slayt & PDF | Görsel slayt gösterisi, sayfa sayfa PDF okuyucu (pdf.js), yakınlaştırma, “Tuvale ekle” |
| Çerçeveler | 60 düşünme/koçluk modeli (Ikigai, SWOT, OKR, Eisenhower…) + iş kanvasları (Business Model Canvas, Lean Canvas, Değer Önerisi Kanvası) — tuvale düzenlenebilir infografik ya da şablon |
| Tam ekran | HUD (kum saati, sayaç, kontroller), açılır yan panel, duraklatınca adımlar arası gezinme |
| Zil | Son 10/30/60 sn uyarısı, son 5 sn tık, bitiş çanı (Web Audio, dosyasız) |
| Not duvarı | İzleyici sohbeti, soruları, kelime önerileri ve notlar yapışkan not olarak; tuvale yapıştır |
| Arama | Ctrl+K / `/`: menüler, ayarlar, komutlar, şablonlar, modeller, kılavuz, SSS, kısayollar ve kendi içeriğin; filtre + sıralama + vurgulama |
| Yardım merkezi | Kılavuz (20 makale, okundu ilerlemesi), SSS, kısayollar, sorun giderme, destek |
| Kısayollar | `?` listesi; G+harf gezinme, F tam ekran, B zil, Shift+T tema, Ctrl+S kaydet, tuval tuşları |
| Rapor | Planlanan vs gerçekleşen, skorlar, rozetler, **otomatik + düzenlenebilir SWOT**, öz değerlendirme |
| Dışa aktarma | **.snmtdz** (gzip JSON, kendi formatı), JSON, Markdown, PDF, yazdır. İçe aktarma: .snmtdz / .json |

Kısayollar: `←/→` adım, `Boşluk` duraklat.

## Mimari

- `server/index.ts` — Express + Socket.IO, helmet CSP, token bucket rate-limit, oda TTL (6 saat), sunucu token’ı ile yetki.
- `client/src/lib/speechMatch.ts` — saf, test edilebilir Türkçe eşleştirme (`findMentions`, `speechStats`).
- `client/src/lib/templates.ts` — şablon seed verisi.
- `client/src` — Vite + React + TypeScript + Zustand; veriler IndexedDB’de (medya dahil) saklanır.
- PDF, Türkçe karakter sorunu olmaması için `html2canvas-pro` + `jsPDF` ile rasterize edilir (lazy-load).

## Sunucuya kurulum (CloudPanel / PM2)

```bash
git clone -b claude/nodejs-presentation-app-zu7ljh git@github.com:izmgamestudios/sunum-ortakofis.git app
cd app && PORT=3030 ./scripts/deploy.sh     # sonraki güncellemeler: ./scripts/deploy.sh (ayarlar .deploy.env içinde)
```
`scripts/deploy.sh`: git pull → `npm ci` → build → PM2 (`ecosystem.config.cjs`) → reboot'ta otomatik başlatma (crontab) → sağlık kontrolü. Uygulama `127.0.0.1:PORT` dinler; nginx/CloudPanel reverse proxy önünde durur.

## Sunumlarım ve paylaşım

- **Sunumlarım**: birden fazla sunum (IndexedDB). Sekmeler: Özel · Paylaştıklarım · Benimle paylaşılan · Keşfet.
- **🔗 Paylaş**: görünürlük `özel` / `bağlantıyla` / `herkese açık` (Keşfet'te listelenir) / `şifreli`; bağlantıyla gelenlerin rolü `izleyici` (anonim, salt okunur) veya `düzenleyici` (admin: içeriği değiştirir; ayar ve silme yalnızca sahipte).
- Hesap yok: sahip anahtarı tarayıcıda, sunucuda yalnızca hash'i saklanır. Şifreler scrypt ile hash'lenir, deneme hız sınırlıdır; erişim token'ları HMAC imzalıdır ve ayar değişince geçersizleşir.
- Otomatik kayıt + sürüm kontrolü (çakışmada “sunucudakini yükle / benimkini kaydet”), değişiklikler açık oturumlara Socket.IO ile anında bildirilir.
- Notlar, sohbet ve döküm varsayılan olarak paylaşılmaz.

**Sunucu verisi:** paylaşılan sunumlar `DATA_DIR` (varsayılan `./data`, git'e girmez, deploy'da silinmez) altında JSON olarak tutulur. Yedek almak için bu klasörü kopyalaman yeterli. İmza anahtarı `SHARE_SECRET` ortam değişkeniyle verilebilir; verilmezse `data/.share-secret` dosyasında bir kez üretilir.

## 🌍 Açık kaynak — katkılarınızı bekliyoruz

Teknodoz Sunum **MIT lisanslı açık kaynak** bir projedir: <https://github.com/izmgamestudios/sunum-ortakofis>

- ⭐ Repoya yıldız ver ve paylaş.
- 🐛 Hata ve önerileri [Issues](https://github.com/izmgamestudios/sunum-ortakofis/issues) üzerinden ilet.
- 🔀 Repoyu klonlayıp kendi projelerinde (private veya public) kullanabilir, geliştirmelerini Pull Request olarak önerebilirsin. Ayrıntılar: [CONTRIBUTING.md](CONTRIBUTING.md)

```bash
git clone https://github.com/izmgamestudios/sunum-ortakofis.git
cd sunum-ortakofis && npm install && npm run dev
```

## İletişim

**Hüseyin Bayer** — izmgamestudios · Teknodoz

- LinkedIn: <https://www.linkedin.com/in/huseyin-bayer-izmgamestudios/>
- E-posta: <izmgamestudios@gmail.com>
- Telefon / WhatsApp: 0541 770 92 05 · <https://wa.me/905417709205>
