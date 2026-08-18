"use client";

import { useState } from "react";
import { ClipboardList, Tag, UserCircle, Users } from "lucide-react";

import { OrdersSection } from "@/components/orders/orders-section";
import { CustomersSection } from "@/components/orders/customers-section";
import { PriceListsSection } from "@/components/orders/price-lists-section";
import { SalesRepsSection } from "@/components/orders/sales-reps-section";
import { ModuleTabs } from "@/components/ui/module-tabs";
import type { OrderProductOption, OrderRow, OrdersCapabilities } from "@/lib/orders/types";
import type {
  CustomerRow,
  PriceListRow,
  ProductOption,
  SalesRepRow,
} from "@/lib/pricing/types";

type Tab = "orders" | "customers" | "salesReps" | "priceLists";

interface OrdersManagerProps {
  initialOrders: OrderRow[];
  initialCustomers: CustomerRow[];
  initialSalesReps: SalesRepRow[];
  initialPriceLists: PriceListRow[];
  products: ProductOption[];
  orderProducts: OrderProductOption[];
  salesReps: SalesRepRow[];
  priceLists: PriceListRow[];
  capabilities: OrdersCapabilities;
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
  capabilities,
  labels,
}: OrdersManagerProps) {
  const [tab, setTab] = useState<Tab>("orders");

  const tabs = [
    { id: "orders", label: labels.ordersTab, icon: ClipboardList },
    { id: "customers", label: labels.customersTab, icon: Users },
    { id: "salesReps", label: labels.salesRepsTab, icon: UserCircle },
    { id: "priceLists", label: labels.priceListsTab, icon: Tag },
  ] as const;

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
            products={orderProducts}
            capabilities={capabilities}
            labels={labels}
          />
        )}
        {tab === "customers" && (
          <CustomersSection
            initialCustomers={initialCustomers}
            salesReps={salesReps}
            priceLists={priceLists}
            products={products}
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
            products={products}
            capabilities={capabilities}
            labels={labels}
          />
        )}
      </div>
    </div>
  );
}
