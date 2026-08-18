import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Factory,
  Package,
  ClipboardList,
  BarChart3,
  Boxes,
  Sparkles,
  Users,
  Settings,
} from "lucide-react";

const modules = [
  {
    icon: ClipboardList,
    title: "Sipariş Takibi",
    description: "Sipariş formundan üretime ve sevkiyata kadar uçtan uca takip.",
  },
  {
    icon: Factory,
    title: "Üretim & Kazanlar",
    description: "Pişirme, soğutma, kesim ve paketleme hatlarının canlı izleme.",
  },
  {
    icon: Package,
    title: "Reçeteler",
    description: "Hammadde ve ambalaj reçeteleri, maliyet ve varyant yönetimi.",
  },
  {
    icon: Boxes,
    title: "Stok",
    description: "Hammadde, ambalaj ve mamul stoğu; lot ve kritik seviye uyarıları.",
  },
  {
    icon: BarChart3,
    title: "Raporlar",
    description: "Gün, ay ve yıl bazında maliyet, gelir ve kârlılık analizi.",
  },
  {
    icon: Sparkles,
    title: "Yapay Zekâ",
    description: "Stok önerileri, kârlılık analizi ve sipariş formu okuma.",
  },
  {
    icon: Users,
    title: "İnsan Kaynakları",
    description: "Personel, puantaj, mesai ve işçilik maliyeti takibi.",
  },
  {
    icon: Settings,
    title: "Ayarlar",
    description: "Kullanıcılar, roller, yetkiler ve fabrika parametreleri.",
  },
];

export function HomePage() {
  const showDevHint = process.env.NODE_ENV !== "production";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">L</span>
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Loquito</p>
              <p className="text-xs text-muted-foreground">
                Brazilian Delight · Fabrika Yönetimi
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/login">Giriş Yap</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <Badge className="mb-4 bg-accent text-accent-foreground hover:bg-accent/90">
              Lokum Fabrikası ERP
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Fabrikanızı tek ekrandan yönetin
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Reçete, üretim, sipariş, stok, finans ve insan kaynakları modülleri
              tek bir sistemde. Brezilya operasyonunuz için tasarlandı.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/login">Giriş Yap</Link>
              </Button>
            </div>
            {showDevHint && (
              <p className="mt-4 text-sm text-muted-foreground">
                Geliştirme hesabı: admin@loquito.com / admin123
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stats preview */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aktif Kazanlar</CardDescription>
              <CardTitle className="text-3xl">3</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pişirme kapasitesi · 70 kg / parti
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ürün Çeşidi</CardDescription>
              <CardTitle className="text-3xl">9 + Mix</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Amazon Rare Fruits koleksiyonu
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ambalaj</CardDescription>
              <CardTitle className="text-3xl">85g · 250g</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                500g ve 1kg tanımlı, pasif
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Modules grid */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 text-xl font-semibold">Modüller</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <Card
              key={module.title}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <module.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-center text-sm text-muted-foreground">
            Loquitos Indústria e Comércio de Doces e Equipamentos LTDA · CNPJ
            61.581.495/0001-84
          </p>
        </div>
      </footer>
    </div>
  );
}
