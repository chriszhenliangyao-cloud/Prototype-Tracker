# Collaboration Platform Modular Monolith

## Runtime Baseline

- Primary domain: `https://operations-planning-hub.vercel.app`
- Application host: one Next.js deployment
- Authentication: one Supabase Google session and exact-email membership model
- Database: one Supabase project with separate platform and `commercial_planning` domain schemas
- Source tool: read-only and unchanged

## Route Ownership

| Route | Owner |
| --- | --- |
| `/platform/index.html` | Preserved operational workspaces: Project, Sales, Forecast, Logistics and Marketing |
| `/platform/workbench` | Native cross-module approval workbench |
| `/platform/business/value-chain/on-sale` | Native on-sale product simulation |
| `/platform/business/value-chain/new-product` | Native new-product simulation |
| `/platform/business/bp` | Native BP planning and achievement |
| `/platform/collaboration/monthly-approvals` | Native monthly promotion workflow |
| `/platform/collaboration/other-approvals` | Native other-approval workflow |
| `/platform/system/master-data` | Native commercial Master Data administration |
| `/api/platform/*` | Shared Master Data and approval-task contracts |

The static operational workspaces are generated into the Next.js `public`
output from the canonical `cloud-app` files before every build. Commercial
planning now renders under the native Next.js platform layout; the former
commercial iframe stage and embedded-auth bridge are not used by platform
navigation. The legacy standalone commercial routes remain available only as
rollback-compatible entry points.

## Performance Baseline

- Native platform routes stream the authenticated shell first and keep the
  selected URL across refreshes.
- Session resolution is request-deduplicated across root layout, platform
  layout and page rendering.
- Master Data loads by governed section instead of serializing every editable
  table into the first response. The overview response dropped from about
  5.5 MB to about 40 KB in the local production build.
- On-sale simulation paginates the 33-column workbook at 30 rows per page.
  The initial response dropped from about 10.8 MB to about 0.5 MB while all
  rows remain available to filters, calculations and export.
- Native navigation uses intent prefetch instead of prefetching every dynamic
  business page at startup.

## Session Model

The collaboration shell continues to use the Supabase browser client for
workspace documents and Realtime. After exact-email membership is verified, it
posts the active Supabase session to the same-origin `/auth/platform-session`
endpoint. The endpoint rejects foreign origins, validates the Supabase user and
commercial-planning access resolver, and writes the server-side cookies needed
by internal Next.js routes.

Tokens are never sent to the former standalone application or any other
origin. Native pages use the same Supabase server session and exact-email
authorization as the collaboration platform. Google OAuth remains the fallback
only when the platform session is absent or expired.

## Data Boundaries

Do not flatten commercial calculations, BP, promotion approvals and archives
into workspace-document tables. The `commercial_planning` schema remains the
transactional source for those workflows. Platform documents, permissions and
version history retain their existing RLS model. Shared identity and Master
Data contracts connect the domains.

Settlement remains excluded from the copied schema and runtime.

## Rollback

Vercel retains the preceding static-platform deployment and every unified
deployment. Rolling back the web deployment does not change database rows or
schema. The former `operations-commercial-planning-test.vercel.app` deployment
is retained temporarily for UAT comparison only and is no longer a runtime
dependency of the collaboration platform.

## Remaining Cutover Gates

1. Authenticated role-by-role UAT across all internal commercial routes.
2. Independent outbound approval-email configuration and delivery test.
3. Scheduled off-site logical backups or managed Supabase backup/PITR.
4. Rollback rehearsal and data-count reconciliation.
5. Explicit approval before decommissioning the former standalone copied app.
