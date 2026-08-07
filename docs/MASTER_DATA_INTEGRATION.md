# Master Data Integration

## Objective

Use one governed product, market and route-to-market dictionary across the collaboration platform. Business modules select records by stable ID and must not maintain separate product names, codes or categories.

## Ownership

- Product identity is owned by `commercial_planning.products`.
- Market identity is owned by `commercial_planning.countries`.
- Channel, retailer, distributor and Incoterms options are derived from active commercial margin records.
- `product.id` is the integration key. SKU remains the human-readable business key and should be treated as immutable after publication.
- Product name, category and lifecycle are display attributes read from Master Data. They are not editable inside projects, plans, promotions or deliveries.
- The quick new-product simulation is the controlled product-creation flow. A draft becomes selectable elsewhere only after an authorised user creates the Master Data product.

## Platform Read Contract

`GET /api/platform/master-data-options` returns the current permitted option catalog:

- `products`: ID, SKU, official name, canonical category, lifecycle and launch dates.
- `categories`: Power Bank, Charger, Wireless Charger and Charging Cable.
- `markets`: country ID, code, name, currency and VAT.
- `channels`, `retailers`, `distributors`, `incoterms`: deduplicated active options.

Product identity is globally readable to authorised platform members. Market and route-to-market dimensions are reduced to the user's country data scope. The endpoint requires an authenticated session, disables caching and supports only approved platform origins.

## Module Connections

| Module | Master Data selection | Transaction data retained by module |
| --- | --- | --- |
| Project Tracking | Product | Project ID, owner, stage, project launch baseline, timeline revisions and workstreams |
| Sales & Inventory | Product | Monthly demand, supply, inventory, First Batch and plan versions |
| Forecast Management | Product, market, channel/customer | Forecast cycle, month, quantity, version, owner and change reason |
| Logistics Delivery | Product, market, warehouse/route | Shipment, quantity, ETD, ETA, customs and receipt status |
| Marketing Assets | Inherits product from Project Tracking | Material checklist, owner, DDL, delivery state and blockers |
| Prototype Management | Inherits product from Project Tracking | Prototype type, quantity, recipient, dates and status |
| Monthly Promotion Approval | Product, market, retailer/channel | Promotion period, price, volume, investment, margin and approval status |
| Value Chain Simulation | Product, market, retailer/distributor/Incoterms | Scenario inputs, calculated values, row order and saved versions |
| BP Achievement | Product, market, channel/customer | BP target, forecast, actuals, variance and actions |
| Approval and Tasks | References source record IDs | Approval stage, decision, reminder and audit history |

## Synchronisation Rules

1. New products are created in Master Data, then become available to module selectors.
2. Project creation stores `productId`; SKU, name and category are automatically populated and read-only.
3. Project launch dates remain project-controlled because delays and timeline revisions must not rewrite the product dictionary silently.
4. Marketing Assets and Prototype Management inherit the project's product identity and cannot choose a different product independently.
5. Renaming or recategorising a product updates labels across modules on the next catalog refresh; transactional history remains attached through `productId`.
6. SKU changes require an explicit administrator migration with an alias/audit record. Existing module records must never be matched only by display name.
7. Inactive products remain visible on historical records but are removed from selectors for new transactions.

## Governed Workbook Update Workflow

The System Management import is a controlled two-step publish flow:

1. Select one `.xlsx` workbook.
2. Run **Validate & preview impact**. This parses the workbook without changing any database row.
3. Review additions, changed defaults and records that will become inactive for Markets/VAT/FX, Products, BOM, Country RRP, Logistics and Commercial Margins.
4. Review the affected platform modules before publishing.
5. Select **Import workbook**. The server revalidates the same file, creates a read-only pre-import workbook snapshot and then applies the complete update in one database transaction. It loads the current snapshot once and writes only new, changed, reactivated or duplicate-cleanup rows; unchanged rows are not rewritten.
6. A successful publish creates a second read-only snapshot of the new version and emits a platform refresh event. Active copied modules refresh immediately; cached dependent modules refresh once when next opened.

An invalid workbook, duplicate business key or failed pre-import snapshot blocks the publish before governed data is changed. Rows removed from a replacement workbook are inactivated rather than physically deleted.

## Module Impact And History Protection

| Master Data change | Current/default effect | Historical protection |
| --- | --- | --- |
| New product | Becomes available in governed selectors after publish | No historical record is rewritten |
| Product name/category/lifecycle | Current labels refresh through stable `productId` | Existing project, approval and planning records keep their transaction history |
| BOM change | New calculations and newly created scenarios use the new active BOM | Saved simulations, approved promotions and plan versions keep their recorded inputs/results |
| RRP/VAT/FX change | New value-chain, BP and promotion calculations use the new defaults | Published or approved versions retain their saved price/tax/rate snapshot |
| Logistics change | New route calculations use the active logistics default | Existing shipment and saved calculation records retain their recorded value |
| Margin change | New simulations and promotion checks use the new active margin | Approved requests and saved versions retain their recorded margin snapshot |
| Workbook row removed | Record becomes inactive and disappears from new-entry selectors | Existing references and both workbook snapshots remain readable for audit |

The workbook archive is the rollback evidence, not an automatic destructive rollback. Restoring a prior Master Data version must be an explicit owner/admin action that republishes that archived workbook as a new version, preserving the full sequence of changes.

## Local Test Scope

The local preview implements the shared options API, governed product selection and runtime synchronisation of Sales & Inventory, Project Tracking and Marketing Assets labels. The copied promotion, value-chain, BP and new-product modules read the same reference-data service.

The supplied `Master data.xlsx` passes the preview and publish workflow in an isolated database. Browser verification confirms the current workbook is recognized, impact details are shown before publish, both pre- and post-publish archives are created, and the System Management page has no document-level horizontal overflow at 1280px.

Production activation remains gated by authenticated UAT and an explicit deployment decision. No source system or production data is changed by this local verification.
