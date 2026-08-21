export const PR_PURCHASE_TAX_NOTE =
  "Paraná içindeki hammadde alış vergisi, satın alınan girdinin türüne göre değişir.";

export interface BrazilStateTaxSeed {
  code: string;
  name: string;
  region: string;
  purchaseTaxPercent: number | null;
  salesTaxPercent: number;
  notes: string | null;
}

/** Excel: Loquitos_Eyalet_Bazli_Alis_Satis_Vergileri — oranlar yüzde olarak saklanır (0.07 → 7). */
export const BRAZIL_STATE_TAXES: BrazilStateTaxSeed[] = [
  { code: "AC", name: "Acre", region: "Kuzey", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "AL", name: "Alagoas", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "AP", name: "Amapá", region: "Kuzey", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "AM", name: "Amazonas", region: "Kuzey", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "BA", name: "Bahia", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "CE", name: "Ceará", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "DF", name: "Distrito Federal", region: "Orta Batı", purchaseTaxPercent: 7, salesTaxPercent: 16, notes: null },
  { code: "ES", name: "Espírito Santo", region: "Güneydoğu", purchaseTaxPercent: 7, salesTaxPercent: 16, notes: null },
  { code: "GO", name: "Goiás", region: "Orta Batı", purchaseTaxPercent: 7, salesTaxPercent: 16, notes: null },
  { code: "MA", name: "Maranhão", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "MT", name: "Mato Grosso", region: "Orta Batı", purchaseTaxPercent: 7, salesTaxPercent: 16, notes: null },
  { code: "MS", name: "Mato Grosso do Sul", region: "Orta Batı", purchaseTaxPercent: 7, salesTaxPercent: 16, notes: null },
  { code: "MG", name: "Minas Gerais", region: "Güneydoğu", purchaseTaxPercent: 12, salesTaxPercent: 17, notes: null },
  { code: "PA", name: "Pará", region: "Kuzey", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "PB", name: "Paraíba", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  {
    code: "PR",
    name: "Paraná",
    region: "Güney",
    purchaseTaxPercent: null,
    salesTaxPercent: 12,
    notes: PR_PURCHASE_TAX_NOTE,
  },
  { code: "PE", name: "Pernambuco", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "PI", name: "Piauí", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "RJ", name: "Rio de Janeiro", region: "Güneydoğu", purchaseTaxPercent: 12, salesTaxPercent: 17, notes: null },
  { code: "RN", name: "Rio Grande do Norte", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "RS", name: "Rio Grande do Sul", region: "Güney", purchaseTaxPercent: 12, salesTaxPercent: 17, notes: null },
  { code: "RO", name: "Rondônia", region: "Kuzey", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "RR", name: "Roraima", region: "Kuzey", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "SC", name: "Santa Catarina", region: "Güney", purchaseTaxPercent: 12, salesTaxPercent: 17, notes: null },
  { code: "SP", name: "São Paulo", region: "Güneydoğu", purchaseTaxPercent: 12, salesTaxPercent: 17, notes: null },
  { code: "SE", name: "Sergipe", region: "Kuzeydoğu", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
  { code: "TO", name: "Tocantins", region: "Kuzey", purchaseTaxPercent: 7, salesTaxPercent: 10, notes: null },
];
