# Teknodoz Sunum — Yol haritası

**Odak kitle:** girişimcilik toplulukları (GamFed, kuluçka merkezleri, hackathon'lar, pitch günleri).
**Gelir modeli:** henüz karar yok → beta boyunca her şey ücretsiz; özellikler ileride “Pro”ya ayrılabilecek şekilde (bayraklarla) tasarlanır.
**Çalışma şekli:** 1 haftalık sprintler, her sprint sonunda `main`'e PR + canlıya alma; her özellik `npm test` duman testine en az bir senaryo ekler.

## ✅ Tamamlanan (beta 0.4)
Zaman kutulu adımlar · tek tuval · 66 çerçeve ve iş kanvası · şablonlar · canlı oda · dinleme/döküm · ses ve ekran kaydı · rapor + SWOT · giriş/kapanış · davetli paylaşım (e-posta kodu) · birleştir/ayır · 19 geçiş etkinliği · CI + gece yedeği.

## ✅ Sprint 1 — Hesapla senkron “Sunumlarım” (tamamlandı)
- E-postayla giriş yapan kullanıcı → sunumları sunucuda hesabına bağlı; her cihazda aynı liste.
- Yerel (girişsiz) kullanım aynen devam; ilk girişte “bu cihazdaki sunumları hesabıma taşı”.
- Sahip anahtarı yerine hesap sahipliği (eski anahtarlar geçerli kalır).
- Çakışma: sürüm numarası (mevcut 409 mantığı), son yazan kazanır + “diğer sürümü kopya olarak sakla”.
- **Kabul:** iki farklı tarayıcıda aynı e-postayla giriş → aynı sunumlar, birinde düzenleme diğerine ≤5 sn'de yansır.

## Sprint 2 — Canlı anket, quiz ve puan tablosu
- Adıma “soru” ekle: çoktan seçmeli, evet/hayır, 1–5 puan, kelime bulutu, açık uçlu.
- İzleyici oda kodu ile oy verir; sonuç tuvalde canlı grafik.
- Quiz modu: doğru cevap + hız puanı → takma adlı puan tablosu, sunum sonunda podyum.
- Pitch günü modu: jüri puanlama (kriterler: problem, çözüm, pazar, ekip, sunum) → sıralama.
- **Kabul:** 50 sanal izleyiciyle oylama < 1 sn gecikme, rapora sonuçlar eklenir.

## Sprint 3 — Yapay zekâ sunum koçu (Claude API)
- “Konudan taslak”: başlık + kitle + süre → adımlar, metinler, uygun çerçeve önerisi.
- Döküm sonrası geri bildirim: net mesaj, hız, dolgu kelimeler, değer önerisi tutarlılığı, 3 somut öneri.
- Maliyet kontrolü: kullanıcı başına günlük kota, sunucu tarafı anahtar, önbellek; ileride Pro.
- **Kabul:** taslak < 15 sn; geri bildirim rapora “🤖 Koç notları” olarak eklenir.

## Sprint 4 — Gelişim panosu ve rozetler
- Sunumdan sunuma: süreye uyum %, dakikada kelime, dolgu oranı, tombala skoru trendi.
- Seriler (haftalık prova), rozetler (ilk pitch, süreye tam uyum, 10 sunum, sıfır dolgu…).
- Topluluk: herkese açık profil (isteğe bağlı), “en çok gelişen” listesi.

## Teknik borç / sürekli
- Canlı oda durumu bellek içinde → çoklu süreç için Redis (kullanıcı sayısı artınca).
- E-posta: Gmail SMTP → kendi alan adınla Resend/Brevo (teslim edilebilirlik).
- Erişilebilirlik denetimi (klavye, ekran okuyucu), İngilizce arayüz.
