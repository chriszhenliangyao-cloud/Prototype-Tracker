# Roadmap Local Test Source Manifest

This directory is an isolated local prototype. The source Roadmap remains read-only and is not modified by this test.

## Read-only source

- Roadmap HTML: `/Users/julio/Documents/个人提升项目/codex-agent-team/data/artifacts/iniu-2026-retail-roadmap-20260729/iniu-2026-retail-roadmap-weekly.html`
- Baseline data: `/Users/julio/Documents/个人提升项目/codex-agent-team/data/artifacts/iniu-2026-retail-roadmap-20260729/iniu-roadmap-latest-baseline.json`
- Product images: `/Users/julio/Documents/个人提升项目/codex-agent-team/data/artifacts/iniu-2026-retail-roadmap-20260729/product-images`

## Source checksums before implementation

- Roadmap HTML SHA-256: `46a9c0c65d59178fedccbb5e756fef05c2ed431d8b9ee32f4d9c1630f9eae21a`
- Baseline JSON SHA-256: `0494fc66e321f8690a9c59b72583a1b04a059a39f010d3a2e523719a9f5f0c72`

## Local-test behavior

- The copied baseline JSON is fetched from `data/roadmap-baseline.json`.
- Test changes are stored only under the browser key `operationsPlanningRoadmapLocalTest.v1`.
- No API endpoint, Supabase table, Vercel project, or source file is written by this prototype.
- Resetting the prototype deletes only its local browser test key and reloads the copied baseline.
