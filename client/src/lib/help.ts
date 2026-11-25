// client/src/lib/help.ts — user guide, FAQ and troubleshooting content (also indexed by global search)
import type { View } from '../types';

export type GuideCategory = 'Başlangıç' | 'Hazırlık' | 'Sunum' | 'Tuval & Medya' | 'Etkileşim' | 'Rapor & Veri' | 'Kişiselleştirme' | 'Yönetim';

export interface GuideSection {
  h: string;
  p?: string[];
  ul?: string[];
}

export interface GuideArticle {
  id: string;
  emoji: string;
  title: string;
  category: GuideCategory;
  summary: string;
  sections: GuideSection[];
  /** quick navigation buttons at the end of the article */
  goto?: { label: string; view: View; templates?: string }[];
}

export const GUIDE: GuideArticle[] = [
  {
    id: 'hizli-baslangic',
    emoji: '🚀',
    title: '5 dakikada ilk sunumun',
    category: 'Başlangıç',
    summary: 'Sunum oluştur, adımları ayarla, başlat ve raporunu al.',
    sections: [
      { h: '1. Hazırlık', ul: ['Hazırlık ekranında sunum başlığını, sunan kişiyi ve hedef kitleyi yaz.', 'Adım sayısını 1–9 arasında seç; N. adım varsayılan olarak N dakika sürer.', 'İstersen “Şablondan başla” ile hazır bir iskelet ya da 66 düşünme modeli, iş ve bilinç kanvasından birini seç.'] },
      { h: '2. İçerik', ul: ['Her adım için Metin, Medya, Tuval ve Konu akışı sekmelerini doldur.', 'Yüklediğin görsel/PDF otomatik olarak o adımın tuvaline yerleşir.'] },
      { h: '3. Sunum', ul: ['“Sunumu başlat” (Ctrl+Enter) ile başla; üstte kum saati ve sayaç akar.', 'Son saniyelerde zil çalar; → ile sonraki adıma geç.', 'Canlı oda açarak izleyicilerin telefondan anonim katılmasını sağla.'] },
      { h: '4. Rapor', ul: ['Bitirdiğinde Rapor ekranında süre, etkileşim, içerik skorları ve otomatik SWOT oluşur.', 'PDF, .snmtdz, JSON veya Markdown olarak dışa aktar.'] },
    ],
    goto: [
      { label: '🛠️ Hazırlığa git', view: 'setup' },
      { label: '📚 Şablonlara göz at', view: 'templates' },
    ],
  },
  {
    id: 'arayuz',
    emoji: '🧭',
    title: 'Arayüzde gezinme',
    category: 'Başlangıç',
    summary: 'Header, mega menü, kenar menü, alt menü, arama ve bağlam barı.',
    sections: [
      { h: 'Header', p: ['Hazırlık, Sunum ve Rapor ana bölümlerdir. Şablonlar ve Kaynaklar menüleri üzerine gelince mega menü olarak açılır.', 'Sağ üstte arama (Ctrl+K), tema, dosya menüsü ve “Sunumu başlat” butonu bulunur.'] },
      { h: 'Bağlam barı', p: ['Hazırlık ve Rapor ekranlarında sunum adını, hazırlık yüzdesini (içerik eklenmiş adım oranı) ve son skoru gösterir. ↻ ile yeni boş sunum açılır.'] },
      { h: 'Kenar menü', p: ['Masaüstünde solda: adımlar ve süreleri, sunum/rapor, şablon kategorileri, yardım. Mobilde ☰ ile çekmece olarak açılır.'] },
      { h: 'Alt menü (telefon)', p: ['Hazırlık · Şablonlar · ▶ Başlat · Rapor · Menü. Sunum sırasında ekranı büyütmek için gizlenir.'] },
    ],
  },
  {
    id: 'adimlar-sureler',
    emoji: '⏳',
    title: 'Adımlar ve süreler',
    category: 'Hazırlık',
    summary: '1-2-3 dakika kuralı, süre düzenleme, adım ekleme ve sıralama.',
    sections: [
      { h: 'Varsayılan kural', p: ['N. adım N dakika sürer: 6 adımlık bir sunum 1+2+3+4+5+6 = 21 dakikadır. Sunum ısınarak derinleşir.'] },
      { h: 'Düzenleme', ul: ['Adım editöründe süreyi 0,5 dakikalık adımlarla değiştir.', '“Süreleri 1-2-3… dk yap” ile varsayılana dön.', 'Kenar menüdeki “＋ Adım ekle” ile yeni adım ekle (en fazla 9).'] },
      { h: 'Otomatik geçiş', p: ['“Süre bitince otomatik sonraki adıma geç” açıksa sayaç sıfırlandığında sunum kendiliğinden ilerler; kapalıysa süre aşımı kırmızıyla sayılır.'] },
    ],
    goto: [{ label: '🛠️ Adımları düzenle', view: 'setup' }],
  },
  {
    id: 'kum-saati-zil',
    emoji: '🔔',
    title: 'Kum saati, zil ve süre uyarıları',
    category: 'Sunum',
    summary: 'Son saniyelerde uyarı çanı, tık sesleri ve bitiş zili.',
    sections: [
      { h: 'Kum saati', p: ['Kum, adımın süresiyle orantılı akar ve her yeni adımda döner. Süre dolunca sayaç kırmızıya döner ve aşımı “+0:12” gibi gösterir.'] },
      { h: 'Zil', ul: ['Uyarı çanı adımın bitmesine 10, 30 veya 60 saniye kala çalar (Hazırlık → ayarlar).', 'Son 5 saniyede her saniye kısa bir tık sesi duyulur; sıfırda üçlü bitiş çanı çalar.', 'Uyarı süresine girildiğinde sayaç turuncuya döner.', 'Sunum sırasında 🔔 butonu ya da B tuşu ile sessize al. Ses seviyesini “Dene” ile test et.'] },
      { h: 'Neden ses gelmiyor?', p: ['Tarayıcılar sesi ilk kullanıcı etkileşiminden önce engeller: sayfada bir kez tıklaman yeterli. Cihaz sessizdeyse ya da sekme sessize alınmışsa zil duyulmaz.'] },
    ],
  },
  {
    id: 'molalar',
    emoji: '🫁',
    title: 'Molalar: nefes, esneme, su',
    category: 'Hazırlık',
    summary: 'Adımlar arası geçiş modları ve mola aktiviteleri.',
    sections: [
      { h: 'Geçiş modları', ul: ['Geçiş yok: doğrudan sonraki adım.', 'Manuel bekle: “Hazırım, devam” butonuna basana kadar mola sürer.', 'Otomatik: 15/30/45/60 sn; +15 sn ile uzatılabilir.'] },
      { h: 'Aktiviteler', ul: ['Nefes 4-4-4 × 2: 4 sn al, 4 sn tut, 4 sn bırak; iki tur (24 sn — kısa molalar otomatik uzatılır).', 'El, kol, boyun esneme: 5 saniyede bir değişen hareket kartları.', 'Su iç hatırlatması ve sessiz bekleme.', 'Sırayla ya da rastgele seçilir. Mola, tam ekranda da sahnenin içinde gösterilir.'] },
      { h: 'Duraklatınca', p: ['Sunum duraklatılmışken “sonraki” molayı atlayıp doğrudan sonraki adıma geçer.'] },
    ],
  },
  {
    id: 'rol-yapma',
    emoji: '🎭',
    title: 'Rol yapma / drama modu',
    category: 'Hazırlık',
    summary: 'Duygu, ton, mekân, zaman ve kalabalık seviyesiyle prova.',
    sections: [
      { h: 'Ayarlar', ul: ['Duygu: üzgün, kızgın, sevinçli, heyecanlı, korkmuş, şaşkın, sakin, nostaljik, nötr.', 'Ton: ciddi, samimi, esprili, resmi, ilham verici.', 'Mekân: sahne, aile ortamı, asansörde yabancılar, toplantı, kafe, sınıf, online, mülakat, sokak röportajı.', 'Zaman: sabah, öğle, akşam, gece · Kalabalık: birebirden 500+ kişiye.'] },
      { h: 'Senaryo zarı', p: ['“Her adımda senaryo zarı at” açıkken her adım rastgele bir duygu/ortamla başlar; sunum sırasında 🎲 ile yeniden atabilirsin. Rapor, kullanılan duyguları ve “Bin Surat” rozetini gösterir.'] },
    ],
  },
  {
    id: 'tuval',
    emoji: '🎨',
    title: 'Tuval: çizim, yazı, not kağıdı, katmanlar',
    category: 'Tuval & Medya',
    summary: 'Tıkla-yaz, seç-taşı-döndür-boyutlandır, katman yönetimi.',
    sections: [
      { h: 'Araçlar', ul: ['Kalem, fosforlu, silgi, çizgi, ok, dikdörtgen, elips.', '𝐓 Yazı: tuvalde bir noktaya tıkla ve doğrudan yazmaya başla; Ctrl+Enter ya da dışarı tıklayınca kaydedilir, Esc vazgeçer.', '📌 Not kağıdı: tıkladığın yere renkli yapışkan not ekler.'] },
      { h: 'Seç & dönüştür', ul: ['🖐️ Seç (V) ile bir öğeye tıkla: çerçeve, 8 boyutlandırma tutamacı ve ↻ döndürme tutamacı görünür.', 'Köşelerden boyutlandır (görsellerde oran korunur; Shift ile değiştirilir), ↻ ile döndür (Shift: 15° adımlar), sürükleyerek taşı.', 'Seçim çubuğu: düzenle, en öne/arkaya, döndürmeyi sıfırla, çoğalt, kilitle, sil.', 'Çift tık: yazıyı/notu düzenler; görsel/PDF kartını Slayt sekmesinde açar.'] },
      { h: 'Katmanlar', p: ['🗂️ Katman panelinde en üstteki öğe listenin başındadır. Her öğeyi gizle/göster, kilitle, bir üst/alt katmana taşı. Kilitli öğeler seçilebilir ama taşınamaz.'] },
      { h: 'Dışa aktarma', p: ['⬇️ ile tuvali PNG olarak indir. Rapor, her adımın tuvalini küçük resim olarak içerir.'] },
    ],
  },
  {
    id: 'medya-slayt',
    emoji: '🖼️',
    title: 'Medya, slayt gösterisi ve PDF okuyucu',
    category: 'Tuval & Medya',
    summary: 'Görsel, PDF, video, ses ve link ekleme; slayt sekmesi.',
    sections: [
      { h: 'Ekleme', ul: ['Hazırlıkta Medya sekmesinden, tuvalde 🖼️ Medya butonundan veya Slayt sekmesindeki ＋ ile dosya ekle (dosya başına 15 MB).', 'Eklenen görsel tuvale resim olarak, PDF/video/ses ise tıklanabilir kart olarak yerleşir.', 'Link ekle: YouTube bağlantıları gömülü oynatıcı olarak açılır.'] },
      { h: 'Slayt sekmesi', ul: ['Görseller slayt gibi tek tek gösterilir: oklar, küçük resim şeridi, kaydırma (swipe) ve yakınlaştırma.', 'PDF’ler okuma modunda sayfa sayfa gösterilir: sayfa numarası gir, ilk/son sayfaya atla.', '📌 Tuvale ekle: görseli ya da PDF’in o sayfasını tuvale koyar; üzerine çizim yapabilirsin.'] },
      { h: 'Silme', p: ['Medya listesinden kaldırılan dosyanın tuvaldeki karşılığı da otomatik silinir.'] },
    ],
  },
  {
    id: 'cerceveler',
    emoji: '🧩',
    title: 'Çerçeveler & modeller (66)',
    category: 'Tuval & Medya',
    summary: 'Ikigai’den OKR’a düzenlenebilir infografikler ve 3 adımlı şablonlar.',
    sections: [
      { h: 'Tuvale ekle', p: ['Tuval araç çubuğunda 🧩 Çerçeve’ye tıkla; 13 grupta 66 model arasında ara ya da filtrele, önizle ve “Tuvale ekle” ya da “Tuvali bununla değiştir” seç. Her daire, kutu ve yazı ayrı bir katmandır: taşı, boyutlandır, çift tıklayıp yazıları değiştir.'] },
      { h: 'Şablon olarak', p: ['Şablonlar → 🧩 Çerçeveler & Modeller kategorisinde her model 3 adımlık bir sunumdur: 1) Model (diyagram tuvalde hazır, bileşenler konu ağacında) 2) Kendi örneğim (bileşenler tombala kelimesi — söyledikçe otomatik işaretlenir) 3) Eylem planı.'] },
      { h: 'Gruplar', ul: ['Amaç & Anlam · Karar & Önceliklendirme · Düşünme Modelleri · Problem Çözme · Öğrenme & Gelişim', 'Verimlilik & Alışkanlık · Hedef & Performans · İletişim & Geri Bildirim · Takım & Değişim · Öz Farkındalık · Ürün & Strateji'] },
    ],
    goto: [{ label: '🧩 Modellere git', view: 'templates', templates: 'cerceve' }],
  },
  {
    id: 'konu-akisi',
    emoji: '🎱',
    title: 'Konu akışı: kelime tombalası ve konu ağacı',
    category: 'Hazırlık',
    summary: 'Doğaçlama için rastgele kelimeler, planlı anlatım için başlık ağacı.',
    sections: [
      { h: 'Kelime tombalası', ul: ['Her adım için kelime havuzu oluştur (ya da hazır havuzdan 9 kelime ekle).', 'Sunumda 🎲 ile torbadan kelime çek ve konuşmana bağla; ✅ ile işaretle.', '3×3 kartta bir satır/sütun/çapraz dolunca TOMBALA! rozeti kazanırsın.', 'İzleyiciler canlı odadan kelime önerebilir; öneriyi tek tıkla torbaya ekle.'] },
      { h: 'Konu ağacı', ul: ['İç içe başlıklar oluştur ya da girintili listeden içe aktar (2 boşluk = 1 seviye).', 'Sunumda işledikçe işaretle; rapor kapsama oranını hesaplar.'] },
    ],
  },
  {
    id: 'dokum',
    emoji: '🎙️',
    title: 'Konuşma dökümü ve otomatik işaretleme',
    category: 'Sunum',
    summary: 'Canlı yazıya dökme, ses kaydı, kelime/dk ve dolgu kelimeleri.',
    sections: [
      { h: 'Başlatma', p: ['Sunum ekranında 🎙️ Döküm sekmesi → “Dinlemeye başla”. Dil seçilebilir (Türkçe, English, Deutsch, العربية). Chrome, Edge ve Safari destekler; Firefox’ta metni yapıştırabilirsin.'] },
      { h: 'Otomatik işaretleme', p: ['Söylediğin cümlelerdeki tombala kelimeleri ve konu ağacı başlıkları otomatik işaretlenir. Türkçe ekler ve ünsüz yumuşaması yakalanır: “girişim” → “girişimciler”, “kitap” → “kitabı”.'] },
      { h: 'Ses kaydı', p: ['“Ses kaydını da sakla” açıksa her adım ayrı bir ses dosyası olarak o adımın Medya’sına eklenir (yaklaşık dakikada 240 KB).'] },
      { h: 'Analiz', p: ['Kelime/dk (ideal 110–160) ve “ııı, şey, yani” gibi dolgu kelimesi oranı rapora, SWOT’a ve rozetlere eklenir.'] },
    ],
  },
  {
    id: 'canli-oda',
    emoji: '📡',
    title: 'Canlı oda: anonim sohbet, tepkiler ve not duvarı',
    category: 'Etkileşim',
    summary: 'QR ile katılım, anonim sorular, emoji tepkileri, kelime önerileri.',
    sections: [
      { h: 'Oda açma', p: ['Sunum → 📡 Oda → “Canlı oda aç”. Katılımcılar QR kodu okutur ya da bağlantıya girer; kurulum veya hesap gerekmez.'] },
      { h: 'Katılımcı ekranı', ul: ['Her katılımcıya “Meraklı Baykuş #42” gibi rastgele bir takma ad verilir.', 'Anonim mesaj/soru, 8 emoji tepkisi ve tombala kelime önerisi.', 'Mevcut adım ve mola durumu canlı görünür.'] },
      { h: 'Not duvarı', p: ['Sahnedeki 📌 Duvar sekmesi sohbet, sorular (soru işareti içerenler), kelime önerileri ve notlarını yapışkan not kağıtları olarak gösterir. “Tuvale” ile tuvale yapıştır, ✓ ile yanıtlandı işaretle. Tuval açıkken yeni bir girdi köşede not kağıdı olarak belirir.'] },
      { h: 'Moderasyon', p: ['Sunucu mesaj hızını sınırlar; Sohbet sekmesinden sohbeti kilitleyebilirsin.'] },
    ],
  },
  {
    id: 'tam-ekran',
    emoji: '⛶',
    title: 'Tam ekran sunum modu ve gezinme',
    category: 'Sunum',
    summary: 'HUD, açılır panel, duraklatınca adımlar arası gezinme.',
    sections: [
      { h: 'Tam ekran', p: ['Sahnede ⛶ Tam ekran (ya da F tuşu). Üstte kum saati, sayaç, adım numaraları ve geri/duraklat/ileri/zil kontrolleri görünür. ☰ Panel ile tombala, döküm, not, sohbet ve oda sekmeleri sağda açılır-kapanır.'] },
      { h: 'Gezinme', p: ['Boşluk ile duraklat: adım numaraları kesikli çerçeveyle tıklanabilir olur; istediğin adıma atla. Duraklatma korunur, devam etmek için ▶ ya da Boşluk.'] },
      { h: 'Çıkış', p: ['Esc ya da ✕. iPhone gibi tam ekran API’si olmayan cihazlarda sahne ekranı kaplayan bir katman olarak açılır.'] },
    ],
  },
  {
    id: 'notlar',
    emoji: '📝',
    title: 'Notlar ve alıntılar',
    category: 'Sunum',
    summary: 'Not, alıntı, aksiyon, fikir ve soru kaydı.',
    sections: [
      { h: 'Kullanım', p: ['Sunum → 📝 Not sekmesinde tür seç ve Ctrl+Enter ile ekle. Her not zaman damgası ve adım numarasıyla kaydedilir; not duvarında da görünür.'] },
      { h: 'Raporda', p: ['Aksiyonlar SWOT “Fırsatlar”a, alıntılar “Güçlü yönler”e katkı sağlar. Tümü PDF/Markdown çıktısına eklenir.'] },
    ],
  },
  {
    id: 'rapor',
    emoji: '📊',
    title: 'Rapor, skorlar, SWOT ve rozetler',
    category: 'Rapor & Veri',
    summary: 'Zaman/etkileşim/içerik skorları, otomatik + düzenlenebilir SWOT.',
    sections: [
      { h: 'Skorlar', ul: ['Zaman: plandan sapma ve tamamlanma.', 'Etkileşim: tepki, mesaj, soru, kelime önerisi.', 'İçerik: tombala/konu ağacı kapsaması ve notlar.', 'Genel = %40 zaman + %30 etkileşim + %30 içerik.'] },
      { h: 'SWOT', p: ['Sunum verisinden otomatik maddeler (italik) üretilir; her kutuya kendi maddelerini ekleyebilirsin. Öz değerlendirme alanı rapora dahildir.'] },
      { h: 'Rozetler', p: ['Saat Ustası, Bin Surat, Tombala, Salonu Ateşledin, Merak Uyandırıcı, Nefes Disiplini, Kayıt Makinesi, Akıcı Konuşmacı, Kelime Avcısı…'] },
    ],
    goto: [{ label: '📊 Rapora git', view: 'report' }],
  },
  {
    id: 'paylasim',
    emoji: '🔗',
    title: 'Sunumlarım ve paylaşım (özel / herkese açık / şifreli)',
    category: 'Rapor & Veri',
    summary: 'Birden fazla sunum, bağlantıyla paylaşım, izleyici veya düzenleyici rolü.',
    sections: [
      { h: 'Sunumlarım', p: ['Tüm sunumların bu cihazda saklanır. Sunumlarım sayfasında Özel, Paylaştıklarım, Benimle paylaşılan ve Keşfet (herkese açık) sekmeleri bulunur.'] },
      { h: 'Görünürlük', ul: ['🔒 Özel: yalnızca sen. Bağlantı çalışmaz.', '🔗 Bağlantıya sahip olanlar: listelenmez, bağlantıyı bilen açar.', '🌍 Herkese açık: Keşfet’te listelenir.', '🔑 Şifreli: bağlantı + şifre.'] },
      { h: 'Rol', ul: ['👀 Sadece izleme: anonim ziyaretçiler sunumu salt okunur görür (adımlar, tuval, medya).', '✏️ Düzenleme (admin): bağlantıyla gelen herkes içeriği değiştirebilir; değişiklikler otomatik kaydedilir ve diğerlerine anında yansır. Ayarları değiştirme ve silme yalnızca sahibindedir.'] },
      { h: 'Sahiplik', p: ['Hesap gerekmez: sunumu ilk paylaşan kişiye gizli bir sahip anahtarı verilir ve bu tarayıcıda saklanır. Paylaş → “Sahip anahtarını yedekle” ile başka cihazda Sunumlarım → “Sahip anahtarıyla aç” kullanabilirsin.'] },
      { h: 'Çakışmalar', p: ['İki kişi aynı anda değiştirirse uyarı çıkar: “Sunucudakini yükle” ya da “Benimkini kaydet”.'] },
      { h: 'Gizlilik', p: ['Notlar, anonim sohbet ve konuşma dökümü varsayılan olarak paylaşılmaz; Paylaş penceresinden açabilirsin.'] },
    ],
    goto: [{ label: '🗂️ Sunumlarım', view: 'library' }],
  },
  {
    id: 'disa-aktarma',
    emoji: '💾',
    title: 'Dışa / içe aktarma ve .snmtdz',
    category: 'Rapor & Veri',
    summary: '.snmtdz, JSON, Markdown, PDF; başka cihazda açma.',
    sections: [
      { h: 'Formatlar', ul: ['.snmtdz: uygulamanın kendi formatı (sıkıştırılmış JSON) — adımlar, medya, tuval, notlar, sohbet, döküm ve rapor dahil her şey.', 'JSON: okunabilir ham veri.', 'Markdown: metin raporu.', 'PDF: görsel rapor (Türkçe karakterler korunur). Ayrıca Yazdır.'] },
      { h: 'İçe aktarma', p: ['Dosya menüsü → İçe aktar (Ctrl+O) ile .snmtdz veya .json aç. Mevcut sunumun yerine geçer; önce dışa aktarmanı öneririz.'] },
    ],
  },
  {
    id: 'sablonlar',
    emoji: '📚',
    title: 'Şablonlar',
    category: 'Hazırlık',
    summary: '12 kategoride hazır iskeletler; arama ve öneriler.',
    sections: [
      { h: 'Kullanım', p: ['Şablonlar sayfasında ara, kategori seç (Çerçeveler & Modeller’de ayrıca grup filtresi var), “Adımlar” ile önizle ve “Bu şablonla başla”. Şablon; başlıkları, ipuçlarını, tombala kelimelerini, konu ağaçlarını ve önerilen rol ayarlarını içerir.'] },
      { h: 'Hassas konular', p: ['Siyaset & Kamu şablonları kanıta dayalı ve taraf tutmayan, İnanç & Değerler şablonları saygılı ve karşılaştırmalı bir çerçevede hazırlanmıştır. Sağlık ve finans içerikleri tavsiye değildir.'] },
    ],
    goto: [{ label: '📚 Şablonlara git', view: 'templates' }],
  },
  {
    id: 'arama-kisayol-tema',
    emoji: '🔍',
    title: 'Arama, kısayollar ve tema',
    category: 'Kişiselleştirme',
    summary: 'Ctrl+K ile her şeyi ara; klavye kısayolları; açık/koyu/sistem.',
    sections: [
      { h: 'Arama', ul: ['Ctrl+K (Mac’te ⌘K) ya da / ile aç. Menüler, ayarlar, şablonlar, modeller, kılavuz, SSS, kısayollar, komutlar ve kendi içeriklerin (adımlar, tuval yazıları, notlar, sohbet, döküm) aranır.', 'Tür filtreleri ve sıralama (alaka, A→Z, tür). ↑↓ ile gez, Enter ile aç, Esc ile kapat.', 'Türkçe karakterlere duyarsızdır: “sablon” yazınca “şablon” bulunur.'] },
      { h: 'Kısayollar', p: ['? tuşu kısayol listesini açar. “G” sonra bir harf ile bölümler arasında geç: G H Hazırlık, G S Sunum, G R Rapor, G T Şablonlar, G M Modeller, G Y Yardım.'] },
      { h: 'Tema', p: ['Header’daki tema butonundan Açık, Koyu ya da Sistem; Shift+T ile hızlıca değiştir. Tercih cihazında saklanır.'] },
    ],
  },
  {
    id: 'kurulum',
    emoji: '🖥️',
    title: 'Kendi sunucuna kurulum',
    category: 'Yönetim',
    summary: 'Node.js, PM2, CloudPanel / nginx ve Docker.',
    sections: [
      { h: 'Gereksinimler', ul: ['Node.js 20+, WebSocket destekleyen bir reverse proxy (nginx / CloudPanel).', 'Mikrofon ve tam ekran özellikleri için HTTPS.'] },
      { h: 'Kurulum', ul: ['Repoyu klonla, PORT=3030 ./scripts/deploy.sh — betik bağımlılıkları kurar, derler, PM2 ile başlatır, reboot kaydı ekler ve sağlık kontrolü yapar.', 'Sonraki güncellemeler: ./scripts/deploy.sh (port ve dal .deploy.env içinde saklanır).', 'Alternatif: Dockerfile ile docker build / docker run.'] },
      { h: 'Notlar', p: ['Uygulama tek süreç çalışmalıdır: canlı oda durumu bellekte tutulur. Sağlık kontrolü: /api/health.'] },
    ],
  },
  {
    id: 'gizlilik',
    emoji: '🔒',
    title: 'Gizlilik ve veriler',
    category: 'Yönetim',
    summary: 'Veriler cihazında; sunucu sadece canlı mesajları iletir.',
    sections: [
      { h: 'Depolama', p: ['Sunumlar, medya, notlar, döküm ve ayarlar tarayıcının IndexedDB/localStorage alanında, yalnızca senin cihazında saklanır.'] },
      { h: 'Canlı oda', p: ['Sunucu katılımcı mesajlarını saklamaz, yalnızca anlık iletir; mesajlar sunan kişinin cihazındaki sunum dosyasına yazılır. Odalar 6 saat hareketsizlikten sonra kapanır.'] },
      { h: 'Konuşma tanıma', p: ['Canlı döküm tarayıcının konuşma tanıma servisini kullanır; Chrome’da ses Google’a gönderilebilir. Hassas içerikte dökümü kapalı tut ya da metni elle ekle.'] },
    ],
  },
];

export interface FaqItem {
  q: string;
  a: string;
  tag: 'Genel' | 'Sunum' | 'Tuval' | 'Kitle' | 'Döküm' | 'Veri' | 'Teknik';
}

export const FAQS: FaqItem[] = [
  { tag: 'Veri', q: 'Sunumumu başkalarıyla nasıl paylaşırım?', a: 'Header’daki 🔗 Paylaş ile görünürlüğü (özel / bağlantıyla / herkese açık / şifreli) ve bağlantıyla gelenlerin rolünü (sadece izleme ya da düzenleme) seç. Ayarları yalnızca sunumu ilk paylaşan kişi değiştirebilir.' },
  { tag: 'Veri', q: 'Düzenleme bağlantısıyla gelen biri sunumumu silebilir mi?', a: 'Hayır. Düzenleyiciler içeriği değiştirebilir ama paylaşım ayarlarını değiştiremez ve sunumu silemez; bunlar yalnızca sahibe aittir.' },
  { tag: 'Genel', q: 'Teknodoz Sunum nedir?', a: 'Adım adım, zaman kutulu sunum pratiği ve canlı sunum aracıdır: kum saati, zil, molalar, rol yapma, tuval, 66 düşünme modeli ve kanvas (Business Model Canvas, Lean Canvas, Değer Önerisi, Evrenin Ölçekleri, 12 Boyut), kelime tombalası, anonim kitle sohbeti, konuşma dökümü ve otomatik SWOT raporu tek yerde.' },
  { tag: 'Genel', q: 'Ücretli mi? Beta ne demek?', a: 'Erken erişim (beta) sürecinde ücretsizdir. Beta, özelliklerin hâlâ geliştiği ve geri bildirimle şekillendiği anlamına gelir.' },
  { tag: 'Genel', q: 'Hesap açmam gerekiyor mu?', a: 'Hayır. Sunan kişi de katılımcılar da hesap açmadan kullanır; veriler cihazında saklanır.' },
  { tag: 'Genel', q: 'Her şeyi nasıl ararım?', a: 'Ctrl+K (Mac’te ⌘K) ya da / tuşuna bas. Menüler, ayarlar, şablonlar, modeller, kılavuz, SSS, kısayollar ve kendi içeriklerin aranır; türe göre filtreleyip sıralayabilirsin.' },
  { tag: 'Genel', q: 'Klavye kısayolları neler?', a: '? tuşu tam listeyi açar. Öne çıkanlar: Ctrl+K arama, Ctrl+Enter başlat, ←/→ adım, Boşluk duraklat, F tam ekran, B zil, G+harf ile bölümler arası geçiş.' },
  { tag: 'Sunum', q: 'Adım süreleri neden 1-2-3… dakika?', a: 'Varsayılan kural: N. adım N dakika. Böylece sunum ısınarak derinleşir (6 adım = 21 dk). Her adımın süresi değiştirilebilir.' },
  { tag: 'Sunum', q: 'Süre bitince ne olur?', a: 'Kum saati biter, sayaç kırmızıya döner ve aşımı gösterir. “Süre bitince otomatik geç” açıksa sonraki adıma geçilir.' },
  { tag: 'Sunum', q: 'Zil ne zaman çalar?', a: 'Seçtiğin uyarı süresinde (10/30/60 sn kala) uyarı çanı, son 5 saniyede tık, sıfırda üçlü bitiş çanı. 🔔 ya da B ile kapatılır.' },
  { tag: 'Sunum', q: 'Sunum sırasında adımlar arasında nasıl gezinirim?', a: 'Boşluk ile duraklat; adım numaraları tıklanabilir olur. İstediğin adıma atla; duraklatma korunur ve molalar atlanır.' },
  { tag: 'Sunum', q: 'Tam ekranda kontroller nerede?', a: 'Üstteki HUD’da kum saati, sayaç, adımlar ve geri/duraklat/ileri/zil butonları var. ☰ Panel ile tombala, döküm, not, sohbet ve oda sekmeleri açılır.' },
  { tag: 'Sunum', q: 'Molalarda ne yapılıyor?', a: 'Nefes 4-4-4 (2 tur), el-kol-boyun esneme, su hatırlatması veya sessiz bekleme. Geçiş yok / manuel / otomatik 15–60 sn seçilebilir.' },
  { tag: 'Sunum', q: 'Rol yapma (drama) modu nasıl çalışır?', a: 'Duygu, ton, mekân, zaman ve kalabalığı seçersin; sunumda senaryo kartı ve ipuçları görünür. “Her adımda senaryo zarı” ile her adım farklı bir duyguyla prova edilir.' },
  { tag: 'Tuval', q: 'Tuvale nasıl yazı yazarım?', a: '𝐓 aracını seç (ya da T), tuvalde bir noktaya tıkla ve yaz. Ctrl+Enter veya dışarı tıklama kaydeder; Esc vazgeçer. Var olan yazıyı çift tıklayarak düzenle.' },
  { tag: 'Tuval', q: 'Bir öğeyi nasıl döndürür veya boyutlandırırım?', a: 'Seç aracıyla (V) öğeye tıkla. Köşe/kenar tutamaçlarıyla boyutlandır, üstteki ↻ ile döndür, sürükleyerek taşı. Shift: 15° adımlar / oran kilidi.' },
  { tag: 'Tuval', q: 'Katmanlar ne işe yarar?', a: 'Hangi öğenin üstte görüneceğini belirler. Katman panelinden sıralayabilir, gizleyebilir veya kilitleyebilirsin.' },
  { tag: 'Tuval', q: 'Görselleri slayt gibi gösterebilir miyim?', a: 'Evet. Sahnedeki 🖼️ Slayt sekmesi adımın görsellerini, PDF sayfalarını ve videolarını oklar, küçük resimler ve kaydırma ile gösterir.' },
  { tag: 'Tuval', q: 'PDF’i sayfa sayfa okuyabilir miyim?', a: 'Evet. PDF slaytında sayfa gezgini, yakınlaştırma ve “Tuvale ekle” (o sayfayı resim olarak tuvale koyar) bulunur.' },
  { tag: 'Tuval', q: 'Business Model Canvas (İş Modeli Kanvası) nasıl kullanılır?', a: 'Tuvalde 🧩 Çerçeve → “İş Modeli Kanvasları” grubundan İş Modeli Kanvası, Lean Canvas ya da Değer Önerisi Kanvası’nı seç. Kanvas iskeleti kilitli bir grup olarak gelir; her bloktaki sarı/pembe not kağıtları serbesttir: çift tıklayıp yaz, sürükle, Ctrl+D ile çoğalt. Hazır akış için Şablonlar → Girişimcilik → “İş Modeli Sunumu” ya da “Lean Canvas Sunumu” (9 blok = 9 adım).' },
  { tag: 'Tuval', q: '“1 piksel = 1 insan” aracı nedir?', a: 'Dünya nüfusu kadar pikselli bir ekranın çözünürlüğünü (16:9’da ≈ 121.680 × 68.445), kaç Full HD/4K/8K ekran gerektiğini ve fiziksel boyutunu hesaplar. Bir görseli tek pikselden başlayıp adım adım açar; her adımda bir pikselin kaç insanı temsil ettiğini söyler. Kaynaklar → 1 piksel = 1 insan; ya da bir adımın Metin sekmesinde “🌍 aracını sahnede göster”i işaretle.' },
  { tag: 'Sunum', q: 'Slaytı tam ekran nasıl yaparım?', a: 'Slayt / Medya görüntüleyicide ⛶ Tam ekran düğmesine bas ya da slayt seçiliyken F tuşuna bas: yalnızca slayt ekranı kaplar (F11 gibi). ← / → ile slaytlar arasında gezilir, Esc ya da F ile çıkılır.' },
  { tag: 'Genel', q: 'Şablonu mevcut bir sunuma ekleyebilir miyim? Sunumları birleştirip ayırabilir miyim?', a: 'Evet. Şablon kartında “➕ Mevcut sunuma ekle” ile hangi sunuma ve hangi adımların ekleneceğini seç (en fazla 9 adım). Sunumlarım’da kartların köşesindeki kutucuklarla 2+ sunum seçip “🔗 Birleştir” de; ✂️ ile bir sunumu istediğin adımdan ikiye ayır. Kaynak sunumlar hiç değişmez, yeni sunumlar oluşturulur.' },
  { tag: 'Kitle', q: 'Paylaşım bağlantısıyla izleyen kişi sunumu canlı takip edebilir mi?', a: 'Evet. Salt okunur bağlantıyı açan kişi “🎯 Sunumu izle” seçiliyken sen sunum yaptıkça hangi adımda olduğunu ve tuvaldeki yakınlaştırma/kaydırmanı canlı görür (🔴 Canlı). “🧭 Sunum dosyasında serbestçe dolaş” seçerse adımlar arasında kendi gezer; istediği an takibe döner.' },
  { tag: 'Sunum', q: 'Giriş (intro) ve kapanış (outro) ekranı nasıl eklenir?', a: 'Hazırlık → 🎬 Giriş & Kapanış. Girişe tanıtım görseli, başlık ve alt başlık koy: sunum başlayınca önce bu ekran gelir, 1. adımın süresi “Başlayalım”a basınca işler. Kapanışa görsel, teşekkür mesajı ve iletişim bilgilerini (e-posta, telefon, WhatsApp, LinkedIn, Instagram, X, YouTube, GitHub, web) ekle: son adım bitince teşekkür ekranı açılır, ilk web/sosyal bağlantı için QR kod da gösterilir; rapor oradan bir tık.' },
  { tag: 'Sunum', q: 'Her adım arasındaki molayı ayrı ayrı açıp kapatabilir miyim?', a: 'Evet. Hazırlık’taki adım listesinde ve canlı sunumda üstteki adım çiplerinin arasında 🫁 / ⏭ simgesi var: 🫁 o iki adım arasında mola var, ⏭ doğrudan geçilir. Tıklayarak değiştir; genel geçiş ayarı yalnızca dokunmadığın aralıklar için geçerlidir.' },
  { tag: 'Sunum', q: 'Sunum modu ile tam ekran farkı ne?', a: '🎬 Sunum modu uygulama menülerini, tuval araç çubuğunu ve panel dokunu gizler; yalnızca üstteki kum saati, adımlar ve ileri/geri/duraklat kalır (☰ ile panelleri geri açabilirsin, Esc ile çıkarsın). ⛶ Tam ekran ise tarayıcıyı tam ekrana alır; ikisi birlikte de kullanılabilir.' },
  { tag: 'Döküm', q: 'Ses kaydını nasıl alır ve indiririm?', a: 'Sunum başlarken “Kayıt alınsın mı?” sorulur: “Evet — sesimi kaydet ve yazıya dök”, “Sadece yazıya dök” ya da “Hayır”. Yalnızca sunum yapan kişinin (bu cihazın) mikrofonu kaydedilir; izleyicilerin ve konukların sesi kaydedilmez. Her adım ayrı bir ses dosyasıdır ve yalnızca bu cihazda saklanır. Sunum bitince Rapor → “Ses kaydı & döküm” bölümünden sesleri ve yazıya dökülmüş metni Word (.docx) olarak indir.' },
  { tag: 'Döküm', q: 'Dinleme otomatik başlıyor mu?', a: 'Evet (varsayılan). Sunum başlayınca dinleme açılır, molada ve duraklatınca durur, adım başlayınca devam eder. Dinleme düğmesindeki nokta kayıt sürerken kırmızı, durunca yeşildir. Kapatmak için Dinleme panelindeki “Sunum başlayınca otomatik dinle” kutusu.' },
  { tag: 'Tuval', q: 'Medyada web sitesi neden boş görünüyor?', a: 'Web siteleri Slayt içinde canlı açılır; ancak site sahibi X-Frame-Options ya da CSP frame-ancestors ile gömmeyi kapatmışsa tarayıcı sayfayı göstermez. Bu durumda “Yeni sekmede aç” düğmesini kullan ya da sitenin ekran görüntüsünü medyaya ekle.' },
  { tag: 'Sunum', q: '“Tek tuval” görünümü nedir?', a: 'Canlı sunumda her şey tuvalin üzerindedir: üstte kum saati, süre (−/+ ile değiştirilebilir), adım adları, ileri/geri, duraklat, zil ve bitir; solda Slayt, Duvar, Metin, Senaryo, Tombala/Ağaç, Döküm, Not, Sohbet ve Oda düğmeleri tuvalin üzerinde panel açar. Eski düzen için üst şeritteki ▦ Klasik düğmesi.' },
  { tag: 'Sunum', q: 'Adım sürelerini nasıl değiştiririm?', a: 'Hazırlık’taki adım listesinde her adımın yanındaki dakika kutusuna yaz (0,5–60 dk, yarım dakika adımlarla). Canlı sunumda da kum saatinin yanındaki −/+ ile o anki adımın süresini değiştirebilirsin.' },
  { tag: 'Sunum', q: 'Metni nasıl biçimlendiririm?', a: 'Adımın ✍️ Metin alanı zengin metin editörüdür: başlık stilleri, yazı tipi, boyut, kalın/italik/altı çizili, hizalama (ortala, iki yana yasla), listeler, bağlantı, yazı rengi ve vurgu. Yapıştırılan içerik güvenlik için temizlenir.' },
  { tag: 'Sunum', q: 'Molada (geçiş) kendi cümlemi gösterebilir miyim?', a: 'Evet. Hazırlık → adım → ✍️ Metin altındaki “🫁 Geçiş göndermesi” alanına yaz; o adımdan önceki molada nefes/esneme/su ekranının altında görünür. “Mikrodan Makroya” şablonunda her geçiş evrenin bir ölçeğine gönderme yapar.' },
  { tag: 'Tuval', q: 'Ikigai, SWOT gibi modelleri nasıl eklerim?', a: 'Tuvalde 🧩 Çerçeve → 66 model arasında seç → Tuvale ekle. Her parça düzenlenebilir. Şablon olarak başlamak için Şablonlar → Çerçeveler & Modeller.' },
  { tag: 'Kitle', q: 'Dinleyiciler nasıl katılır?', a: '📡 Oda sekmesinden canlı oda aç; QR kodu okutarak veya bağlantıyla uygulama indirmeden katılırlar.' },
  { tag: 'Kitle', q: 'Sohbet gerçekten anonim mi?', a: 'Evet. İsim, e-posta veya hesap istenmez; rastgele takma ad verilir. Mesajlar sunucuda saklanmaz.' },
  { tag: 'Kitle', q: 'İzleyici sorularını sunum sırasında nasıl takip ederim?', a: 'Sahnedeki 📌 Duvar sekmesi girdileri not kağıdı olarak gösterir; tuval açıkken yeni bir girdi köşede belirir. Notu tuvale yapıştırabilirsin.' },
  { tag: 'Kitle', q: 'Spam veya uygunsuz mesajları nasıl engellerim?', a: 'Sunucu mesaj hızını sınırlar. Sohbet sekmesinden sohbeti tek tıkla kilitleyebilirsin.' },
  { tag: 'Döküm', q: 'Konuşmam nasıl yazıya dökülüyor?', a: '🎙️ Döküm sekmesinden dinlemeyi başlat. Tarayıcının konuşma tanıma özelliği kullanılır (Chrome, Edge, Safari).' },
  { tag: 'Döküm', q: 'Tombala kelimeleri otomatik nasıl işaretleniyor?', a: 'Söylediğin cümleler adımın tombala kelimeleri ve konu ağacı başlıklarıyla Türkçe eklere duyarlı şekilde karşılaştırılır.' },
  { tag: 'Döküm', q: 'Ses kaydım nereye gidiyor?', a: '“Ses kaydını da sakla” açıksa kayıt yalnızca cihazındaki adım medyasına eklenir. Canlı tanıma için tarayıcı sesi kendi servisine gönderebilir.' },
  { tag: 'Döküm', q: 'Firefox’ta döküm çalışmıyor.', a: 'Firefox canlı konuşma tanımayı desteklemiyor. Chrome/Edge/Safari kullan ya da dökümü “Metin yapıştır” alanına ekle.' },
  { tag: 'Veri', q: 'Verilerim nerede saklanıyor?', a: 'Tarayıcının IndexedDB alanında, yalnızca senin cihazında. Sunucu sadece canlı oda mesajlarını anlık iletir.' },
  { tag: 'Veri', q: '.snmtdz dosyası nedir?', a: 'Uygulamanın kendi dosya formatı: tüm sunum sıkıştırılmış tek dosyada. Başka bir cihazda Dosya → İçe aktar ile açılır.' },
  { tag: 'Veri', q: 'Hangi formatlarda dışa aktarabilirim?', a: '.snmtdz, JSON, Markdown ve PDF. Tuvaller PNG olarak, medya dosyaları tek tek indirilebilir.' },
  { tag: 'Veri', q: 'Tarayıcı verisini silersem ne olur?', a: 'Cihazdaki kayıtlar silinir. Önemli sunumları düzenli olarak .snmtdz olarak dışa aktar (Ctrl+S).' },
  { tag: 'Veri', q: 'Sunumumu başka bir cihazda devam ettirebilir miyim?', a: '.snmtdz olarak dışa aktar ve diğer cihazda içe aktar. Bulut senkronizasyonu yol haritasında.' },
  { tag: 'Teknik', q: 'Mobilde kullanabilir miyim?', a: 'Evet. Arayüz telefon, tablet ve masaüstüne uyumludur; alt menü, çekmece ve dokunmatik tuval desteklenir.' },
  { tag: 'Teknik', q: 'İnternetsiz çalışır mı?', a: 'Sayfa açıldıktan sonra hazırlık, tuval, zil ve rapor çevrimdışı çalışır. Canlı oda ve canlı döküm internet gerektirir.' },
  { tag: 'Teknik', q: 'Kendi sunucumda çalıştırabilir miyim?', a: 'Evet: Node.js 20+ ile scripts/deploy.sh veya Dockerfile. Canlı oda için WebSocket destekleyen bir proxy gerekir. Ayrıntılar kılavuzda.' },
  { tag: 'Teknik', q: 'Hangi tarayıcılar destekleniyor?', a: 'Güncel Chrome, Edge, Safari ve Firefox. Canlı döküm Firefox’ta yok; PDF okuyucu eski Safari sürümlerinde de çalışacak şekilde derlenmiştir.' },
];

export interface TroubleItem {
  symptom: string;
  fixes: string[];
}

export const TROUBLESHOOT: TroubleItem[] = [
  { symptom: 'Zil sesi gelmiyor', fixes: ['Sayfada bir kez tıkla — tarayıcılar sesi ilk etkileşimden önce engeller.', 'Hazırlık → ayarlarda “Son saniyelerde zil” açık mı ve ses seviyesi yeterli mi? “Dene” ile test et.', 'Cihaz/sekme sessizde olmasın.'] },
  { symptom: 'Mikrofon izni sorulmuyor / döküm başlamıyor', fixes: ['Site HTTPS üzerinden mi açıldı? Mikrofon yalnızca HTTPS veya localhost’ta çalışır.', 'Adres çubuğundaki kilit simgesinden mikrofon iznini “İzin ver” yap.', 'Firefox kullanıyorsan Chrome/Edge/Safari dene.'] },
  { symptom: 'Canlı odaya bağlanılamıyor', fixes: ['Oda kodu 6 karakter mi? Kod büyük/küçük harf duyarsızdır.', 'Oda 6 saat hareketsiz kaldıysa kapanmıştır; yeni oda aç.', 'Kurumsal ağlar WebSocket’i engelleyebilir; uygulama otomatik olarak yedek bağlantıya geçer, sayfayı yenile.'] },
  { symptom: 'PDF açılmıyor veya boş görünüyor', fixes: ['Dosya 15 MB’dan küçük mü?', 'Şifreli/korumalı PDF’ler desteklenmez.', 'Harici bağlantıdan eklenen PDF’ler CORS nedeniyle açılmayabilir; dosyayı indirip yükle.'] },
  { symptom: 'Tuval PNG olarak indirilemiyor', fixes: ['Harici URL’den eklenen görseller tarayıcı güvenliği (CORS) nedeniyle dışa aktarmayı engeller; görseli dosya olarak yükle.'] },
  { symptom: 'Tam ekran açılmıyor', fixes: ['iPhone’da tam ekran API’si yok; sahne ekranı kaplayan katman olarak açılır.', 'Tarayıcı tam ekran iznini engelliyorsa site ayarlarını kontrol et.'] },
  { symptom: 'Yaptıklarım kayboldu', fixes: ['Gizli sekme kapatıldığında veriler silinir.', 'Tarayıcı verilerini temizlemek kayıtları siler; düzenli olarak Ctrl+S ile .snmtdz yedeği al.'] },
  { symptom: 'Sunucuda 502 Bad Gateway', fixes: ['pm2 status ile uygulamanın çalıştığını kontrol et.', 'CloudPanel’deki App Port ile .deploy.env içindeki PORT aynı olmalı.', 'pm2 logs teknodoz-sunum --lines 50 çıktısına bak.'] },
];
