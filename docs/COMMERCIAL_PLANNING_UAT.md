# Commercial Planning Copy UAT

## Current Gate

- Source application remains read-only and unchanged.
- The copied application runs independently on port `3010`.
- The collaboration-platform preview on port `4173` embeds copied routes directly in their target workspaces by default; `commercialPlanningPreview=0` is the explicit local opt-out and there is no separate preview-entry button.
- Embedded rendering keeps the collaboration-platform sidebar and hides the copied application's global header. Platform-style spacing, borders, focus states, and primary-button colors apply only in embedded mode.
- Settlement ledger, settlement evidence, Gmail evidence, CN reverse, and settlement review functions are excluded.
- The target Supabase schema migration exists locally but has not been applied.
- Formal business data migration has not started.

## Module Acceptance

| Platform module | Copied route | Acceptance focus |
| --- | --- | --- |
| Value Chain Simulation | `/` and `/normal` | Calculation inputs, outputs, export, saved scenarios |
| New product simulation | `/simulation` | Quick product and product-set simulation |
| BP achievement | `/business-plan` | BP input, actuals, achievement, status workflow, export |
| Monthly promotion approval | `/promotion` | Monthly plans, validation, submission, two-step approval, history |
| Other approvals | `/promotion?workspace=other-approvals` | Create, attachments, submit, review, return, approve, audit |
| Master data | `/master-data` | Products, markets, costs, margins, access scope, import/export |

## Technical Results

- TypeScript: pass.
- Automated tests: 54 files, 337 tests passed.
- Next.js production build: pass.
- Existing platform production build: pass.
- Browser route smoke test: pass; no console errors.
- Direct workspace embedding: pass for BP achievement, Value Chain Simulation, monthly promotion approval, other approvals, and commercial master data. No duplicate copied header or separate preview button is rendered.
- Embedded approval pages use the platform navigation as the single module switcher: monthly promotion and other approvals no longer render the copied two-button navigator or combined cross-module queue. The standalone copied application retains both controls.
- Embedded-only visual adaptation now matches platform density and tokens for headings, cards, tables, filters, form controls, primary actions and focus states without changing business behavior.
- The local static preview uses `npm run dev:static` and sends no-cache headers so UI changes are not masked by stale HTML.
- Clean PostgreSQL 17 migration rehearsal: pass; 34 RLS-enabled copied tables, zero settlement tables, access resolver verified.
- Production dependency audit: zero known vulnerabilities after the target-only Next.js patch update and dependency overrides.
- Copy scope validator: must pass before each preview deployment.

## Business UAT Checklist

1. Finance checks three value-chain cases against the source tool, including one normal and two promotion scenarios.
2. Sales checks BP import, monthly totals, PO achievement, and exported workbook formulas.
3. Marketing checks one monthly promotion through submission and both approvals.
4. A requester and approver complete one other-approval cycle with an attachment and return-for-revision.
5. An administrator verifies exact-email access, viewer restrictions, master-data edits, and audit records.
6. All reviewers confirm that no settlement workspace or settlement records are visible.

## Formal Migration Gate

Formal migration begins only after all six checks are signed off. The run must use a new `copy_import_batches` record, preserve every legacy ID in `copy_legacy_id_map`, compare source and target row counts and checksums, and retain the source as the rollback authority until production acceptance.
