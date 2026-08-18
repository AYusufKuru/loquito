import type {
  ChannelCodeRow,
  CustomerPriceRow,
  CustomerRow,
  PriceListItemRow,
  PriceListRow,
  PriceTierRow,
  SalesRepRow,
} from "./types";
import { toIsoString } from "@/lib/utils/datetime";

export function toSalesRepRow(
  rep: {
    id: string;
    name: string;
    company: string | null;
    region: string | null;
    address: string | null;
    cep: string | null;
    phone: string | null;
    email: string | null;
    isActive: boolean;
    customers?: { id: string }[];
  },
): SalesRepRow {
  return {
    id: rep.id,
    name: rep.name,
    company: rep.company,
    region: rep.region,
    address: rep.address,
    cep: rep.cep,
    phone: rep.phone,
    email: rep.email,
    isActive: rep.isActive,
    customerCount: rep.customers?.length ?? 0,
  };
}

export function toPriceListRow(
  list: {
    id: string;
    code: string;
    name: string;
    channel: string | null;
    region: string | null;
    validFrom: Date | string | null;
    validTo: Date | string | null;
    isActive: boolean;
    items?: { id: string }[];
    customers?: { id: string }[];
  },
): PriceListRow {
  return {
    id: list.id,
    code: list.code,
    name: list.name,
    channel: list.channel,
    region: list.region,
    validFrom: toIsoString(list.validFrom),
    validTo: toIsoString(list.validTo),
    isActive: list.isActive,
    itemCount: list.items?.length ?? 0,
    customerCount: list.customers?.length ?? 0,
  };
}

export function toPriceListItemRow(
  item: {
    id: string;
    productId: string;
    boxPriceCents: number;
    unitPriceCents: number;
    product: { sku: string; name: string };
  },
): PriceListItemRow {
  return {
    id: item.id,
    productId: item.productId,
    productSku: item.product.sku,
    productName: item.product.name,
    boxPriceCents: item.boxPriceCents,
    unitPriceCents: item.unitPriceCents,
  };
}

export function toCustomerRow(
  customer: {
    id: string;
    name: string;
    cnpj: string | null;
    region: string | null;
    salesRepId: string | null;
    priceListId: string | null;
    paymentTerms: string | null;
    freightType: string | null;
    address: string | null;
    deliveryAddress: string | null;
    billingAddress: string | null;
    phone: string | null;
    email: string | null;
    contactName: string | null;
    isActive: boolean;
    balanceCents: number;
    notes: string | null;
    salesRep?: { name: string } | null;
    priceList?: { name: string } | null;
    customerPrices?: { id: string }[];
    priceTiers?: { id: string }[];
    channelCodes?: { id: string }[];
  },
): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    cnpj: customer.cnpj,
    region: customer.region,
    salesRepId: customer.salesRepId,
    salesRepName: customer.salesRep?.name ?? null,
    priceListId: customer.priceListId,
    priceListName: customer.priceList?.name ?? null,
    paymentTerms: customer.paymentTerms,
    freightType: customer.freightType,
    address: customer.address,
    deliveryAddress: customer.deliveryAddress,
    billingAddress: customer.billingAddress,
    phone: customer.phone,
    email: customer.email,
    contactName: customer.contactName,
    isActive: customer.isActive,
    balanceCents: customer.balanceCents,
    notes: customer.notes,
    customerPriceCount: customer.customerPrices?.length ?? 0,
    tierCount: customer.priceTiers?.length ?? 0,
    channelCodeCount: customer.channelCodes?.length ?? 0,
  };
}

export function toCustomerPriceRow(
  row: {
    id: string;
    productId: string;
    boxPriceCents: number | null;
    unitPriceCents: number | null;
    validFrom: Date | string | null;
    validTo: Date | string | null;
    notes: string | null;
    product: { sku: string; name: string };
  },
): CustomerPriceRow {
  return {
    id: row.id,
    productId: row.productId,
    productSku: row.product.sku,
    productName: row.product.name,
    boxPriceCents: row.boxPriceCents,
    unitPriceCents: row.unitPriceCents,
    validFrom: toIsoString(row.validFrom),
    validTo: toIsoString(row.validTo),
    notes: row.notes,
  };
}

export function toPriceTierRow(
  row: {
    id: string;
    productId: string | null;
    thresholdQty: number;
    thresholdUnit: string;
    discountPercent: number | null;
    boxPriceCents: number | null;
    unitPriceCents: number | null;
    notes: string | null;
    product?: { sku: string; name: string } | null;
  },
): PriceTierRow {
  return {
    id: row.id,
    productId: row.productId,
    productSku: row.product?.sku ?? null,
    productName: row.product?.name ?? null,
    thresholdQty: row.thresholdQty,
    thresholdUnit: row.thresholdUnit as "box" | "unit",
    discountPercent: row.discountPercent,
    boxPriceCents: row.boxPriceCents,
    unitPriceCents: row.unitPriceCents,
    notes: row.notes,
  };
}

export function toChannelCodeRow(
  row: {
    id: string;
    productId: string;
    channel: string;
    externalSku: string;
    product: { sku: string; name: string };
  },
): ChannelCodeRow {
  return {
    id: row.id,
    productId: row.productId,
    productSku: row.product.sku,
    productName: row.product.name,
    channel: row.channel,
    externalSku: row.externalSku,
  };
}
