# Prototype Tracker Project Notes

## Current Goal

Maintain and extend the bilingual operations collaboration platform. The latest native workspaces are now released as an authenticated read-only production pilot inside the unified cloud platform. Formal cloud modules and production records remain the source of truth until their corresponding native backend contracts pass authenticated UAT and explicit cutover acceptance.

## 2026-08-09 Unified Platform Shell Release Candidate

- Replaced the three competing navigation shells with one Next.js platform shell
  and a single module registry. Every visible sidebar item now uses a canonical
  `/platform/...` route; legacy and native static workspaces render only their
  business content inside same-origin module containers.
- Old `/platform/index.html#module=...` and
  `/platform-native/index.html#module=...` bookmarks redirect before rendering
  to the corresponding canonical route. Cross-module actions inside embedded
  workspaces send navigation back to the parent shell instead of opening a
  second interface.
- Removed mixed `Beta`, `测试` and `试运行` labels from the visible platform
  navigation. Only registry-controlled pilot modules display `试运行`; formal
  modules have no test badge. The footer and HTTP response expose one release
  identifier, while old shell HTML is revalidated to avoid stale mixed assets.
- The root URL now redirects directly to `/platform/workbench`, so refresh keeps
  the current canonical module instead of falling back to the old hash shell.
  Approval badge counts come from one authenticated read-only summary endpoint.
- This release contains no schema migration, seed, import or application data
  mutation. The deployment gate uses an order-independent read-only fingerprint
  across all 44 `public` and `commercial_planning` application tables before and
  after release.
- Local verification passes the unified-shell test suite, TypeScript, the
  PostgreSQL-targeted Vercel build, copy-scope validation and `git diff --check`.
  Browser screenshots confirm one sidebar for the workbench and the embedded
  Forecast workspace. Database-backed legacy content requires the production
  Supabase public configuration and is verified after deployment.

## 2026-08-09 Cloud Release Candidate

- The latest native local workspaces are packaged into the unified Vercel app at
  `/platform-native/`: three-month Forecast Management and scorecard, Shipment
  Summary, Shipment Operation, Product Logistics & Pricing, BP monitoring,
  Business Analysis Review, Function Workspace and Prototype Management.
- Existing formal cloud modules remain the production sources of truth. Project
  Tracking, Sales & Inventory, Marketing Assets, approvals, Value Chain, BP,
  Master Data, permissions and cloud sync are not replaced by snapshot data.
- Forecast, Logistics and Business Analysis Review open the same-origin native
  pilot. The pilot is explicitly read-only and its browser drafts are not added
  to the Supabase sync document allowlist.
- The 1.45 MB pilot business snapshot is loaded only after the platform login is
  synchronized. `/platform-native/assets/data.js` is protected by a Next.js
  proxy and a ten-minute HMAC-signed access cookie. Static layout and styles
  remain CDN-delivered for fast module switching.
- A production-only sensitive `AUTH_SESSION_SECRET` was added to Vercel. No SQL,
  schema migration, seed, import or production row mutation is part of this
  release.
- Pre-release Supabase evidence covers 44 application tables with 4,242 total
  rows (3,533 public workspace rows and 709 commercial-planning rows). Exact row
  counts and order-independent content fingerprints must match after release,
  excluding separately explained concurrent user activity.
- Local verification passes 65 test files / 376 tests, the production Vercel
  build, copy-scope validation, `git diff --check`, and the full Playwright
  regression. Native module switch time is 155-256 ms in the local run, no
  document-level horizontal overflow is reported at desktop or 390 px, and no
  browser errors are reported.
- Current production observability baseline has three historical error groups:
  60 Supabase refresh-token reuse errors, six Prisma P2024 connection-pool
  timeouts and one older missing `DATABASE_URL` deployment error. The signed
  pilot asset guard deliberately avoids adding another Supabase call during
  native snapshot loading.

## 2026-08-09 Production Release

- Production deployment `dpl_7uGBgL1oN2GWvFvs63bZzUVDQhms` is `READY` and is
  aliased to `https://operations-planning-hub.vercel.app`.
- The deployed release contains the complete current native test workspaces for
  Forecast Management, Logistics Delivery, BP monitoring, Business Analysis
  Review and Prototype Management. The Vercel build copies only the native
  runtime `index.html` and `assets/`; design concepts and test screenshots are
  not served by the production application.
- No database migration, seed, import, destructive command or production write
  was executed during the release. Exact pre/post-release verification covered
  all 44 application tables and 4,242 rows using row counts plus
  order-independent JSON content fingerprints. The final comparison reported
  zero changed tables.
- Production health and route checks pass for `/api/health`, the platform shell,
  the native shell, BP, both Value Chain workspaces, both approval workspaces
  and Master Data. An anonymous request to
  `/platform-native/assets/data.js` receives a login redirect, so the business
  snapshot cannot be fetched without an authenticated platform session.
- Final local regression passes 65 test files / 376 tests, the production Vercel
  build, copy-scope validation, exact source-to-public native asset comparison,
  `git diff --check` and the complete headless browser workflow. The browser
  regression covers Forecast scorecard and entry, all three Logistics views,
  BP market/category/SKU drill-through, exact PO and Forecast context transfer,
  Business Analysis Review, Function Workspace and Prototype Management at
  desktop and mobile widths with no browser errors or document-level overflow.
- Verified cross-module contracts: BP to Forecast carries exact market, SKU and
  category filters; BP to valid PO carries the exact selected product and shows
  an explicit no-match state instead of substituting another product; Business
  Analysis Review reads confirmed source snapshots and opens Logistics and
  Credit Note details by the requested PO/CN and SKU dimensions; Prototype
  Management remains nested under Function Workspace.
- The native Forecast, Logistics and Business Analysis Review workspaces remain
  an authenticated read-only pilot. Their browser drafts use local or session
  storage and are not part of the cloud document allowlist. Formal Project
  Tracking, Sales & Inventory, Marketing Assets, approvals, Value Chain, BP,
  Master Data, permissions and cloud sync continue to use their existing cloud
  records and were not replaced.
- Production release logs contain no current runtime `error` or `fatal` entry.
  Historical observability still shows refresh-token reuse races, Prisma P2024
  connection-pool timeouts and rejected workspace-save retries. These are
  follow-up reliability items, not mutations introduced by this release.
- Remaining verification boundary: automated authenticated production visual
  testing cannot reuse the user's Google session from the connected browser.
  The deployed artifacts, public/auth boundaries, production routes, logs and
  database fingerprints are verified; a short signed-in production acceptance
  pass remains recommended for the account-specific UI path.

## Commercial Planning Copy Status

- On 2026-08-07 the copied commercial-planning workspaces were promoted from
  same-origin iframe modules to native Next.js platform routes. System Master
  Data, on-sale/new-product simulation, BP, monthly promotion approval, other
  approval and the approval workbench now share one platform layout, session,
  route history and database connection.
- The commercial iframe frame pool, embedded route activation and startup
  iframe preload were removed from `cloud-app/index.html`. Existing Project,
  Sales, Forecast, Logistics and Marketing workspaces remain intact in the
  generated operational shell.
- Approval tasks, BP notifications, monthly-promotion notifications and
  other-approval emails now deep-link to native platform routes. Session
  expiry returns users to the same native module instead of the old standalone
  route.
- Local production verification reports no iframe elements or browser console
  errors on native routes. Master Data overview response size is about 40 KB
  (previously 5.5 MB); the paginated on-sale workbook is about 0.5 MB
  (previously 10.8 MB). The desktop and 390px layouts have no document-level
  horizontal overflow.

- Source task: `019f1ea5-d45c-7b11-b62f-9486cdf2c0fe`.
- Source files, source AWS infrastructure, source authentication and source production data were not changed.
- `commercial-planning-app/` contains the copied Value Chain, new-product simulation, BP, monthly promotion approval, other approval and master-data functions.
- Settlement, settlement evidence, Gmail evidence, CN reverse and settlement review functions are excluded. The calculator's `SettlementMode` input remains because it is value-chain logic.
- The existing platform UI is unchanged by default. Local query flag `commercialPlanningPreview=1` exposes links from BP, Value Chain, monthly promotion approval, other approval and system master data to the copy.
- The platform `我的待办` now reads monthly promotion and other-approval queues from a permission-scoped, read-only aggregation API. Approval status, stage, requester, waiting time, approval-reminder email status and final-delivery email health are shown without duplicating workflow state.
- Task actions deep-link to the matching month/country or other-approval request. The email-record action opens the copied approval delivery dialog, preserving its existing retry workflow.
- The copy supports Supabase Google exact-email authentication through the current `operations-planning` workspace; `commercial_planning.app_user_roles` optionally refines business roles.
- Migration `20260805213749_commercial_planning_non_settlement_schema.sql` is prepared but intentionally unapplied. Formal source data migration has not started.
- Business UAT and migration gates are documented in `docs/COMMERCIAL_PLANNING_UAT.md`.

## Repository Context

- Remote: `https://github.com/chriszhenliangyao-cloud/Prototype-Tracker.git`
- Default branch: `main`
- Conversation work branch: `codex/operations-planning-updates`
- Existing repository stack: React Router 7, TypeScript, Cloudflare Workers, Wrangler
- Independent collaboration deployment: static Vercel app in `cloud-app/` with Supabase Auth, Postgres, RLS and Realtime
- Sales route: `app/routes/sales-inventory.tsx`
- Project route: `app/routes/project-progress.tsx`
- Existing product requirements: `docs/SALES_INVENTORY_REQUIREMENTS.md` and `docs/PROJECT_PROGRESS_REQUIREMENTS.md`
- Latest high-fidelity standalone reference: `/Users/julio/Documents/Analysis tool/sales-inventory-tool/index.html`

The standalone reference remains the design and behavior source for the React application. A copy is also deployed independently from `cloud-app/` so the current complete workflow can be used collaboratively while the React routes are migrated incrementally.

## Product Decisions

- `产销管理` and `项目跟进` are peer modules in one application shell.
- Both operational interfaces are displayed in Simplified Chinese; SKU codes, EOH, internal status values, and API field names remain stable.
- The default Sales view is a dense three-month demand-supply matrix with row and column totals, complete exceptions, and compact first-batch markers.
- First Batch applies only to new products. Forecast may exist before First Batch, while planned supply before the First Batch month is zero.
- The monthly planning workspace opens on a role-aware collaboration overview and keeps a fixed modal size across overview, plan entry, version history, and change history.
- Sales owns Forecast input; Supply owns Supply Plan input. Department submission locks that scope and advances the monthly workflow.
- Plan entry supports direct submission from the matrix. Confirmation summarizes changed SKUs, net impact, missing notes, stockouts, first-batch risks, and the next workflow step.
- All input surfaces automatically save drafts, including plan cells, notes, paste/import, bulk changes, temporary changes, reopen reasons, month closing, project creation, workstream updates, delays, and permission forms.
- Automatic saving is persistence only. Create, submit, publish, close, and permission-apply actions remain explicit and audited.
- Project Tracking is a cross-functional control tower. Department modules remain the source of truth for detailed tasks.
- Project workstream matrix cards use the colored left border as the single compact health indicator; redundant colored dots are reserved for surfaces without a status border.
- Project phase and project lifecycle are independent. The lifecycle states are active, paused, launched closeout, archived and cancelled. Archive/cancel remains the normal exit path; permanent deletion is an exceptional Super-Admin-only action.
- The default project matrix includes active, paused and launched-closeout projects. Archived and cancelled projects remain read-only in the History scope and the complete Project Ledger.
- Project lifecycle transitions require a reason, accountable owner and effective date, retain immutable status history, and support restoring archived or cancelled projects.
- Project deletion is shown only in the complete Project Ledger for active Super Admins. It requires a deletion reason plus exact model confirmation, rechecks the role in the action handler, removes project-owned drafts and current-module mappings, and preserves the complete deleted project snapshot in the versioned `projectDeletionAudit.v1` cloud document. Master Data products and Sales & Inventory records are not deleted.
- Moving a linked project to launched closeout or archive updates its Sales & Inventory product to launched and retains a First Batch snapshot. Cancelling a project does not rewrite Sales & Inventory data.
- Source-module controls only use button styling when a real destination exists. Sales & Inventory opens with the project model prefiltered; unconnected department sources are shown as non-interactive status labels.
- Project delays create immutable timeline revisions with cause, accountable owner, mitigation, complete before/after dates, and downstream impact. Repeated delays preserve the original baseline and every intermediate version.
- Sales & Inventory first-batch Forecast and Supply values feed the Project Supply workstream as read-only data.
- Account and permission management belongs to the application shell, not inside the monthly planning workflow.
- Exact-email authorization and tool-level account permissions are managed from one unified `权限管理` interface. Login authorization is immediate; tool responsibility changes remain an explicit saved action.
- The platform uses a grouped left navigation instead of a growing flat top-level module switch. The primary domains are `计划与交付`, `经营管理`, `市场增长`, `协同中心`, and `专业与管理`, with `我的工作台` as the personal default landing page.
- Child-module navigation is text-first. The repeated square letter/character marks are removed; category labels, active indicators, counts, test badges and risk badges remain.
- `计划与交付` contains four peer submodules: `项目跟进`, `产销管理`, `预测管理`, and `物流交付`. Forecast owns regional/channel forecast input and consensus versions; Logistics owns shipment, in-transit, customs, ETA, warehouse receipt and delivery exceptions.
- `经营管理` and `市场增长` are separate navigation categories shown with the same small category-label treatment as `计划与交付`. Their child modules use standard full navigation rows: Business Management contains `经营总览`, `BP达成`, `经营分析`, `Value Chain Simulation`, and `结算台账`; Market Growth contains `新品上市`, `营销活动`, and `营销物料`.
- Navigation order is `计划与交付`, `市场增长`, `协同中心`, `经营管理`, then `专业与管理`. Business Management places `Value Chain Simulation` and `结算台账` after `经营分析`.
- `结算台账` is the customer settlement control surface. It summarises amounts due, received, outstanding, overdue and pending allocation, and tracks billing period, deductions, reconciliation, collections, payment allocation and archive status by customer.
- Collaboration Center separates approvals into `月度促销审批` and `其他审批`. Monthly promotion approval connects promotion plans with value-chain margin, Sales & Inventory supply risk, and campaign readiness; non-promotion approvals retain project, forecast, supply and logistics decisions.
- The bilingual architecture is per-user `zh-CN` / `en-GB`, with one UI language displayed at a time. Stable codes and source-language user content remain canonical; translated views never overwrite originals. The shared terminology glossary and locale-aware date/number helpers are exposed through `cloud-app/i18n.js`.
- Department workspaces are source-of-truth maintenance surfaces. Project Tracking monitors project impact, the collaboration center aggregates decisions and actions, and System Management owns permissions, master data, integrations and audit.
- `样机管理` is an independent Function Workspace backed by each project's `prototype` workstream. Its ledger, readiness, owners, deadlines, tasks, blockers and next actions read and write the same project records; it does not maintain a duplicate sample dataset.
- The Prototype Management page is reachable from Function Workspaces and from the Prototype source control in Project Tracking. Viewing opens the project drawer on the prototype workstream; editing reuses the department update workflow and refreshes both surfaces after publish.
- `营销物料` is a project-row delivery matrix. Its six fixed standard columns are Product Introduction Slides, Packaging Design Final Draft, Product Sheet, Product & Packaging Images & Manual, POSM, and Social Copy & PR Release. All special materials are grouped in one final managed column so adding a type never widens the matrix.
- The grouped Special Materials column renders only materials explicitly assigned to each project. Unselected projects keep the cell blank in both the matrix and CSV export; assignment remains controlled from the header-level special-material manager.
- Marketing material names use English title case in both interface languages, while recognised abbreviations such as POSM remain uppercase. Saving a material updates the linked project's marketing workstream readiness, tasks, owner, next deadline and blockers.
- Each of the six standard marketing materials has a bilingual default delivery checklist. Project-specific item dialogs support check/uncheck, add, delete and restore-default actions; completion is calculated from checked items and stored with the material record.
- Checklist completion can advance ordinary not-started/in-progress work to completed, but review, missing and overdue remain explicit business states. Selecting completed checks every deliverable; reducing a completed checklist reopens it as in progress.
- Marketing Assets uses the approved compact default checklists: Product slide; Design document; Product page; and Product picture, A+ picture, White background product picture, White background packaging picture and Manual. Existing customized checklists are preserved until the user explicitly applies the new defaults.
- Marketing material status includes `not_required` (`无需求` / `Not required`). It requires a reason, keeps the checklist for later reuse, does not require an owner or DDL, and is excluded from project progress, risk, overdue, due-soon and Project Tracking marketing-readiness totals.
- The Marketing Assets matrix supports two persistent sort controls: Project/Product sorts by launch date and Total Progress sorts by calculated project completion. Each toggles ascending/descending; the default is launch date ascending (nearest launch first).
- Project Tracking is the source of truth for the Marketing Assets project list. Creating a project initializes all six standard assets as `not_started`; active, paused and closeout projects stay visible, while archived/cancelled records are retained but hidden from the current matrix.
- Project Tracking filters use one compact desktop row and a responsive two-row layout on narrower screens. Portfolio scope, project selection, health, phase, owner, critical-only and view controls stay aligned without internal overflow; changing scope clears the previous project-specific search.
- Project Tracking exceptions are opened on demand from a compact matrix/milestone header control. A right-side overlay drawer provides all/blocked/warning filters plus locate and handle actions, leaving the readiness matrix and milestone table at full workspace width.
- Sales & Inventory exceptions follow the same on-demand pattern: the matrix/trend header shows compact stockout, First Batch and gap counts, while a right-side drawer provides category filtering and direct cell location without reserving permanent page width.
- Monthly Sales & Inventory collaboration cards use dedicated `collab-workflow-*` styles. This isolates their horizontal deadline/status layout from the vertical workflow components used elsewhere in the platform and prevents clipped or overlapping card content.
- The Project / Model filter is a typeable native dropdown. Its options are limited to the selected portfolio scope and ordered by launch date, while free-text model, project-name and category search remains supported.
- Product categories use one canonical dictionary across Project Tracking, Sales & Inventory and access scope configuration: `Power Bank`, `Charger`, `Wireless Charger` and `Charging Cable`. The Chinese labels are `移动电源`, `充头`, `无线充` and `充电线`; existing `充电器` and `无线充电器` data is normalized on load. Product-category input is a dropdown rather than free text.
- Product identity is now governed by the copied commercial-planning Master Data. Business modules store the stable product ID and render the official SKU, name, category and lifecycle; Project Tracking no longer permits free-entry product identity when creating a project.
- Local Master Data workbook imports use the five governed sheets `EXR`, `Bom cost`, `RRP`, `Logistic cost` and `Margin data`. Calculation-only workbook tabs and their external-formula errors do not block or contaminate the governed import.
- The controlled Quick New Product Simulation flow is the only current free-entry product-creation path. A product becomes available to business-module selectors only after it is published into Master Data.
- Project launch dates remain project-owned timeline data so project delays and revisions do not silently rewrite the global product dictionary. Marketing Assets and Prototype Management inherit the selected project's product identity.
- Every successful shared-document save atomically updates `workspace_documents`, appends the complete payload to `workspace_document_versions`, and writes an audit event. Historical payload rows are read-only to authenticated members and cannot be updated or deleted from the browser.
- Restoring a cloud document is admin-only and creates a new version with `operation = restore` and the source version recorded; it never rewrites or removes the historical version chain.
- The browser persists unsynchronized mutations in `operationsPlanningCloudOutbox.v1`. Entries are cleared only after the database confirms the save; transient failures retry, while version conflicts preserve local content and require an explicit choice before loading the team version.
- The local Project Tracking matrix uses fluid percentage columns and displays the seven workstreams plus next milestone without horizontal scrolling at the 1280px desktop validation width. The milestone view follows the same full-width exception-drawer pattern.

## Current State

- The repository is on `codex/operations-planning-updates`.
- The independent combined tool is deployed at `https://operations-planning-hub.vercel.app`.
- Vercel project: `paytonppc-2101s-projects/operations-planning-hub`.
- Supabase project: `Operations Planning Hub`, ref `yzsmdwbuuwhsqrewecle`, region `eu-west-1`.
- Supabase provides exact-email Google authorization, workspace membership, shared versioned JSON documents, audit events and Realtime document notifications.
- The first administrator authorization is registered for `payton.ppc@gmail.com`. That address becomes the administrator on its first successful Google login.
- Google OAuth frontend and database support are deployed in production. Supabase reports the Google Provider as enabled.
- The existing React Sales route is still an earlier implementation and does not yet contain the full Chinese collaboration workflow from the standalone tool.
- The production Vercel cloud app includes the Project Ledger and project lifecycle management workflow described below.
- A local information-architecture test is implemented in `cloud-app/index.html`. It adds the grouped platform shell, a cross-module home workspace, complete forecast and logistics prototype pages, separate Business Management and Market Growth first-level domains with three submodules each, and structural pages for approvals, tasks, exceptions, function workspaces and system administration.
- The platform supports complete Simplified Chinese and British English UI switching from the application header. The selected locale is retained per account locally and synchronized to Supabase for authenticated accounts.
- Business Management includes a `结算台账` prototype with customer and market filters, five financial summary metrics, a compact settlement ledger and a complete reconciliation-to-archive workflow.
- Access Management now uses a four-layer RBAC model: platform role, one or more functional roles, data scopes and approval limits/authorities. The fixed tabs are Member Accounts, Role Templates, Data Scopes and Approval Access.
- The local permission workflow includes 16 reusable role templates, default-deny scope selection, independent publish/month-close/archive authorities, approval amount and validity limits, autosaved drafts and explicit apply with an immutable local audit entry.
- A bilingual Prototype Management workspace provides live project filters, portfolio metrics, a compact project prototype ledger, a seven-day task queue, CSV export and bidirectional Project Tracking links.
- A bilingual Marketing Asset Delivery Matrix provides a typeable project selector, launch-month/stage/owner/health filters, per-project and per-material totals, actionable project-gap summaries, CSV export, autosaved compact edit dialogs, and controlled special-material management.
- User-entered project reasons, blockers, mitigation notes, handover details and other source-language content are marked as canonical user content and are not changed by UI language switching.
- The latest platform-shell, bilingual, permission, settlement and Prototype Management changes are published to the production Vercel application.
- The Marketing Asset Delivery Matrix and its shared cloud document are published to the production Vercel application.
- The no-horizontal-scroll Marketing Assets matrix, project-gap workflow, compact editor and Project Tracking project synchronization are published to production.
- The Project Tracking filter bar with non-overlapping scope controls and a scope-aware project/model dropdown is published to production.
- The compact single-row Project Tracking filter, fixed four-category dropdowns, immutable document versions and durable sync outbox are deployed to production.
- Supabase is currently on the Free plan. Application-level version history protects against user error and frontend evolution, but provider-level disaster recovery still requires a paid daily-backup plan, PITR, or a scheduled off-site logical dump.

## Key Decisions

- Do not overwrite the existing React routes with the standalone HTML prototype.
- Port behavior incrementally into React components and preserve existing Cloudflare deployment structure.
- Keep product behavior and integration contracts separate from browser-only prototype persistence.
- Implement and verify on the conversation branch; merge through a pull request rather than pushing directly to `main`.
- Use a modular monolith for the collaboration platform: one Vercel host, one
  Supabase login session and one database project, while keeping domain tables
  separated by schema and service boundaries.
- Use exact-email authorization with Google OAuth. Supabase roles control workspace-level access; in-app account permissions control department/workstream scope.
- Calculate effective business access from `platform role + functional roles + data scopes + approval access`. New members receive only sign-in and Workspace access until business roles are assigned.
- Keep access records recoverable: disable or revoke accounts instead of hard-deleting them, and preserve every applied permission change for audit.

## Changed Files

- `cloud-app/index.html`
- `cloud-app/i18n.js`
- `cloud-app/cloud-sync.js`
- `cloud-app/api/config.mjs`
- `cloud-app/package.json`
- `cloud-app/vercel.json`
- `cloud-app/.env.example`
- `cloud-app/.gitignore`
- `cloud-app/README.md`
- `supabase/migrations/*.sql`
- `commercial-planning-app/**`
- `roadmap-local-test/**`
- `docs/COMMERCIAL_PLANNING_COPY_SCOPE.md`
- `docs/COMMERCIAL_PLANNING_UAT.md`
- `PROJECT_NOTES.md`

## Verification

- The commercial-planning copy passes TypeScript, 55 test files / 338 tests, production build and copy-scope validation.
- The target-only framework patch update is Next.js `16.2.11`; production dependency audit reports zero known vulnerabilities.
- All platform and commercial-planning migrations apply in order to a clean PostgreSQL 17 test database. The result has 34 RLS-enabled commercial-planning tables, zero settlement tables, and a working exact-email access resolver (`editor` maps to `SALES_MANAGER`).
- Local browser smoke tests pass for Value Chain, new-product simulation, BP, monthly promotion approval, direct other-approval entry and master data. No browser console errors were reported and copied navigation has no Settlement entry.
- The commercial-planning local preview now occupies the matching collaboration-platform workspace directly for BP, Value Chain, monthly promotion approval, other approvals, and commercial master data. The platform sidebar remains visible; the copied global header and all separate preview-entry buttons are removed in preview mode.
- Embedded-only UI adaptation aligns primary blue actions, borders, card radii, focus states and compact spacing with the collaboration platform without changing formulas, workflows, permissions, fields or APIs. Frame access is restricted to the configured platform origins through `frame-ancestors`.
- Monthly Promotion Approval and Other Approvals now rely on the platform sidebar as their only embedded module navigation. The copied internal two-button switcher and combined approval queue are hidden only inside the platform; standalone testing retains them.
- Embedded pages use tighter 12px operational typography, compact card padding and gaps, platform table headers, consistent form borders and no development indicator. Browser checks passed for both approval workspaces at 1280px.
- The local `我的待办` approval aggregation returns HTTP 200 with credentialed origin controls, renders the zero-state without hiding ordinary execution tasks, and opens `Approval delivery status` directly from `邮件记录`. Inline JavaScript syntax, all 338 tests and the Next.js production build pass.
- The existing platform production build still passes. Wrangler emits its existing local preferences log warning but completes with exit code 0.

- JavaScript syntax checks pass for `cloud-sync.js` and the inline application script.
- Local offline smoke test passes for the Chinese Sales view and Project Tracking module switch.
- Google login page JavaScript and visual smoke tests pass locally against the real Supabase configuration.
- Production login page shows only Google login, with no password fields, and the OAuth request reaches Google with the expected Supabase callback and `email profile` scopes.
- The cloud account status is mounted inside the persistent top application bar. Its compact trigger shows sync state only; email and logout are contained in a click-open account menu, with no fixed overlay positioning.
- The duplicate cloud authorization dialog and menu action have been removed. `权限管理` now provides one member table for Google email access, activation state, cloud role, tool role, department, workstream, project scope and account status.
- Project Tracking now includes portfolio-scope switching and a complete Project Ledger. Super administrators can pause, cancel, move projects into launched closeout, archive them after closeout confirmation, and restore historical projects without deleting project records.
- Lifecycle forms auto-save personal drafts; published transitions are recorded in both dedicated status history and the project activity timeline. Archived and cancelled projects disable workstream editing and delay registration.
- The launched-closeout flow updates the linked Sales & Inventory lifecycle and preserves the project's First Batch snapshot for historical review.
- New authorized emails are added to the responsibility draft with a safe default tool role of read-only. Revoking login keeps the responsibility record for audit and later recovery.
- Exact-email authorization upserts use the named unique constraint to avoid PL/pgSQL output-column ambiguity. Authorization UI errors are logged for diagnostics but shown to users as concise Chinese business messages.
- Anonymous requests to the authorization table and authorization RPC are rejected with HTTP 401/404.
- Authorization and revocation privilege logic lives in the unexposed `private` schema; public RPCs are `SECURITY INVOKER` wrappers.
- Supabase security advisor now reports only the existing versioned-document save RPC; it performs an explicit workspace editor/admin check.
- Supabase performance advisor reports only unused-index informational notices on the newly created, nearly empty database.
- Production root and `/api/config` return HTTP 200; browser smoke testing finds the cloud login screen without console errors.
- Local browser tests passed for project pause, cancel-to-history, restore, launched-closeout, archive, History scope filtering, Project Ledger rendering, and linked Sales & Inventory lifecycle updates. No browser warnings or errors were reported.
- Local browser regression passed for all 12 platform navigation destinations at a 1280px viewport. Each destination renders the correct context and heading without document-level horizontal overflow.
- Forecast Management and Logistics Delivery render their filters, summary metrics, dense operational tables, workflow status and clickable test actions. Existing Sales and Project pages remain reachable under `计划与交付`.
- Platform permission boundaries pass locally: a super administrator sees `系统管理` and `权限管理`; switching to a department editor hides both and routes away from the restricted system page.
- Business Management and Market Growth navigation regression passes locally. All six child pages render the correct active state, platform context and page heading at 1280x720 without document-level horizontal overflow. The compact sidebar shows every navigation domain at 720px height without scrolling.
- Local verification passes for the reordered navigation, split approval pages and Value Chain Simulation. The simulator recalculates unit contribution and margin on input and preset changes; all navigation categories fit exactly within the 720px viewport without a sidebar scrollbar.
- Bilingual regression passes for all 19 platform destinations in English at 1280x720. No Chinese system strings remain outside the deliberate `中文` language option, no page has document-level horizontal overflow, and the compact sidebar fits without scrolling.
- The new Settlement Ledger passes Chinese and English checks at 1280x720. Its eight-column compact table, five summary metrics and workflow panel fit without table, document or sidebar overflow.
- English audits pass for Add Project, Access Management, all four monthly planning tabs, Project Drawer tabs, Delay registration, Project Ledger, Project Status Management and Department Update dialogs.
- Account-switch testing confirms that different local accounts restore their own language preference. Switching back to `zh-CN` restores the original Chinese UI and browser title without changing user-authored content.
- The four Access Management tabs keep the same 1240 × 662 px dialog footprint at a 1280 × 720 viewport. Role-template assignment, mutually exclusive data scopes, approval authorities, amount editing and autosave have passed local interaction checks.
- Prototype Management passes local tests for Function Workspace entry, search/reset filters, project drawer opening, department editor launch, publish-and-refresh behavior, reverse source navigation, prototype-owner permissions and Chinese/English rendering at 1280 × 720 without document or table overflow.
- Marketing Assets passes local Chinese and English browser tests for all six standard columns, title-case rendering, grouped special-material management, item editing, matrix totals, and synchronization back to the Project Tracking marketing workstream.
- At a 1280×720 viewport, the Marketing Assets matrix and its container are both 1040px wide, document width equals viewport width, and all nine headers use static positioning. The complete horizontal matrix is visible without scrolling or sticky-column overlap.
- Project-to-Marketing-Assets synchronization passes an end-to-end local test: creating `MKT-SYNC-01` in Project Tracking automatically adds the same project to the Marketing Assets project selector and matrix with six standard materials initialized as not started.
- The project total-progress control opens a complete gap list with direct update actions. The material editor is 700×299px in the tested desktop state, with four compact fields on one row and a short full-width note field.
- The checklist-enabled material editor passes add/delete/reset, autosave and persistence tests. A five-item material changes from `5/5 · 100%` to `4/5 · 80%`, then to `4/6 · 67%` after adding an item; reopening restores the saved checklist. A review item remains in review at `5/5 · 100%`.
- Marketing Assets typography is increased to 8px column headers, 9px project-row headers and 8px status values while the 1040px matrix still fits its container without horizontal scrolling.
- Sidebar module marks compute as `display: none` in Chinese and English; module labels and right-aligned status/count badges remain correctly aligned.
- Marketing Assets sorting passes all four local order checks with six projects: launch date ascending/descending and progress ascending/descending. Active headers expose `aria-sort`, inactive headers show `↕`, and launch-date ascending persists after reload as the default/current preference.
- Project Tracking filter regression passes at 1280×720 in Chinese and English. Scope labels and counts do not overlap or truncate, the filter bar and document have no horizontal overflow, and six current-scope project options are available from the Project / Model dropdown.
- Selecting `PX51` through the Project / Model field reduces the matrix to one project; switching portfolio scope clears the project condition and restores the complete scope result.
- JavaScript syntax checks pass for `cloud-app/i18n.js`, `cloud-app/cloud-sync.js`, and the inline application script.
- The user-locale preference migration is applied to Supabase with RLS. Anonymous table access is revoked; authenticated users receive only select, insert and update privileges, constrained by own-user policies.
- Vercel production deployment `dpl_D12a4aXTgi75ThZgfMuiUYBHNiFC` is READY and aliased to `https://operations-planning-hub.vercel.app`.
- Production root and `/api/config` return HTTP 200. Release markers for Prototype Management and Settlement Ledger are present in the deployed HTML.
- Production browser smoke testing confirms the Google-only login screen has no password input, the Function Workspace opens the independent Prototype Management page, English switching renders the expected navigation and heading, and the 1280px viewport has no document-level horizontal overflow.
- Vercel production deployment `dpl_8AL1mrmTU6S3j7gdsa9fS43xpa8J` is READY and aliased to `https://operations-planning-hub.vercel.app`. Production root and `/api/config` return HTTP 200.
- Production Marketing Assets regression confirms the 1040px matrix fits its 1040px container, all nine headers use static positioning, the project selector is present, and WAL101 opens a five-item actionable gap dialog.
- Vercel production deployment `dpl_7NJmy2be6AUdcbnFM8aivQLXXkid` is READY and aliased to `https://operations-planning-hub.vercel.app`. Production root and `/api/config` return HTTP 200.
- Production regression confirms no sidebar module marks are visible, matrix header/project/status fonts compute to 8/9/8px without horizontal overflow, and the PX51 image/manual dialog renders five default checklist items with add, remove and restore-default controls.
- Vercel production deployment `dpl_APYCHknM1o5ojms85HvZPB764enY` is READY and aliased to `https://operations-planning-hub.vercel.app`; production root returns HTTP 200.
- Production Marketing Assets opens with launch-date ascending order (`PX51`, `WAL101`, `WM321`, `PM61-Black`, `P51L-P2`), exposes correct active/inactive `aria-sort` states, and sorts progress from 3% to 96% on the first progress-header action without document or matrix overflow.
- Vercel production deployment `dpl_A47N1L7aSkvAvwPfxddig45vipvj` is READY and aliased to `https://operations-planning-hub.vercel.app`; production root and `/api/config` return HTTP 200.
- Production Project Tracking shows all portfolio-scope labels without clipping or overlap, exposes five current-scope project/model dropdown options in the base production dataset, and filters the matrix to the selected `PX51` project without document or filter-bar overflow.
- Local Project Tracking at 1280x720 renders all seven filter groups in a 57px bar with matching 1042px client/scroll widths and no document overflow. At 1100px the filter itself wraps cleanly into two rows without internal overflow.
- The Add Project category control is a `select` with exactly four options in Chinese (`移动电源`, `充头`, `无线充`, `充电线`) and English (`Power Bank`, `Charger`, `Wireless Charger`, `Charging Cable`). The Sales & Inventory category filter exposes the same four values plus the all-category option.
- Local interaction checks pass for selecting `Charging Cable`, restoring the draft to `Power Bank`, switching languages and filtering Sales & Inventory. Browser console warning/error logs are empty.
- Migration `immutable_document_versions_and_recovery` is applied in production. All seven current shared documents were backfilled; each current payload is byte-equivalent at the JSON level to its matching archived version and RLS is enabled on the archive table.
- A rollback-only production durability probe passed: save version 1, save version 2, restore version 1 as version 3, verify the restored payload and three archived rows, then roll back. No probe document, archive or event remains.
- Supabase security advisor no longer reports the public save RPC as an executable `SECURITY DEFINER` function. Public save/restore wrappers are `SECURITY INVOKER`; checked private implementations retain explicit authenticated workspace-role validation.
- Production deployment `dpl_5PhLJJGKNa763U8vxt7D7u1B1FC8` is READY and aliased to `https://operations-planning-hub.vercel.app`. Production root and `/api/config` return HTTP 200, required category/filter/outbox markers are present, and the public login page reports no browser warning or error logs.
- Commercial-planning embedded review URL: `http://127.0.0.1:4173/index.html?offline=1` while the copied application and `npm run dev:static` platform server are running. Local embedding is enabled by default; add `commercialPlanningPreview=0` only to inspect the original placeholder workspaces.
- `Value Chain Simulation` now contains two in-page views backed by the complete copied modules: `On-sale Product Simulation` loads `/`, and `New Product Simulation` loads `/simulation`. The copied on-sale page, standalone navigation, empty-state return link and export filename use the new on-sale name; workbook formulas and the internal worksheet structure remain unchanged.
- Local browser regression passes for both value-chain views at 1280x720. The parent platform remains at 1280/1280px width and 720/720px height, the tab bar no longer sits behind the sticky platform header, iframe routes and selected states stay aligned, and browser warning/error logs are empty.
- The commercial-planning copy passes 55 test files / 339 tests after adding the simulation-name regression, and its Next.js production build completes successfully.
- The platform module name now renders as `价值链测算` in Chinese and translates back to `Value Chain Simulation` in English across the sidebar and context header. The embedded on-sale overview uses the platform's compact header/action pattern plus a four-column summary strip; downstream filters, calculation table and workflows are unchanged.
- Browser regression at 1280x720 confirms the redesigned on-sale summary fills the available width, the platform remains at 1280/1280px and 720/720px without overflow, Chinese/English module naming switches correctly, and warning/error logs are empty. All 339 tests and the production build still pass.
- Local Master Data integration exposes the authenticated `GET /api/platform/master-data-options` contract with nine active products, four canonical categories, four markets and scoped channel/customer/distributor dimensions.
- The local seed includes the six collaboration-platform products plus the copied calculator's three products. All nine have complete BOM and RRP records; platform products use matching logistics-size keys, and the wireless-charger route includes an Italy commercial configuration.
- Project creation now provides a nine-option Master Data selector. SKU, name and category are read-only and auto-populated; PX51 shows First Batch Forecast/Supply data, while launched P61L-P2 does not show First Batch.
- September promotion planning exposes eight complete product-channel candidates from the shared data service. New Product Simulation reports three unlaunched rows and lists PX51, WAL101 and WM321 after expanding the formal list.
- The local database initializer now safely quotes workspace paths containing spaces. `npm run db:init` completes and logs the actual nine-product catalog.
- The copied application passes 56 test files / 340 tests and a production build. The platform inline script and bilingual dictionary pass syntax checks; the 1280x720 browser audit reports no document overflow and no console warnings or errors.
- Marketing Assets local regression confirms all four revised default checklists, the new `无需求` status, `--` completion display, disabled owner/DDL fields, required reason, progress-denominator exclusion and synchronization into the Project Tracking marketing workstream. A `5/7` project correctly recalculates to `4/6` when one completed node is marked not required, then restores to `5/7` when re-enabled.
- Project Tracking local regression at 1280x720 confirms the persistent exception sidebar is removed, the full matrix has equal client/scroll widths of 1058px, all seven workstreams and next milestone are visible, the milestone table also has equal client/scroll widths, and exception filtering, locate highlighting and handle navigation work without console warnings or errors.
- Sales & Inventory local regression at 1280x720 confirms the permanent exception column is removed and the demand-supply matrix fills the 1058px workspace with equal client/scroll widths. The drawer shows 11 current items with `缺货 3 / 首批 3 / 缺口 5` filters; locating an item closes the drawer, switches to matrix view and highlights the matching SKU/month cell.
- The monthly collaboration overview renders four equal 303px workflow cards inside its 1214px grid. Deadline/status headers use horizontal writing mode and computed layout inspection reports no overlap between header, title, metadata, scope and action regions.
- Final inline-script, `i18n.js`, `cloud-sync.js` syntax checks and `git diff --check` pass after the Sales exception and collaboration-layout changes.
- The supplied `Master data.xlsx` was imported into the local copied application's test database through the native Master Data API after creating `/private/tmp/master-data-audit/backups/dev-before-master-data-import-20260806.db`. The import reported 634 imported values, 18 updates, zero skipped rows, zero validation errors and zero duplicate keys.
- The local active Master Data catalog now contains 12 countries, 66 products, 304 RRP rows, 96 expanded logistics rows and 108 operational-margin rows. The import created one read-only Master Data archive; the source workbook and production/cloud data were not changed.
- System Management renders the imported workbook coverage, and a full platform refresh still reports `Master Data 已同步 · 66 个可用产品`. Add Project exposes all 66 governed products in its dropdown, including workbook rows `P72-P1`, `C22-P1` and `PU41`.
- Targeted Master Data parser, platform-options and workbook-export regression passes with 3 test files / 21 tests.
- Local Project Tracking deletion regression passes in an isolated browser origin: Super Admin Ivy sees one delete action per ledger row; ordinary member Leo sees none. Empty reason and incorrect model confirmation are rejected, a confirmed deletion persists after reload, and the linked project disappears from the Marketing Assets matrix while its Master Data product remains untouched.
- The bilingual deletion confirmation dialog renders without overlap at 1280x720. `cloud-app/index.html`, `i18n.js` and `cloud-sync.js` pass JavaScript parsing, and `git diff --check` passes.
- Marketing Assets special-material visibility passes local regression with five projects: the three assigned projects render Channel Training Kit, while the two unassigned project cells contain no button or text. The management dialog reports three of five projects selected and explains that unselected rows remain blank.
- Sales & Inventory current inventory is now edited through a controlled adjustment dialog opened directly from the demand-supply matrix. Super Admin, Planning Admin, Supply Planner and Logistics roles can adjust it; Sales Forecast and other read-only roles see the inventory value without an edit action.
- Each inventory adjustment requires a non-negative whole-number result and a reason, supports loss, transfer-in, transfer-out, stocktake and other classifications, and records before/after values, delta, business owner, operator, timestamp and optional reference. Draft fields autosave, while confirmed changes are included in the shared sales-plan document, recent inventory history, revisions and the plan change log. Restoring a historical plan keeps the current live inventory, and plan-version EOH comparisons use the same current-inventory basis so inventory corrections are not misreported as forecast impact.
- Isolated browser regression changed P61L-P2 from 1,700 to 1,600 and confirmed current-inventory total 11,450 → 11,350 plus rolling EOH 1,100/700/-700 → 1,000/600/-800. Reload preserved the value and audit entry; Sales Forecast saw zero adjustment actions while Supply Planner saw all six. The modal fits at 1280x720 without overlap, and the inline application script parses successfully.
- Vercel production deployment `6xUSHmS3A8tPGTcJjh6MWfeUvqya` is READY and aliased to `https://operations-planning-hub.vercel.app`. Production root and `/api/config` return HTTP 200; the deployed `index.html` SHA-256 exactly matches the local release (`fe0c24f91ff37a56d4adef7939b40cb95a02cff1e29259c89b067741732c342c`) and contains the governed current-inventory adjustment UI, permission checks and audit actions. No Supabase schema or business-data migration was performed for this release.
- Independent commercial-planning cloud UAT was explicitly authorized on 2026-08-06. Supabase migrations `commercial_planning_non_settlement_schema`, `commercial_planning_runtime_role` and `commercial_planning_foreign_key_indexes` are applied to the Operations Planning Hub project. The result is an isolated 34-table `commercial_planning` schema with RLS, no Settlement tables, a server-only runtime role and no remaining unindexed commercial-planning foreign keys.
- The local copied test database was copied transactionally into the empty target schema without reading or writing the source tool. Verified cloud counts include 12 countries, 70 products, 309 product-country RRP rows, 100 logistics-cost rows, 112 operational-margin rows, one Master Data archive, one scenario and one autosave draft. BP and approval workflow tables are ready and intentionally empty.
- The copied application has no source-tool domain, Worker URL or source database dependency. Approval-link fallbacks now use local development only; production links depend on the copied application's own `APP_URL`. The platform reads the copied app endpoint from its own `COMMERCIAL_PLANNING_URL` runtime setting.
- Copy-scope validation, 56 test files / 340 tests, the PostgreSQL Vercel build, database role connectivity and cloud data reconciliation all pass.
- Independent commercial-planning deployment `9aeb7v8dWvHgEZHDgUdBcSj9vezx` is READY and aliased to `https://operations-commercial-planning-test.vercel.app`. Its `/api/health` endpoint returns HTTP 200, unauthenticated root requests redirect to the app-owned Google/Supabase login, and CSP permits framing only by itself and `https://operations-planning-hub.vercel.app`.
- Main-platform deployment `AN6KPwjcxV3mH6KogSiiXW8TjTyR` is READY and aliased to `https://operations-planning-hub.vercel.app`. Production `/api/config` returns the independent copied-app URL, and the deployed `index.html` SHA-256 exactly matches the complete local test release (`dcce9b9e671c25fe6e9ccd8933357d1ee0f630861fad619b86aaa834099b16bd`).
- Supabase OAuth accepts the copied callback `https://operations-commercial-planning-test.vercel.app/auth/callback`. The Operations Planning workspace currently authorizes four exact-email members, including one administrator; copied-app authorization is resolved from the same workspace membership without a second user directory.
- Google OAuth cannot run inside an iframe. The copied application now detects embedded login requests and renders a compact authorization gate instead of navigating the iframe to Google. First use opens Google in a user-initiated top-level popup; successful callback verifies workspace membership, stores only the copied app's own Supabase cookies, opens `/auth/embedded-complete`, closes the popup and reloads the original embedded route. No access or refresh token is transferred between the platform and copied application.
- Commercial-planning deployment `6eYqPy67cghTDU5SX97tevKdP4Uz` is READY and aliased to `https://operations-commercial-planning-test.vercel.app`. Production checks confirm embedded login HTTP 200 with no Google iframe URL, health HTTP 200 and embedded-complete HTTP 200. Full regression remains 56 test files / 340 tests, and the PostgreSQL production build passes.
- Option B modular-monolith phase 1 is deployed at `https://operations-planning-hub.vercel.app`. The Next.js host now serves the complete collaboration shell at `/platform/index.html`, the on-sale value-chain module at `/commercial/value-chain`, and the remaining copied modules through same-origin internal routes. Runtime configuration points `commercialPlanningUrl` back to the same platform origin.
- The platform's existing Supabase browser session is exchanged only with the same-origin `/auth/platform-session` endpoint to establish the server-side Supabase cookie used by commercial-planning routes. External origins are rejected with HTTP 403; a same-origin malformed request reaches validation and returns HTTP 400. No token is sent to another domain.
- The production Vercel project now carries the commercial-planning PostgreSQL database URL and Supabase auth configuration. The `commercial_planning` schema remains a bounded domain containing 34 RLS-enabled non-settlement tables; no platform document tables were flattened or migrated.
- Unified production deployment `dpl_BBqocFMdhkC2qaVongJukitUoAug` is READY and aliased to `https://operations-planning-hub.vercel.app`. Root redirects to `/platform/index.html`, `/api/config` returns the same-origin commercial-planning URL, `/api/health` returns HTTP 200, and unauthenticated iframe requests render the platform-owned login fallback instead of a Google 403 page.
- The former `operations-commercial-planning-test.vercel.app` deployment remains available only as a temporary rollback/UAT reference. The collaboration platform no longer calls it at runtime, and the source tool remains untouched.
- Outbound approval email transport remains intentionally unconfigured in the copied deployment, so delivery records can be created but actual email sending reports `NOT_CONFIGURED`. No source-tool SES or other source-cloud credential was reused.
- The Supabase project is on the Free plan. Application versioning and audit records protect platform documents, and the copied schema preserves its own archives/audit rows, but Free-plan database recovery is not a guaranteed off-site backup. Before production cutover, add scheduled logical exports or upgrade to a plan with managed daily backups/PITR.
- Unified-login incident on 2026-08-06 was traced to the same-origin session bridge rejecting valid short opaque Supabase refresh tokens as incomplete. Access-token sanity validation remains at 20 characters, while refresh tokens now accept any non-empty value and are authoritatively validated by Supabase `setSession`.
- Commercial-planning session exchange is now isolated from collaboration-shell startup. A temporary exchange failure is logged and handled by the commercial module's own login fallback instead of replacing the entire platform with `云端连接失败`.
- Regression coverage includes short refresh tokens, access-token length validation and blank/oversized token rejection. The complete suite passes 57 test files / 343 tests, the Next.js production build passes, generated and source `cloud-sync.js` hashes match, and `git diff --check` passes.
- Unified production deployment `dpl_9MijcTrCnpXvUD3MN4unqLKtNTUZ` is READY and aliased to `https://operations-planning-hub.vercel.app`. Health returns HTTP 200, runtime configuration remains same-origin, a same-origin fake short refresh token reaches Supabase validation and returns HTTP 401 rather than local HTTP 400, and an external-origin exchange remains blocked with HTTP 403.
- Fresh-browser production smoke testing reaches the Google-only platform login gate at `/platform/index.html` without the full-page cloud-connection failure and without browser warnings or errors.
- Copied commercial-planning modules now use a persistent same-origin iframe stage. Loaded instances are kept alive across navigation instead of being destroyed and server-rendered again, preserving unsaved in-module UI state and making repeat switches immediate.
- After platform authentication, accessible copied modules are preloaded in staggered background frames: on-sale and new-product simulation, BP, monthly promotion approval, other approvals and Master Data. Preload respects platform module permissions, and the visible module switches by hiding/showing cached frames rather than recreating them.
- A compact loading progress treatment covers the remaining first-load window. Frame readiness and active route are exposed as DOM state for diagnostics without exposing credentials or business data.
- Performance regression coverage passes 58 test files / 346 tests. Inline platform JavaScript parses, the generated platform shell is byte-identical to its source, the Next.js build passes, and `git diff --check` passes.
- Unified production deployment `dpl_EbqkUgVSAtFF3rpaNBcabbePztHX` is READY and aliased to `https://operations-planning-hub.vercel.app`. The deployed shell contains the persistent frame cache, all six governed preload routes and cached value-chain switching; `/api/health` returns HTTP 200.
- Smart remote-update handling is complete locally. Non-conflicting team changes apply automatically, unrelated module updates stay silent, relevant changes use one batched auto-dismiss toast, and repeated document versions are deduplicated. Only same-document local/remote conflicts remain persistent, with difference review, keep-local, use-team and 30-minute snooze actions; unresolved conflicts also remain available from the account sync menu.
- Remote updates now rehydrate the active Sales, Project Tracking and Marketing Assets state without a page reload. Pending local data is never overwritten: conflict resolution archives recovery data before applying the team version, and further autosaves pause until the user explicitly chooses a version.
- Smart-sync regression passes 59 test files / 350 tests; browser-script syntax checks, generated/source shell hashes, the Next.js production build and `git diff --check` all pass. Production `operations-planning-hub` still serves the previous generic update prompt because the Vercel device credential expired before the final deployment; a fresh device authorization is required before release verification.
- During target-link diagnosis, deployment `dpl_2EWCMngdPAADLGWVrBzaqfDYsW67` was built on the former standalone copied-app project. It made no schema or business-data migration and does not change the unified platform's runtime dependency direction; the unified production alias was not changed.
- Project Tracking now supports a governed `eol` lifecycle status rendered as `已退市（EOL）` in Chinese and `EOL` in English. Active, paused and launched-closeout projects can move to EOL; EOL projects are read-only historical projects and can be explicitly reactivated from the project register.
- An EOL transition records the reason category, detailed reason, responsible owner, EOL effective date, operator and immutable status history. The project remains in the register with launch and EOL dates, while current tracking, exception/KPI calculations, Prototype Management and Marketing Assets exclude it. Master Data, Sales & Inventory and project history are preserved.
- Local interaction regression moved PX51 to EOL and verified current-project count 5 → 4, history count 0 → 1 and Marketing Assets removal, then reactivated it to restore the test fixture. Chinese/English labels, the six-column project-register summary and the EOL reason options render without overflow at 1280×720; browser warning/error logs are empty. Full regression passes 60 test files / 354 tests and the production build completes successfully.
- Unified production deployment `dpl_6bpPsCffNDPb8SKpYVUXpDFo3Vaa` is READY and aliased to `https://operations-planning-hub.vercel.app`. The complete local test version was deployed without a database schema or business-data migration. Production `/api/health` returns HTTP 200; deployed assets contain the smart remote-update policy, conflict-resolution actions, EOL lifecycle/status routing and active-module rehydration event, while the former generic always-visible sync prompt is absent.
- An isolated Product Roadmap prototype is available in `roadmap-local-test/`. It places `产品路线图` first under `计划与交付` and reproduces the current platform shell without changing `cloud-app/` or any cloud deployment.
- The prototype imports the existing Roadmap's five product lines, 44 product nodes, two replacement relationships, product images and complete Chinese/English weekly archives from a checksum-verified local copy. The source HTML, baseline JSON and product-image directory remain read-only and unchanged.
- Roadmap operations use one continuous 2024-2027 price/time canvas, weekly update ledger and immutable version-history view. The former summary strip and 2026/2027 switch are removed; users pan the canvas horizontally with pointer drag or the native scrollbar.
- The source-style weekly update panel remains visible on the right by default. It preserves bilingual flip, edit/review, automatic record date, weekly theme, per-product dated entries, image paste/drop/upload, save/translate/archive, history display and local archive deletion. The added hide control collapses the panel without deleting data, and a compact toolbar action restores it.
- Weekly Chinese/English switching now uses the source Roadmap's two-stage 3D flip-out/flip-in transition, with a reduced-motion fallback. The language content changes only at the card midpoint so the panel reads as one physical card being turned.
- Product cards now expose product specifications, KSP and Master Data mapping status without opening the drawer. Product, drawer and Weekly Update images open in one clear large-image dialog. EOL cards use a neutral low-emphasis treatment and recover contrast only on hover/focus.
- The Roadmap EOL filter dot, detail status tag, weekly editor and history rows now use the same neutral grey vocabulary as the weakened EOL cards; red remains reserved for active risks and exceptions.
- Roadmap Master Data selection now reads a 66-product local UAT catalog snapshot aligned with the platform import instead of the former 13-item prototype list. Existing and new-product workflows use a custom searchable combobox that opens the complete catalog, filters by SKU/name/category/status, reports result counts and retains exact-selection validation. Known legacy prototype model aliases migrate once to current Master Data SKUs.
- Product image management is embedded in the compact product editor. Users can upload or replace PNG/JPG/WebP files, remove an image, use a URL/local asset path, choose fit/fill/natural sizing, set the focal position and tune 70%-140% scale with a live preview. Browser uploads are resized to a maximum 1400px side and compressed to WebP before local-draft persistence; source Roadmap images remain read-only.
- Product details use separate compact read and edit states instead of displaying duplicate information and a long form together. The editor updates Roadmap name, lifecycle, exact/quarter launch date, RRP, specifications, KSP and image path, and can link, change or clear an existing Master Data product through a validated typeable dropdown. Mapping conflicts and free-text values outside Master Data are rejected; every accepted update creates a local immutable version.
- Product placement is now business-rule driven rather than trusting decorative source coordinates. Full dates, month/year values and quarter values are parsed chronologically across one 2024-2027 timeline; undated items use a dedicated final lane. Cards are grouped into strict high-to-low RRP layers, while same-price products receive additional subrows only when their time positions collide. The canvas gains internal vertical scrolling only when product density or the global 80%-135% card scale requires it. Price grid lines and replacement relationships follow the final calculated positions.
- The lifecycle/status filters replace the redundant Roadmap legend in the canvas heading. Product/model search, global card scale, weekly-panel restore action and the three view tabs share the compact top control band, removing the former second control row and increasing usable Roadmap height.
- Product creation is governed by a Master Data dropdown. The local test includes the source-mapped product identities plus `P76-P1-W · MagPro Slim 10K-White` from the current platform context so the add-product workflow can be tested without free-text product identity.
- All prototype mutations remain under browser key `operationsPlanningRoadmapLocalTest.v1`. Restore creates a new local version instead of rewriting history; reset deletes only that test key. No Supabase, Vercel, source Roadmap or production platform data is written.
- Desktop and mobile browser regression passes for all three views, continuous timeline dragging, exact month ordering, strict rendered price/time ordering, global card resizing, compact product editing, direct Master Data mapping, product and Weekly Update image lightboxes, weekly update save/archive/history, animated bilingual switching, weekly panel hide/restore, version growth and drawer/dialog boundaries. All five product lines have zero overlap, price-order violations or time-order violations at both 100% and 135% card sizes; the compact editor is three columns on desktop and one column on mobile, with no drawer or document-level horizontal overflow. Browser warning/error logs are empty.
- The latest Roadmap edit regression confirms 66/66 Master Data options, SKU filtering (`PX` -> 4 products), local upload-to-WebP preview, grey EOL styling, and zero overlap/price/time violations across all five lines. At 390x844 the add-product dialog, options list and product editor stay within viewport and drawer bounds with no horizontal overflow.
- Product Roadmap now defaults to `结构总览 / Structure`, a fixed price-by-time matrix that separates portfolio scanning from product-detail reading. It renders only occupied business price tiers, extends the timeline from 2024 through the current/next quarter and any later product quarter, and places every visible product inside its governed price/time cell. Compact nodes show product name, Master Data model, RRP, lifecycle and update/relationship markers; images, specifications, KSP and history remain one click away in the existing drawer.
- Roadmap display is now intentionally limited to `结构总览 / Structure` and `精确坐标 / Precise`; the intermediate Product cards mode and its obsolete collision-layout code are removed. Existing browser drafts that still reference that removed mode safely normalize back to Structure. The global 80%-135% card scale remains available only for Precise, while Structure keeps the right-side Weekly Update panel and bilingual axis guidance.
- The product-image editor now spans the full three-column edit form instead of being compressed into one column. At desktop drawer width it uses a stable 124px preview plus a flexible control area: upload/remove share one action row, the image path gets a full row, fit and focal position form a balanced pair, and scale uses the complete row. Responsive rules retain the compact two-column and single-column fallbacks.
- Local 1280x720 regression across all five product lines confirms visible node counts of 14/8/4/11/7, zero horizontal or vertical matrix overflow, zero out-of-canvas nodes and no cell containing more than two products. The matrix remains zero-overflow in Chinese and English, both modes persist and switch correctly, structure nodes open the original Overview / Project execution / Change history drawer, and the reorganized image controls fit the 540px drawer without overlap. The source Roadmap HTML, copied baseline and product images remain checksum-identical and unchanged.
- Source integrity verification remains exact: Roadmap HTML SHA-256 `46a9c0c65d59178fedccbb5e756fef05c2ed431d8b9ee32f4d9c1630f9eae21a`; source and copied baseline JSON SHA-256 `0494fc66e321f8690a9c59b72583a1b04a059a39f010d3a2e523719a9f5f0c72`; copied product images are byte-identical by recursive comparison.
- Platform access governance now has one protected `平台所有者 / Platform Owner` above Super Admin. The Operations Planning workspace owner is `payton.ppc@gmail.com`; a partial unique index prevents a second owner, RLS exposes governance rows only to workspace members, and ownership transfer remains an explicit owner-only audited action.
- Super Admin reuses the existing workspace `admin` boundary, while ordinary accounts use `editor`. The production owner role is active, and Super-Admin promotion/demotion is available only through the dedicated owner-authorized governance RPC. Protected-role edits outside that path are rejected at the database boundary.
- Shared-data conflict handling now performs a three-way comparison against the last synchronized base. Non-overlapping changes merge automatically; actual collisions identify module, record, field, local value and team value. Access conflicts identify the Platform Owner as final authority, and non-owners cannot overwrite the team permission document with a local copy.
- Project view state, workstream drafts and permission-form drafts are account-scoped local data and are no longer synchronized as team documents. Legacy queued local-only mutations are removed from the cloud outbox, preventing `activeUserId`, personal views and unfinished drafts from creating false team conflicts.
- Platform-owner governance regression passes 61 test files / 361 tests, JavaScript parsing and the Next.js production build. Local 1280×720 browser inspection confirms the owner label, final-authority context, protected-role controls and fixed permission-dialog boundaries.
- Unified production deployment `dpl_3woweVjW9vpntwzQCW8CZkKemjQY` is READY and aliased to `https://operations-planning-hub.vercel.app`. Production health returns HTTP 200; deployed assets contain the owner, detailed-conflict and account-scoped draft markers. Super-Admin cloud elevation is explicitly guarded and does not call an unapproved production permission path.
- Owner-only Super-Admin management is complete locally. The prepared migration adds persistent UPDATE/DELETE protection triggers to `workspace_authorizations` and `workspace_members`, plus the audited `set_workspace_super_admin` SECURITY DEFINER RPC. Promotion requires an already-authorized, activated workspace account; demotion returns the account to editor. Super Admins cannot alter, demote or revoke any Super Admin or the Platform Owner.
- The permission UI now locks every protected-account field for non-owners, and the cloud client uses only the dedicated governance RPC for Super-Admin promotion/demotion. Full regression passes 61 test files / 361 tests.
- Production migration `20260807083540_platform_owner_super_admin_control` is applied. It installs enabled UPDATE/DELETE protection triggers on `workspace_authorizations` and `workspace_members`, plus the audited owner-only `set_workspace_super_admin` SECURITY DEFINER function and public invoker wrapper. The trigger also rejects non-owner attempts to assign `admin` and prevents workspace-account moves. Existing account roles remained unchanged: authorizations `admin 1 / editor 4`, members `admin 1 / editor 4`, platform owners `1`.
- Master Data workbook import authentication now uses the unified request-scoped Supabase session instead of the legacy cookie-only helper. The preview and publish endpoints return explicit JSON errors, disable response caching and preserve same-origin login behavior.
- System Management now uses a two-step `Validate & preview impact` then `Import workbook` workflow. The preview is read-only and reports additions, changed values, inactivations and affected modules across Markets/VAT/FX, Products, BOM, Country RRP, Logistics and Commercial Margins.
- Publishing requires a successful read-only pre-import workbook archive, applies the replacement atomically and creates a post-publish archive. Removed workbook rows become inactive. Existing plans, approvals and saved simulations retain their transaction snapshots while new calculations and selectors use the current active Master Data.
- The platform listens for the Master Data publish event, refreshes native option catalogs immediately and marks cached commercial-planning modules for a single refresh when next activated.
- The supplied `Master data.xlsx` passed an isolated browser workflow: preview identified 16 changes, publish reported 12 imported / 652 updated / 0 skipped, and active counts became 12 countries, 66 products, 66 BOM rows, 316 country RRP rows, 96 logistics rows and 108 operational-margin rows. The archive ledger contains the prior workbook, a `Before workbook publish` snapshot and the new `Published workbook` snapshot.
- At 1280×720, the Master Data page and upload panel both fit their containers: document client/scroll width is 1280/1280 and the upload panel client/scroll width is 1238/1238. Full regression passes 63 test files / 364 tests and the Next.js production build completes successfully.
- Vercel production deployment `dpl_7xDeQr88it7h698Uh2o9ZUCbE9vm` is READY and aliased to `https://operations-planning-hub.vercel.app`. The production health endpoint and platform shell return HTTP 200; unauthenticated Master Data access returns the expected login redirect instead of a runtime error. No production workbook was imported during deployment, and the source commercial-planning tool and source Roadmap were not modified.
- The first authenticated production Master Data publish correctly rolled back after Prisma's 60-second interactive transaction expired while redundantly updating unchanged rows. The importer now reads the active snapshot once, writes only actual additions/changes/reactivations/duplicate cleanup, keeps one atomic transaction with a 240-second database limit and a 300-second Vercel route limit, and returns a safe rollback message without exposing database internals.
- Isolated verification with the supplied workbook and a production-shaped 16-change baseline publishes exactly `12 imported / 4 updated / 0 skipped` in about 0.15 seconds, retaining 12 active countries, 66 products, 66 BOM rows, 316 country RRP rows, 96 logistics rows and 108 operational-margin rows. Reimporting an identical workbook reports `0 imported / 0 updated`. Full regression passes 64 test files / 367 tests; SQLite and PostgreSQL-targeted Next.js builds pass.
- Platform refresh/load investigation found two concrete production causes: the shell hard-coded `activeModule = "home"` without URL persistence, and startup blocked its first render on cloud sync plus Master Data while preloading six hidden commercial workspaces. The hidden iframe burst triggered Prisma `P2024` connection-pool timeouts against the serverless pool limit of one, and duplicate open browser tabs amplified the requests.
- Platform navigation now persists per authenticated account and in `#module=...` URL state, including the value-chain subview. Refresh restores the current accessible module; browser back/forward updates the view. The shell renders immediately after shared-document sync, refreshes Master Data in the background, preloads at most one commercial workspace after 280ms of visible navigation intent, and keeps visited frames alive for instant repeat switching.
- Commercial cloud startup now performs same-origin session exchange, governance-role lookup, preferences and the five governed shared-document reads in parallel. Reference/Master Data reads use one Prisma batch transaction instead of nine concurrent queries against a one-connection pool. Active reference data has a five-minute tagged cache that is immediately invalidated by workbook, partial-import and manual Master Data changes.
- Local browser verification confirms `#module=system` survives refresh with one current iframe, while a fresh `#module=home` displays My Workspace without another click and creates zero hidden commercial frames. Full regression passes 64 test files / 368 tests; SQLite and PostgreSQL-targeted Next.js builds pass.
- The latest Product Roadmap is now integrated into the unified platform as the first module under `计划与交付 / Planning & Delivery`. The host uses a same-origin `/roadmap/index.html?embedded=1` module container; embedded mode removes the duplicate Roadmap sidebar and account header while retaining the platform context, weekly panel, structure/precise views, drawers and editors.
- `commercial-planning-app/scripts/sync-platform-shell.mjs` now copies the complete governed Roadmap package into the unified build. The production artifact includes the checksum-identical Roadmap baseline, the 66-product Master Data snapshot, 37 product images and the current interface/history logic without reading or changing the source Roadmap at runtime.
- Roadmap access is granted to management, planning admin, PMO, sales forecast, supply planning, business planning and market growth roles; auditors and platform administrators retain their existing broad access rules. The platform registry now reports 20 modules and five Planning & Delivery submodules.
- Integrated local browser verification at 1440x900 confirms the Roadmap navigation and context, a 1218x822 embedded workspace, hidden duplicate shell, five product lines, both display modes, 14 visible Pocket + Leopard nodes, no document overflow and zero browser warning/error logs. ERP native regression also passes Forecast, Shipment Summary, Shipment Operations and Business Analysis on desktop and mobile with zero iframe usage or horizontal overflow.
- Unified regression passes 64 test files / 369 tests. The PostgreSQL-targeted Next.js production build passes, generated and source platform assets match, Roadmap baseline and Master Data hashes match their build copies, and `git diff --check` passes.
- Cloud release source is split into `0c79e35` (`Refine native logistics workspace`) and `4dfe842` (`Integrate product roadmap into operations platform`) on `codex/operations-planning-updates`; both commits are pushed to `origin/codex/operations-planning-updates`. This branch, rather than a reconstructed chat transcript, is the complete current test configuration for subsequent work.
- Unified production deployment `dpl_FZBqWh5E7xpX7nL48Ph2z5nQGnBs` is READY and aliased to `https://operations-planning-hub.vercel.app`. Production `/api/health`, `/platform/index.html`, `/roadmap/index.html?embedded=1&lang=zh` and the Roadmap baseline return HTTP 200. A 1440x900 production browser regression confirms the active Product Roadmap navigation, same-origin embedded route, hidden duplicate shell, five product lines, Structure/Precise modes, 14 visible Pocket + Leopard nodes, no horizontal overflow and zero browser warnings or errors.
- This release performs no Supabase schema migration or business-data rewrite. The Roadmap baseline, Master Data snapshot and product images are versioned in Git and shipped inside the unified artifact; browser edits remain local test drafts until a separately governed shared Roadmap document, version ledger and conflict protocol are approved.
- Durable handoff rule: future Codex sessions, including the main conversation, must read `PROJECT_NOTES.md`, work from `codex/operations-planning-updates`, preserve the Roadmap source manifest, and push this branch before any Vercel release. The branch commit and Vercel deployment ID are the release source of truth; do not reconstruct changes from chat history.
- Product Roadmap business state is now governed under the shared Supabase document `productRoadmap.v1`. Products, Master Data mappings, specifications, KSP, lifecycle, launch timing, RRP, product/weekly images, bilingual weekly updates, drafts and immutable Roadmap versions synchronize through the existing workspace document, version, audit, offline queue and conflict-resolution protocol. Language, filters, selected view, scale and weekly-panel visibility remain account-browser preferences under `productRoadmapPreferences.v1` and do not create team conflicts.
- Roadmap access is independently configurable in the platform Permission Manager with four levels: `none`, `view`, `edit`, and `manage`. Platform Owner and Super Admin retain `manage`; explicit per-member Roadmap access overrides inferred functional-role defaults. The iframe receives only the resolved access level, and the production database trigger independently rejects `productRoadmap.v1` writes unless the authenticated member resolves to `edit` or `manage`.
- Production Supabase migration `20260807121815_roadmap_cloud_permissions` is applied. It installs the private fixed-search-path permission resolver and an enabled BEFORE INSERT/UPDATE trigger on `public.workspace_documents`. Current workspace resolution reports one Edit member and four Manage members. Post-migration advisors report no Roadmap-specific security or performance issue.
- Embedded Roadmap layout now removes the duplicate heading and low-value outer spacing, uses `calc(100vh - 62px)` in the host and a viewport-filling child matrix. Local 1440x900 verification measures an 824px Roadmap module and 749px canvas with document client/scroll height both 900, no page-level vertical overflow, and correct manage controls. Weekly and product image uploads are compressed before entering the shared cloud document.
- Final local regression passes 64 test files / 370 tests, JavaScript syntax checks, `git diff --check`, and the PostgreSQL-targeted Next.js production build. The original Roadmap HTML, baseline and image source remain read-only and unchanged.
- Unified production deployment `dpl_9gDS3dHKCdoKW49yDt7db4Vh3xX9` is READY and aliased to `https://operations-planning-hub.vercel.app`. Production health, Roadmap HTML and baseline return HTTP 200, and deployed markers confirm the independent permission controls, cloud document/personal-preference split and viewport-filling layout. Fresh 1440x900 browser checks for View/Edit/Manage measure an 824px module and 749px canvas with no document scroll; View hides all edit controls, Edit exposes content editing only, and Manage also exposes product creation and baseline restoration.
- The initial production `productRoadmap.v1` team document is seeded through the existing governed save protocol under the Platform Owner identity, not by direct table replacement. Database reconciliation confirms document version 1, a 419,546-byte payload, five product lines, 44 products, one embedded Roadmap version, one immutable workspace document version and one `document.saved` audit event; the writer independently resolves to Roadmap `manage` permission.
- Roadmap card/detail mismatches were traced to two different products sharing the legacy ID `new-product`. Schema v3 normalisation now guarantees globally unique product IDs and migrates same-line connections, bilingual current/archive updates, weekly drafts, selected-product state and version snapshot item IDs before rendering or saving. Future version snapshots also retain `slideId`.
- The production team document was repaired atomically from its latest locked state rather than from a previously downloaded snapshot. Only the Charger product and its governed references changed to `charger--new-product`; reconciliation at document v54 confirms 44 products, zero duplicate IDs, one matching repaired product, 54 immutable document versions and 54 audit events.
- The full-width Roadmap sync notice and the later compact in-module status are both removed. The platform header's global sync control is the only sync indicator; Roadmap access remains independently resolved and enforced without repeating status chrome inside the canvas.
- Local and production browser regression confirms the `160W charging station (Online + Offline)` card opens its own matching drawer and the `New Mag power 10K with stand` card remains independent. Unified regression remains 64 test files / 370 tests and the PostgreSQL Vercel build passes.
- Unified production deployment `dpl_J8vzZQy6viG5CCkFuZu1xXxjtPQ9` is READY and aliased to `https://operations-planning-hub.vercel.app`. Deployed assets contain schema v3 ID migration and the compact sync status; production direct-module inspection reports no duplicate notice row or document-level vertical overflow.
- Roadmap portfolio management now exposes `新增产品 / Add product` directly in the embedded control bar for Manage users. Product details expose a Manage-only delete action with explicit confirmation; deletion removes only the Roadmap card, current weekly entry, drafts and relationship lines, preserves Master Data, Project Tracking and archived weekly reports, and creates a new immutable Roadmap version.
- Product/model search now token-matches SKU, name, specifications and KSP regardless of display-field order. Selecting a datalist option or pressing Enter switches to the matching product line and Roadmap view, clears an incompatible lifecycle filter and focuses the matching card. Browser regression using `P62-P1 · Leopard Power 65W` passes from another product line.
- Local 1440x900 permission regression confirms View/Edit hide product add/delete while Manage exposes both. Add dialog opening, confirmed deletion, reload persistence, version creation, exact search location and zero document overflow pass with no browser console errors. Full regression passes 64 test files / 370 tests; the PostgreSQL-targeted Vercel build and `git diff --check` pass.
- Release commit `3fba5f6` is pushed to `origin/codex/operations-planning-updates`. Unified production deployment `dpl_BL6G4DmS2CDJq7saMCj72eQAy8M4` is READY and aliased to `https://operations-planning-hub.vercel.app`; health returns HTTP 200. Deployed Roadmap assets contain the governed add/delete actions and tokenized search while the in-module sync chip is absent. Production 1440x900 browser regression locates `P62-P1 · Leopard Power 65W`, exposes Manage-only delete, has zero document overflow and reports no console errors.
- Protected-module governance now sits outside every ordinary platform role. Platform Owner always resolves to `manage`; Super Admin and functional-role templates receive no implicit protected access. Explicit, expiring grants cover Product Roadmap, Master Data, System Configuration, Permission Governance and Audit, with module-specific levels and absence interpreted as no access.
- The Platform Owner alone can open `权限管理 > 特殊模块权限`, select a member, set the permitted level and optional expiry, and apply the change with a mandatory reason. Owner rights are fixed and cannot be downgraded. Every grant, level change and revocation writes an immutable `protectedModulePermissions.v1` workspace audit event.
- Production Supabase migration `20260807170000_protected_module_permissions` is applied. It installs the protected-grant table, RLS, fixed-search-path resolver, owner-only list/set RPCs and rebinds the Roadmap write trigger. Existing explicit Roadmap grants were preserved without converting broad administrator roles into protected grants: Chris and Jiwen remain View, Julio remains Manage, while the Platform Owner resolves to Manage without a mutable grant row.
- Roadmap navigation/write access and Master Data/System Management navigation plus import-preview, import, export and archive-download endpoints all enforce the protected resolver. Direct route/API access therefore cannot bypass the visible navigation. Full regression passes 64 test files / 372 tests; the local owner/non-owner permission UI and five-row protected matrix pass browser verification without error overlays.
- Release commit `a699ec5` is pushed to `origin/codex/operations-planning-updates`. Unified production deployment `dpl_3LM1iZPg5YWP7hN6ti9gaSXhTxVh` is READY and aliased to `https://operations-planning-hub.vercel.app`; `/api/health` returns HTTP 200 and deployed assets contain the owner-only protected-module matrix plus the protected permission read/write RPCs.
- Product Roadmap now divides the legacy annual columns into `2024 H1 / H2` and `2025 H1 / H2` in both Structure and Precise views, while 2026 and 2027 retain quarterly granularity. Products with a month or quarter follow chronological half-year placement; records carrying only a year use that year's H2 as the conservative display default.
- Local embedded-browser verification on Pocket + Leopard reports `2024 H2 6 / 2025 H1 2 / 2025 H2 2`, with no 2024 H1 products because the current source records are all Q3/Q4. Structure has at most two products in a price/time cell and zero document overflow; Precise renders 14 cards with zero overlap or canvas clipping. The Roadmap baseline data and original source Roadmap remain unchanged. Full regression remains 64 test files / 372 tests and the PostgreSQL-targeted Vercel build passes.
- Release commit `1ec7e38` is pushed to `origin/codex/operations-planning-updates`. Unified production deployment `dpl_FdfFEFVWM7S3Lj6THhamSUA6GyJw` is READY and aliased to `https://operations-planning-hub.vercel.app`; health returns HTTP 200, and the deployed Roadmap script is SHA-256 identical to both the governed local source and build copy with all four half-year markers present.

## Next Steps

1. Complete an authenticated cloud UAT of the Master Data preview/publish workflow with an owner/admin account before any production workbook is published.
2. Complete an authenticated browser UAT for smart remote-update conflict handling and the EOL lifecycle on `operations-planning-hub`.
3. Complete an authenticated browser UAT on the unified platform: current-product simulation, new-product simulation, BP, monthly promotion approval and other approval.
4. Configure an independent outbound email sender and verify approval-reminder/final-delivery messages without reusing source-tool credentials.
5. Add scheduled logical database exports or upgrade Supabase backup coverage before production cutover.
6. After authenticated UAT, reconciliation and rollback rehearsal, mark the former standalone copied deployment for decommissioning. The source tool remains read-only and unchanged until a separate formal cutover is approved.
7. Keep Settlement excluded until a separate scope is approved.

## Forecast Panorama Local Test (2026-08-07)

### Current Goal

Validate a native three-month rolling sales forecast workflow that lets country sales teams enter many products and customer channels in one screen, preserves the `Country -> FD -> Retailer -> SKU` supply relationship, and lets GTM review the same forecast without rebuilding presentation data.

### Completed

- Rebuilt the local Forecast Management module with two native views: `市场全景填报` and `GTM评审`.
- The entry matrix groups products by FD and retailer, exposes three editable forecast months simultaneously, includes group and market totals, prior-version deltas, completion state, change reasons and promotion/project context, and supports search plus compact filters without repetitive channel switching.
- Draft edits auto-save locally and can be explicitly saved or submitted to GTM. GTM review reuses the same working dataset for market, FD/channel, product and change/risk presentation views.
- Added responsive forecast-specific styling. Desktop shows all essential columns without page-level horizontal scrolling; mobile confines wide-table scrolling to the matrix panel.
- The market selector now includes `全部可见市场`, aggregating only the five markets available to the current local-test account. This scope is explicitly read-only, shows market/month/product totals and prior-version deltas, and provides a supply-coordination summary action while preserving market-level ownership of forecast entry.
- GTM review adds a `渠道×产品` view for a selected market. Its two-level header groups Retailers under their supplying FD, each product-channel cell displays Aug/Sep/Oct plus the three-month total and prior-version variance, and product/market totals, risk cues, filters and review actions remain in the same screen.
- GTM approval is now intentionally centralized on the Overview tab. Only Overview exposes the overall review note, return-to-sales action and overall approval action; Channel x Product, FD/Channel, Product and Change/Risk are presentation-only analysis views.
- Channel x Product includes a `查看所有产品` coverage toggle. France expands from 20 products already present in forecast data to all 66 active Master Data products, making omitted channel/product combinations visible as blank cells instead of silently excluding them.
- Every Retailer column header opens a compact channel-detail modal showing the supplying FD, three forecast months, total, prior-version variance, completeness status and an optional all-product list. The Boulanger sample switches between 11 forecasted products and all 66 active products.
- Fullscreen review now targets the stable document root instead of the re-rendered Forecast workspace. Previous/next buttons therefore preserve fullscreen, and Arrow Left/Right, Arrow Up/Down plus PageUp/PageDown navigate review tabs without leaving presentation mode.
- The matrix review now changes grain with market scope. A selected market renders `渠道×产品`, while `全部可见市场` renders `国家×产品` with FR/PL/ES/NL/SE columns, three monthly values, country totals, product totals and the regional grand total. Switching back to a market restores the channel matrix without losing the all-product review setting.
- Matrix cells now prioritize the three monthly forecast values at `9px` with stronger weight and contrast. When monthly details are visible, the three-month total is reduced to an `8px` secondary line; hiding monthly details restores the total to `10px` as the primary value.
- Each country header opens a country forecast-detail modal with market coverage, FD/Retailer counts, product coverage, monthly product forecasts, three-month totals and prior-version variance. The country modal can switch between products already forecast in that market and all active Master Data products.

### Changed Files

- `erp-native-local-test/assets/forecast.js`
- `erp-native-local-test/assets/forecast.css`
- `erp-native-local-test/index.html`

### Verification

- `node --check erp-native-local-test/assets/forecast.js` passes.
- `git diff --check` passes.
- Local browser regression passes with no console errors or document-level horizontal overflow. The all-market view reports five market rows and 12 product summaries; the France GTM matrix reports two FD groups, seven channels and 20 product rows. All five review tabs and matrix risk filtering were exercised, and the all-market scope correctly disables the market-specific matrix tab.
- The revised France review has exactly one overall approval surface on Overview and none on the other four tabs. Seven channel-detail entry points render without viewport overflow; all-product coverage renders 66 rows and 426 intentionally blank channel/product cells. Arrow and PageUp/PageDown navigation were exercised in fullscreen review with no console errors.
- All-market matrix regression reports five clickable country columns, 52 forecasted products by default and 66 products in full-coverage mode. Country totals reconcile to the 76,235 regional total; France reconciles at 37,300 in both the matrix header and country-detail modal, with 20 forecasted of 66 active products. Returning to France restores seven clickable channel columns. No console errors or document-level horizontal overflow were observed.

### Next Step

Obtain user acceptance on the local UI and workflow before connecting shared APIs, Supabase persistence or any cloud release. This change does not modify production data or the cloud deployment.

## Logistics Delivery Local Test (2026-08-08)

### Current Goal

Separate product logistics reference data from shipment execution, then give regional and market users a single shipment summary for market, PO, batch and exception tracking.

### Completed

- Reordered the Logistics Delivery workspace as `发货汇总`, `发货操作`, then `产品物流与价格`. Legacy logistics links remain compatible and redirect to the corresponding new view.
- Renamed the former summary page to `产品物流与价格`; its product packaging, inventory, RRP and Invoice Price content remains unchanged.
- Added a native shipment summary with week, month, quarter and year periods; market, FD/customer, date-basis, PO/SKU and status filters; regional metrics; market progress; PO fulfilment; expandable actual and planned batches; and delay/exception history.
- Shared one in-memory PO, shipment-batch and remaining-plan store between Shipment Summary and Shipment Operations. Recording a partial shipment immediately updates shipped/remaining quantities, the PO status, the next planned batch and exception history in the summary.
- Kept the existing PO lifecycle pipeline in Shipment Operations, removed its duplicated weekly analytics, and expanded the operation console with warehouse, transport mode, ETA, carrier, tracking/container, invoice number, batch note, unmet-reason category, owner and next planned shipment date.
- Partial shipment confirmation requires a reason and next shipment date. Remaining quantities are calculated across every PO line, including lines not selected in the current batch.

### Changed Files

- `erp-native-local-test/index.html`
- `erp-native-local-test/assets/platform-shell.js`
- `erp-native-local-test/assets/logistic.js`
- `erp-native-local-test/assets/shipment.js`
- `erp-native-local-test/assets/shipment-summary.js`
- `erp-native-local-test/assets/shipment-summary.css`

### Verification

- JavaScript syntax checks and `git diff --check` pass.
- Local browser verification confirms the three-module order, route compatibility, no document-level horizontal overflow, the expanded operation fields and live partial-shipment reconciliation from Shipment Operations back to Shipment Summary.

### Next Step

Obtain user acceptance on the local logistics workflow before adding shared persistence, permission enforcement or a cloud release. This local test does not modify production data or deployment state.

## Product Logistics Sticky Header (2026-08-08)

- The `产品物流与价格` inventory and pricing tables now use a viewport-fitted internal scroll region instead of a fixed 700px panel that extended below the visible workspace.
- Column headers remain pinned during vertical table scrolling. Code and Name stay pinned during horizontal scrolling with explicit widths and independent header/body z-index levels, preventing overlap.
- Local 919x863 browser verification scrolls the table 620px vertically and 359px horizontally: the header remains at the scroll-region top, Code and Name meet without overlap, and the document has no horizontal overflow.

## FCST Scorecard Forecast Module Local Test (2026-08-08)

- Forecast Management now has a third native view, `预测评分卡`, after Sales Entry and GTM Review. Business Analysis is no longer the intended owner of this workflow.
- The scorecard compares the exact selected published three-month forecast with effective PO quantity at `Market -> FD -> SKU -> Month` grain. Retailer forecasts are rolled into their supplying FD; Retailer is shown as forecast composition only and is not independently scored because Retailer actuals are unavailable.
- The UI exposes only `预测准确率`. WAPE terminology and the FD ranking module are intentionally removed. Accuracy is `max(0, 100 - absolute error / forecast * 100)`; an effective PO against a zero forecast is classified as unplanned PO demand.
- Achieve uses current PO ordered quantity. Cancelled POs are excluded; partially fulfilled POs retain their current effective ordered quantity. Shipped and delivered quantities are fulfilment context and do not replace demand actuals.
- Future months after the latest effective PO month are `待评估`, preventing missing future POs from being reported as false 0% accuracy. Portfolio accuracy sums absolute error at FD/SKU/month grain before dividing by total forecast, so over- and under-forecast products cannot offset one another.
- The local view includes permission-scoped market/all-market filters, KPIs, a three-month trend, a compact FD-product matrix, exception filtering and a detail drawer with Retailer forecast composition, PO records and autosaved review notes.
- The scorecard now contains three persistent page-level views: `综合总览`, `当前滚动明细` and `季度复盘明细`. The unified overview keeps only four non-duplicated management KPIs: current rolling accuracy, quarterly composite accuracy, prior-quarter change and exception products. H1/H2/H3 figures appear only in the horizon chart and detail tables.
- Quarterly review automatically matches each target month to the published runs released one, two and three months earlier. It calculates H1, H2 and H3 after summing absolute error at Market/FD/SKU/month grain, then applies the approved `H1 50% + H2 30% + H3 20%` composite formula.
- Quarter months later than the latest effective-PO month remain `待评估`. A quarter with missing historical forecast vintages reports `样本不足` rather than fabricating a prior-quarter comparison. The current Q3 local sample therefore leaves September pending and does not produce a Q2 comparison because the required H2/H3 source runs are incomplete.
- The quarter table and Market/FD/Product drill-down share the current version, quarter, market, FD, product and exception filters. A row drawer traces all nine month/horizon cells to their exact published run, shows effective PO lines and autosaves quarter review reasons and actions.
- Browser regression passes with 21 France rows and 133 all-market rows. Accuracy is present; WAPE and FD ranking are absent; future months remain pending; the detail drawer shows PO context without overflow; all tested platform modules switch in 162-215ms with no document-level horizontal overflow.
- The expanded regression verifies three score views, four overview KPIs, zero duplicate horizon KPI cards, four horizon bars, four quarter summary rows, current and quarter drawers, the scoring-rule dialog, all-market grain and 390px mobile layout. Quarter tables scroll internally while desktop and mobile documents retain zero horizontal overflow; platform module switching remains approximately 158-261ms.
- This is a local test only. Shared persistence, permission enforcement, historical close snapshots, legacy-link redirects and cloud release remain pending user acceptance.

## Business Analysis Scorecard Retirement (2026-08-08)

- Removed the legacy `FCST Scorecard` tab, scoring rules, forecast aggregation and score table from Business Analysis. Forecast Management is now the only owner of forecast scoring and quarterly review.
- Business Analysis retains only `Sales Review` and `Profitability (P&L)`, with `Sales Review` as the default view. Any stale in-memory `kpi` tab value is defensively redirected to `Sales Review` instead of rendering a blank page.
- Removed the scorecard-only `Hide empty SKUs` control from the Business Analysis selector bar.
- Local browser regression verifies exactly two Business Analysis tabs, no legacy scorecard text, both remaining views render, and neither view creates document-level horizontal overflow.

## Prototype Management Source Audit and Migration Concept (2026-08-08)

- Audited the read-only migration source at `/Users/julio/Desktop/AI output/Chris 部分搬运嵌入/iniu-erp-demo(1)`. Its manifest and implementation contain only Forecast, Performance, Logistic & Stock and Shipment Workflow modules. It does not contain a Prototype Management route, page, sample ledger or sample movement data model; incidental `Sample Support` text in expense/review snapshots is not a management module.
- The collaboration platform already has a native `prototype-management` function workspace linked to each project's `workstreams.prototype`, permission scopes, project navigation and cloud document synchronization. The current implementation provides portfolio filters, readiness, current task, risk, deadline, owner, export and project-workstream editing, but does not yet track individual physical samples, movements, custody or returns.
- Recommended migration path is to promote the existing native workspace into the prototype system of record rather than fabricate a source-package copy. Add requirement, physical-unit, movement, custody/loan and immutable audit entities keyed to platform project and Master Data SKU IDs; Project Tracking consumes readiness/risk summaries from this ledger.
- Created a non-production concept at `erp-native-local-test/prototype-management-migration-concept.html` and `erp-native-local-test/prototype-management-migration-concept.png`. It demonstrates project overview, sample movement, loan/return and history tabs, compact filters, one-screen ledger, exceptions and explicit cross-module ownership. The source package was not modified.

## Prototype Management Native Local Test (2026-08-08)

- Added a native `职能工作台` at `#module=functions` with six department-owned entry rows. `样机管理` is not a separate left-navigation module: it opens only from the Prototype Management row and uses the nested deep link `#module=functions&workspace=prototype`. Desktop and mobile module selectors continue to show only `职能工作台`.
- Implemented four workspace views: `项目总览`, `样机流转`, `借用与归还` and `历史记录`. The overview combines compact project/model, stage, type, status, owner and exception filters; five portfolio KPIs; a project prototype ledger; and a complete exception queue without document-level horizontal scrolling.
- Added a Master Data/project-bound prototype requirement workflow. Users select an existing project/model, prototype type, quantity, owner, due date and purpose; free-form product identities are not created. The project ledger and immutable local history update together.
- Added physical movement operations for shipment, receipt, loan and return. Operations update received/in-transit/loaned counts, readiness, current node, location/custodian and movement history. Project details expose requirements, physical-unit status and recent movement records in one drawer.
- Added CSV ledger export, direct Project Tracking navigation and an explicit ownership contract: Project Tracking provides project identity and milestones; Prototype Management owns requirements, physical assets and custody; Quality, Engineering and Marketing consume the resulting status.
- Local-test edits autosave to browser `sessionStorage` under `erp-native-prototype-management.v1`. They are isolated from Supabase, production data and cloud deployment, and the audited migration source remains unchanged.

### Changed Files

- `erp-native-local-test/index.html`
- `erp-native-local-test/assets/platform-shell.js`
- `erp-native-local-test/assets/platform-integration.css`
- `erp-native-local-test/assets/functional-workspace.js`
- `erp-native-local-test/assets/functional-workspace.css`
- `erp-native-local-test/assets/prototype-management.js`
- `erp-native-local-test/assets/prototype-management.css`
- `erp-native-local-test/verify-ui.cjs`

### Verification

- JavaScript syntax checks and `git diff --check` pass.
- Full local browser regression passes with no console errors. Function Workspace opens in approximately 172ms with six entries; exactly one Prototype Management entry is present and there is no separate Prototype Management navigation item. The nested workspace retains four views and five KPIs while preserving Forecast, Logistics and Performance regressions.
- Requirement creation, project drawer opening, receipt recording, readiness/location recalculation, movement history, loan/return actions and immutable history rendering were exercised successfully.
- Entering Prototype Management from Function Workspace, refreshing its nested URL and returning to Function Workspace were exercised successfully. The Function Workspace navigation remains active throughout the nested workflow.
- Desktop and 390px mobile screenshots confirm zero document-level horizontal overflow. The compact mobile layout keeps the full filter set visible and confines the dense ledger to its own scroll region.
- Screenshots: `erp-native-local-test/native-prototype-management.png` and `erp-native-local-test/native-prototype-management-mobile.png`.

## Original Business Analysis Audit and Optimization Concept (2026-08-08)

- Audited the read-only source `performance.html` and `assets/performance.js` in `/Users/julio/Desktop/AI output/Chris 部分搬运嵌入/iniu-erp-demo(1)`. The source remains unchanged.
- The original module combines `FCST Scorecard`, `Sales Review` and `Profitability (P&L)`. Forecast scoring now belongs to Forecast Management; full BP detail belongs to BP Achievement; PO freight detail belongs to Logistics Delivery; and Credit Note/settlement detail belongs to Settlement Ledger.
- Identified calculation and governance risks: forecast runs are averaged instead of preserving forecast vintage; PO actuals are not explicitly filtered for cancelled status; category P&L does not populate logistics or Credit Note costs; FX is hard-coded; Sales Review shows only six channels, does not load its available review records and has no durable save/history workflow; and all-market behavior is inconsistent.
- Repositioned Business Analysis as the cross-module diagnosis and review layer with four views: `综合复盘`, `市场与渠道`, `产品与盈利`, and `行动与复盘`. It consumes governed summaries from source modules, explains revenue and profit movement, surfaces data-quality exceptions and creates traceable actions without duplicating operational ledgers.
- The concept uses the original Q2 2026 snapshot: revenue EUR 527.0K, BP achievement 47.5%, GP 30.6%, NP 26.2%, and a revenue-to-NP bridge including BOM, logistics and Credit Notes. It also calls out missing PL BP and three POs without freight coverage.
- Created the non-production artifacts `erp-native-local-test/business-analysis-optimization-concept.html` and `erp-native-local-test/business-analysis-optimization-concept.png`. They are review concepts only and are not wired into the platform route or cloud deployment.

## Business Review Center Concept (2026-08-09)

- Proposed a new first-level page entry, `经营复盘`, under the existing `经营管理` navigation group. It is distinct from `经营分析`: analysis supports continuous diagnosis, while review supports fixed-period meetings, frozen data versions, decisions and follow-up.
- The same review structure supports monthly, quarterly, half-year and annual periods. Each review selects a period, visible-market scope and comparison baseline, then freezes the exact BP, forecast, PO, logistics, settlement, project and Master Data versions used by the meeting.
- The review workspace is organized into `复盘总览`, `收入与利润`, `预测与交付`, `项目与市场`, `结论与行动`, and `历史复盘`. The overview presents non-duplicated management KPIs, source readiness, trend and margin movement, meeting agenda, cross-module conclusions and action closure in one screen.
- Recommended workflow is `会前数据检查与预读 -> 数据冻结 -> 会议模式 -> 结论确认 -> 行动同步我的待办 -> 历史归档`. Corrections after freezing create an adjustment version and never overwrite an accepted historical review.
- Created the non-production concept files `erp-native-local-test/business-review-center-concept.html` and `erp-native-local-test/business-review-center-concept.png`. A 1600x1000 browser render confirms zero page-level horizontal or vertical overflow. The concept is not connected to platform routes, shared persistence or cloud deployment.
- Expanded the same concept into six switchable review views: `复盘总览`, `收入与利润`, `预测与交付`, `项目与市场`, `结论与行动`, and `历史复盘`. Query-string views and the visible tabs use one shared period, scope, comparison and frozen-version context.
- Generated six 1600x1000 review screenshots: `business-review-01-overview.png`, `business-review-02-profit.png`, `business-review-03-forecast-delivery.png`, `business-review-04-project-market.png`, `business-review-05-conclusion-action.png`, and `business-review-06-history.png`. Browser checks confirm the correct active tab, zero console errors and no document-level horizontal or vertical overflow for every view.

## Business Analysis and Business Review Native Local Test (2026-08-09)

- Replaced the old local Business Analysis renderer with the approved four-view structure: `综合复盘`, `市场与渠道`, `产品与盈利`, and `行动与复盘`. The page now owns continuous variance diagnosis, revenue-to-net-profit explanation, market/channel drill-down, product profitability and traceable action creation; Forecast Scorecard remains exclusively in Forecast Management.
- Added a shared business metrics layer over the local snapshot. Effective PO calculations explicitly exclude cancelled POs. Revenue, BP, BOM, freight, Credit Note, GP, NP, fulfilment and published forecast metrics now use one common period and market scope across Business Analysis and Business Review.
- Renamed the proposed review module from `经营复盘` to `业务复盘`. Added it as a native navigation entry immediately after `结算台账`, including the mobile module selector, URL route `#module=businessReview`, Chinese/English shell names and module context.
- Implemented six native Business Review views: `复盘总览`, `收入与利润`, `预测与交付`, `项目与市场`, `结论与行动`, and `历史复盘`. One shared filter context supports monthly, quarterly, half-year and annual reviews, market scope and prior-period/BP comparison.
- Added the four-step review workflow: pre-meeting source check, frozen review version, meeting conclusion, and action/archive closure. Frozen-version notices, action progress and local history state persist in browser `sessionStorage`; accepted versions are presented as non-overwritable, with corrections routed to an adjustment-version flow.
- Project and market readiness in the local snapshot are explicitly marked as collaboration sample data because the migrated ERP package does not include authoritative project, prototype or marketing asset tables. Production integration must replace these examples with governed Project Tracking and functional-workspace summaries.
- This remains a local test only. It does not modify the read-only migration source, Supabase production data, cloud routes or Vercel deployments.

### Changed Files

- `erp-native-local-test/index.html`
- `erp-native-local-test/assets/platform-shell.js`
- `erp-native-local-test/assets/business-metrics.js`
- `erp-native-local-test/assets/business-workspaces.css`
- `erp-native-local-test/assets/business-analysis.js`
- `erp-native-local-test/assets/business-review.js`
- `erp-native-local-test/verify-ui.cjs`

### Verification

- JavaScript syntax checks and `git diff --check` pass.
- Full Playwright regression passes with zero console errors, no iframe dependencies and no document-level horizontal overflow on desktop or the existing mobile regression pages.
- Business Analysis exposes exactly four views and no legacy `FCST Scorecard`; Business Review exposes exactly six views, four workflow stages, month/quarter/half/year period controls, a frozen-version state and a history archive.
- `业务复盘` is confirmed immediately after `结算台账`. Native module switches complete in approximately 158-176ms while Forecast, Logistics, Function Workspace and Prototype Management regressions remain green.
- Screenshots: `erp-native-local-test/native-business-analysis.png` and `erp-native-local-test/native-business-review.png`.

## Business Review Expense and Delivery Refinement (2026-08-09)

- Business Review now consumes a shared confirmed-result contract for Business Analysis, BP Achievement, Forecast Management, Logistics Delivery and Settlement Ledger. Every source exposes its status, version, confirmation time, period and market scope before the review uses it.
- Added a compact `费用分析` section. Logistics fee, Credit Note and total fee are shown by visible market, with each ratio placed beside the amount in parentheses instead of occupying a separate column.
- Logistics fee values open a detail dialog with `按PO` and `按产品SKU` views. PO rows preserve shipment, amount, currency, status and exception context; SKU rows allocate a PO's logistics fee by line revenue share and state that allocation rule in the dialog.
- Credit Note values open a detail dialog with `按Credit Note号` and `按产品SKU` views. The number view groups all affected SKU lines under the originating Credit Note; the SKU view aggregates deduction impact by product while retaining the source note count.
- Removed the duplicated headline KPI strip from `收入与利润`. BP achievement, BOM share, logistics share, gross-profit rate, Credit Note share and net-profit rate now sit directly in the profit bridge.
- Fixed market scoping so a selected country is the only country shown in Business Analysis and Business Review market tables. All-market users still receive the governed cross-market aggregate.
- Rebuilt `预测与交付` as a review chain from BP plan through rolling forecast, effective PO and shipped quantity. It reuses confirmed Forecast Management and Logistics Delivery results and keeps drill-through ownership in the source modules.
- This refinement is local-test only and has not been deployed to Vercel or written to production data.

### Expense Refinement Verification

- Full Playwright regression passes with zero console errors, no iframe dependencies and no document/modal horizontal overflow.
- FR market scope returns only FR rows. Logistics details expose 6 PO rows and 9 SKU rows; Credit Note details expose 3 note-number rows and 5 SKU rows in the bundled local snapshot.
- Forecast-and-delivery review exposes all four stages and the confirmed source versions. JavaScript syntax checks and `git diff --check` pass.
- Screenshots: `erp-native-local-test/native-business-review-expense.png`, `erp-native-local-test/native-business-review-logistics-details.png`, `erp-native-local-test/native-business-review-credit-note-details.png`, and `erp-native-local-test/native-business-review-forecast-delivery.png`.

## BP Achievement Native Local Module (2026-08-09)

- Replaced the `BP达成` existing-platform placeholder with the native local route `#module=bp`. The desktop navigation, mobile module selector, Chinese/English shell context and Business Review source drill-through now resolve to the same native module.
- Moved the BP ownership previously embedded in the source Performance page into four focused views: `综合达成`, `市场与品类`, `产品明细`, and `版本记录`.
- `综合达成` supports full-year and Q1-Q4 selection, all-visible-market or single-market scope, and SI amount/quantity metrics. It shows the confirmed BP target, effective-PO actual, gap, achievement, four-quarter progress, twelve-month detail and market exception order.
- `市场与品类` applies one governed market filter to both tables. `产品明细` keeps products that have a BP target but no actual PO, supports model/name search, shows quantity and value achievement together, and opens a twelve-month product drawer.
- Extended the shared metrics contract with BP target quantity, actual value/quantity, value/quantity gaps, both achievement rates, and confirmed market/category/SKU detail. Cancelled POs remain excluded from actual achievement.
- BP target totals and product-detail totals are verified to reconcile for both value and quantity. A confirmed BP version feeds Business Analysis and Business Review; a new confirmation creates a new version without overwriting frozen review history.
- This remains a local-test implementation only. It does not modify the read-only source package, Supabase production data or Vercel deployment.

### BP Verification

- Full Playwright regression passes with zero console errors and no page-level horizontal overflow across desktop and mobile. Native module switching completes in approximately 159-249ms.
- The BP page exposes four views, four KPI cells, four quarter cards and twelve monthly rows. FR scope returns only FR, the local snapshot exposes five FR categories and thirty FR product rows, and BP-only products remain visible.
- Product drawers expose twelve monthly rows. Mobile product detail uses internal table scrolling without expanding the document width.
- Screenshots: `erp-native-local-test/native-bp-achievement.png` and `erp-native-local-test/native-bp-achievement-mobile.png`.

## Business Analysis Review Consolidation (2026-08-09)

- Consolidated the overlapping `经营分析` and `业务复盘` entries into one native `经营分析复盘` module at `#module=performance`. The separate `业务复盘` desktop navigation, mobile option and runtime route were removed.
- `经营分析复盘` now uses the former Business Review implementation in full: `复盘总览`, `收入与利润`, `预测与交付`, `项目与市场`, `结论与行动` and `历史复盘`, including the four-step review workflow, frozen versions, expense drill-downs, source-module contracts and history archive.
- Preserved `sessionStorage` key `erp-native-business-review-state`. Existing local frozen state, actions and history therefore remain readable after the module rename instead of being copied or reset.
- Added backward-compatible route canonicalization. Existing bookmarks using `#module=businessReview` automatically replace themselves with `#module=performance`, including same-page hash changes where the active renderer does not otherwise change.
- Renamed the shared confirmed-result contract source from `经营分析` to `经营分析复盘`. BP, Forecast, Logistics and Settlement remain the governed source modules; the merged page continues to consume their confirmed snapshots rather than duplicating their operational ledgers.
- The previous `business-analysis.js` file remains untouched but is no longer loaded by the local test shell. This avoids destructive cleanup in the dirty worktree while guaranteeing that the former four-view renderer cannot override the merged module.
- This consolidation is local-test only. It does not update Supabase, Vercel or production routes.

### Consolidation Verification

- JavaScript syntax checks and `git diff --check` pass.
- Full Playwright regression passes with zero console errors. The merged module exposes exactly one navigation entry, six review views, four workflow steps and no document-level horizontal overflow.
- Legacy `#module=businessReview` links redirect to `#module=performance` and render `经营分析复盘`. Forecast, Logistics, BP, Function Workspace and Prototype Management regressions remain green.
- Desktop and 390px mobile renders pass. Screenshots: `erp-native-local-test/native-business-analysis-review.png` and `erp-native-local-test/native-business-analysis-review-mobile.png`.

## Business Analysis Review Compact UX Implementation (2026-08-09)

- Applied the approved compact layout to the active local `经营分析复盘` module. The four-stage workflow strip is no longer rendered. The former page head, methodology band, filter block, source pills and separate tab block are consolidated into a two-row control shell that is 102px high at the 1440px test viewport.
- The control shell keeps period type, review period, market scope and comparison in the first row. Source readiness is summarized as `来源 4/4`; clicking it opens the four governed source versions. Meeting mode, history and frozen-version controls remain directly accessible.
- Merged the former standalone expense section into `市场收入、利润与费用`. Each market row now carries revenue, BP achievement, GP rate, logistics fee and ratio, Credit Note and ratio, total cost and ratio, NP rate and review status. Logistics and Credit Note amounts still open their governed PO/Credit Note and SKU detail dialogs.
- Simplified `结论与行动` to a compact conclusion summary and action table. The default page shows only decision/action identity, impact or source, owner, deadline and status. Conclusion reasons/decisions and action reasons/evidence open in an editable right-side drawer; updates are persisted under the existing `erp-native-business-review-state` session key.
- Preserved the six review tabs, frozen versions, source contracts, legacy `#module=businessReview` redirect and history archive. No source snapshot, production database or cloud deployment was changed.

### Compact UX Verification

- JavaScript syntax checks and `git diff --check` pass.
- Full Playwright regression passes with zero console errors and no iframe or document-level horizontal overflow. The compact review has zero workflow nodes, one control shell, no legacy page/method/filter blocks, four conclusion summaries and five action rows.
- Conclusion and action drawers were edited and saved during automated testing. Logistics details expose 6 PO and 9 SKU rows; Credit Note details expose 3 note-number and 5 SKU rows. Forecast, Logistics, BP, Function Workspace and Prototype Management regressions remain green.
- Desktop and 390px mobile screenshots: `erp-native-local-test/native-business-analysis-review.png`, `erp-native-local-test/native-business-analysis-review-expense.png`, `erp-native-local-test/native-business-analysis-review-actions.png`, `erp-native-local-test/native-business-analysis-review-action-drawer.png`, and `erp-native-local-test/native-business-analysis-review-mobile.png`.

## Business Review Overview, Category Mix and BP Density Refinement (2026-08-09)

- Reorganized `复盘总览` around its two primary review jobs. `${selected review period}利润桥` is now the first full-width section and `市场复盘摘要` is the second. The former six-card headline strip is removed from this view.
- Moved `关键异常` and `行动摘要` into a single compact secondary bar below the main review data. Each item shows only its count/progress and leading issue; clicking opens the complete list in a modal with a direct route to `预测与交付` or `结论与行动`.
- Added an `ALL`-scope total row to `市场收入、利润与费用`. The row aggregates revenue, BP achievement, GP, logistics fee, Credit Note, total cost, NP and pending-cost status across all visible markets. Total logistics and Credit Note values retain their existing drill-down dialogs.
- Rebuilt `品类贡献` as a compact left table plus linked right contribution chart. Users can switch between revenue, gross-profit and net-profit contribution; clicking either a table row or legend focuses the same category. Negative profit values keep their signed amount while chart share uses absolute impact magnitude.
- Replaced the BP Achievement page head, methodology band, filter panel, version card and separate tabs with one two-row `bp-control` shell. Year, period, market, metric, methodology, export and confirmed version remain accessible while the desktop shell height is reduced to 102px.
- This refinement remains local-test only. No production database, cloud route or Vercel deployment was changed.

### Overview and BP Verification

- Full Playwright regression passes with zero console errors and no document-level horizontal overflow at 1440px or 390px.
- The overview exposes exactly two primary panels in order: `2026 Q2利润桥`, then `市场复盘摘要`; four exception items and five action items open successfully in secondary modals.
- All-market financial review returns four market rows plus one total row. Category contribution exposes five rows, three metric modes, a linked chart and synchronized row/legend focus.
- BP Achievement renders one 102px compact control shell and no legacy page head, method bar or filter bar. Forecast, Logistics, Prototype Management and all prior BP/Business Review drill-down tests remain green.
- Updated screenshots: `erp-native-local-test/native-business-analysis-review.png`, `erp-native-local-test/native-business-analysis-review-expense.png`, `erp-native-local-test/native-business-analysis-review-profit-mobile.png`, `erp-native-local-test/native-bp-achievement.png`, and `erp-native-local-test/native-bp-achievement-mobile.png`.

## BP Market and Category Multidimensional Monitoring (2026-08-09)

- Rebuilt `BP达成 > 市场与品类` as three non-duplicating review views: `达成矩阵`, `趋势与预测`, and `结构与缺口`.
- `达成矩阵` now provides an all-market market-by-category cross section. Selecting one market switches the same surface to category-by-quarter or category-by-month monitoring. Every cell exposes the BP target, effective PO, gap and achievement, with a linked SKU detail panel and governed routes to PO and Forecast Management.
- `趋势与预测` exclusively owns the monthly BP/effective-PO/confirmed-forecast chart. It adds market pacing, the next three available forecast months and forecast-change alerts without counting forecasts as achieved revenue.
- `结构与缺口` compares BP share with actual contribution and ranks gaps by market, category or SKU. The prior gap-attribution block is not rendered. Risk and structural exception summaries remain on-demand modals instead of permanent dashboard panels.
- Historical periods no longer relabel closed months as a future plan. Quarter charts use their actual month count, while mobile matrix and trend content scroll only inside their own containers.
- This implementation remains local-test only. It does not change the production database or cloud deployment.

### BP Multidimensional Verification

- Playwright now checks the all-market matrix, single-market matrix, selected-cell SKU drill-through, both monitoring dialogs, twelve-month trend view, all three gap ranking dimensions and 390px internal scrolling.
- Screenshots: `erp-native-local-test/native-bp-achievement-market.png`, `erp-native-local-test/native-bp-achievement-trend.png`, `erp-native-local-test/native-bp-achievement-structure.png`, and `erp-native-local-test/native-bp-achievement-market-mobile.png`.

## BP Combination Chart and Exact Drill-through Refinement (2026-08-09)

- Replaced the provisional monthly trend rendering with one true SVG combination chart. Twelve monthly groups now share a common amount axis and show blue BP-target bars, green effective-PO bars, a continuous orange dashed confirmed-forecast line, and a continuous dark cumulative-achievement line with twelve nodes and percentage labels.
- Added a current-month background marker, left amount axis, right percentage axis, horizontal guides, tooltips and a compact legend. On 390px screens the chart keeps its readable desktop geometry and scrolls inside the chart container without expanding the page width.
- Added explicit BP cell product selection. `查看产品明细`, `查看有效PO`, and `进入预测管理` now carry the selected market, category, SKU, product and month range instead of using only the parent matrix cell.
- Forecast Management consumes that context and opens the market-wide entry view with the exact market, category and SKU filters already applied. The BP product drawer also opens the exact selected SKU and market with twelve monthly rows.
- Shipment Summary consumes the same context, opens `PO履约`, applies the exact market/SKU/period filters and automatically expands matching PO batches. It never silently substitutes another product. When the logistics snapshot lacks the selected SKU mapping, or the SKU has no PO in the selected period, the page states that reason in the positioning band while preserving the exact filter.
- The bundled local snapshot currently has no ShipmentStore SKU mapping for `P61L-P2`; the verified result is therefore an explicit mapping warning rather than an unrelated PO. Production Master Data synchronization must align BP product codes and logistics SKU codes before that product can expose corresponding PO batches.
- This refinement is local-test only. No production database, Supabase project, Vercel route or cloud deployment was changed.

### Combination Chart and Drill-through Verification

- Full Playwright regression passes with zero console errors, no iframe dependencies and no document-level horizontal overflow on desktop or mobile.
- The chart exposes 12 target bars, 12 actual bars, one forecast line, one cumulative-rate line, 12 rate nodes and both axes. Mobile keeps internal chart scrolling.
- Exact FR drill-through was verified for `P61L-P2`: product detail opens 12 monthly rows; Forecast Management opens `FR / Power bank / P61L-P2`; Shipment Summary preserves `FR / P61L-P2` and shows the explicit missing-map state without fallback.
- Screenshots: `erp-native-local-test/native-bp-achievement-trend.png`, `erp-native-local-test/native-bp-achievement-po-drilldown.png`, and `erp-native-local-test/native-bp-achievement-forecast-drilldown.png`.

## Production Reliability Hardening (2026-08-09)

- Replaced the commercial-planning session bridge's refresh-token handoff and
  server-side `auth.setSession()` call with access-token validation. The browser
  now sends only the current access token, coalesces concurrent bridge requests,
  renews the signed same-origin session every four minutes and follows normal
  Supabase access-token refresh events without consuming the refresh token.
- Signed `vc_session` cookies are now accepted consistently by server-rendered
  pages and write APIs under the Supabase provider. The cookie carries the
  authenticated workspace id and protected-module grants, eliminating duplicate
  Supabase session refreshes and extra permission lookups during one platform
  render.
- Cloud document autosave now classifies failures. Version conflicts keep their
  existing merge workflow; permission, authentication and validation failures
  stop automatic retries while preserving the local outbox; only network,
  timeout, rate-limit, database-restart and 5xx failures retry with exponential
  backoff, capped at three attempts. A manual `retryPending()` recovery hook is
  exposed without discarding drafts.
- Prisma now uses one client/pool per warm serverless process. Vercel runtime
  database URLs receive conservative defaults when the URL does not already
  specify them: connection limit 1, pool timeout 60 seconds and connect timeout
  15 seconds. Existing URL parameters remain authoritative.
- Applied Supabase migration `harden_commercial_access_rpc`. The exposed
  `public.get_commercial_planning_access()` is now a security-invoker wrapper;
  its security-definer implementation is isolated in the private schema. The
  related Supabase security advisor warning is cleared.
- Production deployment `dpl_CkdJ4827aSPQJqFAcHyRgcMnwbSm` is `READY` and
  aliased to `https://operations-planning-hub.vercel.app`.
- Exact production data safety verification covered the same 44 application
  tables and 4,242 rows before and after the migration/deployment. Every row
  count and order-independent content fingerprint matched; zero business tables
  changed.
- Post-release route checks pass for health, platform shell, native snapshot
  authentication and session-bridge origin/input guards. The anonymous browser
  renders the Google authorization gate with no console error or horizontal
  overflow. Vercel reports no runtime error in the release window.
- Remaining controlled risks: Supabase leaked-password protection is still a
  dashboard-level warning, but this workspace currently uses exact-email Google
  OAuth rather than password login. Preview deployments intentionally do not
  receive the production `DATABASE_URL`; a separate UAT database or Supabase
  branch must be approved before database-backed preview routes can be enabled.
  Unused-index advisor notices are retained until production query history is
  representative; no speculative index deletion was performed.

### Reliability Verification

- `npm test`: 65 files / 380 tests passed.
- `npx tsc --noEmit`, `npm run build:vercel`,
  `npm run validate:copy-scope` and `git diff --check` passed.
- Supabase security advisor now reports only the leaked-password setting; the
  exposed security-definer RPC warning is resolved.
- Authenticated account-specific visual UAT cannot be automated from the current
  browser connection because it has no reusable Google session. Anonymous and
  HTTP security boundaries, production artifacts, logs and database invariants
  are verified.

## Settlement Ledger Cloud Release (2026-08-09)

- Production deployment `dpl_5meFD8K2yBSVq1UmP7R2YAKvmnPP` is `READY` and is
  aliased to `https://operations-planning-hub.vercel.app`.
- Promoted the latest settlement-ledger interaction workspace into the unified
  platform at `/platform/business/settlements`. The native platform shell owns
  authentication, account context, language control and navigation; the
  settlement workspace is rendered as a same-origin protected module surface.
- Replaced the legacy settlement navigation target with the new native route.
  The released workspace includes settlement overview, Claim and difference
  confirmation, Credit Note balance management, receipt allocation, version
  audit, file upload/download simulations and the approved lifecycle:
  prior approval -> customer execution -> Claim -> confirmation -> CN -> CN
  application -> cash reconciliation.
- The removed six-step process strip remains absent, leaving the main data and
  tab surfaces visible in the first viewport. Embedded mode suppresses the
  prototype's duplicate sidebar and header.
- The Vercel build copies only the settlement HTML runtime to
  `/platform-native/settlement-ledger.html`; local review screenshots are not
  part of the production bundle. Direct access to the runtime is protected by
  the same signed platform session boundary.
- This release is an interactive production UAT surface backed by example
  settlement rows. It does not introduce a settlement database schema, mutate
  production business records or replace existing financial source documents.
- Local verification passes 65 test files / 380 tests, the optimized Next.js
  build, route/static-runtime HTTP checks and browser validation of the unified
  shell, all five ledger tabs and the CN upload dialog.
- Post-release verification reports `/api/health` as healthy, the native
  settlement runtime redirects anonymous requests to platform login, and no
  current runtime error log for the release window. No database migration,
  seed, import or production data write was executed.

## Resume Instructions

Read this file, `docs/MODULAR_MONOLITH_MIGRATION.md`, `docs/COMMERCIAL_PLANNING_COPY_SCOPE.md`, `docs/COMMERCIAL_PLANNING_UAT.md`, and `commercial-planning-app/README.md`, then inspect `git status`. Work on `codex/operations-planning-updates`; do not commit directly to `main`. The primary runtime is the unified `operations-planning-hub` modular monolith; the former standalone copied deployment is rollback-only. Next verify authenticated cloud UAT, independent email delivery and durable database backups; do not move formal source data until cloud UAT is accepted and cutover is explicitly approved. Never commit local environment files or expose credentials in chat output.
