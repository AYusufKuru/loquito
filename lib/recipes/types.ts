export interface RecipeItemRow {
  id: string;
  materialId: string | null;
  materialCode: string | null;
  materialName: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  subcategory?: string | null;
}

export interface PackagingItemRow extends RecipeItemRow {
  packagingId: string;
  subcategory: string | null;
  unitPriceCents: number;
  perBatch: boolean;
}

export interface PackagingProfile {
  packagingId: string;
  packagingCode: string;
  packagingLabel: string;
  netWeightG: number;
  unitsPerBox: number;
  items: PackagingItemRow[];
}

export interface RecipeRow {
  id: string;
  code: string;
  name: string;
  flavorId: string | null;
  flavorName: string | null;
  flavorCode: string | null;
  customerId: string | null;
  customerName: string | null;
  yieldKg: number;
  scrapPercent: number;
  version: number;
  isActive: boolean;
  notes: string | null;
  rawItemCount: number;
  packagingProfileCount: number;
  isCustomerSpecific: boolean;
}

export interface RecipeDetail extends RecipeRow {
  rawItems: RecipeItemRow[];
  inputKg: number;
  packagingProfiles: PackagingProfile[];
}

export interface PackagingOption {
  id: string;
  code: string;
  label: string;
  netWeightG: number;
  unitsPerBox: number;
}

export interface RecipeCostResult {
  packagingId: string;
  packagingLabel: string;
  netWeightG: number;
  unitsPerBox: number;
  yieldKg: number;
  boxesPerBatch: number;
  rawCostCents: number;
  packagingCostCents: number;
  totalBatchCents: number;
  perKgCents: number;
  perBoxCents: number;
  perShipBoxCents: number;
}

export interface CustomerOption {
  id: string;
  name: string;
}

export interface FlavorOption {
  id: string;
  code: string;
  name: string;
}

export interface RawMaterialOption {
  id: string;
  code: string;
  name: string;
  unit: string;
  subcategory: string | null;
  unitPriceCents: number;
}

export interface RecipeCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
