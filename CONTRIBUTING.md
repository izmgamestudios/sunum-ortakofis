# Katkı rehberi

Teknodoz Sunum'a katkı verdiğin için teşekkürler! 💜

## Hızlı başlangıç

```bash
git clone https://github.com/izmgamestudios/sunum-ortakofis.git
cd sunum-ortakofis
npm install
npm run dev        # client :5173 · server :3001
npm run typecheck  # tip kontrolü
npm run build      # üretim derlemesi
```

## Nasıl katkı verilir?

1. Önce bir [Issue](https://github.com/izmgamestudios/sunum-ortakofis/issues) aç ya da mevcut birine yorum yaz: ne yapmak istediğini kısaca anlat.
2. Repoyu fork'la, `feat/kisa-aciklama` veya `fix/kisa-aciklama` adında bir dal aç.
3. Küçük ve odaklı commit'ler at; `npm run typecheck` ve `npm run build` hatasız geçmeli.
4. Pull Request açarken: ne değişti, neden, nasıl test edildi (mümkünse ekran görüntüsü).

## Kod düzeni

| Klasör | İçerik |
|---|---|
| `server/` | Express + Socket.IO (canlı oda, sohbet, tuval yayını) |
| `client/src/lib/` | Saf mantık: store, rapor/SWOT, arama, tuval geometrisi, çerçeveler |
| `client/src/components/` | React bileşenleri |

- TypeScript strict; yeni metinler Türkçe, kod/değişken adları İngilizce.
- Kullanıcı verisi cihazda kalır; sunucuya kalıcı kişisel veri eklemeyin.
- Güvenlik: sunucuya gelen her olayı doğrulayın ve hız sınırı uygulayın.

## Fikir önerileri

Çeviri (i18n), yeni çerçeve/model şablonları, erişilebilirlik iyileştirmeleri ve test kapsamı özellikle değerli.

## Kendi projende kullanmak

MIT lisansı altında projeyi kendi (private veya public) projelerinde kullanabilir, değiştirebilirsin; lisans ve telif notunu korumanı rica ederiz. Geliştirmelerini geri katkı olarak önerirsen çok seviniriz.

İletişim: izmgamestudios@gmail.com · WhatsApp: https://wa.me/905417709205
