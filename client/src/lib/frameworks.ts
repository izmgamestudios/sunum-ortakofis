// client/src/lib/frameworks.ts — 60 thinking / coaching / productivity frameworks (seed data)

export type FwGroup = 'amac' | 'karar' | 'dusunme' | 'problem' | 'ogrenme' | 'verimlilik' | 'hedef' | 'iletisim' | 'takim' | 'oz' | 'urun';

export const FW_GROUPS: Record<FwGroup, { label: string; emoji: string }> = {
  amac: { label: 'Amaç & Anlam', emoji: '🧭' },
  karar: { label: 'Karar & Önceliklendirme', emoji: '⚖️' },
  dusunme: { label: 'Düşünme Modelleri', emoji: '🧠' },
  problem: { label: 'Problem Çözme & İyileştirme', emoji: '🔧' },
  ogrenme: { label: 'Öğrenme & Gelişim', emoji: '📈' },
  verimlilik: { label: 'Verimlilik & Alışkanlık', emoji: '⏱️' },
  hedef: { label: 'Hedef & Performans', emoji: '🎯' },
  iletisim: { label: 'İletişim & Geri Bildirim', emoji: '💬' },
  takim: { label: 'Takım & Değişim', emoji: '👥' },
  oz: { label: 'Öz Farkındalık', emoji: '🪞' },
  urun: { label: 'Ürün & Strateji', emoji: '🚀' },
};

export type Layout =
  | { kind: 'venn'; center?: string; pairs?: string[] }
  | { kind: 'wheel' }
  | { kind: 'concentric' }
  | { kind: 'matrix'; x?: [string, string]; y?: [string, string] }
  | { kind: 'pyramid'; notes?: string[] }
  | { kind: 'cycle' }
  | { kind: 'steps' }
  | { kind: 'vsteps'; connector?: string }
  | { kind: 'stairs' }
  | { kind: 'columns'; colors?: string[] }
  | { kind: 'stack' }
  | { kind: 'curve'; points: [number, number][]; marks: [number, string][]; x: string; y: string }
  | { kind: 'fishbone'; head: string }
  | { kind: 'pareto' }
  | { kind: 'table'; headers: string[]; rows: string[][]; formula?: string }
  | { kind: 'tree' }
  | { kind: 'chain' }
  | { kind: 'timeline'; blocks: [string, number][] }
  | { kind: 'jar' }
  | { kind: 'kano' }
  | { kind: 'flow' };

export interface Framework {
  id: number;
  name: string;
  subtitle: string;
  group: FwGroup;
  desc: string;
  /** components — also used as tombala words / topic-tree nodes in the generated template */
  parts: string[];
  layout: Layout;
}

export const FRAMEWORKS: Framework[] = [
  { id: 1, name: 'Ikigai', subtitle: 'Yaşam Amacı Kesişimi', group: 'amac', desc: 'Sevdiğin, iyi olduğun, dünyanın ihtiyaç duyduğu ve para kazanabileceğin şeylerin kesişiminde yaşam amacını bul.', parts: ['Sevdiğin', 'İyi olduğun', 'Dünyanın ihtiyacı', 'Para kazandıran'], layout: { kind: 'venn', center: 'Ikigai', pairs: ['Tutku', 'Misyon', 'Meslek', 'Uzmanlık'] } },
  { id: 2, name: 'Yaşam Çemberi', subtitle: 'Wheel of Life', group: 'amac', desc: 'Hayatının 8 alanını 1–10 arası puanla; dengesiz alanları görünür kıl ve önceliklendir.', parts: ['Kariyer', 'Finans', 'Sağlık', 'Aile', 'İlişkiler', 'Kişisel gelişim', 'Eğlence', 'Çevre'], layout: { kind: 'wheel' } },
  { id: 3, name: 'Kirpi Konsepti', subtitle: 'The Hedgehog Concept', group: 'amac', desc: 'Jim Collins: tutkun, dünyada en iyi olabileceğin alan ve ekonomik motorun kesiştiği tek odağı bul.', parts: ['Tutkulu olduğun', 'En iyi olabileceğin', 'Ekonomik motor'], layout: { kind: 'venn', center: 'Kirpi' } },
  { id: 4, name: 'Tatlı Nokta Modeli', subtitle: 'The Sweet Spot', group: 'amac', desc: 'Yeteneklerin, ilgi alanların ve pazar talebinin buluştuğu "tatlı noktayı" keşfet.', parts: ['Yetenekler', 'İlgi alanları', 'Pazar talebi'], layout: { kind: 'venn', center: 'Tatlı nokta' } },
  { id: 5, name: 'Purusharthas', subtitle: 'Dört Yaşam Amacı', group: 'amac', desc: 'Hint felsefesindeki dört yaşam amacı: erdem, refah, haz ve özgürlük arasında denge.', parts: ['Dharma\nErdem, görev', 'Artha\nRefah, geçim', 'Kama\nHaz, sevgi', 'Moksha\nÖzgürlük'], layout: { kind: 'columns' } },
  { id: 6, name: 'Tasarım Üçgeni', subtitle: 'Desirability, Feasibility, Viability', group: 'urun', desc: 'IDEO: iyi bir inovasyon istenir, yapılabilir ve sürdürülebilir olmalı.', parts: ['İstenirlik\n(İnsan)', 'Yapılabilirlik\n(Teknoloji)', 'Sürdürülebilirlik\n(İş)'], layout: { kind: 'venn', center: 'İnovasyon' } },
  { id: 7, name: 'Altın Çember', subtitle: 'Golden Circle — Neden, Nasıl, Ne', group: 'amac', desc: 'Simon Sinek: içten dışa iletişim — önce "neden", sonra "nasıl", en son "ne".', parts: ['NEDEN', 'NASIL', 'NE'], layout: { kind: 'concentric' } },
  { id: 8, name: 'Eisenhower Matrisi', subtitle: 'Önemli / Acil Matrisi', group: 'karar', desc: 'İşleri önem ve aciliyete göre dört kutuya ayır: yap, planla, devret, ele.', parts: ['YAP\nÖnemli + Acil', 'PLANLA\nÖnemli + Acil değil', 'DEVRET\nÖnemsiz + Acil', 'ELE\nÖnemsiz + Acil değil'], layout: { kind: 'matrix', x: ['Acil', 'Acil değil'], y: ['Önemli', 'Önemsiz'] } },
  { id: 9, name: 'Johari Penceresi', subtitle: 'Johari Window', group: 'oz', desc: 'Kendin hakkında bildiklerin ile başkalarının bildikleri arasındaki dört alan.', parts: ['AÇIK ALAN\nHerkes biliyor', 'KÖR ALAN\nBaşkaları biliyor', 'GİZLİ ALAN\nSadece ben biliyorum', 'BİLİNMEYEN\nKimse bilmiyor'], layout: { kind: 'matrix', x: ['Benim bildiğim', 'Bilmediğim'], y: ['Başkalarının bildiği', 'Bilmediği'] } },
  { id: 10, name: 'Kişisel SWOT Analizi', subtitle: 'Güçlü, Zayıf, Fırsat, Tehdit', group: 'oz', desc: 'İçsel güçlü/zayıf yönlerini ve dışsal fırsat/tehditleri tek tabloda gör.', parts: ['GÜÇLÜ YÖNLER', 'ZAYIF YÖNLER', 'FIRSATLAR', 'TEHDİTLER'], layout: { kind: 'matrix', x: ['Yardımcı', 'Zarar verici'], y: ['İçsel', 'Dışsal'] } },
  { id: 11, name: 'Altı Şapkalı Düşünme Tekniği', subtitle: 'Six Thinking Hats', group: 'dusunme', desc: 'Edward de Bono: bir konuyu sırayla altı farklı bakış açısıyla ele al.', parts: ['Beyaz\nVeri, gerçekler', 'Kırmızı\nDuygular', 'Siyah\nRiskler', 'Sarı\nFaydalar', 'Yeşil\nYaratıcılık', 'Mavi\nSüreç'], layout: { kind: 'columns', colors: ['#f8fafc', '#fecaca', '#334155', '#fef08a', '#bbf7d0', '#bfdbfe'] } },
  { id: 12, name: 'İyi Zaman Günlüğü', subtitle: 'Good Time Journal', group: 'verimlilik', desc: 'Designing Your Life: aktivitelerde enerji ve bağlılığını kaydet; seni neyin beslediğini keşfet.', parts: ['Aktivite', 'Bağlılık', 'Enerji', 'Akış', 'Gözlem'], layout: { kind: 'table', headers: ['Aktivite', 'Bağlılık 🔥', 'Enerji ⚡', 'Akış mı?', 'Gözlem'], rows: [['Sabah toplantısı', '●●○', '−', 'Hayır', ''], ['Kod yazma', '●●●', '+', 'Evet', ''], ['E-posta', '●○○', '−', 'Hayır', ''], ['', '', '', '', '']] } },
  { id: 13, name: "Maslow'un İhtiyaçlar Hiyerarşisi", subtitle: "Maslow's Hierarchy of Needs", group: 'amac', desc: 'Temel ihtiyaçlardan kendini gerçekleştirmeye uzanan beş basamaklı motivasyon piramidi.', parts: ['Kendini gerçekleştirme', 'Saygı', 'Ait olma & sevgi', 'Güvenlik', 'Fizyolojik'], layout: { kind: 'pyramid' } },
  { id: 14, name: 'Pareto İlkesi', subtitle: '80/20 Kuralı', group: 'karar', desc: 'Sonuçların yaklaşık %80’i nedenlerin %20’sinden gelir; o kritik %20’yi bul.', parts: ['%20 neden', '%80 sonuç', 'Kritik az', 'Önemsiz çok'], layout: { kind: 'pareto' } },
  { id: 15, name: 'GROW Koçluk Modeli', subtitle: 'Goal, Reality, Options, Will', group: 'hedef', desc: 'Koçluk sohbetini dört aşamada yapılandır: hedef, gerçeklik, seçenekler, irade.', parts: ['Hedef\n(Goal)', 'Gerçeklik\n(Reality)', 'Seçenekler\n(Options)', 'İrade\n(Will)'], layout: { kind: 'cycle' } },
  { id: 16, name: 'SMART Hedefler', subtitle: 'Specific, Measurable, Achievable, Relevant, Time-bound', group: 'hedef', desc: 'Hedefleri belirli, ölçülebilir, ulaşılabilir, ilgili ve zamana bağlı yaz.', parts: ['S\nBelirli', 'M\nÖlçülebilir', 'A\nUlaşılabilir', 'R\nİlgili', 'T\nZamana bağlı'], layout: { kind: 'columns' } },
  { id: 17, name: 'SCAMPER Yaratıcı Düşünme Tekniği', subtitle: '7 Adımlı Yaratıcılık Çerçevesi', group: 'dusunme', desc: 'Var olan bir fikri yedi soruyla dönüştür.', parts: ['S\nYerine koy', 'C\nBirleştir', 'A\nUyarla', 'M\nDeğiştir', 'P\nBaşka kullan', 'E\nÇıkar', 'R\nTersine çevir'], layout: { kind: 'columns' } },
  { id: 18, name: 'OODA Döngüsü', subtitle: 'Observe, Orient, Decide, Act', group: 'dusunme', desc: 'John Boyd: hızlı değişen ortamlarda gözlemle, yönlen, karar ver, uygula — ve tekrarla.', parts: ['Gözlemle', 'Yönlen', 'Karar ver', 'Uygula'], layout: { kind: 'cycle' } },
  { id: 19, name: '5 Neden Tekniği', subtitle: '5 Whys Kök Neden Analizi', group: 'problem', desc: 'Bir problemin kök nedenine ulaşana kadar art arda "neden?" diye sor.', parts: ['Problem', '1. Neden?', '2. Neden?', '3. Neden?', '4. Neden?', '5. Kök neden'], layout: { kind: 'vsteps', connector: 'neden?' } },
  { id: 20, name: 'Etki / Çaba Matrisi', subtitle: 'Impact / Effort Matrix', group: 'karar', desc: 'Fikirleri etki ve çabaya göre yerleştir; önce hızlı kazanımlar.', parts: ['HIZLI KAZANIM\nYüksek etki, az çaba', 'BÜYÜK PROJE\nYüksek etki, çok çaba', 'DOLGU İŞLER\nDüşük etki, az çaba', 'ZAMAN TUZAĞI\nDüşük etki, çok çaba'], layout: { kind: 'matrix', x: ['Az çaba', 'Çok çaba'], y: ['Yüksek etki', 'Düşük etki'] } },
  { id: 21, name: 'WOOP Metodu', subtitle: 'Wish, Outcome, Obstacle, Plan', group: 'hedef', desc: 'Gabriele Oettingen: dileği, sonucu, iç engeli ve "eğer–o zaman" planını yaz.', parts: ['Dilek', 'Sonuç', 'Engel', 'Plan\n(Eğer… o zaman…)'], layout: { kind: 'steps' } },
  { id: 22, name: 'Feynman Öğrenme Tekniği', subtitle: 'Basitleştirerek Öğrenme', group: 'ogrenme', desc: 'Bir konuyu bir çocuğa anlatır gibi basitleştir; boşlukları bul ve yeniden çalış.', parts: ['Konuyu seç', 'Çocuğa anlat', 'Boşlukları bul', 'Basitleştir'], layout: { kind: 'steps' } },
  { id: 23, name: 'Pomodoro Tekniği', subtitle: 'Zaman Bloklama', group: 'verimlilik', desc: '25 dakika odak, 5 dakika mola; dört turda bir uzun mola.', parts: ['Odak', 'Kısa mola', 'Uzun mola', 'Tur'], layout: { kind: 'timeline', blocks: [['Odak', 25], ['Mola', 5], ['Odak', 25], ['Mola', 5], ['Odak', 25], ['Mola', 5], ['Odak', 25], ['Uzun mola', 20]] } },
  { id: 24, name: 'Kişisel Kanban Panosu', subtitle: 'Yapılacaklar / Yapılıyor / Bitti', group: 'verimlilik', desc: 'İşleri görselleştir, devam eden işi sınırla, akışı yönet.', parts: ['Yapılacaklar', 'Yapılıyor', 'Bitti'], layout: { kind: 'columns' } },
  { id: 25, name: 'GTD', subtitle: 'Getting Things Done — İş Bitirme Sanatı', group: 'verimlilik', desc: 'David Allen: her şeyi topla, netleştir, düzenle, gözden geçir, uygula.', parts: ['Topla', 'Netleştir', 'Düzenle', 'Gözden geçir', 'Uygula'], layout: { kind: 'steps' } },
  { id: 26, name: 'Atomik Alışkanlıklar Döngüsü', subtitle: 'İşaret, İstek, Tepki, Ödül', group: 'verimlilik', desc: 'James Clear: alışkanlık döngüsünü tasarla — görünür, çekici, kolay, tatmin edici.', parts: ['İşaret', 'İstek', 'Tepki', 'Ödül'], layout: { kind: 'cycle' } },
  { id: 27, name: 'Alışkanlık İstifleme', subtitle: 'Habit Stacking', group: 'verimlilik', desc: '"Mevcut alışkanlığımdan sonra yeni alışkanlığımı yapacağım" formülüyle zincir kur.', parts: ['Kahvemi koyduktan sonra', '1 dk meditasyon', 'Dişlerimi fırçaladıktan sonra', '1 şükür notu', 'Bilgisayarı açınca', 'Günün 3 önceliği'], layout: { kind: 'chain' } },
  { id: 28, name: 'PERMA Mutluluk Modeli', subtitle: 'Pozitif Duygu, Bağlılık, İlişkiler, Anlam, Başarı', group: 'amac', desc: 'Martin Seligman: iyi oluşun beş temel bileşeni.', parts: ['P\nPozitif duygu', 'E\nBağlılık', 'R\nİlişkiler', 'M\nAnlam', 'A\nBaşarı'], layout: { kind: 'columns' } },
  { id: 29, name: 'Akış Teorisi', subtitle: 'Flow State — Beceri / Zorluk Dengesi', group: 'ogrenme', desc: 'Csíkszentmihályi: zorluk ve beceri dengelendiğinde akış hâli oluşur.', parts: ['Akış', 'Kaygı', 'Sıkılma', 'Beceri', 'Zorluk'], layout: { kind: 'flow' } },
  { id: 30, name: 'Gelişim Zihniyeti Modeli', subtitle: 'Growth vs. Fixed Mindset', group: 'ogrenme', desc: 'Carol Dweck: yeteneğin gelişebileceğine inanmak zorluklara bakışı değiştirir.', parts: ['Zorluklar', 'Engeller', 'Çaba', 'Eleştiri', 'Başkalarının başarısı'], layout: { kind: 'table', headers: ['Durum', 'Sabit zihniyet', 'Gelişim zihniyeti'], rows: [['Zorluklar', 'Kaçınır', 'Kucaklar'], ['Engeller', 'Kolayca vazgeçer', 'Israr eder'], ['Çaba', 'Boşuna görür', 'Ustalığın yolu'], ['Eleştiri', 'Görmezden gelir', 'Öğrenir'], ['Başkalarının başarısı', 'Tehdit hisseder', 'İlham alır']] } },
  { id: 31, name: 'Stoacı Kontrol Dikotomisi', subtitle: 'Kontrol Edebildiklerim / Edemediklerim', group: 'oz', desc: 'Epiktetos: enerjini yalnızca kontrol edebildiklerine ver.', parts: ['Kontrol edebildiklerim', 'Kontrol edemediklerim'], layout: { kind: 'concentric' } },
  { id: 32, name: 'Etki Alanı vs. İlgi Alanı', subtitle: 'Stephen Covey Çemberleri', group: 'oz', desc: 'Proaktif insanlar etki alanına odaklanır; böylece etki alanı genişler.', parts: ['Etki alanı', 'İlgi alanı'], layout: { kind: 'concentric' } },
  { id: 33, name: 'Büyük Taşlar Teorisi', subtitle: 'Önceliklendirme Kavanozu', group: 'karar', desc: 'Önce büyük taşları (öncelikleri) kavanoza koy; çakıl ve kum sonra sığar.', parts: ['Büyük taşlar', 'Çakıllar', 'Kum'], layout: { kind: 'jar' } },
  { id: 34, name: '10-10-10 Kuralı', subtitle: '10 Dakika, 10 Ay, 10 Yıl Sonrası', group: 'karar', desc: 'Suzy Welch: bir kararın 10 dakika, 10 ay ve 10 yıl sonraki etkisini düşün.', parts: ['10 dakika sonra', '10 ay sonra', '10 yıl sonra'], layout: { kind: 'columns' } },
  { id: 35, name: 'İkinci Derece Düşünme', subtitle: 'Second-Order Thinking', group: 'dusunme', desc: '"Peki sonra ne olacak?" — kararların ikinci ve üçüncü derece sonuçlarını izle.', parts: ['Karar', '1. derece sonuç', '2. derece sonuç'], layout: { kind: 'tree' } },
  { id: 36, name: 'Tersine Düşünme', subtitle: 'Inversion Thinking', group: 'dusunme', desc: 'Charlie Munger: başarısızlığı garantileyecek şeyleri bul, sonra onlardan kaçın.', parts: ['Hedef', 'Başarısızlığı garantileyenler', 'Önlemler'], layout: { kind: 'steps' } },
  { id: 37, name: 'İlk İlkelerle Düşünme', subtitle: 'First Principles Thinking', group: 'dusunme', desc: 'Problemi temel gerçeklerine ayır ve çözümü sıfırdan yeniden inşa et.', parts: ['Varsayımları belirle', 'Temel gerçeklere ayır', 'Sıfırdan yeniden kur'], layout: { kind: 'steps' } },
  { id: 38, name: 'Balık Kılçığı Diyagramı', subtitle: 'Ishikawa Temel Neden Analizi', group: 'problem', desc: 'Bir sorunun olası nedenlerini kategoriler hâlinde görselleştir.', parts: ['İnsan', 'Yöntem', 'Makine', 'Malzeme', 'Ölçüm', 'Çevre'], layout: { kind: 'fishbone', head: 'PROBLEM' } },
  { id: 39, name: 'Kano Modeli', subtitle: 'Beklenti ve Memnuniyet Analizi', group: 'urun', desc: 'Özellikleri temel beklenti, performans ve heyecan verici olarak sınıflandır.', parts: ['Temel beklentiler', 'Performans', 'Heyecan vericiler'], layout: { kind: 'kano' } },
  { id: 40, name: 'RICE Önceliklendirme Skoru', subtitle: 'Reach, Impact, Confidence, Effort', group: 'urun', desc: 'Fikirleri erişim, etki, güven ve çaba ile puanla; skora göre sırala.', parts: ['Erişim', 'Etki', 'Güven', 'Çaba'], layout: { kind: 'table', headers: ['Fikir', 'Erişim', 'Etki', 'Güven', 'Çaba', 'RICE'], rows: [['Onboarding turu', '2000', '2', '%80', '2', '1600'], ['Karanlık mod', '500', '1', '%100', '1', '500'], ['', '', '', '', '', '']], formula: 'RICE = (Erişim × Etki × Güven) ÷ Çaba' } },
  { id: 41, name: 'MoSCoW Yöntemi', subtitle: "Must, Should, Could, Won't", group: 'urun', desc: 'Kapsamı dört öncelik seviyesine ayır.', parts: ['MUST\nOlmazsa olmaz', 'SHOULD\nOlmalı', 'COULD\nOlabilir', "WON'T\nŞimdilik yok"], layout: { kind: 'columns', colors: ['#fecaca', '#fed7aa', '#bbf7d0', '#e2e8f0'] } },
  { id: 42, name: 'Dreyfus Beceri Edinme Modeli', subtitle: 'Acemilikten Ustalığa', group: 'ogrenme', desc: 'Beceri edinmenin beş aşaması: kurallardan sezgiye.', parts: ['Acemi', 'İleri başlangıç', 'Yetkin', 'Usta', 'Uzman'], layout: { kind: 'stairs' } },
  { id: 43, name: 'Öğrenme Piramidi', subtitle: 'Pasif vs. Aktif Öğrenme', group: 'ogrenme', desc: 'Pasif yöntemlerden aktif yöntemlere doğru öğrenmenin kalıcılığı artar (yaygın tahmini oranlar).', parts: ['Dinleme', 'Okuma', 'Görsel-işitsel', 'Gösterim', 'Tartışma', 'Uygulama', 'Başkasına öğretme'], layout: { kind: 'pyramid', notes: ['~%5', '~%10', '~%20', '~%30', '~%50', '~%75', '~%90'] } },
  { id: 44, name: 'Konfor, Gelişim ve Panik Alanları', subtitle: 'Comfort, Stretch, Panic Zones', group: 'ogrenme', desc: 'Öğrenme konfor alanının hemen dışında, panik alanının içinde olmayan bölgede gerçekleşir.', parts: ['Konfor', 'Gelişim', 'Panik'], layout: { kind: 'concentric' } },
  { id: 45, name: 'Dunning-Kruger Etkisi Eğrisi', subtitle: 'Özgüven ve Yetkinlik İlişkisi', group: 'ogrenme', desc: 'Az bilgiyle yüksek özgüven, öğrendikçe düşüş ve ustalıkla gelen dengeli özgüven.', parts: ['Cahil cesareti', 'Umutsuzluk vadisi', 'Aydınlanma yokuşu', 'Ustalık platosu'], layout: { kind: 'curve', points: [[0, 0.1], [0.12, 0.92], [0.3, 0.45], [0.45, 0.12], [0.7, 0.45], [1, 0.72]], marks: [[1, 'Cahil cesareti'], [3, 'Umutsuzluk vadisi'], [4, 'Aydınlanma yokuşu'], [5, 'Ustalık platosu']], x: 'Yetkinlik / deneyim', y: 'Özgüven' } },
  { id: 46, name: 'Kübler-Ross Değişim Eğrisi', subtitle: 'Değişime Adaptasyon Aşamaları', group: 'takim', desc: 'Değişime verilen duygusal tepkilerin tipik akışı.', parts: ['Şok', 'İnkâr', 'Öfke', 'Pazarlık', 'Depresyon', 'Kabul', 'Entegrasyon'], layout: { kind: 'curve', points: [[0, 0.6], [0.12, 0.42], [0.25, 0.68], [0.4, 0.45], [0.55, 0.12], [0.75, 0.5], [1, 0.85]], marks: [[0, 'Şok'], [1, 'İnkâr'], [2, 'Öfke'], [3, 'Pazarlık'], [4, 'Depresyon'], [5, 'Kabul'], [6, 'Entegrasyon']], x: 'Zaman', y: 'Moral / yetkinlik' } },
  { id: 47, name: 'STAR Mülakat ve Hikâye Tekniği', subtitle: 'Situation, Task, Action, Result', group: 'iletisim', desc: 'Deneyimini durum, görev, aksiyon ve sonuç sırasıyla anlat.', parts: ['Durum', 'Görev', 'Aksiyon', 'Sonuç'], layout: { kind: 'steps' } },
  { id: 48, name: 'Kahramanın Yolculuğu', subtitle: "Hero's Journey — Hikâye Anlatıcılığı", group: 'iletisim', desc: 'Joseph Campbell: dönüşüm hikâyelerinin evrensel döngüsü.', parts: ['Sıradan dünya', 'Macera çağrısı', 'Reddediş', 'Mentor', 'Eşiği geçiş', 'Sınavlar', 'En derin mağara', 'Büyük sınav', 'Ödül', 'Dönüş yolu', 'Diriliş', 'İksirle dönüş'], layout: { kind: 'cycle' } },
  { id: 49, name: 'SCARF Sosyal Tehdit ve Ödül Modeli', subtitle: 'Status, Certainty, Autonomy, Relatedness, Fairness', group: 'iletisim', desc: 'David Rock: beynin sosyal tehdit/ödül algıladığı beş alan.', parts: ['Statü', 'Kesinlik', 'Özerklik', 'Aidiyet', 'Adalet'], layout: { kind: 'columns' } },
  { id: 50, name: 'Şiddetsiz İletişim', subtitle: 'NVC — Gözlem, Duygu, İhtiyaç, Rica', group: 'iletisim', desc: 'Marshall Rosenberg: yargılamadan gözlem, duygu, ihtiyaç ve rica ile konuş.', parts: ['Gözlem', 'Duygu', 'İhtiyaç', 'Rica'], layout: { kind: 'steps' } },
  { id: 51, name: 'Sandviç Geri Bildirim Tekniği', subtitle: 'Olumlu — Geliştirici — Olumlu', group: 'iletisim', desc: 'Geliştirici geri bildirimi iki olumlu gözlemin arasına yerleştir.', parts: ['Olumlu', 'Geliştirici', 'Olumlu'], layout: { kind: 'stack' } },
  { id: 52, name: 'SBI Geri Bildirim Modeli', subtitle: 'Situation, Behavior, Impact', group: 'iletisim', desc: 'Durumu, gözlenen davranışı ve etkisini net ve yargısız aktar.', parts: ['Durum', 'Davranış', 'Etki'], layout: { kind: 'steps' } },
  { id: 53, name: 'Tuckman Takım Gelişim Aşamaları', subtitle: 'Forming, Storming, Norming, Performing', group: 'takim', desc: 'Takımlar oluşma, çatışma, normlaşma ve performans aşamalarından geçer.', parts: ['Oluşma', 'Çatışma', 'Normlaşma', 'Performans', 'Dağılma'], layout: { kind: 'stairs' } },
  { id: 54, name: 'RACI Sorumluluk Matrisi', subtitle: 'Responsible, Accountable, Consulted, Informed', group: 'takim', desc: 'Her iş için kimin yapan, hesap veren, danışılan ve bilgilendirilen olduğunu netleştir.', parts: ['Yapan (R)', 'Hesap veren (A)', 'Danışılan (C)', 'Bilgilendirilen (I)'], layout: { kind: 'table', headers: ['Görev', 'Ürün', 'Tasarım', 'Yazılım', 'Pazarlama'], rows: [['Gereksinimler', 'A', 'C', 'C', 'I'], ['Tasarım', 'C', 'R/A', 'C', 'I'], ['Geliştirme', 'A', 'C', 'R', 'I'], ['Lansman', 'A', 'I', 'C', 'R']], formula: 'R: Yapan · A: Hesap veren · C: Danışılan · I: Bilgilendirilen' } },
  { id: 55, name: 'PDCA Döngüsü', subtitle: 'Planla, Uygula, Kontrol Et, Önlem Al', group: 'problem', desc: 'Deming döngüsü: sürekli iyileştirme için planla, uygula, kontrol et, önlem al.', parts: ['Planla', 'Uygula', 'Kontrol et', 'Önlem al'], layout: { kind: 'cycle' } },
  { id: 56, name: 'Kaizen Felsefesi', subtitle: 'Sürekli Küçük İyileştirme', group: 'problem', desc: 'Her gün %1’lik küçük iyileştirmeler zamanla büyük dönüşüm yaratır.', parts: ['Gözlemle', 'Küçük değişiklik', 'Ölç', 'Standartlaştır', 'Tekrarla'], layout: { kind: 'stairs' } },
  { id: 57, name: "Ockham'ın Usturası", subtitle: 'En Basit Çözüm', group: 'problem', desc: 'Eşit açıklayıcı hipotezler arasında en az varsayım içerenini tercih et.', parts: ['Karmaşık açıklama\nÇok varsayım', 'Basit açıklama\nAz varsayım ✓'], layout: { kind: 'columns', colors: ['#fecaca', '#bbf7d0'] } },
  { id: 58, name: "Hanlon'un Usturası", subtitle: 'Niyet vs. İhmal Analizi', group: 'problem', desc: 'İhmal ya da bilgi eksikliğiyle açıklanabilecek şeyi kötü niyete bağlama.', parts: ['Kötü niyet mi?', 'İhmal / bilgi eksikliği mi? ✓'], layout: { kind: 'columns', colors: ['#fecaca', '#bfdbfe'] } },
  { id: 59, name: 'OKR Sistemi', subtitle: 'Objectives and Key Results', group: 'hedef', desc: 'İlham veren bir hedef ve onu ölçen 3–5 anahtar sonuç.', parts: ['Hedef (O)', 'Anahtar sonuç 1', 'Anahtar sonuç 2', 'Anahtar sonuç 3'], layout: { kind: 'table', headers: ['Hedef / Anahtar sonuç', 'Başlangıç', 'Hedef değer', 'Şu an', 'İlerleme'], rows: [['O: Topluluğu büyütmek', '', '', '', ''], ['KR1: Aktif üye 1.000 → 2.500', '1.000', '2.500', '', '%0'], ['KR2: Haftalık etkinlik 2 → 5', '2', '5', '', '%0'], ['KR3: NPS 30 → 50', '30', '50', '', '%0']] } },
  { id: 60, name: 'KPI Çerçevesi', subtitle: 'Temel Performans Göstergeleri', group: 'hedef', desc: 'Başarıyı ölçen kritik göstergeleri tanımla, hedef ve sorumlusunu belirle.', parts: ['Gösterge', 'Formül', 'Hedef', 'Sıklık', 'Sorumlu'], layout: { kind: 'table', headers: ['KPI', 'Formül', 'Hedef', 'Sıklık', 'Sorumlu'], rows: [['Aylık aktif kullanıcı', 'Tekil kullanıcı / ay', '10.000', 'Aylık', 'Ürün'], ['Dönüşüm oranı', 'Ödeyen ÷ kayıt', '%5', 'Haftalık', 'Büyüme'], ['Churn', 'Ayrılan ÷ toplam', '<%3', 'Aylık', 'Başarı'], ['', '', '', '', '']] } },
];

export const frameworkById = (id: number) => FRAMEWORKS.find((f) => f.id === id);
