# Prototype Tracker Project Notes

## Current Goal

Use this repository as the implementation source for the operations-planning tool discussed in the active Codex conversation. The product has two peer modules: `产销管理` and `项目跟进`.

## Repository Context

- Remote: `https://github.com/chriszhenliangyao-cloud/Prototype-Tracker.git`
- Default branch: `main`
- Conversation work branch: `codex/operations-planning-updates`
- Production stack: React Router 7, TypeScript, Cloudflare Workers, Wrangler
- Sales route: `app/routes/sales-inventory.tsx`
- Project route: `app/routes/project-progress.tsx`
- Existing product requirements: `docs/SALES_INVENTORY_REQUIREMENTS.md` and `docs/PROJECT_PROGRESS_REQUIREMENTS.md`
- Latest high-fidelity standalone reference: `/Users/julio/Documents/Analysis tool/sales-inventory-tool/index.html`

The standalone reference is a design and behavior source, not a file to copy over the React application. Features should be ported into the repository's existing route, state, and styling structure.

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
- Project delays create immutable timeline revisions with cause, accountable owner, mitigation, complete before/after dates, and downstream impact. Repeated delays preserve the original baseline and every intermediate version.
- Sales & Inventory first-batch Forecast and Supply values feed the Project Supply workstream as read-only data.
- Account and permission management belongs to the application shell, not inside the monthly planning workflow.

## Current State

- The GitHub repository has been cloned locally and the conversation branch has been created.
- The repository's current Sales route is an earlier English/localStorage implementation and does not yet contain the full Chinese collaboration workflow from the standalone reference.
- The Project route already contains substantial project-tracking functionality and should be evolved in place.
- Remote reads work. Remote writes are currently blocked because the local HTTPS credential is invalid and the connected GitHub integration does not have write access to this repository.

## Key Decisions

- Do not overwrite the repository with the standalone HTML prototype.
- Port behavior incrementally into React components and preserve existing Cloudflare deployment structure.
- Keep product behavior and integration contracts separate from browser-only prototype persistence.
- Implement and verify on the conversation branch; merge through a pull request rather than pushing directly to `main`.

## Changed Files

- `PROJECT_NOTES.md`

## Verification

- Repository cloned successfully from `origin/main` at commit `85102253bea9cb760fd602b6cd6f201de637b3b4`.
- Local branch `codex/operations-planning-updates` created from `main`.
- Remote branch creation and push were attempted but rejected with HTTP 403 / invalid GitHub credential.

## Next Steps

1. Grant the connected GitHub app or user write access to `chriszhenliangyao-cloud/Prototype-Tracker`, or refresh the local GitHub credential.
2. Push `codex/operations-planning-updates` and open a draft pull request.
3. Port the current Chinese Sales & Inventory collaboration workflow from the standalone reference into `app/routes/sales-inventory.tsx` and focused components.
4. Run `npm run typecheck` and `npm run build`, then verify both routes in desktop and compact browser viewports.

## Resume Instructions

Read this file and both requirement documents, inspect `git status`, then compare the React Sales route with the standalone reference before implementing. Work on `codex/operations-planning-updates`; do not commit directly to `main`.
