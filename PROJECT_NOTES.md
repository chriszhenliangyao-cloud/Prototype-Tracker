# Prototype Tracker Project Notes

## Current Goal

Maintain and extend the published bilingual operations collaboration platform. The current delivery focuses on the Marketing Asset Delivery Matrix: keep it fully visible without horizontal scrolling, make project gaps actionable, and synchronize its project list from Project Tracking so every newly created project is initialized automatically.

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
- Project phase and project lifecycle are independent. The lifecycle states are active, paused, launched closeout, archived and cancelled; created projects are never hard-deleted.
- The default project matrix includes active, paused and launched-closeout projects. Archived and cancelled projects remain read-only in the History scope and the complete Project Ledger.
- Project lifecycle transitions require a reason, accountable owner and effective date, retain immutable status history, and support restoring archived or cancelled projects.
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
- Marketing material names use English title case in both interface languages, while recognised abbreviations such as POSM remain uppercase. Saving a material updates the linked project's marketing workstream readiness, tasks, owner, next deadline and blockers.
- Each of the six standard marketing materials has a bilingual default delivery checklist. Project-specific item dialogs support check/uncheck, add, delete and restore-default actions; completion is calculated from checked items and stored with the material record.
- Checklist completion can advance ordinary not-started/in-progress work to completed, but review, missing and overdue remain explicit business states. Selecting completed checks every deliverable; reducing a completed checklist reopens it as in progress.
- The Marketing Assets matrix supports two persistent sort controls: Project/Product sorts by launch date and Total Progress sorts by calculated project completion. Each toggles ascending/descending; the default is launch date ascending (nearest launch first).
- Project Tracking is the source of truth for the Marketing Assets project list. Creating a project initializes all six standard assets as `not_started`; active, paused and closeout projects stay visible, while archived/cancelled records are retained but hidden from the current matrix.

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

## Key Decisions

- Do not overwrite the existing React routes with the standalone HTML prototype.
- Port behavior incrementally into React components and preserve existing Cloudflare deployment structure.
- Keep product behavior and integration contracts separate from browser-only prototype persistence.
- Implement and verify on the conversation branch; merge through a pull request rather than pushing directly to `main`.
- Keep the Vercel cloud app independent until the React implementation reaches feature parity.
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
- `PROJECT_NOTES.md`

## Verification

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
- Local review URL: `http://127.0.0.1:4178/?offline=1` while the local HTTP server is running from `cloud-app/`.

## Next Steps

1. Normalize Project, Marketing Asset Type and Marketing Asset Delivery records in Supabase so the browser prototype synchronization contract can become multi-user and transactional.
2. Define a separate translation-service contract for optional user-content translations while keeping original text canonical.
3. Define normalized API contracts for Forecast versions, Forecast lines, Shipment plans, Shipment milestones, Exceptions, Tasks and Approvals before enabling multi-user editing.

## Resume Instructions

Read this file, `cloud-app/README.md`, and both requirement documents, then inspect `git status`. Work on `codex/operations-planning-updates`; do not commit directly to `main`. Never commit `cloud-app/.env.local` or expose its publishable key in chat output.
