import type { OrderChannel } from "@/lib/orders/constants";

export const DEMO_SAMPLE_FILES = [
  {
    id: "kanal-a",
    channel: "retail_form" as OrderChannel,
    fileName: "kanal-a-pastorinho-form.txt",
    label: "Kanal A — Matbu form (Pastorinho)",
  },
  {
    id: "kanal-b",
    channel: "proposal" as OrderChannel,
    fileName: "kanal-b-avolta-proposta.txt",
    label: "Kanal B — Avolta teklif",
  },
  {
    id: "kanal-c",
    channel: "portal" as OrderChannel,
    fileName: "kanal-c-carrefour-portal.txt",
    label: "Kanal C — Carrefour portal",
  },
] as const;

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  retail_form: "Matbu sipariş formu (koli)",
  proposal: "Kurumsal teklif (adet)",
  portal: "Müşteri portalı (adet)",
};
