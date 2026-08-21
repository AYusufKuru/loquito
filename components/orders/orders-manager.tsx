"use client";

import { useState } from "react";
import { ClipboardList, Package, Tag, UserCircle, Users } from "lucide-react";

import { OrdersSection } from "@/components/orders/orders-section";
import { CustomersSection } from "@/components/orders/customers-section";
import { PriceListsSection } from "@/components/orders/price-lists-section";
import { ProductsSection } from "@/components/orders/products-section";
import { SalesRepsSection } from "@/components/orders/sales-reps-section";
import { ModuleTabs } from "@/components/ui/module-tabs";
import { useLiveState } from "@/hooks/use-live-state";
import type {
  CatalogProductRow,
  OrderProductOption,
  OrderRow,
  OrdersCapabilities,
  PackagingPickOption,
  RecipePickOption,
} from "@/lib/orders/types";
import type { TaxLocationRow } from "@/lib/finance/tax-locations";
import type {
  CustomerRow,
  PriceListRow,
  ProductOption,
  SalesRepRow,
} from "@/lib/pricing/types";

type Tab = "orders" | "products" | "customers" | "salesReps" | "priceLists";

interface OrdersManagerProps {
  initialOrders: OrderRow[];
  initialCustomers: CustomerRow[];
  initialSalesReps: SalesRepRow[];
  initialPriceLists: PriceListRow[];
  products: ProductOption[];
  orderProducts: OrderProductOption[];
  catalogProducts: CatalogProductRow[];
  recipes: RecipePickOption[];
  packagings: PackagingPickOption[];
  salesReps: SalesRepRow[];
  priceLists: PriceListRow[];
  capabilities: OrdersCapabilities;
  taxLocations: TaxLocationRow[];
  labels: Record<string, string>;
}

export function OrdersManager({
  initialOrders,
  initialCustomers,
  initialSalesReps,
  initialPriceLists,
  products,
  salesReps,
  priceLists,
  orderProducts,
  catalogProducts,
  recipes,
  packagings,
  capabilities,
  taxLocations,
  labels,
}: OrdersManagerProps) {
  const [tab, setTab] = useState<Tab>("orders");
  const [catalog, setCatalog] = useLiveState(catalogProducts);
  const [sellable, setSellable] = useLiveState(orderProducts);
  const [priceProducts, setPriceProducts] = useLiveState(products);

  const tabs = [
    { id: "orders", label: labels.ordersTab, icon: ClipboardList },
    { id: "products", label: labels.productsTab, icon: Package },
    { id: "customers", label: labels.customersTab, icon: Users },
    { id: "salesReps", label: labels.salesRepsTab, icon: UserCircle },
    { id: "priceLists", label: labels.priceListsTab, icon: Tag },
  ] as const;

  function handleProductCreated(product: CatalogProductRow) {
    setCatalog((prev) => [...prev, product]);
    setSellable((prev) => [
      ...prev,
      {
        id: product.id,
        sku: product.sku,
        name: product.name,
        unitsPerBox: product.unitsPerBox,
        packagingCode: null,
        customerId: product.customerId,
      },
    ]);
    if (!product.customerId) {
      setPriceProducts((prev) => [
        ...prev,
        { id: product.id, sku: product.sku, name: product.name, unitsPerBox: product.unitsPerBox },
      ]);
    }
  }

  return (
    <div>
      <ModuleTabs
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      <div className="mt-6">
        {tab === "orders" && (
          <OrdersSection
            initialOrders={initialOrders}
            customers={initialCustomers}
            products={sellable}
            capabilities={capabilities}
            taxLocations={taxLocations}
            labels={labels}
            onAddProduct={() => setTab("products")}
          />
        )}
        {tab === "products" && (
          <ProductsSection
            products={catalog}
            recipes={recipes}
            packagings={packagings}
            capabilities={capabilities}
            labels={labels}
            onCreated={handleProductCreated}
          />
        )}
        {tab === "customers" && (
          <CustomersSection
            initialCustomers={initialCustomers}
            salesReps={salesReps}
            priceLists={priceLists}
            products={priceProducts}
            capabilities={capabilities}
            labels={labels}
          />
        )}
        {tab === "salesReps" && (
          <SalesRepsSection
            initialSalesReps={initialSalesReps}
            capabilities={capabilities}
            labels={labels}
          />
        )}
        {tab === "priceLists" && (
          <PriceListsSection
            initialPriceLists={initialPriceLists}
            products={priceProducts}
            capabilities={capabilities}
            labels={labels}
          />
        )}
      </div>
    </div>
  );
}
