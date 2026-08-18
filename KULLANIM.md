



# Loquito — Kurulum ve Kullanım Kılavuzu

Bu belge, Loquito fabrika yönetim sisteminin kurulumu, günlük kullanımı ve kabul senaryolarını açıklar.

## 1. Kurulum

### Gereksinimler

- Node.js 20+
- npm 10+

### İlk kurulum

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Tarayıcı: [http://localhost:3000](http://localhost:3000)

### Demo hesaplar

| E-posta | Şifre | Rol |
|---------|-------|-----|
| admin@loquito.com | admin123 | Tam yetki |
| satis@loquito.com | (seed) | Satış (sınırlı) |

### Üretim ortamı (Vercel + Supabase)

Ayrıntılı adımlar: [`DEPLOY.md`](./DEPLOY.md)

```bash
npm run db:deploy   # Supabase şeması
npm run db:seed     # İlk veriler
```

- `DATABASE_URL` → Supabase connection pooler (port 6543)
- `DIRECT_URL` → Supabase direct connection (migration)
- `JWT_SECRET` en az 32 karakter, rastgele ve gizli tutulmalıdır
- Dosyalar için `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + bucket `loquito`
- Lokal geliştirmede Supabase boşsa dosyalar `./storage` klasörüne yazılır

## 2. Dil seçimi

Üst barda veya giriş sayfasında **Türkçe / English / Português** seçilebilir. Tercih cookie ile saklanır.

## 3. Modül özeti

| Modül | Yol | Amaç |
|-------|-----|------|
| Kontrol Paneli | `/dashboard` | Özet kartlar, uyarılar, AI önerileri |
| Siparişler | `/orders` | Sipariş girişi, onay, üretim analizi |
| Üretim | `/production` | Kazan/hat takibi, üretim emirleri |
| Stok | `/stock` | Malzeme, lot, mamul stok |
| Finans | `/finance` | Ödemeler, ekstre eşleştirme |
| Yapay Zekâ | `/ai` | Öneriler, soru-cevap, Gmail/OCR |
| Ayarlar | `/settings` | Kullanıcılar, fabrika parametreleri |

## 4. Kabul senaryosu (uçtan uca)

Aşağıdaki adımlar demo seed verisi ile doğrulanabilir:

1. **Giriş** — `admin@loquito.com` ile oturum açın.
2. **Kontrol paneli** — Sipariş özeti, stok uyarıları ve AI önerileri görünür.
3. **Sipariş** — `PED-EXEMPLO-001` toplam **R$ 5.409,25**; durum sevke hazır veya üretimde.
4. **Üretim** — 3 kazan kartı ve kesim/paketleme hatları canlı görünümde.
5. **Stok** — Hammadde kartları, kritik seviye uyarıları.
6. **Finans** — Örnek tahsilat vadesi; ekstre eşleştirme sekmesi.
7. **Yapay Zekâ** — Örnek soru: *"PED-EXEMPLO-001 sipariş tutarı ne kadar?"* → **R$ 5.409,25**.
8. **Ayarlar** — Fabrika parametreleri (kazan sayısı, mesai) ekrandan düzenlenebilir.
9. **Dil** — English seçildiğinde menü ve sayfa metinleri İngilizceye geçer.

### Otomatik duman testi

```bash
npm run smoke
```

Seed verisi ve temel tabloların dolu olduğunu doğrular. Örnek sipariş eksikse: `npm run smoke:repair`.

## 5. Mobil / saha kullanımı

- Telefonda üst menü yatay kaydırılabilir modül sekmeleri sunar.
- Dokunma hedefleri en az 44px yükseklikte tutulur.
- Geniş tablolar yatay kaydırma ile görüntülenir (`table-scroll` sınıfı).

## 6. Güvenlik notları

- Tüm uygulama rotaları JWT cookie ile korunur (`/login` hariç).
- Modül erişimi RBAC ile sınırlandırılır.
- Middleware güvenlik başlıkları ekler (X-Frame-Options, nosniff, Referrer-Policy).
- Kritik değişiklikler audit log’a yazılır.

## 7. Sorun giderme

| Sorun | Çözüm |
|-------|--------|
| Örnek sipariş yok | `npm run smoke:repair` veya `npm run db:setup` |
| Oturum açılmıyor | `.env` içinde `JWT_SECRET` kontrol edin |
| Prisma EPERM (Windows) | `npm run db:push` tekrar deneyin; IDE/antivirus kilidini kaldırın |
| Build hatası | `npm run lint` ve `npm run build` |

Detaylı gereksinimler: [`PROJE.md`](./PROJE.md)
