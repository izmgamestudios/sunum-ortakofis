// client/src/lib/templates.ts
import type { CanvasElement, CanvasGroup, Presentation, RoleplayConfig } from '../types';
import { createNode, createPresentation, createStep, uid } from './factory';
import { parseOutline } from './outline';
import { FRAMEWORKS, FW_GROUPS, frameworkById } from './frameworks';
import { buildFramework } from './frameworkDraw';

export type TemplateCategory =
  | 'girisimcilik'
  | 'ekonomi'
  | 'egitim'
  | 'saglik'
  | 'bilim'
  | 'teknoloji'
  | 'finans'
  | 'siyaset'
  | 'inanc'
  | 'kisisel'
  | 'cerceve';

export const CATEGORIES: Record<TemplateCategory, { label: string; emoji: string; color: string }> = {
  girisimcilik: { label: 'Girişimcilik', emoji: '🚀', color: '#a93bf5' },
  ekonomi: { label: 'Ekonomi', emoji: '📈', color: '#0ea5e9' },
  egitim: { label: 'Eğitim', emoji: '🎓', color: '#f59e0b' },
  saglik: { label: 'Sağlık', emoji: '🩺', color: '#22c55e' },
  bilim: { label: 'Bilim', emoji: '🔬', color: '#14b8a6' },
  teknoloji: { label: 'Teknoloji', emoji: '💻', color: '#3b8bf7' },
  finans: { label: 'Finans', emoji: '💰', color: '#16a34a' },
  siyaset: { label: 'Siyaset & Kamu', emoji: '🏛️', color: '#64748b' },
  inanc: { label: 'İnanç & Değerler', emoji: '🕊️', color: '#a16207' },
  kisisel: { label: 'Kişisel Gelişim', emoji: '🌱', color: '#ec4899' },
  cerceve: { label: 'Çerçeveler & Modeller', emoji: '🧩', color: '#0ea5e9' },
};

interface TemplateStep {
  title: string;
  text: string;
  /** → tombala mode */
  words?: string[];
  /** indented outline → topic tree mode */
  tree?: string;
  /** flat topic-tree nodes (no outline parsing) */
  nodes?: string[];
  /** framework infographic pre-placed on the step canvas */
  framework?: number;
  /** override the default "step N = N minutes" duration */
  minutes?: number;
  /** pre-filled text for the framework's sticky notes (in drawing order) */
  stickies?: string[];
  /** break-screen reflection shown before this step */
  cue?: string;
  widget?: 'pixels';
}

export interface PresentationTemplate {
  id: string;
  category: TemplateCategory;
  title: string;
  description: string;
  audience: string;
  level: 'Başlangıç' | 'Orta' | 'İleri';
  roleplay?: Partial<RoleplayConfig>;
  steps: TemplateStep[];
  /** framework id for gallery previews */
  frameworkId?: number;
}

const BASE_TEMPLATES: PresentationTemplate[] = [
  /* ---------------- Girişimcilik ---------------- */
  {
    id: 'business-model-canvas',
    category: 'girisimcilik',
    title: 'İş Modeli Sunumu (Business Model Canvas)',
    description: 'Osterwalder’in 9 bloğu, 9 adım: her adım bir blok. İlk adımda tuvalde doldurulabilir İş Modeli Kanvası hazır gelir.',
    audience: 'Yatırımcılar, kuluçka programları, ekip içi strateji',
    level: 'Orta',
    frameworkId: 61,
    roleplay: { emotion: 'calm', tone: 'formal', setting: 'meeting', crowd: 2 },
    steps: [
      { title: 'Müşteri Segmentleri', minutes: 2, framework: 61, text: 'Kimin için değer yaratıyoruz? En önemli müşteri gruplarını ve ilk benimseyenleri anlat. Tuvaldeki kanvası sunum boyunca doldur.', words: ['kitle pazarı', 'niş', 'segment', 'persona', 'ilk benimseyen', 'B2B', 'B2C', 'ihtiyaç', 'çok taraflı'] },
      { title: 'Değer Önerisi', minutes: 3, text: 'Hangi problemi çözüyor, hangi ihtiyacı karşılıyoruz? Müşteri neden bizi seçmeli?', words: ['yenilik', 'performans', 'kişiselleştirme', 'tasarım', 'fiyat', 'maliyet azaltma', 'risk azaltma', 'erişilebilirlik', 'kolaylık'] },
      { title: 'Kanallar', minutes: 2, text: 'Farkındalık → değerlendirme → satın alma → teslimat → satış sonrası: müşteriye nasıl ulaşıyoruz?', tree: 'Farkındalık\n  Sosyal medya\n  İçerik / SEO\nSatış\n  Web sitesi\n  Satış ekibi\n  Ortak mağazalar\nTeslimat\nSatış sonrası' },
      { title: 'Müşteri İlişkileri', minutes: 2, text: 'Her segmentle nasıl bir ilişki kuruyoruz: kişisel destek, self servis, topluluk, birlikte üretim?', words: ['kişisel destek', 'self servis', 'otomasyon', 'topluluk', 'birlikte üretim', 'sadakat', 'onboarding', 'geri bildirim', 'abonelik'] },
      { title: 'Gelir Akışları', minutes: 3, text: 'Müşteriler neye, nasıl ve ne kadar ödüyor? Fiyatlandırma mekanizması ve gelir payları.', words: ['abonelik', 'satış', 'kullanım ücreti', 'lisans', 'komisyon', 'reklam', 'freemium', 'kiralama', 'dinamik fiyat'] },
      { title: 'Kilit Kaynaklar', minutes: 2, text: 'İş modelinin çalışması için gereken fiziksel, fikrî, insan ve finansal kaynaklar.', nodes: ['Fiziksel', 'Fikrî (marka, patent, veri)', 'İnsan', 'Finansal'] },
      { title: 'Kilit Faaliyetler', minutes: 2, text: 'Değer önerisini sunmak için mutlaka iyi yapmamız gereken işler: üretim, problem çözme, platform/ağ.', nodes: ['Üretim', 'Problem çözme', 'Platform / ağ yönetimi'] },
      { title: 'Kilit Ortaklar', minutes: 2, text: 'Tedarikçiler, stratejik ortaklıklar, ortak girişimler: kim hangi kaynağı veya faaliyeti sağlıyor?', words: ['tedarikçi', 'stratejik ortaklık', 'ortak girişim', 'rakiplerle iş birliği', 'ölçek ekonomisi', 'risk paylaşımı', 'lisans', 'dağıtıcı', 'yatırımcı'] },
      { title: 'Maliyet Yapısı & Kapanış', minutes: 3, text: 'En büyük sabit ve değişken maliyetler; maliyet odaklı mı değer odaklı mı? Kanvası birlikte gözden geçir ve tek cümleyle kapan.', tree: 'Sabit maliyetler\nDeğişken maliyetler\nÖlçek ekonomisi\nKârlılık yolu\n  Başa baş noktası\n  Birim ekonomisi\nKapanış cümlesi' },
    ],
  },
  {
    id: 'lean-canvas-9',
    category: 'girisimcilik',
    title: 'Lean Canvas Sunumu',
    description: 'Ash Maurya’nın yalın kanvası 9 adımda: problemden haksız avantaja. Erken aşama girişimler ve fikir doğrulama için.',
    audience: 'Girişimciler, hackathon jürisi, mentorlar',
    level: 'Başlangıç',
    frameworkId: 62,
    roleplay: { emotion: 'excited', tone: 'inspiring', setting: 'stage', crowd: 3 },
    steps: [
      { title: 'Problem', minutes: 2, framework: 62, text: 'En önemli 3 problem ve bugünkü alternatifler. Tuvaldeki Lean Canvas’ı her adımda doldur.', words: ['acı noktası', 'alternatif', 'zaman kaybı', 'maliyet', 'verimsizlik', 'risk', 'kullanıcı hikâyesi', 'mevcut çözüm', 'boşluk'] },
      { title: 'Müşteri Segmentleri', minutes: 2, text: 'Hedef müşteriler ve ilk benimseyenler kim? Onları nasıl tanırız?', words: ['ilk benimseyen', 'persona', 'niş', 'segment', 'karar verici', 'kullanıcı', 'alıcı', 'pazar', 'topluluk'] },
      { title: 'Benzersiz Değer Önerisi', minutes: 3, text: 'Tek, net, akılda kalan mesaj. Üst düzey kavram: “X için Y”.', words: ['fark', 'mesaj', 'fayda', 'sonuç', 'basitlik', 'hız', 'güven', 'X için Y', 'vaat'] },
      { title: 'Çözüm', minutes: 2, text: 'Her problem için en basit çözüm (MVP özellikleri).', nodes: ['Problem 1 → çözüm', 'Problem 2 → çözüm', 'Problem 3 → çözüm', 'MVP kapsamı'] },
      { title: 'Kanallar', minutes: 2, text: 'Müşterilere giden yol: ücretsiz ve ücretli kanallar, gelen ve giden pazarlama.', words: ['içerik', 'SEO', 'sosyal medya', 'topluluk', 'referans', 'ortaklık', 'reklam', 'etkinlik', 'viral döngü'] },
      { title: 'Gelir Akışları', minutes: 2, text: 'Gelir modeli, fiyat, yaşam boyu değer (LTV), brüt kâr.', words: ['fiyat', 'abonelik', 'LTV', 'brüt kâr', 'freemium', 'komisyon', 'ödeme isteği', 'deneme', 'paket'] },
      { title: 'Maliyet Yapısı', minutes: 2, text: 'Müşteri edinme maliyeti (CAC), dağıtım, barındırma, ekip; başa baş noktası.', words: ['CAC', 'barındırma', 'ekip', 'pazarlama', 'sabit', 'değişken', 'başa baş', 'nakit akışı', 'runway'] },
      { title: 'Temel Metrikler', minutes: 2, text: 'Başarıyı hangi sayılarla ölçeceğiz? Edinme, aktivasyon, elde tutma, gelir, tavsiye.', nodes: ['Edinme', 'Aktivasyon', 'Elde tutma', 'Gelir', 'Tavsiye', 'Kuzey yıldızı metriği'] },
      { title: 'Haksız Avantaj & Kapanış', minutes: 3, text: 'Kolayca kopyalanamayan ne var? Sonraki deney ve kapanış cümlesi.', tree: 'Haksız avantaj\n  İçeriden bilgi\n  Topluluk\n  Ağ etkisi\n  Ekip\nSonraki deney\nKapanış cümlesi' },
    ],
  },
  {
    id: 'value-proposition-canvas',
    category: 'girisimcilik',
    title: 'Değer Önerisi Kanvası Sunumu',
    description: 'Müşteri profili (işler, acılar, kazançlar) ile değer haritasını (ürünler, acı gidericiler, kazanç sağlayıcılar) eşleştir. İki doldurulmuş örnekle: ev yemeği uygulaması ve KOBİ bulut muhasebe.',
    audience: 'Ürün ekipleri, girişimciler, inovasyon atölyeleri',
    level: 'Başlangıç',
    frameworkId: 63,
    roleplay: { emotion: 'calm', tone: 'friendly', setting: 'meeting', crowd: 2 },
    steps: [
      { title: 'Müşteri İşleri', minutes: 2, framework: 63, text: 'Sağ taraf — müşteri profili. Müşteri neyi tamamlamak, hangi problemi çözmek, hangi hedefe ulaşmak istiyor? İşlevsel, sosyal ve duygusal işleri ayır. Tuvaldeki kanvası adım adım doldur.', words: ['görev', 'hedef', 'problem', 'işlevsel', 'sosyal', 'duygusal', 'bağlam', 'sıklık', 'öncelik'] },
      { title: 'Acılar', minutes: 2, text: 'Bu işleri yaparken karşılaşılan engeller, riskler, maliyetler ve olumsuz deneyimler. En şiddetli 3 acıyı sırala.', words: ['engel', 'risk', 'maliyet', 'zaman kaybı', 'hata', 'gecikme', 'belirsizlik', 'stres', 'karmaşa'] },
      { title: 'Kazançlar', minutes: 2, text: 'Müşterinin beklediği somut faydalar, tasarruflar ve olumlu sonuçlar: zorunlu, beklenen, arzu edilen, beklenmedik.', words: ['tasarruf', 'hız', 'kalite', 'güven', 'statü', 'kolaylık', 'sağlık', 'bütçe', 'görünürlük'] },
      { title: 'Ürün & Hizmetler', minutes: 2, text: 'Sol taraf — değer haritası. Müşteriye sunduğun somut çözümler: fiziksel, dijital, hizmet, finansal.', nodes: ['Fiziksel ürün', 'Dijital ürün', 'Hizmet', 'Finansal (abonelik, kredi)'] },
      { title: 'Acı Gidericiler & Kazanç Sağlayıcılar', minutes: 3, text: 'Her acıyı nasıl azaltıyor ya da ortadan kaldırıyorsun? Müşteriye nasıl ek fayda üretiyorsun? Uyum: acı gidericiler ↔ acılar, kazanç sağlayıcılar ↔ kazançlar, ürünler ↔ işler.', tree: 'Acı gidericiler\n  En şiddetli acı → çözüm\n  Risk → güvence\nKazanç sağlayıcılar\n  Beklenen fayda\n  Beklenmedik sürpriz\nUyum kontrolü' },
      { title: 'Örnek 1: Ev Yemeği Sipariş Uygulaması', minutes: 3, framework: 63, stickies: ['Yerel ev aşçılarından günlük yemek teslimatı yapan mobil uygulama', 'Kalori/malzeme bilgisi, haftalık abonelik indirimi, aşçı puanlama', '30 dakikada kapıda teslimat, şeffaf ve uygun fiyatlı porsiyonlar', 'Ev yapımı tadında, bütçe dostu, hızlı teslim', 'İş çıkışı pişirmeye vakit yok; fast-food pahalı ve sağlıksız', 'Akşam yemeği yemek, sağlıklı beslenmek'], text: 'Müşteri: çalışan profesyoneller.\n\nMüşteri profili — İşler: akşam yemeği yemek, sağlıklı beslenmek. Acılar: iş çıkışı yemek pişirmeye vakit bulamamak; dışarıdaki fast-food seçeneklerinin pahalı ve sağlıksız olması. Kazançlar: ev yapımı tadında, bütçe dostu ve hızlı teslim edilen öğünler.\n\nDeğer haritası — Ürün: yerel ev aşçılarından günlük yemek teslimatı mobil uygulaması. Acı gidericiler: 30 dakikada kapıda teslimat, şeffaf ve uygun fiyatlı porsiyonlar. Kazanç sağlayıcılar: kalori/malzeme bilgisi, haftalık abonelik indirimi, aşçı puanlama sistemi.', words: ['ev yemeği', 'teslimat', 'abonelik', 'kalori', 'puanlama', 'bütçe', 'sağlıklı', 'hızlı', 'aşçı'] },
      { title: 'Örnek 2: KOBİ’ler İçin Bulut Muhasebe', minutes: 3, framework: 63, stickies: ['E-fatura ve banka entegrasyonlu web tabanlı ön muhasebe platformu', 'Otomatik vade hatırlatıcıları, gerçek zamanlı nakit akışı grafikleri', 'Otomatik banka hareketi eşleştirme, tek tıkla mali müşavir erişimi', 'Anlık kâr-zarar, zaman ve danışmanlık maliyetinden tasarruf', 'Excel’de hata, muhasebeciyle evrak paylaşımında gecikme', 'Fatura kesmek, nakit akışını izlemek, vergiye hazırlanmak'], text: 'Müşteri: küçük işletme sahipleri.\n\nMüşteri profili — İşler: faturalandırma yapmak, nakit akışını takip etmek, vergi dönemine hazırlanmak. Acılar: karmaşık Excel tablolarında hata yapmak; muhasebeciyle evrak paylaşımında gecikmek. Kazançlar: anlık kâr-zarar görünümü; zamandan ve danışmanlık maliyetinden tasarruf.\n\nDeğer haritası — Ürün: e-fatura ve banka entegrasyonlu web tabanlı ön muhasebe platformu. Acı gidericiler: otomatik banka hareketi eşleştirme, tek tıkla mali müşavir erişimi. Kazanç sağlayıcılar: otomatik vade hatırlatıcıları, gerçek zamanlı nakit akışı grafikleri.\n\nKapanış: kendi ürününde en zayıf uyum hangi blokta? Bu hafta hangi müşteriyle konuşup doğrulayacaksın?', words: ['e-fatura', 'banka', 'nakit akışı', 'vergi', 'mali müşavir', 'Excel', 'otomasyon', 'hatırlatıcı', 'tasarruf'] },
    ],
  },
  {
    id: 'mikrodan-makroya',
    category: 'kisisel',
    title: 'Mikrodan Makroya: Ben, Biz ve Evren',
    description: 'Planck uzunluğundan (10⁻³⁵ m) gözlemlenebilir evrene (10²⁷ m) ölçek yolculuğu üzerinden farkındalık, wellness ve psikoloji sunumu. Benden bize, bireysel & toplumsal değer, 12 boyutlu bilinç haritası ve “1 piksel = 1 insan” deneyimiyle.',
    audience: 'Kişisel gelişim, farkındalık, wellness ve psikoloji grupları',
    level: 'Orta',
    frameworkId: 64,
    roleplay: { emotion: 'calm', tone: 'inspiring', setting: 'stage', crowd: 3 },
    steps: [
      { title: 'Planck uzunluğu · 10⁻³⁵ m — Şimdi', minutes: 2, framework: 64, text: 'Evrenin en küçük anlamlı ölçüsünden başlıyoruz. Farkındalık da en küçük birimde başlar: bu an, bu nefes. Tuvaldeki ölçek cetveli boyunca yolculuğumuzu izle: her basamak 10 kat.', words: ['şimdi', 'an', 'nefes', 'dikkat', 'küçük', 'kuantum', 'başlangıç', 'merak', 'farkındalık'] },
      { title: 'Atom çekirdeği · 10⁻¹⁵ m — Çekirdek değerlerim', minutes: 2, cue: 'Nefes alırken düşün: atomun kütlesinin neredeyse tamamı minicik çekirdeğinde. Senin de “çekirdeğin” var — seni sen yapan değerler. Nefes verirken birini içinden say.', text: 'Atomun kütlesinin %99,9’u çekirdekte. İnsanı ayakta tutan da çekirdek değerleridir. Seni sen yapan 3 değer ne?', words: ['dürüstlük', 'sevgi', 'cesaret', 'adalet', 'merhamet', 'özgürlük', 'aile', 'emek', 'saygı'] },
      { title: 'Atom · 10⁻¹⁰ m — Boşluğun gücü', minutes: 2, cue: 'Atom neredeyse tamamen boşluktur. Bu molada zihninde de biraz boşluk aç: 4 sn al, 4 sn tut, 4 sn bırak. Boşluk eksiklik değil, alan demek.', text: 'Atomun hacminin neredeyse tamamı boşluk. Zihnimizde de boşluğa, sessizliğe ihtiyaç var: düşünceler ve duygular arasında nefes alacak bir alan. Meditasyon, sınırlar, “hayır” diyebilmek.', words: ['boşluk', 'sessizlik', 'meditasyon', 'sınır', 'alan', 'dinlenme', 'zihin', 'sakinlik', 'kabul'] },
      { title: 'Mikron · 10⁻⁶ m — Küçük adımlar', minutes: 2, cue: 'Bedeninde şu an milyarlarca hücre sessizce yenileniyor. Omuzlarını gevşet, boynunu yavaşça iki yana esnet: büyük değişim, mikron mikron gelir.', text: 'Hücreler mikron ölçeğinde çalışır; beden her gün milyarlarcasını yeniler. Alışkanlıklar da böyledir: görünmeyecek kadar küçük adımlar, zamanla bambaşka bir sen. Bu hafta %1’lik hangi adım?', words: ['alışkanlık', 'hücre', 'yenilenme', '%1', 'süreklilik', 'sabır', 'rutin', 'uyku', 'beslenme'] },
      { title: 'İnsan · 10⁰ m — Ben', minutes: 3, cue: 'Tam ortadayız: 10⁰ metre, yani sen. Ellerini kalbinin üzerine koy, bir yudum su iç. Mikro evren de makro evren de buradan, senin bakışından ölçülüyor.', text: 'Ölçeklerin tam ortasındayız: insan ≈ 1 metre. Mikroya da makroya da buradan bakıyoruz. Bireysel farkındalık: bugün ne hissediyorum, neye ihtiyacım var, beni ne zorluyor?', words: ['duygu', 'ihtiyaç', 'beden', 'öz şefkat', 'farkındalık', 'kimlik', 'sınır', 'güç', 'kırılganlık'] },
      { title: 'Dünya · 10⁷ m — Benden bize', minutes: 3, framework: 66, cue: 'Dünya’nın çapı 12.700 km ve üzerinde 8 milyardan fazla “ben” var. Gözlerini kapat ve şu an aynı anda nefes alan milyarlarca insanı düşün: hepimiz aynı gemideyiz.', text: 'Tümevarım: kendi deneyimimden ortak insani gerçeğe. 1) Bireysel farkındalık — kendi duygularımı, ihtiyaçlarımı gözlemlerim. 2) Benzerlikleri görme — yaşadıklarımın başkalarında da olduğunu fark ederim. 3) Ortak payda — “hepimiz aynı gemideyiz” düşüncesi dayanışmaya dönüşür. Örnekler: empati, toplumsal değişim, edebiyat ve sanat.', nodes: ['Ben: bireysel farkındalık', 'Benzerlikleri görme', 'Biz: ortak payda', 'Empati', 'Toplumsal değişim', 'Edebiyat & sanat'] },
      { title: 'Güneş Sistemi · 10¹²–10¹⁶ m — Değer önerim', minutes: 3, framework: 63, stickies: ['Yeteneklerim, emeğim, zamanım, hikâyem', 'Toplumsal değer: bilgimi paylaşmak, gönüllülük, ilham vermek', 'Dinlemek, destek olmak, yükü paylaşmak', 'Bireysel değer: anlam, huzur, aidiyet', 'Yalnızlık, tükenmişlik, değersizlik hissi', 'Kendimi tanımak, büyümek, bağ kurmak'], cue: 'Güneş’ten çıkan ışık Dünya’ya 8 dakikada ulaşır. Senin ışığın kime ulaşıyor? Ayağa kalk, kollarını yukarı uzat, sonra yavaşça indir.', text: 'Gezegenler Güneş’in çekimiyle yörüngede kalır. Senin çevrene sunduğun “çekim” ne? Değer Önerisi Kanvası’nı kendine uygula — sağda bireysel değer (kendi işlerim, acılarım, kazançlarım), solda toplumsal değer (topluma ne sunuyorum, kimin acısını hafifletiyorum, kime kazanç sağlıyorum).', tree: 'Bireysel değer\n  Kendimi tanımak\n  Anlam ve huzur\n  Sağlık ve denge\nToplumsal değer\n  Bilgi paylaşımı\n  Gönüllülük\n  İlham ve rol model\nUyum: ben ↔ biz' },
      { title: 'Samanyolu · 10²¹ m — 12 boyutlu bilinç haritası', minutes: 3, framework: 65, cue: 'Samanyolu’nda 100–200 milyar yıldız var ve ışığın onu bir uçtan öbür uca geçmesi 100.000 yıl sürer. Gözlerini kapat; yoğun madde hissinden hafif bir ışığa doğru, nefesinle 12 basamak yüksel.', text: 'Spiritüel felsefe ve New Age öğretilerinde anlatılan 12 boyutlu bilinç modeli: yoğun maddeden (1) kaynak bilincine (12) uzanan sembolik bir farkındalık haritası. Not: bilimsel bir teori değil; kendi içsel yolculuğunu konuşmak için bir metafor. Sen bugün en çok hangi basamakta yaşıyorsun?', nodes: ['1 Madde ve atomlar', '2 Bitki ve hayvanlar', '3 İnsan ve ego', '4 Zaman, duygular, astral', '5 Sevgi ve bilgi', '6 Kozmik bilinç', '7 Ruhsal plan', '8 Kolektif & tekil denge', '9 Galaktik bilinç', '10 Evrensel yaratım', '11 Sonsuz ışık', '12 Mutlak birlik'] },
      { title: 'Gözlemlenebilir evren · 10²⁷ m — 1 piksel = 1 insan', minutes: 3, widget: 'pixels', cue: 'Gözlemlenebilir evrende yaklaşık 10⁸⁰ atom var, Dünya’da 8,3 milyar insan. Şimdi her insanı bir piksel olarak düşün: sen de o devasa resmin vazgeçilmez bir noktasısın.', text: 'Dünya nüfusu kadar piksel: 16:9 ekranda ≈ 121.680 × 68.445 (≈ 8,3 gigapiksel) — 4.016 Full HD ya da 1.004 adet 4K ekran. “🌍 Piksel” sekmesinde tek bir pikselden başlayıp resmi adım adım aç: her piksel bir kıta, bir ülke, bir şehir… sonunda bir insan. Tek bir pikselden bütün resim anlaşılmaz; ama her piksel olmadan da resim eksik kalır. Kapanış: sen hangi rengi katıyorsun?', words: ['piksel', 'insanlık', 'bütün', 'parça', 'renk', 'bağ', 'anlam', 'sen', 'biz'] },
    ],
  },
  {
    id: 'pitch-deck',
    category: 'girisimcilik',
    title: 'Yatırımcı Pitch’i',
    description: 'Problem → çözüm → pazar → iş modeli → ekip → talep. Klasik 6 adımlık yatırım sunumu.',
    audience: 'Melek yatırımcılar, VC',
    level: 'Orta',
    roleplay: { emotion: 'excited', tone: 'inspiring', setting: 'meeting', crowd: 2 },
    steps: [
      { title: 'Problem', text: 'Kimin, hangi acısını çözüyorsun? Tek bir gerçek kullanıcı hikâyesiyle başla.', words: ['acı noktası', 'müşteri', 'zaman', 'maliyet', 'hikâye', 'veri', 'kriz', 'merak', 'günlük hayat'] },
      { title: 'Çözüm & Demo', text: 'Ürünün problemi nasıl çözüyor? 30 saniyelik canlı demo ya da ekran görüntüsü.', tree: 'Değer önerisi\n  Önce / sonra\nDemo akışı\n  Kayıt\n  Ana özellik\n  “Aha!” anı' },
      { title: 'Pazar', text: 'TAM / SAM / SOM. Neden şimdi? Rakipler ve farkın.', tree: 'Pazar büyüklüğü\n  TAM\n  SAM\n  SOM\nNeden şimdi?\nRekabet\n  Doğrudan rakipler\n  Farkımız' },
      { title: 'İş modeli & Traction', text: 'Nasıl para kazanıyorsun? Kullanıcı, gelir, büyüme metrikleri.', words: ['abonelik', 'gelir', 'büyüme', 'churn', 'CAC', 'LTV', 'pilot', 'sözleşme', 'topluluk'] },
      { title: 'Ekip', text: 'Neden bu işi en iyi siz yaparsınız? Kurucu-pazar uyumu.', words: ['deneyim', 'tutku', 'mentor', 'danışman', 'geçmiş', 'başarısızlık', 'öğrenme', 'ekip', 'vizyon'] },
      { title: 'Talep & Kapanış', text: 'Ne kadar yatırım, ne için, hangi kilometre taşlarına ulaşmak için? Akılda kalan tek cümleyle bitir.', tree: 'Yatırım tutarı\nKullanım alanları\n  Ürün\n  Pazarlama\n  Ekip\n18 aylık hedefler\nKapanış cümlesi' },
    ],
  },
  {
    id: 'lean-canvas',
    category: 'girisimcilik',
    title: 'Lean Canvas ile Fikir Doğrulama',
    description: 'Bir fikri 4 adımda masaya yatır: varsayımlar, müşteri, deney, karar.',
    audience: 'Kuluçka programı, ekip içi',
    level: 'Başlangıç',
    roleplay: { emotion: 'calm', tone: 'friendly', setting: 'cafe', crowd: 2 },
    steps: [
      { title: 'Fikir & Varsayımlar', text: 'Fikri tek cümleyle anlat, en riskli 3 varsayımı listele.', words: ['varsayım', 'risk', 'hipotez', 'müşteri', 'problem', 'çözüm', 'kanal', 'fiyat', 'rakip'] },
      { title: 'Müşteri segmenti', text: 'Erken benimseyen kim? Persona ve mülakat bulguları.', tree: 'Persona\n  Demografi\n  Davranış\nMülakat bulguları\n  Tekrar eden acılar\n  Şaşırtan cevaplar' },
      { title: 'MVP deneyi', text: 'En ucuz ve en hızlı doğrulama deneyi nedir? Başarı kriteri?', words: ['landing page', 'bekleme listesi', 'prototip', 'ölçüm', 'dönüşüm', 'A/B testi', 'geri bildirim', 'iterasyon', 'sprint'] },
      { title: 'Karar: Pivot mu devam mı?', text: 'Veri ne diyor? Sonraki sprint’in tek hedefi.', tree: 'Öğrendiklerimiz\nKarar\n  Devam\n  Pivot\n  Durdur\nSonraki sprint hedefi' },
    ],
  },

  /* ---------------- Ekonomi ---------------- */
  {
    id: 'enflasyon',
    category: 'ekonomi',
    title: 'Enflasyonu Herkes İçin Anlatmak',
    description: 'Teknik jargon olmadan enflasyon: market sepeti, nedenler, etkiler, kişisel önlemler.',
    audience: 'Genel kitle, lise/üniversite',
    level: 'Başlangıç',
    roleplay: { emotion: 'neutral', tone: 'friendly', setting: 'family', crowd: 3 },
    steps: [
      { title: 'Market sepeti hikâyesi', text: 'Aynı sepetin 1 yıl önce ve bugünkü fiyatı. Enflasyon nedir?', words: ['ekmek', 'kira', 'maaş', 'fiyat', 'sepet', 'alım gücü', 'zam', 'bütçe', 'pazar'] },
      { title: 'Nedenleri', text: 'Talep, maliyet, para arzı, beklentiler.', tree: 'Talep enflasyonu\nMaliyet enflasyonu\n  Enerji\n  Kur\nPara arzı\nBeklentiler' },
      { title: 'Kimi nasıl etkiler?', text: 'Sabit gelirli, borçlu, tasarruf sahibi, işletmeler.', words: ['emekli', 'öğrenci', 'esnaf', 'kredi', 'tasarruf', 'faiz', 'ücret', 'eşitsizlik', 'belirsizlik'] },
      { title: 'Kişisel önlemler', text: 'Bütçe disiplini, harcama önceliklendirme, finansal okuryazarlık. (Yatırım tavsiyesi değildir.)', tree: 'Bütçe takibi\nÖncelikli harcamalar\nAcil durum fonu\nFinansal okuryazarlık' },
    ],
  },
  {
    id: 'yerel-ekonomi',
    category: 'ekonomi',
    title: 'Yerel Ekonomi & Kooperatif Modeli',
    description: 'Bir mahalle / köy ölçeğinde ortak üretim ve paylaşım ekonomisi önerisi.',
    audience: 'Belediye, STK, yerel üreticiler',
    level: 'Orta',
    roleplay: { emotion: 'joyful', tone: 'friendly', setting: 'meeting', crowd: 3 },
    steps: [
      { title: 'Bölgenin hikâyesi', text: 'Bölgenin güçlü yanları ve kaybolan değerleri.', words: ['üretici', 'göç', 'gelenek', 'toprak', 'zanaat', 'genç', 'kadın', 'pazar', 'turizm'] },
      { title: 'Kooperatif modeli', text: 'Ortaklık yapısı, karar alma, gelir paylaşımı.', tree: 'Ortaklık\n  Üyelik\n  Aidat\nYönetişim\n  Genel kurul\nGelir paylaşımı' },
      { title: 'Pilot proje', text: 'İlk 6 ayda tek ürün / tek kanal ile pilot.', words: ['pilot', 'e-ticaret', 'marka', 'sertifika', 'lojistik', 'fiyat', 'kalite', 'hibe', 'eğitim'] },
      { title: 'Etki ölçümü', text: 'Gelir, istihdam, topluluk metrikleri.', tree: 'Ekonomik etki\nSosyal etki\n  İstihdam\n  Kadın katılımı\nÇevresel etki' },
      { title: 'Çağrı', text: 'Kimden ne bekliyoruz? Somut ilk adım.', words: ['gönüllü', 'destek', 'ortaklık', 'imza', 'toplantı', 'takvim', 'sorumlu', 'bütçe', 'söz'] },
    ],
  },

  /* ---------------- Eğitim ---------------- */
  {
    id: 'ders-plani',
    category: 'egitim',
    title: 'Etkileşimli Ders Planı (5E)',
    description: 'Dikkat çek → keşfet → açıkla → derinleştir → değerlendir. 5E öğrenme modeli.',
    audience: 'Öğretmenler, eğitmenler',
    level: 'Başlangıç',
    roleplay: { emotion: 'excited', tone: 'friendly', setting: 'classroom', crowd: 3 },
    steps: [
      { title: 'Dikkat çek (Engage)', text: 'Şaşırtıcı bir soru, video ya da nesneyle başla.', words: ['soru', 'merak', 'oyun', 'video', 'hikâye', 'bilmece', 'tahmin', 'gözlem', 'sürpriz'] },
      { title: 'Keşfet (Explore)', text: 'Öğrenciler küçük gruplarla dener, gözlemler.', tree: 'Grup etkinliği\n  Malzemeler\n  Görev kartı\nGözlem formu' },
      { title: 'Açıkla (Explain)', text: 'Kavramları öğrencilerin bulgularına bağlayarak açıkla.', tree: 'Ana kavram\n  Tanım\n  Örnek\nYaygın kavram yanılgıları' },
      { title: 'Derinleştir (Elaborate)', text: 'Gerçek hayata transfer: yeni bir durumda uygula.', words: ['proje', 'günlük hayat', 'meslek', 'tasarım', 'problem', 'işbirliği', 'yaratıcılık', 'model', 'sunum'] },
      { title: 'Değerlendir (Evaluate)', text: 'Çıkış kartı, mini quiz, öz değerlendirme.', tree: 'Çıkış kartı\nMini quiz\nÖz değerlendirme\nÖdev' },
    ],
  },
  {
    id: 'tez-savunma',
    category: 'egitim',
    title: 'Tez / Proje Savunması',
    description: 'Jüri karşısında akademik çalışmanı net ve savunulabilir biçimde sun.',
    audience: 'Akademik jüri',
    level: 'İleri',
    roleplay: { emotion: 'calm', tone: 'formal', setting: 'meeting', crowd: 2 },
    steps: [
      { title: 'Araştırma sorusu', text: 'Problem, motivasyon, araştırma sorusu ve hipotezler.', tree: 'Problem\nMotivasyon\nAraştırma soruları\nHipotezler' },
      { title: 'Literatür', text: 'Bu alanda ne biliniyor, boşluk nerede?', words: ['literatür', 'boşluk', 'kuram', 'model', 'katkı', 'önceki çalışma', 'eleştiri', 'kavram', 'çerçeve'] },
      { title: 'Yöntem', text: 'Desen, örneklem, veri toplama, analiz.', tree: 'Araştırma deseni\nÖrneklem\nVeri toplama\nAnaliz\nGeçerlik & güvenirlik' },
      { title: 'Bulgular', text: 'En önemli 3 bulgu, görsellerle.', words: ['anlamlı', 'korelasyon', 'grafik', 'tablo', 'beklenmedik', 'etki', 'karşılaştırma', 'trend', 'sonuç'] },
      { title: 'Tartışma & Sınırlılıklar', text: 'Bulgular literatürle nasıl konuşuyor? Sınırlılıklar ve öneriler.', tree: 'Yorum\nSınırlılıklar\nGelecek çalışmalar\nKatkı' },
    ],
  },

  /* ---------------- Sağlık ---------------- */
  {
    id: 'saglikli-yasam',
    category: 'saglik',
    title: 'Sağlıklı Yaşam Atölyesi',
    description: 'Uyku, beslenme, hareket, stres — 4 sütunlu farkındalık sunumu. (Tıbbi tavsiye yerine geçmez.)',
    audience: 'Kurum çalışanları, topluluk',
    level: 'Başlangıç',
    roleplay: { emotion: 'calm', tone: 'friendly', setting: 'stage', crowd: 4 },
    steps: [
      { title: 'Uyku', text: 'Uyku hijyeni ve ekran ışığı.', words: ['uyku', 'rutin', 'ekran', 'kafein', 'yatak', 'karanlık', 'dinlenme', 'saat', 'enerji'] },
      { title: 'Beslenme', text: 'Tabak modeli, su tüketimi, işlenmiş gıda.', tree: 'Tabak modeli\n  Sebze\n  Protein\n  Tam tahıl\nSu\nİşlenmiş gıda' },
      { title: 'Hareket', text: 'Masa başında mikro hareketler. (Uygulamadaki esneme molasını kullan!)', words: ['yürüyüş', 'merdiven', 'esneme', 'duruş', 'adım', 'nefes', 'egzersiz', 'mola', 'bisiklet'] },
      { title: 'Stres yönetimi', text: '4-4-4 nefes, sınır koyma, sosyal destek.', tree: 'Nefes teknikleri\nSınır koymak\nSosyal destek\nProfesyonel yardım ne zaman?' },
    ],
  },
  {
    id: 'vaka-sunumu',
    category: 'saglik',
    title: 'Klinik Vaka Sunumu',
    description: 'Sağlık profesyonelleri için yapılandırılmış vaka tartışması (anonimleştirilmiş veri ile).',
    audience: 'Hekimler, hemşireler, öğrenciler',
    level: 'İleri',
    roleplay: { emotion: 'neutral', tone: 'serious', setting: 'meeting', crowd: 3 },
    steps: [
      { title: 'Vaka özeti', text: 'Yaş, cinsiyet, başvuru şikâyeti — kişisel veriler anonim.', tree: 'Başvuru şikâyeti\nÖykü\nÖzgeçmiş\nSoygeçmiş' },
      { title: 'Muayene & tetkikler', text: 'Fizik muayene, laboratuvar, görüntüleme bulguları.', tree: 'Fizik muayene\nLaboratuvar\nGörüntüleme' },
      { title: 'Ayırıcı tanı', text: 'Olası tanılar ve gerekçeleri.', words: ['ayırıcı tanı', 'semptom', 'bulgu', 'olasılık', 'kılavuz', 'risk faktörü', 'kanıt', 'test', 'tanı'] },
      { title: 'Tedavi & izlem', text: 'Uygulanan yaklaşım ve sonuç.', tree: 'Tedavi planı\nKomplikasyonlar\nİzlem\nSonuç' },
      { title: 'Öğrenme noktaları', text: 'Bu vakadan çıkan 3 ders.', words: ['ders', 'hata', 'iletişim', 'ekip', 'hasta güvenliği', 'kılavuz', 'erken tanı', 'deneyim', 'empati'] },
    ],
  },

  /* ---------------- Bilim ---------------- */
  {
    id: 'bilim-iletisimi',
    category: 'bilim',
    title: 'Bilimi Halka Anlatmak',
    description: 'Karmaşık bir bilimsel konuyu benzetmeler ve hikâyeyle anlat. Feynman tekniği.',
    audience: 'Genel kitle, bilim şenliği',
    level: 'Orta',
    roleplay: { emotion: 'excited', tone: 'humorous', setting: 'stage', crowd: 4 },
    steps: [
      { title: 'Büyük soru', text: 'Herkesin merak ettiği tek bir soruyla başla.', words: ['evren', 'atom', 'zaman', 'ışık', 'yaşam', 'enerji', 'kara delik', 'DNA', 'merak'] },
      { title: 'Benzetme', text: 'Kavramı günlük bir nesneyle anlat.', words: ['mutfak', 'futbol', 'trafik', 'kahve', 'balon', 'ayna', 'harita', 'müzik', 'oyun'] },
      { title: 'Nasıl biliyoruz?', text: 'Deney, gözlem, kanıt — bilimsel yöntem.', tree: 'Gözlem\nHipotez\nDeney\n  Kontrol grubu\n  Tekrarlanabilirlik\nSonuç' },
      { title: 'Hayatımıza etkisi', text: 'Bu bilgi telefonundan ilacına neyi değiştirdi?', tree: 'Teknoloji\nSağlık\nÇevre\nGelecek' },
    ],
  },
  {
    id: 'iklim',
    category: 'bilim',
    title: 'İklim Değişikliği: Veri ve Çözümler',
    description: 'Kanıt → etkiler → çözümler → bireysel eylem. Veri odaklı, umut odaklı.',
    audience: 'Öğrenciler, kurumlar',
    level: 'Orta',
    roleplay: { emotion: 'neutral', tone: 'inspiring', setting: 'classroom', crowd: 3 },
    steps: [
      { title: 'Veriler ne söylüyor?', text: 'Sıcaklık, CO₂, deniz seviyesi grafikleri.', words: ['sıcaklık', 'karbon', 'buzul', 'deniz seviyesi', 'grafik', 'ölçüm', 'ortalama', 'rekor', 'trend'] },
      { title: 'Etkiler', text: 'Kuraklık, tarım, göç, biyoçeşitlilik.', tree: 'Su kaynakları\nTarım & gıda\nBiyoçeşitlilik\nSağlık\nGöç' },
      { title: 'Çözümler', text: 'Yenilenebilir enerji, verimlilik, adaptasyon.', tree: 'Azaltım\n  Yenilenebilir enerji\n  Verimlilik\nAdaptasyon\n  Su yönetimi\n  Şehir planlama' },
      { title: 'Ben ne yapabilirim?', text: 'Somut, ölçülebilir bireysel ve topluluk eylemleri.', words: ['tasarruf', 'toplu taşıma', 'geri dönüşüm', 'yerel', 'ağaç', 'gönüllü', 'enerji', 'bilinç', 'topluluk'] },
    ],
  },

  /* ---------------- Teknoloji ---------------- */
  {
    id: 'yapay-zeka-101',
    category: 'teknoloji',
    title: 'Yapay Zekâ 101',
    description: 'YZ nedir, nasıl öğrenir, nerede kullanılır, riskleri ne? Teknik olmayan kitle için.',
    audience: 'Yöneticiler, genel kitle',
    level: 'Başlangıç',
    roleplay: { emotion: 'excited', tone: 'friendly', setting: 'online', crowd: 4 },
    steps: [
      { title: 'YZ nedir, ne değildir?', text: 'Bilim kurgu vs gerçek: örüntü tanıma makineleri.', words: ['yapay zekâ', 'veri', 'model', 'robot', 'algoritma', 'tahmin', 'öğrenme', 'insan', 'efsane'] },
      { title: 'Nasıl öğrenir?', text: 'Veri → eğitim → model → tahmin. Basit bir örnekle.', tree: 'Veri\n  Etiketli veri\nEğitim\nModel\nTahmin\n  Hata payı' },
      { title: 'Kullanım alanları', text: 'Sağlık, eğitim, üretim, günlük hayat.', words: ['sohbet asistanı', 'çeviri', 'öneri sistemi', 'görüntü', 'otomasyon', 'sağlık', 'eğitim', 'oyun', 'güvenlik'] },
      { title: 'Riskler & etik', text: 'Yanlılık, mahremiyet, sorumluluk, şeffaflık.', tree: 'Yanlılık\nMahremiyet\nŞeffaflık\nSorumluluk\nİnsan denetimi' },
      { title: 'Yarın sabah ne yapmalı?', text: 'Kurumda / hayatta ilk 3 adım.', words: ['pilot', 'eğitim', 'politika', 'deney', 'verimlilik', 'merak', 'ölçüm', 'ekip', 'strateji'] },
    ],
  },
  {
    id: 'urun-lansmani',
    category: 'teknoloji',
    title: 'Ürün / Özellik Lansmanı',
    description: 'Demo günü veya sprint review için yeni özelliği tanıt: neden, ne, nasıl, sonraki adım.',
    audience: 'Ekip, paydaşlar, kullanıcılar',
    level: 'Orta',
    roleplay: { emotion: 'joyful', tone: 'inspiring', setting: 'online', crowd: 3 },
    steps: [
      { title: 'Neden?', text: 'Hangi kullanıcı ihtiyacından doğdu? Veri ve geri bildirim.', words: ['kullanıcı', 'geri bildirim', 'metrik', 'acı noktası', 'talep', 'destek talebi', 'anket', 'hedef', 'OKR'] },
      { title: 'Canlı demo', text: 'Happy path + bir uç durum.', tree: 'Giriş noktası\nAna akış\nUç durum\n“Aha!” anı' },
      { title: 'Nasıl yaptık?', text: 'Mimari kararlar, ödünleşimler, öğrendiklerimiz.', words: ['mimari', 'performans', 'güvenlik', 'test', 'refactor', 'teknik borç', 'API', 'veritabanı', 'deploy'] },
      { title: 'Sonraki adımlar', text: 'Ölçüm planı, roadmap, geri bildirim kanalı.', tree: 'Başarı metrikleri\nRoadmap\nBilinen sorunlar\nGeri bildirim kanalı' },
    ],
  },

  /* ---------------- Finans ---------------- */
  {
    id: 'kisisel-finans',
    category: 'finans',
    title: 'Kişisel Finans Temelleri',
    description: 'Bütçe, acil durum fonu, borç yönetimi, bileşik getiri. (Yatırım tavsiyesi değildir.)',
    audience: 'Gençler, yeni mezunlar',
    level: 'Başlangıç',
    roleplay: { emotion: 'calm', tone: 'friendly', setting: 'cafe', crowd: 3 },
    steps: [
      { title: 'Paran nereye gidiyor?', text: '50/30/20 kuralı ve harcama takibi.', words: ['bütçe', 'maaş', 'kira', 'abonelik', 'market', 'eğlence', 'tasarruf', 'fatura', 'harcama'] },
      { title: 'Acil durum fonu', text: '3-6 aylık giderin neden önemli?', tree: 'Neden gerekli?\nNe kadar?\nNerede tutulur?' },
      { title: 'Borç yönetimi', text: 'Kredi kartı faizi, borç kartopu vs çığ yöntemi.', tree: 'İyi borç / kötü borç\nKredi kartı\nKartopu yöntemi\nÇığ yöntemi' },
      { title: 'Bileşik getiri & uzun vade', text: 'Zamanın gücü, risk-getiri dengesi, çeşitlendirme kavramı.', words: ['faiz', 'enflasyon', 'risk', 'getiri', 'çeşitlendirme', 'vade', 'sabır', 'hedef', 'disiplin'] },
    ],
  },
  {
    id: 'ceyrek-sonuclari',
    category: 'finans',
    title: 'Çeyrek Sonuçları Sunumu',
    description: 'Yönetim kurulu / ekip için finansal performans: özet, gelir, gider, nakit, beklenti.',
    audience: 'Yönetim kurulu, yatırımcılar',
    level: 'İleri',
    roleplay: { emotion: 'neutral', tone: 'formal', setting: 'meeting', crowd: 2 },
    steps: [
      { title: 'Yönetici özeti', text: '3 rakam, 3 cümle.', words: ['gelir', 'kâr', 'büyüme', 'marj', 'hedef', 'sapma', 'nakit', 'müşteri', 'özet'] },
      { title: 'Gelir analizi', text: 'Segment, ürün, bölge kırılımı.', tree: 'Segment\nÜrün\nBölge\nYıllık karşılaştırma' },
      { title: 'Gider & verimlilik', text: 'OPEX, CAPEX, birim ekonomisi.', tree: 'OPEX\nCAPEX\nBirim ekonomisi\nTasarruf alanları' },
      { title: 'Nakit & risk', text: 'Nakit akışı, runway, riskler.', words: ['nakit akışı', 'runway', 'kur', 'tahsilat', 'borç', 'likidite', 'senaryo', 'risk', 'önlem'] },
      { title: 'Beklenti & kararlar', text: 'Sonraki çeyrek için tahmin ve onay istenen kararlar.', tree: 'Tahmin\n  Baz senaryo\n  Kötü senaryo\nOnay istenen kararlar' },
    ],
  },

  /* ---------------- Siyaset & Kamu ---------------- */
  {
    id: 'kamu-politikasi',
    category: 'siyaset',
    title: 'Kamu Politikası Önerisi',
    description: 'Bir politika önerisini kanıta dayalı ve tarafsız biçimde sun: sorun, seçenekler, etki, uygulama.',
    audience: 'Karar alıcılar, düşünce kuruluşları, öğrenciler',
    level: 'İleri',
    roleplay: { emotion: 'neutral', tone: 'serious', setting: 'meeting', crowd: 3 },
    steps: [
      { title: 'Sorunun tanımı', text: 'Kimi, ne ölçüde etkiliyor? Veri ve kaynaklar.', words: ['veri', 'kaynak', 'vatandaş', 'eşitsizlik', 'erişim', 'maliyet', 'paydaş', 'kanıt', 'ölçek'] },
      { title: 'Politika seçenekleri', text: 'En az 3 seçenek, her biri için artı/eksi. Tarafsız karşılaştırma.', tree: 'Seçenek A\n  Artılar\n  Eksiler\nSeçenek B\n  Artılar\n  Eksiler\nSeçenek C\n  Artılar\n  Eksiler' },
      { title: 'Etki analizi', text: 'Maliyet-fayda, kimler kazanır/kaybeder, istenmeyen sonuçlar.', tree: 'Maliyet-fayda\nDağılımsal etki\nİstenmeyen sonuçlar\nUluslararası örnekler' },
      { title: 'Uygulama & izleme', text: 'Takvim, sorumlu kurumlar, başarı göstergeleri.', words: ['takvim', 'bütçe', 'pilot', 'mevzuat', 'koordinasyon', 'gösterge', 'şeffaflık', 'denetim', 'geri bildirim'] },
    ],
  },
  {
    id: 'mahalle-projesi',
    category: 'siyaset',
    title: 'Mahalle / Yerel Yönetim Projesi',
    description: 'Katılımcı demokrasi: bir yerel ihtiyacı belediye veya muhtarlığa sun.',
    audience: 'Belediye meclisi, muhtarlık, komşular',
    level: 'Başlangıç',
    roleplay: { emotion: 'joyful', tone: 'friendly', setting: 'meeting', crowd: 3 },
    steps: [
      { title: 'İhtiyaç', text: 'Komşuların sesi: anket, fotoğraf, harita.', words: ['park', 'aydınlatma', 'kaldırım', 'çocuk', 'yaşlı', 'güvenlik', 'otopark', 'yeşil alan', 'erişilebilirlik'] },
      { title: 'Öneri', text: 'Somut proje ve görsel taslak (tuvali kullan!).', tree: 'Proje tanımı\nKonum\nTaslak çizim\nBenzer örnekler' },
      { title: 'Bütçe & gönüllüler', text: 'Maliyet tahmini, kaynak, mahalle katkısı.', tree: 'Maliyet\nKaynaklar\n  Belediye\n  Hibe\n  Gönüllü emek' },
      { title: 'Takvim & talep', text: 'Kimden ne istiyoruz, ne zamana?', words: ['imza', 'toplantı', 'karar', 'takvim', 'sorumlu', 'takip', 'şeffaflık', 'teşekkür', 'birlikte'] },
    ],
  },

  /* ---------------- İnanç & Değerler ---------------- */
  {
    id: 'inanclar-karsilastirmali',
    category: 'inanc',
    title: 'İnançlar ve Değerler: Karşılaştırmalı Bakış',
    description: 'Farklı inanç ve felsefe geleneklerindeki ortak değerleri saygılı, akademik bir dille keşfet.',
    audience: 'Öğrenciler, kültürlerarası gruplar',
    level: 'Orta',
    roleplay: { emotion: 'calm', tone: 'formal', setting: 'classroom', crowd: 3 },
    steps: [
      { title: 'Neden konuşmalıyız?', text: 'Karşılıklı anlayışın toplumsal barışa katkısı. Saygı kuralları.', words: ['saygı', 'anlayış', 'merak', 'önyargı', 'diyalog', 'kültür', 'tarih', 'toplum', 'barış'] },
      { title: 'Ortak değerler', text: 'Merhamet, adalet, dürüstlük, cömertlik — farklı geleneklerden örnekler.', tree: 'Merhamet\nAdalet\nDürüstlük\nCömertlik\nAile & komşuluk' },
      { title: 'Ritüel ve gelenekler', text: 'Bayramlar, oruç/perhiz, dua/meditasyon pratikleri — betimleyici, karşılaştırmasız.', tree: 'Bayramlar\nOruç & perhiz\nDua & meditasyon\nYardımlaşma gelenekleri' },
      { title: 'Birlikte yaşam', text: 'Farklılıklarla bir arada yaşamak için pratik öneriler.', words: ['empati', 'dinlemek', 'komşuluk', 'gönüllülük', 'hoşgörü', 'ortak proje', 'sofra', 'sohbet', 'dostluk'] },
    ],
  },
  {
    id: 'deger-temelli-liderlik',
    category: 'inanc',
    title: 'Değer Temelli Liderlik',
    description: 'Kişisel değerlerini keşfet ve ekibine/topluluğuna nasıl yansıttığını anlat.',
    audience: 'Liderler, STK gönüllüleri',
    level: 'Başlangıç',
    roleplay: { emotion: 'nostalgic', tone: 'inspiring', setting: 'stage', crowd: 3 },
    steps: [
      { title: 'Beni ben yapan değerler', text: 'Hayatına yön veren 3 değer ve bir hatıra.', words: ['dürüstlük', 'sadakat', 'cesaret', 'tevazu', 'adalet', 'sabır', 'şükran', 'sorumluluk', 'aile'] },
      { title: 'Zor bir karar', text: 'Değerlerinin sınandığı bir anı anlat.', tree: 'Durum\nİkilem\nKarar\nSonuç & ders' },
      { title: 'Ekipte yansıması', text: 'Değerleri günlük ritüellere dönüştürmek.', words: ['güven', 'şeffaflık', 'geri bildirim', 'takdir', 'mentorluk', 'kapsayıcılık', 'örnek olmak', 'ritüel', 'topluluk'] },
      { title: 'Davet', text: 'Dinleyicilere kendi değerlerini yazmaları için bir soru bırak.', tree: 'Yansıtma sorusu\nKüçük taahhüt\nKapanış' },
    ],
  },

  /* ---------------- Kişisel gelişim ---------------- */
  {
    id: 'kendini-tanit',
    category: 'kisisel',
    title: 'Kendini 6 Dakikada Tanıt',
    description: 'Mülakat, networking veya topluluk tanışması için 1-2-3 dakikalık üç adım.',
    audience: 'İşe alım, networking etkinliği',
    level: 'Başlangıç',
    roleplay: { emotion: 'joyful', tone: 'friendly', setting: 'elevator', crowd: 1 },
    steps: [
      { title: 'Kimim? (Asansör konuşması)', text: '60 saniye: ne yapıyorsun, kime değer katıyorsun?', words: ['tutku', 'uzmanlık', 'değer', 'merak', 'şehir', 'hobi', 'hayal', 'proje', 'ekip'] },
      { title: 'Bir başarı hikâyesi (STAR)', text: 'Durum, Görev, Aksiyon, Sonuç.', tree: 'Durum\nGörev\nAksiyon\nSonuç' },
      { title: 'Nereye gidiyorum?', text: 'Hedeflerin ve karşındakinden ne öğrenmek istediğin.', words: ['hedef', 'öğrenmek', 'işbirliği', 'mentor', 'gelecek', 'beceri', 'topluluk', 'katkı', 'soru'] },
    ],
  },
  {
    id: 'hikaye-anlatimi',
    category: 'kisisel',
    title: 'Hikâye Anlatıcılığı Antrenmanı',
    description: 'Kahramanın yolculuğu ile kişisel bir hikâye kur; tombala kelimeleriyle doğaçlama yap.',
    audience: 'Sahne / konuşma kulübü',
    level: 'Orta',
    roleplay: { emotion: 'nostalgic', tone: 'humorous', setting: 'cafe', crowd: 3, randomizePerStep: true },
    steps: [
      { title: 'Sıradan dünya', text: 'Kahraman (sen) hikâyenin başında nasıldı?', words: ['çocukluk', 'şehir', 'aile', 'okul', 'alışkanlık', 'hayal', 'korku', 'arkadaş', 'sabah'] },
      { title: 'Çağrı & engel', text: 'Hayatını değiştiren an ve önündeki engel.', words: ['telefon', 'mektup', 'kayıp', 'fırsat', 'ret', 'yolculuk', 'kapı', 'karar', 'yağmur'] },
      { title: 'Dönüşüm', text: 'Ne öğrendin, nasıl değiştin?', tree: 'Mentor\nEn karanlık an\nÇözüm\nDeğişim' },
      { title: 'Eve dönüş & mesaj', text: 'Dinleyiciye bırakacağın tek cümle.', words: ['ders', 'umut', 'teşekkür', 'cesaret', 'yeniden', 'ışık', 'anahtar', 'köprü', 'yarın'] },
    ],
  },
];

const firstLine = (p: string) => p.split('\n')[0].trim();

/** Framework infographic as one group whose children are position-locked. */
function frameworkCanvas(id?: number, stickies?: string[]): { canvas: CanvasElement[]; groups: CanvasGroup[] } {
  const fw = id ? frameworkById(id) : undefined;
  if (!fw) return { canvas: [], groups: [] };
  const g: CanvasGroup = { id: uid(), name: fw.name, lockChildren: true, frameworkId: fw.id };
  let k = 0;
  return {
    canvas: buildFramework(fw).map((e) => {
      if (e.type !== 'sticky') return { ...e, groupId: g.id };
      const text = stickies?.[k++];
      return text ? { ...e, text, fontSize: 15 } : e;
    }),
    groups: [g],
  };
}

/** One 3-step template per framework: the model (diagram on canvas) → your example (parts as tombala) → action plan. */
const FRAMEWORK_TEMPLATES: PresentationTemplate[] = FRAMEWORKS.map((fw) => {
  const parts = fw.parts.map(firstLine);
  return {
    id: `fw-${fw.id}`,
    category: 'cerceve',
    title: fw.name,
    description: `${fw.subtitle} — ${fw.desc}`,
    audience: FW_GROUPS[fw.group].label,
    level: 'Başlangıç',
    frameworkId: fw.id,
    steps: [
      { title: `${fw.name}: model`, text: `${fw.desc}\n\nBileşenler: ${parts.join(' · ')}`, nodes: parts, framework: fw.id },
      { title: 'Kendi örneğim', text: 'Modeli kendi hayatına ya da işine uygula: her bileşen için bir örnek ver. Söyledikçe tombala kelimeleri otomatik işaretlenir.', words: parts },
      { title: 'Eylem planı', text: 'Bu modelden çıkan 3 somut aksiyonu ve bu hafta atacağın ilk adımı yaz. Kim, ne zaman, nasıl ölçülecek?', nodes: ['Aksiyon 1', 'Aksiyon 2', 'Aksiyon 3', 'İlk adım (bu hafta)'] },
    ],
  };
});

export const TEMPLATES: PresentationTemplate[] = [...BASE_TEMPLATES, ...FRAMEWORK_TEMPLATES];

export function presentationFromTemplate(t: PresentationTemplate): Presentation {
  const base = createPresentation(t.steps.length);
  return {
    ...base,
    title: t.title,
    audience: t.audience,
    templateId: t.id,
    roleplay: t.roleplay ? { ...base.roleplay, ...t.roleplay, enabled: true } : base.roleplay,
    steps: t.steps.map((s, i) => ({
      ...createStep(i),
      title: s.title,
      text: s.text,
      topicMode: s.words ? 'tombala' : s.tree || s.nodes ? 'tree' : 'free',
      words: s.words ?? [],
      topicTree: s.nodes ? s.nodes.map((n) => createNode(n)) : s.tree ? parseOutline(s.tree) : [],
      ...(s.minutes ? { durationSec: s.minutes * 60 } : {}),
      ...(s.cue ? { cue: s.cue } : {}),
      ...(s.widget ? { widget: s.widget } : {}),
      ...frameworkCanvas(s.framework, s.stickies),
    })),
  };
}

export function totalMinutes(t: PresentationTemplate): number {
  return t.steps.reduce((sum, s, i) => sum + (s.minutes ?? i + 1), 0);
}
