# Vercel + Supabase Yayın Kılavuzu

Bu belge Loquito'yu **Vercel** üzerinde çalıştırmak ve veritabanı + dosyalar için **Supabase** kullanmak için adım adım kurulumu anlatır.

## 1. Supabase projesi oluştur

1. [supabase.com](https://supabase.com) → **New project**
2. Bölge: Vercel ile aynı bölgeyi seç (ör. `Frankfurt / eu-central-1`)
3. Veritabanı şifresini kaydet

## 2. Veritabanı bağlantı bilgileri

**Project Settings → Database → Connection string**

| Amaç | Mod | Port |
|------|-----|------|
| `DATABASE_URL` (Vercel) | Transaction pooling | 6543 |
| `DIRECT_URL` (migration) | Session / Direct | 5432 |

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

## Sorun giderme

| Sorun | Çözüm |
|-------|-------|
| `Can't reach database` | `DATABASE_URL` pooler (6543) kullanıldığından emin ol |
| Migration hatası | `DIRECT_URL` ile `npm run db:deploy` çalıştır |
| Dosya yüklenmiyor | Storage bucket adı ve service role key kontrol et |
| Oturum açılmıyor | `JWT_SECRET` Vercel'de tanımlı mı? |
