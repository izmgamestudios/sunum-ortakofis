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
function frameworkCanvas(id?: number): { canvas: CanvasElement[]; groups: CanvasGroup[] } {
  const fw = id ? frameworkById(id) : undefined;
  if (!fw) return { canvas: [], groups: [] };
  const g: CanvasGroup = { id: uid(), name: fw.name, lockChildren: true, frameworkId: fw.id };
  return { canvas: buildFramework(fw).map((e) => ({ ...e, groupId: g.id })), groups: [g] };
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
      ...frameworkCanvas(s.framework),
    })),
  };
}

export function totalMinutes(t: PresentationTemplate): number {
  return (t.steps.length * (t.steps.length + 1)) / 2;
}
