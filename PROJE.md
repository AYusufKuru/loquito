# Loquito — Lokum Fabrikası Üretim ve Yönetim Sistemi

> Proje Gereksinim Dokümanı (PRD)
> Sürüm: 2.0 — `Dokuman/` klasöründeki gerçek belgelerle güncellendi

---

## 1. Genel Bakış

**Loquitos Indústria e Comércio de Doces e Equipamentos LTDA** (CNPJ 61.581.495/0001-84), Brezilya'da faaliyet gösteren bir lokum üretim fabrikasıdır. Marka, pazarda **"Brazilian Delight / Loquitos"** adıyla konumlanır. Ticari yönetim **Rui Vende do Brasil** tarafından yürütülür.

Hammaddeler birleştirilerek sıvı hâlde lokum üretilir, bir gün soğutulur, kesilir, paketlenir ve market zincirleri ile toptancılara satılır.

Bu proje; reçete yönetiminden üretim planlamasına, sipariş takibinden stok, maliyet, sevkiyat, insan kaynakları ve yapay zekâ destekli analize kadar fabrikanın tüm operasyonunu tek bir web uygulaması üzerinden yönetmeyi amaçlar.

### 1.1 Temel Hedefler

- Reçete bazlı üretim planlaması ve otomatik hammadde/maliyet hesabı
- Pişirme kazanları ile kesim/paketleme hatlarının anlık izlenmesi
- Sipariş formundan (PDF) sevkiyata kadar uçtan uca sipariş takibi
- Hammadde, ambalaj ve **bitmiş ürün (mamul)** stoğunun gerçek zamanlı takibi
- Gün / ay / yıl bazında maliyet, gelir ve kâr analizi
- Yapay zekâ destekli kârlılık, stok ve satın alma önerileri
- Rol bazlı yetkilendirme ve tam değişiklik (audit) logu
- Lot bazlı izlenebilirlik ve kalite kontrol kayıtları

### 1.2 Kullanıcı Rolleri

| Rol | Kişi (mevcut) | Yetki Özeti |
|---|---|---|
| Genel Sorumlu / Yönetici | İbrahim Bakırhan | Tüm modüller, **fiyat girme ve sipariş onayı** |
| İdari Kısım Yetkilisi | Abdulkadir Maraçlı | Yönetim, raporlar, satın alma |
| İmalat Yetkilisi | Muhammed Ali Kalender | Üretim, reçete (okuma), stok |
| Muhasebe | Furkan Durna | Finans, **ekstre eşleştirme onayı** |
| Satış / Sipariş (İstanbul) | — | Mail'den gelen talepleri sisteme aktarır |
| Depo Sorumlusu | — | Stok giriş/çıkış, sevkiyat |
| İK Sorumlusu | Daniele A. G. de Azevedo (İdari) | Personel, puantaj |
| Üretim Personeli | Pişirme / Kesim / Dizim / Paketleme ekipleri | Kendi ekranı (üretim girişi) |

> Roller sabit değildir; **Modül 9 (Ayarlar)** üzerinden yeni rol ve kullanıcı oluşturulabilir, her kullanıcının hangi ekranı görebileceği ayrı ayrı ayarlanabilir.

---

## 2. Ürünler, Reçeteler ve Ambalaj

### 2.1 Ürün Kataloğu (9 Lezzet + Karışım)

| # | Lezzet (PT) | Türkçe | Koleksiyon |
|---|---|---|---|
| 1 | Açaí | Açai | Klasik |
| 2 | Limão | Limon | Klasik |
| 3 | Café Amendoim | Kahve–Yer Fıstığı | Klasik |
| 4 | Maracujá | Çarkıfelek meyvesi | Klasik |
| 5 | Graviola | Graviola | Amazon Rare Fruits |
| 6 | Rosa Goiaba | Guava | Amazon Rare Fruits |
| 7 | Cupuaçu | Cupuaçu | Amazon Rare Fruits |
| 8 | Abacaxi | Ananas | Amazon Rare Fruits |
| 9 | Manga | Mango | Amazon Rare Fruits |
| — | Misto / Mix | Karışık | Karışık paket |

**Ek ürün grupları:**
- **Cobertura (Çikolata kaplı):** Café Amendoim ve Maracujá için üretiliyor (`BD-CH-*` kodları). Çikolata hattı yatırımı devam ediyor (bkz. 2.8).
- **Bomonti – Callebaut (`BA-80G-RLF`):** 80 g'lık ayrı ürün, koli içi 25 adet.

### 2.2 Standart Reçete (Meyveli Lokum — Baz Reçete)

| Hammadde | Miktar | Birim |
|---|---|---|
| Şeker | 50 | kg |
| Nişasta | 7 | kg |
| Su | 50 | L |
| Meyve aroması / püresi | 25 | kg |
| Sitrik asit (limon tuzu) | 70 | g |

**Çıktı (verim):** ~**70 kg** bitmiş ürün / 1 parti (batch)

> 9 lezzetin **8'i bu reçeteyi kullanır**; yalnızca **25 kg meyve** kalemi değişir (mango, limon, açai, graviola…). Girdi ile çıktı arasındaki fark pişirme sırasındaki **su buharlaşma kaybıdır**; sistem her reçete için **verim (yield)** oranı tutar.

### 2.3 Kahveli Lokum Reçetesi (Varyant)

Baz reçeteden farkı: **25 kg meyve çıkarılır**, yerine:

| Hammadde | Miktar | Birim |
|---|---|---|
| Kahve | 700 | g |
| Fıstık (amendoim) | 17 | kg |

Diğer hammaddeler (şeker, nişasta, su, sitrik asit) baz reçete ile aynıdır.

### 2.4 Ambalaj Yapısı

Sistem 4 gramaj destekler; **şu an 85 g ve 250 g aktif üretimde**, 500 g ve 1 kg tanımlı ama henüz kullanılmıyor.

| Gramaj | Koli İçi Kutu | Durum |
|---|---|---|
| 85 g (Cartucho) | 50 | Aktif |
| 250 g | 40 | Aktif |
| 500 g | — | Tanımlı, pasif |
| 1 kg | — | Tanımlı, pasif |
| 80 g (Bomonti) | 25 | Aktif (özel ürün) |

**Ambalaj malzemeleri (her gramaj için ayrı):**

| Malzeme | Açıklama | Not |
|---|---|---|
| Kutu | Perakende satış kutusu | **Her lezzet için ayrı baskılı** |
| Beşik | Vakum ile şekillendirilmiş iç tabla | Gramaja özel |
| Nakliye Kolisi | 40 veya 50 kutu taşır | Gramaja özel |
| Jelatin | İç kaplama + dış kaplama filmi | Metre ile ölçülür |

> **Kritik tasarım notu:** Kutu ve beşik stoğu **lezzet × gramaj** kırılımında tutulur (örn. "Açai 250 g Kutu"), çünkü her lezzetin kutu baskısı farklıdır. Koli ve jelatin lezzetten bağımsızdır.

### 2.5 SKU Kodlama Şeması

Sipariş formundaki resmî kodlama:

| Kalıp | Örnek | Anlamı |
|---|---|---|
| `BD-{gramaj}-{lezzet}` | `BD-250-ACA` | 250 g Açaí |
| `BD-85-{lezzet}` | `BD-85-LIM` | 85 g Limão Cartucho |
| `BD-CH-{lezzet}{gramaj}` | `BD-CH-CA250` | 250 g Café Amendoim çikolata kaplı |
| `BA-80G-RLF` | — | Bomonti Callebaut 80 g |

**Lezzet kısaltmaları:** ACA (Açaí), LIM (Limão), CAF (Café Amendoim), MRQ (Maracujá), GRV (Graviola), GOI (Goiaba), CPÇ (Cupuaçu), ABX (Abacaxi), MIX (Misto)

> **Kanal farkı:** Avolta ve Carrefour kendi sistemlerinde farklı kod kullanıyor (`LQ-ACA-250`, `LQ-MAR-250`…). Bu yüzden sistemde **iç SKU + müşteri/kanal bazlı kod eşleme tablosu** tutulacak.

### 2.6 Fiyatlandırma Modeli

> **Temel kural:** `Dokuman/` altındaki sipariş formu **yalnızca bir örnektir**. Hem ürün listesi hem fiyatlar **müşteriye göre değişir ve özelleştirilebilir**. Bu yüzden sistemde tek bir sabit fiyat listesi değil, **katmanlı fiyat çözümleme** yapısı kurulur.

**Fiyat çözümleme sırası** (üstteki bulunursa alttakiler denenmez):

| Öncelik | Katman | Açıklama |
|---|---|---|
| 1 | **Sipariş satırına özel fiyat** | Bu siparişe özel pazarlık edilmiş fiyat. Yetkili kullanıcı elle girer; liste fiyatından sapma oranı gösterilir ve **onaya tabidir** |
| 2 | **Müşteriye özel fiyat** | Uzun süreli çalışılan firmaya tanımlanmış özel fiyat (ürün bazında) |
| 3 | **Miktar kademesi (müşteriye özel)** | Belirli koli/adet eşiğini aşan siparişlerde daha uygun fiyat. **Genel bir kural yoktur; kademeler her müşteriyle ayrı pazarlık edilir** ve o müşterinin kartına elle tanımlanır |
| 4 | **Müşterinin bağlı olduğu fiyat listesi** | Bölge/kanal bazlı liste (örn. "VAREJO – Região Norte/Nordeste", "Atacado", "Kurumsal") |
| 5 | **Varsayılan liste fiyatı** | Hiçbir özel tanım yoksa geçerli olan temel fiyat |

Her fiyat listesi kaleminde **geçerlilik tarihi** (başlangıç/bitiş) bulunur; geçmiş siparişler kendi dönemindeki fiyatla raporlanır.

**Örnek fiyat listesi — VAREJO / Região Norte-Nordeste** (referans olarak seed'e girilecek):

| Ürün Grubu | Koli Fiyatı | Kutu Birim Fiyatı |
|---|---|---|
| 250 g — CAF, ACA, LIM, MIX | R$ 636,00 | R$ 15,90 |
| 250 g — MRQ, ABX, CPÇ, GOI, GRV | R$ 1.235,60 | R$ 30,89 |
| 85 g — tüm lezzetler | R$ 514,50 | R$ 10,29 |
| 250 g Çikolata kaplı | R$ 1.686,00 | R$ 42,15 |
| 85 g Çikolata kaplı | R$ 702,50 | R$ 14,05 |
| Bomonti 80 g | R$ 807,25 | R$ 32,29 |

Toptan/kurumsal kanalda (Avolta, Carrefour) 250 g birim fiyatı R$ 25,00 olarak teklif edilmiştir — aynı ürünün farklı kanalda farklı fiyatlanmasının somut örneğidir.

**Marj göstergesi (bilgi amaçlı):** Fiyat girilirken sistem o ürünün **güncel maliyetini ve oluşacak kâr marjını anlık gösterir**. Bu yalnızca bilgilendirmedir; **sistem minimum marj sınırı koymaz, uyarı vermez ve fiyatı engellemez**. Kararı ve fiyatı çalışan verir.

### 2.7 Müşteriye Özel Ürünler

Uzun süreli çalışılan bir firma **kendine özgü bir ürün** isteyebilir (farklı lezzet, farklı içerik, özel ambalaj, özel gramaj). Bu durumda:

1. Reçete modülünde mevcut bir reçete kopyalanır veya sıfırdan yeni reçete oluşturulur; gerekiyorsa yeni hammadde kalemi eklenir.
2. Ürün **"müşteriye özel"** olarak işaretlenir ve ilgili firmaya bağlanır.
3. Özel ürünler yalnızca bağlı olduğu müşterinin sipariş ekranında ve fiyat listesinde görünür; genel katalogda listelenmez.
4. Özel ambalaj gerekiyorsa (özel baskılı kutu) ambalaj malzemesi de o ürüne özel stok kalemi olarak açılır.
5. Ürün, standart ürünlerle aynı şekilde üretim planına, stok düşümüne, maliyet ve kârlılık raporlarına girer.

> Ürün kataloğu bu nedenle **sabit 9 lezzetle sınırlı değildir**; sistem sınırsız ürün ve reçete tanımını destekler. Bölüm 2.1'deki liste mevcut standart kataloğu gösterir.

### 2.8 Çikolata Hattı (Planlanan Yatırım)

Makine/Ekipman ihtiyaç formunda onay bekleyen ve çikolata hattını kuracak kalemler: temperleme makinesi, çikolata kaplama tezgahı, 90 L eritme kazanı, soğutma makinesi, 3D reçine yazıcı (kalıp üretimi), Callebaut %54,6 çikolata (1.000 kg, R$ 95/kg). Toplam onay bekleyen yatırım: **R$ 1.032.700**.

---

## 3. Üretim Modeli ve Planlama

### 3.1 Çalışma Düzeni

| Parametre | Değer |
|---|---|
| Mesai saatleri | 08:00 – 17:00 |
| Çalışma günleri | Pazartesi – Cuma (Cumartesi/Pazar yok) |
| Pişirme ekibi | 1 usta + 1 yardımcı |
| Bir parti (70 kg) pişirme süresi | 3,5 saat |
| Soğutma / dinlendirme | 1 gün (ertesi güne bekler) |
| Kesim + paketleme ekibi | 10 kişi |
| Referans kapasite | 10.000 kutuluk sipariş → **4 gün** kesim+paketleme (≈ 2.500 kutu/gün) |
| Pişirme kazanı sayısı | 3 |

**Kapasite tablosu gramaj bazlıdır.** Küçük gramajda aynı kg için daha çok kutu doldurulduğundan işçilik farklı olabilir; bu yüzden kapasite tek bir sayı olarak değil, **her gramaj için ayrı satır** olarak tutulur:

| Gramaj | Günlük kutu kapasitesi (10 kişi) |
|---|---|
| 85 g | (ayarlardan girilir) |
| 250 g | 2.500 (referans değer) |
| 500 g | (ayarlardan girilir) |
| 1 kg | (ayarlardan girilir) |

Gramajlar arasında fark yoksa aynı değer girilir; yapı bozulmaz.

### 3.2 Ardışık (Pipeline) Üretim Akışı

Usta **bir gün önden gider**: her gün hem bir önceki günün lokumu kesilip paketlenirken, hem de ertesi gün için yeni karışım pişirilir.

```
Gün 1  08:00  Pişirme (parti A)  →  soğutmaya bırakılır
Gün 2  08:00  Pişirme (parti B)  +  Kesim & Paketleme (parti A)
Gün 3  08:00  Pişirme (parti C)  +  Kesim & Paketleme (parti B)
Gün 4         …                     Kesim & Paketleme (parti C)
```

**Planlama motoru şunları hesaplar:**
- Sipariş adedinden gerekli net kg → gerekli parti sayısı (70 kg/parti)
- Pişirme günleri (kazan kapasitesi ve usta süresine göre)
- +1 gün soğutma gecikmesi
- Kesim/paketleme günleri (ekip kapasitesine göre)
- **Hafta sonlarını atlayarak** gerçek takvim üzerinden tahmini bitiş ve teslim tarihi

> Yukarıdaki tüm süre ve kapasite değerleri **Ayarlar modülünden düzenlenebilir parametrelerdir**; koda gömülmez.

### 3.3 Üretim Aşamaları

`Hazırlık → Pişirme → Karıştırma → Dinlendirme/Soğutma → Kesim → Dizim → Kaplama/Paketleme → Kalite Kontrol → Mamul Depo`

Her aşama için kalite kontrol kaydı tutulur (parametre, hedef/limit, gerçek sonuç, kontrol saati, kontrol eden, uygunluk, düzeltici işlem).

### 3.4 Standart Durum Listeleri

Fabrikanın mevcut formlarındaki listeler birebir kullanılacaktır:

| Liste | Değerler |
|---|---|
| Üretim Durumu | Planlandı, Devam Ediyor, Beklemede, Tamamlandı, İptal |
| Vardiya | Sabah, Akşam, Gece, Özel |
| Birim | kg, g, L, mL, adet, m, koli |
| Malzeme Durumu | Bekliyor, Onaylandı, Uygunsuz |
| Lot Durumu | Karantina, Serbest, Bloke, İmha, Yeniden İşleme |
| Kalite Kararı | Onaylandı, Şartlı Onay, Reddedildi, Bekliyor |
| Sipariş Durumu | Taslak, Onaylandı, Hazırlanıyor, Kısmi Sevk, Sevk Edildi, Teslim Edildi, İptal |
| Sevkiyat Durumu | Planlandı, Hazırlanıyor, Yüklendi, Yolda, Teslim Edildi, Sorunlu, İade |

> **Kural:** Bir lot kalite tarafından *Serbest* bırakılmadan kullanılabilir stok sayılmaz.

---

## 4. Sipariş Kanalları ve Form Yapısı

Üç farklı sipariş kanalı vardır; sistem üçünü de karşılamalıdır.

### 4.1 Kanal A — Loquitos Matbu Sipariş Formu (Rui Vende)

Firmaya gönderilen sabit formatlı PDF; müşteri doldurup geri gönderir.

**Müşteri bilgileri:** Razão Social, CNPJ, Endereço, Endereço de Entrega, Endereço de Cobrança, Telefone, E-mail, Comprador

**Kalem tablosu sütunları:**

| Sütun | Anlamı |
|---|---|
| QUANTIDADE | **Sipariş edilen koli adedi** |
| CÓDIGO | SKU (örn. `BD-250-CAF`) |
| SABOR | Lezzet adı |
| PESO LÍQUIDO | Net gramaj |
| QUANTIDADE CAIXA | Koli içi kutu adedi (40 / 50 / 25) |
| PREÇO TABELA CAIXA | Koli liste fiyatı |
| PREÇO TABELA UNITÁRIO | Kutu birim fiyatı |
| TAXA | İskonto/vergi oranı (%) |
| VALOR TOTAL | Satır toplamı |

**Alt bölüm:** VALOR TOTAL DO PEDIDO, FORMA DE PAGAMENTO (Transferência Bancária %3 peşin iskonto / PIX %3 peşin iskonto / Prazo: 30, 30-45, 30-45-60 gün), FRETE (CIF/FOB), OBSERVAÇÕES

> **Önemli:** Sipariş miktarı **koli** cinsindendir. Toplam kutu = koli × koli içi adet. Tüm üretim ve stok hesapları bu dönüşüm üzerinden yapılır.

### 4.2 Kanal B — Kurumsal Teklif / Proposta (Avolta örneği)

Loquitos'un hazırlayıp müşteriye sunduğu teklif: referans no (`PROP-LQ-AVO-20260430-001`), emisyon tarihi, fornecedor/CNPJ, destinatário, entrega, pagamento, kalem tablosu (Produto, SKU, Quantidade **adet**, Preço unit., Subtotal), toplam adet ve tutar.

### 4.3 Kanal C — Müşteri Portalı Ekran Görüntüsü (Carrefour örneği)

Müşterinin kendi sisteminde oluşturduğu sipariş: Nº do Pedido Carrefour, Data do Pedido, Data de Entrega, Condição de Pagamento, kalemler (SKU `LQ-*`, adet, birim fiyat, subtotal).

> Bu kanalda miktar **adet** cinsindendir; Kanal A'daki koli mantığından farklıdır. Sistem her kanal için birim tipini ayrı tutar.

---

## 5. Modüller

### Modül 1 — Reçete Yönetimi

- Reçete listesi, oluşturma, **kopyalayarak varyant üretme**, versiyonlama, aktif/pasif
- **Müşteriye özel reçete/ürün tanımlama** (bkz. 2.7): reçete belirli bir firmaya bağlanabilir, gerekiyorsa yeni hammadde ve özel ambalaj kalemi açılır
- İki bölüm: **Hammadde** (içerik) ve **Ambalaj** (gramaj bazlı paketleme malzemeleri)
- Verim (kg/parti) ve otomatik fire yüzdesi
- Güncel malzeme fiyatlarından anlık maliyet: **parti başı / kg başı / kutu başı / koli başı**
- 9 lezzet için baz reçete + kahve varyantı + çikolata kaplama varyantları
- Eski sürümler saklanır; geçmiş siparişler kendi dönemindeki reçeteyle raporlanır

### Modül 2 — Üretim ve Hat Takibi

- **Kazan kartları (3 adet):** çalışan parti, ürün, anlık kg, % ilerleme, aşama, durum, vardiya, personel
- **Kesim ve paketleme hattı takibi:** günlük kutu çıktısı, ekip mevcudu, hedefe göre ilerleme
- Üretim emri + **lot izlenebilirliği**: hangi partide hangi hammadde/ambalaj lotu kullanıldı (tedarikçi lotu, iç lot no, SKT)
- Aşama bazlı kalite kontrol kayıtları ve kalite kararı
- Duruş kaydı (neden + süre), fire (kg), yeniden işleme
- Üretim sonucu: iyi ürün (kg), üretilen adet, üretilen kutu, verim %, plan sapması
- Otomatik stok hareketleri: hammadde/ambalaj düşümü, **mamul stok girişi**

### Modül 3 — Sipariş Takibi

- Üç kanaldan sipariş girişi (matbu form, teklif, müşteri portalı)
- **PDF yükleme → yapay zekâ ile alan çıkarma → zorunlu doğrulama ekranı → kayıt**
- Koli ↔ adet dönüşümü, gramaj ve SKU eşleme
- **Katmanlı fiyatlandırma (bkz. 2.6):** müşterinin fiyat listesi, özel fiyatı ve miktar kademesi otomatik uygulanır; yetkili kullanıcı satır bazında özel fiyat girebilir
- Fiyat girilirken **anlık maliyet ve kâr marjı** bilgi olarak gösterilir; sınır veya engelleme yoktur, fiyatı çalışan belirler
- Müşteriye özel ürünler yalnızca ilgili firmanın sipariş ekranında listelenir
- Fiyat girme yetkisi yalnızca yetkili kullanıcıda (İbrahim); onaysız sipariş üretime alınamaz
- Durum akışı ve Kanban görünümü
- **Stok mahsubu:** sipariş önce mevcut mamul stoktan karşılanır, kalanı üretime düşer
- Üretim analizi: parti sayısı, hammadde/ambalaj ihtiyacı, stok karşılaştırması, eksik uyarısı, maliyet, beklenen kâr, planlanan üretim takvimi
- Ödeme koşulu (peşin iskonto / vadeli) ve navlun tipi (CIF/FOB) kaydı
- Kısmi sevkiyat desteği

### Modül 4 — Maliyet, Gelir ve Kârlılık

- Gün / hafta / ay / yıl / özel aralık filtresi
- Sipariş, ürün, lezzet, gramaj, müşteri, kanal ve temsilci bazlı kârlılık
- Malzeme tüketim raporu ve fire maliyeti
- **Sabit gider yönetimi:** kira, elektrik, su, internet, araç, muhasebe, sigorta, sağlık ödemeleri vb. kalemler **elle girilir** (bkz. 6.4)
- Genel giderlerin üretime dağıtımı (üretilen kg veya çalışılan saat bazında)
- İşçilik maliyeti İK modülünden otomatik gelir
- Excel / PDF dışa aktarma

### Modül 5 — Stok Takibi

Üç ayrı stok alanı:

1. **Hammadde:** şeker, nişasta, 9 meyve, kahve, fıstık/kaju, limon tuzu, çikolata
2. **Ambalaj:** kutu (lezzet × gramaj), beşik, nakliye kolisi, jelatin (iç/dış)
3. **Mamul (bitmiş ürün):** lezzet × gramaj bazında hazır kutu stoğu

**Özellikler:** malzeme kartları, giriş/çıkış/fire/sayım hareketleri, lot ve SKT takibi, kritik seviye uyarıları, stok değerleme, tedarikçi ve satın alma siparişi kaydı, fiyat geçmişi.

> Meyve **günlük alınır** (stoklanmaz); sistem bunu "günlük tedarik" tipi malzeme olarak işaretler ve üretim planına göre günlük alım listesi çıkarır.

### Modül 6 — Yapay Zekâ Destek Modülü

- Kârlılık analizi: hangi lezzet/gramaj/müşteri ne kadar kazandırıyor
- Sipariş yüküne göre önerilen stok seviyeleri (emniyet stoğu + tedarik süresi)
- Azalan malzemeler için satın alma önerisi (miktar, tahmini tutar, tedarikçi)
- Talep tahmini ve mevsimsellik
- Anomali tespiti: yüksek fire, maliyet artışı, verim düşüşü
- Sipariş formu okuma (OCR) — üç kanal formatı
- Banka ekstresi/dekont eşleştirme
- Doğal dil soru-cevap

> Tüm çıktılar **öneri** niteliğindedir; kritik işlemler kullanıcı onayı olmadan uygulanmaz.

### Modül 7 — Ana Sayfa (Dashboard)

Aktif kazanlar ve hatlar, kritik stok uyarıları, aylık gelir–gider–kâr, sipariş özeti (onay bekleyen / üretimde / sevke hazır / geciken), günlük üretim (kg ve kutu), çalışan personel ve vardiya, yaklaşan teslim tarihleri, yaklaşan vadeler, mamul stok özeti, yapay zekâ önerileri.

### Modül 8 — İnsan Kaynakları

- Personel kartı: kimlik, iletişim, görev (Pişirme / Kesim / Dizim / Paketleme / Genel İmalat / İdari), aylık maaş, saatlik ücret, mesai çarpanı, işe giriş tarihi
- Mevcut kadro: **14 personel, toplam aylık maaş R$ 40.250**
- Puantaj: 08:00–17:00 mesai, fazla mesai, hafta sonu çalışması
- Personelin hangi üretim emrinde / hangi hatta kaç saat çalıştığı
- İzin, rapor, devamsızlık
- Bordro özeti ve işçilik maliyetinin siparişlere aktarılması

### Modül 9 — Ayarlar ve Kullanıcı Yönetimi

- Kullanıcı ve rol yönetimi, modül bazlı yetki matrisi (görüntüle / ekle / düzenle / sil / onayla)
- Özel yetkiler: *fiyat girebilir*, *sipariş onaylayabilir*, *muhasebe onayı verebilir*
- Fabrika parametreleri: kazan sayısı, mesai saatleri, çalışma günleri, parti süresi, soğutma süresi, ekip kapasitesi, birimler, vardiyalar
- Para birimi (BRL / USD / TRY) ve vergi ayarları
- **Dil ayarı: Türkçe (varsayılan), İngilizce, Portekizce**
- Bildirim ayarları
- Log görüntüleme

### Modül 10 — Finans / Muhasebe

- Ödeme takibi: Ödenmedi / Kısmi / Ödendi / Gecikmiş, vade ve gecikme uyarıları
- Peşin ödeme iskontosu (%3) ve vadeli seçeneklerin (30 / 30-45 / 30-45-60 gün) otomatik hesabı
- **Haftalık banka ekstresi yükleme** → yapay zekâ ile siparişlerle eşleştirme → **onay kutucuğu** ile muhasebe onayı → eşleşmeyenler "İncelenecek" listesinde
- **Dekont okuma:** Bradesco "Confirmação de Operação" formatı — işlem tarihi, kontrol no, gönderen/alıcı adı ve CNPJ, banka, ajans/hesap, PIX anahtarı, tutar, işlem kimliği (E2E). Loquitos alıcıysa **tahsilat**, gönderense **ödeme** olarak sınıflandırılır
- Müşteri cari hesap ekstresi

### Modül 11 — Log / Denetim Kaydı

Talep edildiği üzere takip, **girilmiş verinin değişikliğine** dairdir: kim, ne zaman, hangi kayıt, hangi alan, eski değer → yeni değer. Loglar salt-okunur ve silinemez. Kritik işlemler ayrıca işaretlenir (fiyat, sipariş onayı, stok düzeltmesi, reçete değişikliği, yetki değişikliği, muhasebe onayı).

### Modül 12 — Sevkiyat ve Teslimat

Sevkiyat no ve durumu, planlanan/gerçek sevk ve teslim tarihleri, taşıyıcı firma, sürücü, araç plakası, takip/AWB no, koli ve palet sayısı, mühür no, teslim alan, teslim kanıtı. Sevk öncesi kontrol listesi (stok rezervasyonu, lot/SKT kontrolü, etiket kontrolü, miktar doğrulama, koli/palet sayımı, belgeler, hasar kontrolü). Teslimat farkları: eksik kutu, hasarlı kutu, iade.

### Modül 13 — Demirbaş ve Yatırım / Satın Alma Talebi

Demirbaş envanteri (31 kalem: 3 lokum kazanı, kesim makinesi, 2 ambalaj makinesi, ısı tüneli, transformatör, tablalar, paletler vb.) ve **Makine/Ekipman/Sarf Malzemesi İhtiyaç Formu** akışı: talep türü, teknik özellik, kullanım yeri, miktar, öncelik, tedarikçi, teklif, birim/toplam fiyat, teslim süresi, garanti, **durum (Onay Bekliyor → Onaylandı → Sipariş → Teslim)**, onaylayan.

### Modül 14 — Müşteri ve Satış Temsilcisi Yönetimi

44 müşteri firması (Carrefour/Avolta, Assaí, Pão de Açúcar, Angeloni, Muffato, Zaffari, Grupo Pereira, toptancılar ve etnik market zincirleri) ve **6 bölgesel satış temsilcisi** (SP, RS, PR, SC, RJ). Müşteri kartında: Razão Social, CNPJ, bölge, temsilci, adresler, iletişim, ödeme koşulu, kanal bazlı SKU eşlemesi, cari bakiye.

**Müşteriye özel ticari koşullar sekmesi:**
- Bağlı olduğu **fiyat listesi**
- **Müşteriye özel fiyatlar** (ürün bazında, geçerlilik tarihli)
- **Miktar kademeleri** — her müşteriyle ayrı pazarlık edilip elle tanımlanır (örn. bu firma için 200 koli üzeri %5, 500 koli üzeri %8)
- **Müşteriye özel ürünler** ve reçeteleri
- Bu firmaya satılan ürünlerin geçmiş fiyat değişim kaydı

---

## 6. Mevcut Veri Envanteri (Sisteme Aktarılacak)

### 6.1 Hammadde Stoğu (Başlangıç)

| Hammadde | Miktar |
|---|---|
| Şeker | 1,6 ton |
| Nişasta | 3 ton |
| Kahve | 23 kg |
| Limon tuzu | 6 kg |
| Fıstık / Kaju | 200 kg |
| Meyveler (9 çeşit) | 0 — günlük alım |

### 6.2 Ambalaj Stoğu ve Birim Maliyetler

Son satın alma siparişlerinden türetilen birim fiyatlar:

| Malzeme | Alım Miktarı | Tutar (R$) | Birim Fiyat |
|---|---|---|---|
| Şeker | 50 ton | 127.500 + nakliye | R$ 2,55 / kg |
| Nişasta | 25 ton | 71.250 + nakliye | R$ 2,85 / kg |
| Limon tuzu | 25 kg | 520 | R$ 20,80 / kg |
| Kutu 250 g | 50.000 ad | 100.000 | R$ 2,00 / ad |
| Kutu 85 g | 100.000 ad | 175.000 | R$ 1,75 / ad |
| Nakliye kolisi 250 g | 1.250 ad | 15.000 | R$ 12,00 / ad |
| Nakliye kolisi 85 g | 2.000 ad | 24.000 | R$ 12,00 / ad |
| Beşik 250 g | 50.000 ad | 18.500 | R$ 0,37 / ad |
| Beşik 85 g | 100.000 ad | 35.000 | R$ 0,35 / ad |

Mevcut ambalaj stoğu: her lezzet için 85 g kutu 25 ad, 250 g kutu 50 ad; koli 85 g 25, 250 g 20; beşik 85 g 250, 250 g 350; jelatin iç ve dış kaplama 350'şer metre.

### 6.3 Mamul (Hazır Ürün) Stoğu

| Lezzet | 250 g (adet) | 85 g (adet) |
|---|---|---|
| Cupuaçu | 75 | 167 |
| Abacaxi | 80 | 215 |
| Café | 82 | 240 |
| Limón | 91 | 221 |
| Maracujá | 82 | 118 |
| Açaí | 113 | 215 |
| Misto | 158 | — |
| Graviola | 310 | 510 |
| Goiaba | 38 | 95 |

### 6.4 Aylık Sabit Giderler (R$ 102.760)

Maaşlar 40.250 · Fabrika kira 9.000 · Personel ev kira 2.500 · Fabrika elektrik 9.500 · Personel ev elektrik 750 · **Fabrika su 3.500** · Personel ev su 150 · Fabrika internet 350 · Personel ev internet 350 · Kiralık araç 4.500 · Araç yakıt 2.500 · Genel araç yakıt 7.500 · Muhasebe 2.000 · Sigorta/emeklilik 4.410 · Zorunlu sağlık 15.500

> Su, reçetede yer alsa da **maliyete hammadde olarak yansıtılmaz**; sabit gider (genel gider) olarak sayılır.

### 6.5 Tedarikçiler

| Ürün | Tedarikçi |
|---|---|
| Kutu / Koli | Pitney Embalagens |
| Beşik | Artevac Vacuum Forming |
| Şeker | PBB Comercio De Açucar |
| Nişasta | Amido Nevadas |
| Limon tuzu | Bella Quimicos |
| Meyve | De Marchi |
| Jelatin | Miura Grafica Industria |
| Makine sarf malzemesi | Cetro |
| Fıstık / Kaju | Pinho Nuts |
| Çikolata (planlanan) | Callebaut Brazil |

### 6.6 Banka Bilgisi

Banco Bradesco S.A. — Agência 5716, Conta Corrente 46929-7, PIX anahtarı = CNPJ 61.581.495/0001-84

---

## 7. Veri Modeli (Özet)

| Tablo | Açıklama |
|---|---|
| `users`, `roles`, `permissions` | Kullanıcı, rol ve modül bazlı yetkiler |
| `materials` | Hammadde ve ambalaj malzemeleri (kategori, birim, fiyat, kritik seviye, günlük tedarik bayrağı) |
| `material_lots` | Lot, tedarikçi lotu, SKT, lot durumu |
| `stock_movements` | Giriş / çıkış / fire / sayım / rezervasyon hareketleri |
| `suppliers`, `purchase_orders` | Tedarikçi ve satın alma siparişleri |
| `flavors` | 9 lezzet + Misto |
| `packagings` | Gramaj tanımları (85 g, 250 g, 500 g, 1 kg, 80 g) ve koli içi adet |
| `products` | SKU = lezzet × gramaj × tip (normal / cobertura / bomonti / **müşteriye özel**); özel ürünlerde `customer_id` dolu |
| `product_channel_codes` | Müşteri/kanal bazlı SKU eşlemesi (`LQ-*` ↔ `BD-*`) |
| `price_lists`, `price_list_items` | Bölge/kanal bazlı fiyat listeleri, geçerlilik tarihli |
| `customer_prices` | Müşteriye özel ürün fiyatları, geçerlilik tarihli |
| `price_tiers` | Müşteri bazlı miktar kademeleri (eşik koli/adet → fiyat veya iskonto oranı) |
| `recipes`, `recipe_items` | Reçete başlığı ve satırları (hammadde / ambalaj); reçete müşteriye bağlanabilir |
| `customers`, `sales_reps` | Müşteriler ve bölgesel temsilciler |
| `orders`, `order_items` | Sipariş ve kalemleri (koli/adet, birim fiyat, iskonto, vade, navlun) |
| `order_documents` | Yüklenen sipariş formu, teklif, ekran görüntüsü |
| `production_orders` | Üretim emri, parti/lot no, kazan, planlanan/gerçek tarih, verim |
| `production_consumptions` | Partide tüketilen hammadde ve ambalaj lotları |
| `quality_checks` | Aşama bazlı kalite kontrol kayıtları |
| `downtimes`, `scrap_records` | Duruş ve fire kayıtları |
| `lines` | Kazanlar ve kesim/paketleme hatları |
| `finished_goods_stock` | Mamul stoğu (lezzet × gramaj × lot) |
| `shipments`, `shipment_items` | Sevkiyat ve teslimat |
| `employees`, `attendance`, `work_assignments` | Personel, puantaj, iş atamaları |
| `fixed_expenses` | Aylık sabit gider kalemleri (elle girilir) |
| `payments`, `bank_statements`, `receipts` | Ödeme, ekstre, dekont |
| `assets`, `purchase_requests` | Demirbaş ve yatırım/satın alma talepleri |
| `audit_logs` | Değişiklik logları |

---

## 8. Netleşen Kararlar

| # | Konu | Karar |
|---|---|---|
| 1 | Sipariş formu | 3 kanal var: matbu Loquitos formu (koli bazlı), kurumsal teklif (adet bazlı), müşteri portalı ekranı. Örnekler `Dokuman/` altında |
| 2 | Banka belgeleri | PDF. Bradesco "Confirmação de Operação" formatı |
| 3 | Üretim kapasitesi | 70 kg/parti, 3,5 saat, 1 usta + 1 yardımcı; 1 gün soğutma; 10 kişilik ekip 10.000 kutuyu 4 günde paketler; 08:00–17:00, hafta içi |
| 4 | Su | Maliyete girmez, **genel gider** |
| 5 | Genel giderler | Firma çalışanları tarafından **elle girilir** |
| 6 | Ürün çeşidi | **9 lezzet** (+ Misto karışım). Kahve dışındaki 8 lezzet aynı reçeteyi kullanır, yalnızca 25 kg meyve kalemi değişir |
| 7 | Ambalaj reçeteleri | Malzeme listeleri firma çalışanları tarafından **elle girilir** |
| 8 | Dil | Önce **Türkçe**, ardından İngilizce ve Portekizce |
| 9 | İhracat/gümrük | Gerekmiyor |
| 10 | Mail entegrasyonu | **Gmail** |

| 11 | Ürün ve fiyat esnekliği | Sipariş formu yalnızca örnektir. Ürünler ve fiyatlar **müşteriye göre özelleştirilebilir**: firmaya özel ürün/reçete açılabilir, büyük siparişte daha uygun fiyat verilebilir (bkz. 2.6 ve 2.7) |
| 12 | Miktar kademeleri | Standart kural yok; **her müşteriyle ayrı pazarlık edilir** ve müşteri kartına elle tanımlanır |
| 13 | Minimum kâr marjı | **Konulmayacak.** Sistem marjı yalnızca bilgi olarak gösterir; fiyatı çalışan elle girer, engelleme veya uyarı yoktur |

### 8.1 Kalan Küçük Sorular

Bu maddelerin hiçbiri geliştirmeyi bekletmez. **Dördü de sistem bittikten sonra, koda dokunmadan, ilgili ekrandan değiştirilebilir.**

| # | Soru | Sonradan nasıl değiştirilir |
|---|---|---|
| 1 | **Manga** ürünü satışta mı? (sipariş formunda ve hazır stokta yok) | Ürün/reçete ekranından eklenir veya pasife alınır |
| 2 | 10.000 kutuluk referans sipariş hangi gramaj için? (250 g varsayıldı) | Ayarlar → kapasite tablosundan güncellenir |
| 3 | Kesim/paketleme kapasitesi gramaja göre değişiyor mu? | **Yapı gramaj bazlı kuruluyor** (bkz. 3.1); her gramaja kendi değeri ayarlardan girilir |
| 4 | Bomonti (`BA-80G-RLF`) reçetesi nedir? | Reçete ekranından girilir |

> **Not:** Sonradan ucuza değişmeyen kararlar bunlar değil, Bölüm 8'de sabitlenen yapısal kararlardır (koli/adet mantığı, ambalajın lezzet × gramaj kırılımı, katmanlı fiyatlandırma, lot izlenebilirliği, para biriminin tam sayı saklanması). Bu yüzden onlar baştan netleştirildi.

---

## 9. Kodlama Yol Haritası (Adım Adım Geliştirme Planı)

Bu bölüm, projenin **tek seferde değil, küçük ve kontrol edilebilir adımlarla** yazılması için hazırlanmıştır. Her adım kendi başına çalışan, test edilebilir bir parça üretir.

### 9.1 Çalışma Yöntemi

1. Her seferinde **yalnızca bir adım** kodlanır.
2. Adım bittiğinde: ne yapıldığı özetlenir, hangi dosyaların oluştuğu listelenir, nasıl test edileceği anlatılır.
3. Kullanıcı **"devam et"** dediğinde bir sonraki adıma geçilir.
4. Kullanıcı düzeltme isterse, sıradaki adıma geçmeden önce mevcut adım düzeltilir.
5. Her adımın sonunda derleme/lint kontrolü yapılır; hata varsa adım kapanmadan giderilir.
6. Bir adım tamamlandığında **9.4 İlerleme Takibi** tablosundaki kutucuk işaretlenir.

### 9.2 Teknoloji Kararları (Sabit)

| Konu | Karar | Gerekçe |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Tek kod tabanı: hem arayüz hem API |
| Arayüz | **Tailwind CSS + shadcn/ui** | Hızlı, tutarlı, modern bileşen seti |
| Grafikler | **Recharts** | Dashboard ve rapor grafikleri |
| ORM | **Prisma** | Şema tabanlı, migration yönetimi kolay |
| Veritabanı | **Geliştirmede SQLite → canlıda PostgreSQL** | Şemada `enum` kullanılmaz, durumlar **string sabit** tutulur; geçiş sorunsuz olur |
| Oturum | **JWT + httpOnly cookie (`jose`)** | Az bağımlılık, sürüm sürprizi yok |
| Yetki | **Rol + modül bazlı izin tablosu (RBAC)** | Modül 9 gereksinimi |
| Dosya | Yerel `storage/` klasörü → sonra S3 uyumlu depolama | Sipariş formu, dekont, ekstre |
| Para/Sayı | Tutarlar tam sayı **centavo** olarak saklanır | Yuvarlama hatalarını önlemek için |
| Dil | `next-intl` sözlük yapısı; **TR aktif**, EN/PT sonradan | Madde 8'deki karar |
| Para birimi | Varsayılan **BRL (R$)**, USD/TRY destekli | Brezilya operasyonu |

### 9.3 Adımlar

---

#### FAZ 0 — Temel Kurulum

**Adım 1 — Proje iskeleti**
Next.js + TypeScript + Tailwind + shadcn/ui kurulumu, klasör yapısı, `.env.example`, `README.md`, tema ve renk düzeni.
*Bitti kriteri:* `npm run dev` ile proje ayağa kalkıyor.

**Adım 2 — Veritabanı şeması ve gerçek başlangıç verisi**
Bölüm 7'deki tabloların Prisma şeması, ilk migration ve seed:
9 lezzet, gramajlar ve koli içi adetler, SKU listesi, baz + kahve reçetesi, hammadde/ambalaj malzemeleri ve birim fiyatları (6.2), mevcut hammadde ve mamul stoğu (6.1, 6.3), 14 personel ve maaşları, 10 tedarikçi, 44 müşteri, 6 satış temsilcisi, sabit gider kalemleri (6.4), 3 kazan, demirbaş listesi, roller ve admin kullanıcı.
*Bitti kriteri:* Veritabanı gerçek fabrika verisiyle dolu.

---

#### FAZ 1 — Çekirdek

**Adım 3 — Kimlik doğrulama**
Giriş sayfası, şifre hash'leme, JWT cookie, oturum kapatma, korumalı rota kontrolü.
*Bitti kriteri:* Girişsiz sayfalara erişilemiyor.

**Adım 4 — Yetkilendirme, uygulama kabuğu ve dil altyapısı**
RBAC kontrol mekanizması, sol menü + üst bar, tüm modüller için sayfa iskeletleri, menüde yalnızca yetkili modüller, çeviri altyapısı (TR sözlüğü).
*Bitti kriteri:* Yetkisiz kullanıcı ilgili menüyü göremiyor; tüm metinler sözlükten geliyor.

**Adım 5 — Kullanıcı ve rol yönetimi (Modül 9 çekirdeği)**
Kullanıcı CRUD, rol tanımlama, modül bazlı yetki matrisi, özel yetkiler (*fiyat girebilir*, *sipariş onaylayabilir*, *muhasebe onayı verebilir*).
*Bitti kriteri:* Yeni kullanıcı oluşturulup yetkileri değiştirilebiliyor.

**Adım 6 — Stok: Malzeme kartları**
Hammadde ve ambalaj malzemesi CRUD; ambalaj için **lezzet × gramaj** kırılımı, günlük tedarik bayrağı (meyve), tedarikçi, kritik seviye.
*Bitti kriteri:* "Açai 250 g Kutu" gibi lezzete özel ambalaj kalemleri yönetilebiliyor.

**Adım 7 — Stok: Hareketler, lot ve uyarılar**
Giriş/çıkış/fire/sayım hareketleri, lot + SKT + lot durumu (Karantina/Serbest/Bloke/İmha/Yeniden İşleme), kritik seviye uyarıları, stok değerleme.
*Bitti kriteri:* Hareket girildiğinde miktar doğru güncelleniyor; serbest bırakılmamış lot kullanılabilir sayılmıyor.

**Adım 8 — Reçete: Hammadde bölümü**
Reçete listesi ve detayı, hammadde satırları, verim (kg/parti), fire yüzdesi; 9 lezzetin baz reçetesi ve kahve varyantı; **müşteriye özel reçete işaretleme**.
*Bitti kriteri:* Bir lezzetin meyve kalemi değiştirilerek yeni reçete üretilebiliyor; belirli bir firmaya özel ürün tanımlanabiliyor.

**Adım 9 — Reçete: Ambalaj bölümü ve maliyet**
Gramaj bazlı ambalaj satırları (kutu, beşik, koli, jelatin), reçete kopyalama ve versiyonlama, maliyet hesabı: parti / kg / kutu / koli başı.
*Bitti kriteri:* Bir SKU'nun kutu başı maliyeti ve koli maliyeti doğru hesaplanıyor.

---

#### FAZ 2 — Operasyon

**Adım 10 — Müşteri, temsilci ve katmanlı fiyatlandırma**
Müşteri ve satış temsilcisi CRUD, bölge, CNPJ, adresler; fiyat listeleri, **müşteriye özel fiyatlar**, **müşteri bazlı miktar kademeleri** (elle tanımlanır) ve geçerlilik tarihleri; 2.6'daki **fiyat çözümleme motoru**; **kanal bazlı SKU eşleme** (`BD-*` ↔ `LQ-*`).
*Bitti kriteri:* Aynı ürün, müşterisine ve sipariş miktarına göre farklı fiyat döndürüyor; Carrefour'un `LQ-ACA-250` kodu iç SKU'ya eşleniyor.

**Adım 11 — Sipariş kaydı, durum akışı, fiyat ve onay**
Sipariş oluşturma (koli veya adet bazlı giriş, otomatik dönüşüm), kalemler, iskonto/vade/navlun, durum akışı ve Kanban, fiyat girme yetkisi, **satır bazında elle özel fiyat girişi + bilgi amaçlı anlık kâr marjı göstergesi**, onay adımı.
*Bitti kriteri:* Örnek formdaki sipariş (R$ 5.409,25) birebir girilip toplamı tutuyor; özel fiyat girildiğinde marj anında güncelleniyor ama fiyat engellenmiyor.

**Adım 12 — Sipariş üretim analizi**
Mamul stoktan mahsup, kalan için parti sayısı hesabı, hammadde ve ambalaj ihtiyacı, stok karşılaştırması ve eksik uyarısı, maliyet ve beklenen kâr.
*Bitti kriteri:* "İşi Başlat" öncesi tam analiz tablosu görünüyor.

**Adım 13 — Üretim planlama takvimi**
Pişirme → 1 gün soğutma → kesim/paketleme ardışık akışı, kazan ve ekip kapasitesi, hafta sonlarını atlayan takvim hesabı, tahmini bitiş ve teslim tarihi; parametreler ayarlardan okunur.
*Bitti kriteri:* 10.000 kutuluk sipariş için plan gerçek takvimde doğru günlere dağılıyor.

**Adım 14 — Üretim emri, lot izlenebilirliği ve stok düşümü**
Üretim emri oluşturma, parti/lot no, kazan ataması, tüketilen hammadde/ambalaj lotlarının kaydı, otomatik stok düşümü, üretim sonucu (iyi ürün, fire, verim %) ve **mamul stok girişi**.
*Bitti kriteri:* Parti kapandığında hammadde düşüyor, mamul stok artıyor, lot geriye izlenebiliyor.

**Adım 15 — Kazan ve hat canlı takibi**
3 kazan kartı ve kesim/paketleme hattı, aşama ilerletme, anlık miktar ve % ilerleme, duruş ve fire girişi, aşama bazlı kalite kontrol kayıtları ve kalite kararı.
*Bitti kriteri:* Üretimin anlık durumu tek ekranda izlenebiliyor.

**Adım 16 — Mamul stok yönetimi**
Lezzet × gramaj bazında hazır ürün stoğu, lot ve SKT, rezervasyon, stok değerleme.
*Bitti kriteri:* Bölüm 6.3'teki mevcut stok görüntüleniyor ve siparişle rezerve edilebiliyor.

**Adım 17 — Sevkiyat ve teslimat**
Sevkiyat kaydı, kısmi sevk, taşıyıcı ve araç bilgileri, sevk öncesi kontrol listesi, teslim kanıtı, eksik/hasar/iade kaydı.
*Bitti kriteri:* Bir sipariş kısmi sevk edilip kalan miktar doğru takip ediliyor.

**Adım 18 — Değişiklik logu**
Otomatik audit kaydı (kim, ne zaman, hangi alan, eski → yeni), log ekranı ve filtreler, sipariş/reçete detayında "Değişiklik Geçmişi" sekmesi.
*Bitti kriteri:* Fiyat değişikliği logda eski/yeni değeriyle görünüyor.

---

#### FAZ 3 — Analiz, İK ve Finans

**Adım 19 — İK: Personel**
Personel kartı, görev, maaş, saatlik ücret, mesai çarpanı; mevcut 14 personelin listesi.
*Bitti kriteri:* Personel eklenip maaşı ayarlanabiliyor.

**Adım 20 — İK: Puantaj, mesai ve işçilik maliyeti**
08:00–17:00 mesai kaydı, fazla mesai, izin/devamsızlık, personelin hangi üretim emrinde kaç saat çalıştığı, bordro özeti, işçilik maliyetinin siparişe aktarımı.
*Bitti kriteri:* Bir siparişin maliyetinde işçilik kalemi otomatik çıkıyor.

**Adım 21 — Sabit giderler ve genel gider dağıtımı**
Aylık gider kalemlerinin elle girişi (6.4 listesi), dönemsel karşılaştırma, giderlerin üretime dağıtım kuralı (üretilen kg veya çalışılan saat).
*Bitti kriteri:* Aylık R$ 102.760 gider girilip ürün maliyetine yansıyor.

**Adım 22 — Raporlar ve kârlılık**
Gün/hafta/ay/yıl filtreleri, sipariş–ürün–lezzet–gramaj–müşteri–kanal–temsilci bazlı kârlılık, malzeme tüketimi, fire maliyeti, gelir–gider grafikleri, Excel/PDF dışa aktarma.
*Bitti kriteri:* Seçilen ayda hangi işe ne harcandığı ve ne kazanıldığı görülebiliyor.

**Adım 23 — Finans: Ödeme, cari ve dekont**
Ödeme kaydı, peşin iskonto (%3) ve vadeli koşullar, gecikme uyarıları, dekont yükleme ve arşivi, müşteri cari ekstresi.
*Bitti kriteri:* Siparişin ödeme durumu ve vadesi takip edilebiliyor.

**Adım 24 — Ana sayfa**
Gerçek verilerle tüm widget'lar ve kritik uyarı alanı.
*Bitti kriteri:* Ana sayfa fabrikanın anlık durumunu doğru gösteriyor.

**Adım 25 — Demirbaş ve yatırım/satın alma talebi** ✅
Demirbaş envanteri ve ihtiyaç formu akışı (talep → teklif → onay → sipariş → teslim), onay bekleyen tutar özeti.
*Bitti kriteri:* Çikolata hattı yatırım talepleri (R$ 1.032.700) sistemde onay akışında görünüyor.

---

#### FAZ 4 — Yapay Zekâ

**Adım 26 — Dosya yükleme ve sipariş formu okuma (OCR)** ✅
Yükleme altyapısı ve PDF önizleme; **üç kanal formatı** için alan çıkarma (matbu form, teklif, portal ekranı); koli/adet ayrımı ve SKU eşleme; **zorunlu doğrulama ekranı**.
*Bitti kriteri:* `Dokuman/` altındaki üç örnek dosya da doğru okunuyor.

**Adım 27 — Gmail entegrasyonu** ✅
Gmail kutusundaki sipariş maillerinin ve eklerinin otomatik alınması, taslak sipariş oluşturma.
*Bitti kriteri:* Ekli sipariş formu maili sisteme taslak olarak düşüyor.

**Adım 28 — Ekstre/dekont eşleştirme ve muhasebe onayı** ✅
Haftalık ekstre yükleme, Bradesco dekont formatını okuma, tahsilat/ödeme ayrımı, siparişle otomatik eşleştirme, satır bazlı **onay kutucuğu**, eşleşmeyenler listesi.
*Bitti kriteri:* Örnek dekontlar doğru yönde ve tutarla eşleşiyor.

**Adım 29 — Yapay zekâ öneri motoru** ✅
Kârlılık analizi, önerilen stok seviyeleri, satın alma önerisi, talep tahmini, anomali uyarıları.
*Bitti kriteri:* Öneriler gerekçeli ve veriye dayalı çıkıyor.

**Adım 30 — Yapay zekâ soru-cevap** ✅
Doğal dil ile veri sorgulama ve kaynak veriyi gösterme.
*Bitti kriteri:* Örnek sorular doğru sayısal yanıt veriyor.

---

#### FAZ 5 — Tamamlama

**Adım 31 — Fabrika ayarları ve bildirimler** ✅
Kazan sayısı, mesai saatleri, çalışma günleri, parti süresi, soğutma süresi, ekip kapasitesi, birimler, vardiyalar, vergi ve para birimi; bildirim ayarları.
*Bitti kriteri:* Üretim planı parametreleri koddan değil ekrandan yönetiliyor.

**Adım 32 — İngilizce ve Portekizce dil desteği** ✅
Sözlüklerin tamamlanması, dil seçici, tarih/sayı/para biçimlendirme.
*Bitti kriteri:* Arayüz üç dilde eksiksiz çalışıyor.

**Adım 33 — Cilalama ve teslim** ✅
Hata yönetimi, boş durum ekranları, mobil/tablet uyumu (saha kullanımı), performans ve güvenlik gözden geçirmesi, kurulum ve kullanım dokümanı.
*Bitti kriteri:* Sistem baştan sona senaryo testinden geçiyor.

---

### 9.4 İlerleme Takibi

| # | Adım | Faz | Durum |
|---|---|---|---|
| 1 | Proje iskeleti | 0 | ✅ |
| 2 | Veritabanı şeması ve gerçek seed | 0 | ✅ |
| 3 | Kimlik doğrulama | 1 | ✅ |
| 4 | Yetkilendirme, kabuk ve dil altyapısı | 1 | ✅ |
| 5 | Kullanıcı ve rol yönetimi | 1 | ✅ |
| 6 | Stok: Malzeme kartları | 1 | ✅ |
| 7 | Stok: Hareketler, lot ve uyarılar | 1 | ✅ |
| 8 | Reçete: Hammadde bölümü | 1 | ✅ |
| 9 | Reçete: Ambalaj bölümü ve maliyet | 1 | ✅ |
| 10 | Müşteri, temsilci ve fiyat listeleri | 2 | ✅ |
| 11 | Sipariş kaydı, durum akışı, fiyat ve onay | 2 | ✅ |
| 12 | Sipariş üretim analizi | 2 | ✅ |
| 13 | Üretim planlama takvimi | 2 | ✅ |
| 14 | Üretim emri, lot ve stok düşümü | 2 | ✅ |
| 15 | Kazan ve hat canlı takibi | 2 | ✅ |
| 16 | Mamul stok yönetimi | 2 | ✅ |
| 17 | Sevkiyat ve teslimat | 2 | ✅ |
| 18 | Değişiklik logu | 2 | ✅ |
| 19 | İK: Personel | 3 | ✅ |
| 20 | İK: Puantaj ve işçilik maliyeti | 3 | ✅ |
| 21 | Sabit giderler ve dağıtım | 3 | ✅ |
| 22 | Raporlar ve kârlılık | 3 | ✅ |
| 23 | Finans: Ödeme, cari ve dekont | 3 | ✅ |
| 24 | Ana sayfa | 3 | ✅ |
| 25 | Demirbaş ve yatırım talebi | 3 | ✅ |
| 26 | Sipariş formu okuma (OCR) | 4 | ✅ |
| 27 | Gmail entegrasyonu | 4 | ✅ |
| 28 | Ekstre/dekont eşleştirme ve onay | 4 | ✅ |
| 29 | Yapay zekâ öneri motoru | 4 | ✅ |
| 30 | Yapay zekâ soru-cevap | 4 | ✅ |
| 31 | Fabrika ayarları ve bildirimler | 5 | ✅ |
| 32 | İngilizce ve Portekizce dil desteği | 5 | ✅ |
| 33 | Cilalama ve teslim | 5 | ✅ |

### 9.5 Adım Bağımlılıkları

- Adım 2 (şema) diğer tüm adımların temelidir; değişiklik gerekirse migration ile ilerlenir.
- Adım 12–14, Adım 8–9'daki reçete yapısına ve Adım 6–7'deki stok yapısına doğrudan bağlıdır.
- Adım 13 (planlama takvimi) olmadan Adım 15'teki hat takibi anlamlı bir hedef gösteremez.
- Adım 22 (raporlar), Adım 14 (stok düşümü), Adım 20 (işçilik) ve Adım 21 (genel gider) verisi olmadan tam maliyet üretemez.
- Adım 26–30 (yapay zekâ) önceki fazların verisi üzerine çalışır; en sona bırakılmıştır.
- Adım 3–5 tamamlanmadan hiçbir modül ekranı yetki kontrolü olmadan yayına alınmaz.
