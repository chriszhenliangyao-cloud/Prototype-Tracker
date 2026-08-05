# Prototype Tracker Project Notes

## Current Goal

Use this repository as the implementation source for the operations-planning tool discussed in the active Codex conversation. The product has two peer modules: `产销管理` and `项目跟进`.

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

## Key Decisions

- Do not overwrite the existing React routes with the standalone HTML prototype.
- Port behavior incrementally into React components and preserve existing Cloudflare deployment structure.
- Keep product behavior and integration contracts separate from browser-only prototype persistence.
- Implement and verify on the conversation branch; merge through a pull request rather than pushing directly to `main`.
- Keep the Vercel cloud app independent until the React implementation reaches feature parity.
- Use exact-email authorization with Google OAuth. Supabase roles control workspace-level access; in-app account permissions control department/workstream scope.

## Changed Files

- `cloud-app/index.html`
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

## Next Steps

1. Sign in with the first authorized administrator email, authorize one editor and one viewer, then verify cross-browser Realtime updates and access restrictions with real sessions.
2. Install and authenticate GitHub CLI, then push `codex/operations-planning-updates` and open a draft pull request. The current HTTPS credential is rejected by GitHub.
3. Port the current Chinese Sales & Inventory collaboration workflow from the standalone reference into `app/routes/sales-inventory.tsx` and focused components.
4. Replace shared JSON documents with normalized domain tables when field-level multi-user editing becomes the priority.

## Resume Instructions

Read this file, `cloud-app/README.md`, and both requirement documents, then inspect `git status`. Work on `codex/operations-planning-updates`; do not commit directly to `main`. Never commit `cloud-app/.env.local` or expose its publishable key in chat output.
