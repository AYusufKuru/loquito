# Vercel + Supabase Yayın Kılavuzu

Bu belge Loquito'yu **Vercel** üzerinde çalıştırmak ve veritabanı + dosyalar için **Supabase** kullanmak için adım adım kurulumu anlatır.

## Bölge seçimi (Türkiye + Brezilya)

İki ülke arasında tek bir “ortada” veri merkezi yok; en dengeli seçenek **ABD Doğu (Virginia)**:

| Servis | Bölge | Kod |
|--------|--------|-----|
| **Vercel** (sunucu fonksiyonları) | Washington D.C. | `iad1` |
| **Supabase** (PostgreSQL + Storage) | East US (North Virginia) | `us-east-1` |

Kabaca gecikme (tek yön):

| Kaynak | Virginia (`iad1` / `us-east-1`) |
|--------|-----------------------------------|
| Türkiye | ~100–130 ms |
| Brezilya | ~100–120 ms |

> Avrupa (`fra1` + `eu-central-1`) Türkiye için daha hızlı (~50 ms) ama Brezilya ~220 ms olur. Brezilya ağırlıklı kullanımda `gru1` + `sa-east-1` tercih edilir.

**Önemli:** Supabase projesinin bölgesi sonradan değiştirilemez. Yanlış bölgede proje varsa **yeni proje** açıp veriyi taşımanız gerekir (aşağıdaki “Bölge taşıma” bölümü).

`vercel.json` içinde `"regions": ["iad1"]` tanımlı — Vercel fonksiyonları Supabase ile aynı bölgede çalışır.

## 1. Supabase projesi oluştur

1. [supabase.com](https://supabase.com) → **New project**
2. **Region:** `East US (North Virginia)` — `us-east-1` (Vercel `iad1` ile eşleşir)
3. Veritabanı şifresini kaydet

## 2. Veritabanı bağlantı bilgileri

**Project Settings → Database → Connection string**

| Amaç | Mod | Port |
|------|-----|------|
| `DATABASE_URL` (Vercel) | Transaction pooling | 6543 |
| `DIRECT_URL` (migration) | Session / Direct | 5432 |

Örnek host (Virginia): `aws-0-us-east-1.pooler.supabase.com`

`.env` dosyana kopyala (`.env.example` şablonuna bak).

## 3. Şemayı Supabase'e yükle

Lokal makineden (Supabase URL'leri `.env` içinde olmalı):

```bash
npm install
npm run db:deploy
npm run db:seed
```

Bu komutlar tabloları oluşturur ve demo kullanıcıları ekler (`admin@loquito.com` / `admin123`).

## 4. Supabase Storage

1. **Storage → New bucket**
2. Ad: `loquito` (veya `.env` içindeki `SUPABASE_STORAGE_BUCKET`)
3. **Public bucket: KAPALI** (private — uygulama service role ile erişir)

Vercel ortam değişkenleri:

```env
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service_role key — Project Settings → API]
SUPABASE_STORAGE_BUCKET=loquito
```

> `service_role` anahtarını asla istemci tarafına koyma; yalnızca Vercel server env'de kullan.

## 5. Vercel deploy

1. [vercel.com](https://vercel.com) → **Add New Project**
2. GitHub repo: `AYusufKuru/loquito`
3. **Environment Variables** ekle:

| Değişken | Değer |
|----------|-------|
| `DATABASE_URL` | Supabase pooler URL (6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase direct URL (5432) |
| `JWT_SECRET` | Rastgele 48+ karakter |
| `NEXT_PUBLIC_APP_URL` | `https://senin-proje.vercel.app` |
| `SUPABASE_URL` | Supabase proje URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `SUPABASE_STORAGE_BUCKET` | `loquito` |

4. **Deploy**

Build komutu otomatik: `prisma generate && next build` (`vercel.json`).

## 6. İlk deploy sonrası kontrol

- `https://senin-proje.vercel.app/login` açılıyor mu?
- `admin@loquito.com` / `admin123` ile giriş
- Sipariş oluşturma, stok listesi çalışıyor mu?

Şema güncellemesi gerektiğinde lokalden:

```bash
npm run db:deploy
```

## 7. Lokal geliştirme

Supabase'i hem canlı hem lokal için kullanabilirsin (aynı proje veya ayrı dev projesi).

Alternatif: yerel PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/loquito"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/loquito"
```

Supabase Storage değişkenleri boşsa dosyalar `./storage` klasörüne yazılır.

## 8. Gmail OAuth (isteğe bağlı)

Google Cloud Console'da redirect URI'yi güncelle:

```
https://senin-proje.vercel.app/api/ai/gmail/callback
```

Vercel env'e `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` ekle.

## 9. Bölge taşıma (İrlanda / Frankfurt → Virginia)

Mevcut Supabase projeniz `eu-west-1` veya `eu-central-1` bölgesindeyse yeni proje açmanız gerekir:

1. Supabase → **New project** → Region: **East US (North Virginia)**
2. Storage'da `loquito` bucket'ını oluştur
3. Lokal `.env` dosyasını yeni bağlantı dizeleriyle güncelle:
   - `DATABASE_URL` → `...@aws-0-us-east-1.pooler.supabase.com:6543/...?pgbouncer=true`
   - `DIRECT_URL` → `...@aws-0-us-east-1.pooler.supabase.com:5432/...`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` → yeni proje değerleri
4. Şema ve seed:
   ```bash
   npm run db:deploy
   npm run db:seed
   ```
5. Eski projede canlı veri varsa: Supabase Dashboard → **Database → Backups** veya `pg_dump` / `pg_restore` ile taşıyın; dosyaları Storage'dan yeni bucket'a kopyalayın
6. Vercel → **Settings → Environment Variables** — tüm Supabase değişkenlerini güncelle
7. Vercel → **Settings → Functions** → Region: `Washington, D.C. (iad1)` (veya `vercel.json` deploy ile otomatik)
8. **Redeploy** ve `https://senin-proje.vercel.app/api/health` ile DB bağlantısını doğrula

Eski İrlanda projesini veri taşındıktan sonra silebilirsiniz.

## Sorun giderme

| Sorun | Çözüm |
|-------|-------|
| `Can't reach database` | `DATABASE_URL` pooler (6543) kullanıldığından emin ol |
| Migration hatası | `DIRECT_URL` ile `npm run db:deploy` çalıştır |
| Dosya yüklenmiyor | Storage bucket adı ve service role key kontrol et |
| Oturum açılmıyor | `JWT_SECRET` Vercel'de tanımlı mı? |
| Yavaş sayfa yükleme | Vercel (`iad1`) ve Supabase (`us-east-1`) aynı bölgede mi? |
| `postgres.xxx not found` | `DATABASE_URL` içinde gerçek proje ref kullanın, placeholder değil |
