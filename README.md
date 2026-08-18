# Loquito — Fabrika Yönetim Sistemi

Loquito lokum fabrikası için üretim, sipariş, stok, finans ve insan kaynakları yönetim platformu.

Detaylı gereksinimler: [`PROJE.md`](./PROJE.md) · Kurulum: [`KULLANIM.md`](./KULLANIM.md) · Canlı yayın: [`DEPLOY.md`](./DEPLOY.md)

## Teknoloji

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Prisma** + PostgreSQL (Supabase)
- **JWT** oturum (`jose`)
- **TR / EN / PT** arayüz dilleri

## Hızlı başlangıç

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

[http://localhost:3000](http://localhost:3000) · Demo: `admin@loquito.com` / `admin123`

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run start` | Üretim sunucusu |
| `npm run lint` | ESLint |
| `npm run db:setup` | Şema + seed |
| `npm run smoke` | Duman testi (seed doğrulama) |
| `npm run smoke:repair` | Eksik örnek siparişi oluştur |

## Geliştirme durumu

Tüm 33 adım tamamlandı (Faz 0–5). İlerleme tablosu için `PROJE.md` §9.4.

## Lisans

Özel — Loquitos Indústria e Comércio de Doces e Equipamentos LTDA
