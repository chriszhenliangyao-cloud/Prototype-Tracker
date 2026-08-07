# Commercial Planning Copy Scope

## Source Protection

The source application under `/Users/julio/Documents/个人提升项目/value-chain-calculator` is read-only for this project. No source files, production database records, Cognito configuration, AWS infrastructure, or production deployment may be changed during copy and parity testing.

## Included

- Value-chain normal and promotion calculators
- Quick new-product and product-set simulation
- Scenario save, comparison, and history
- Business Plan input, actuals, targets, analysis, versions, and workflow
- Monthly Promotion Plan submission and approval
- Other Approval requests and attachments
- Product, country, BOM, logistics, RRP, FX, and operational-margin master data
- Autosave, audit, Excel import/export, archive, and notification capabilities required by the included modules

## Excluded

- Settlement workspace and APIs
- Settlement cases, lines, audits, and archive snapshots
- Claim and credit-note reconciliation
- Gmail settlement evidence ingestion and matching
- CN reverse checks and settlement review confirmations
- Settlement-specific roles and navigation

The value-chain calculator field named `SettlementMode` remains included because it is an input to commercial scenario calculations, not the excluded settlement-ledger module.

## Isolation Rules

- Development occurs only in `commercial-planning-app/` and target-platform integration files.
- Target development initially uses synthetic/local seeded data.
- No target write path may connect to the source production RDS database.
- New navigation remains hidden from production users until parity and UAT gates pass.
- Production data migration is a separate, explicitly approved phase.

## Parity Gates

1. Business formulas and warning thresholds match golden source fixtures.
2. BP import/export, calculations, replacement behavior, and workflows match.
3. Promotion and other-approval state transitions, permissions, and attachments match.
4. Master-data validations and archives match.
5. The target contains no Settlement, Gmail evidence, Claim/CN, or reverse-check routes, tables, or scripts.
6. Existing collaboration-platform modules continue to build and operate unchanged.
