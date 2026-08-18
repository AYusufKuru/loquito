export interface FactorySettingDefault {
  key: string;
  value: string;
  label: string;
  category: string;
}

export const FACTORY_SETTING_CATEGORIES = [
  "schedule",
  "production",
  "finance",
  "company",
  "general",
  "notifications",
] as const;

export type FactorySettingCategory = (typeof FACTORY_SETTING_CATEGORIES)[number];

export const DEFAULT_FACTORY_SETTINGS: FactorySettingDefault[] = [
  { key: "work_start", value: "08:00", label: "Mesai başlangıcı", category: "schedule" },
  { key: "work_end", value: "17:00", label: "Mesai bitişi", category: "schedule" },
  { key: "work_days", value: "mon-fri", label: "Çalışma günleri", category: "schedule" },
  { key: "batch_yield_kg", value: "70", label: "Parti verimi (kg)", category: "production" },
  { key: "batch_cook_hours", value: "3.5", label: "Pişirme süresi (saat)", category: "production" },
  { key: "cooling_days", value: "1", label: "Soğutma süresi (gün)", category: "production" },
  { key: "cutting_team_size", value: "10", label: "Kesim/paketleme ekip", category: "production" },
  { key: "cook_team_size", value: "2", label: "Pişirme ekibi (kişi)", category: "production" },
  { key: "reference_order_boxes", value: "10000", label: "Referans sipariş (kutu)", category: "production" },
  { key: "reference_order_days", value: "4", label: "Referans sipariş süresi (gün)", category: "production" },
  { key: "daily_capacity_250g", value: "2500", label: "Günlük kapasite 250g (kutu)", category: "production" },
  { key: "daily_capacity_85g", value: "0", label: "Günlük kapasite 85g (kutu)", category: "production" },
  { key: "kazan_count", value: "3", label: "Kazan sayısı", category: "production" },
  { key: "currency_default", value: "BRL", label: "Varsayılan para birimi", category: "finance" },
  {
    key: "overhead_allocation_method",
    value: "kg",
    label: "Genel gider dağıtım yöntemi",
    category: "finance",
  },
  { key: "default_tax_percent", value: "0", label: "Varsayılan vergi (%)", category: "finance" },
  { key: "unit_weight", value: "kg", label: "Ağırlık birimi", category: "general" },
  { key: "company_cnpj", value: "61.581.495/0001-84", label: "CNPJ", category: "company" },
  {
    key: "company_name",
    value: "LOQUITOS INDUSTRIA E COMERCIO DE DOCES E EQUIPAMENTOS LTDA",
    label: "Firma adı",
    category: "company",
  },
  {
    key: "notify_stock_critical",
    value: "true",
    label: "Kritik stok bildirimi",
    category: "notifications",
  },
  {
    key: "notify_payment_overdue",
    value: "true",
    label: "Geciken tahsilat bildirimi",
    category: "notifications",
  },
  {
    key: "notify_delivery_delayed",
    value: "true",
    label: "Geciken teslimat bildirimi",
    category: "notifications",
  },
  {
    key: "notify_production_downtime",
    value: "true",
    label: "Üretim duruş bildirimi",
    category: "notifications",
  },
  {
    key: "notify_email_enabled",
    value: "false",
    label: "E-posta bildirimleri aktif",
    category: "notifications",
  },
  {
    key: "notify_email_address",
    value: "",
    label: "Bildirim e-posta adresi",
    category: "notifications",
  },
];

export const FACTORY_SETTING_KEYS = new Set(
  DEFAULT_FACTORY_SETTINGS.map((s) => s.key),
);

export const NOTIFICATION_SETTING_KEYS = DEFAULT_FACTORY_SETTINGS.filter(
  (s) => s.category === "notifications",
).map((s) => s.key);

export const WORK_DAYS_OPTIONS = [
  { value: "mon-fri", label: "Pazartesi–Cuma" },
  { value: "all", label: "Tüm günler" },
] as const;

export const CURRENCY_OPTIONS = [
  { value: "BRL", label: "BRL (R$)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
] as const;

export const OVERHEAD_METHOD_OPTIONS = [
  { value: "kg", label: "Üretilen kg" },
  { value: "hours", label: "Çalışılan saat" },
] as const;
