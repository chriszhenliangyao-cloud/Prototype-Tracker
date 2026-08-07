"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ValueChainTabs() {
  const pathname = usePathname() || "";
  const isNewProduct = pathname.endsWith("/new-product");

  return (
    <div className="native-platform-tabs" role="tablist" aria-label="价值链测算视图">
      <Link
        aria-selected={!isNewProduct}
        className={!isNewProduct ? "active" : ""}
        href="/platform/business/value-chain/on-sale"
        prefetch
        role="tab"
      >
        <span>On-sale Product Simulation</span>
        <small>在售及退市产品</small>
      </Link>
      <Link
        aria-selected={isNewProduct}
        className={isNewProduct ? "active" : ""}
        href="/platform/business/value-chain/new-product"
        prefetch
        role="tab"
      >
        <span>New Product Simulation</span>
        <small>未上市新品</small>
      </Link>
    </div>
  );
}
