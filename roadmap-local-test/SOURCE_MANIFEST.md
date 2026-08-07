# Roadmap Platform Source Manifest

This directory is the maintained source for the platform Roadmap module. The original Roadmap remains read-only and unchanged.

## Read-only source

- Roadmap HTML: `/Users/julio/Documents/个人提升项目/codex-agent-team/data/artifacts/iniu-2026-retail-roadmap-20260729/iniu-2026-retail-roadmap-weekly.html`
- Baseline data: `/Users/julio/Documents/个人提升项目/codex-agent-team/data/artifacts/iniu-2026-retail-roadmap-20260729/iniu-roadmap-latest-baseline.json`
- Product images: `/Users/julio/Documents/个人提升项目/codex-agent-team/data/artifacts/iniu-2026-retail-roadmap-20260729/product-images`

## Source checksums before implementation

- Roadmap HTML SHA-256: `46a9c0c65d59178fedccbb5e756fef05c2ed431d8b9ee32f4d9c1630f9eae21a`
- Baseline JSON SHA-256: `0494fc66e321f8690a9c59b72583a1b04a059a39f010d3a2e523719a9f5f0c72`

## Platform behavior

- The copied baseline JSON is fetched from `data/roadmap-baseline.json`.
- The source Roadmap files remain read-only. In the unified platform, governed business changes use the shared document key `productRoadmap.v1`; personal filters and view preferences use the browser-only key `productRoadmapPreferences.v1`.
- The legacy browser key `operationsPlanningRoadmapLocalTest.v1` is read once for safe migration and is never written again.
- The platform shell synchronizes the shared document to Supabase with immutable versions, audit events, offline retry, and conflict handling. The module never writes to the original Roadmap files.
- A Roadmap manager can restore the copied baseline as a new shared version. Existing history is preserved.
