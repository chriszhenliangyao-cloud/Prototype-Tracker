# Commercial Planning Domain Copy

This isolated Next.js application is the target-platform copy of the mature commercial-planning business domain. It preserves the value-chain, BP, approval, master-data, Excel, autosave, and audit behavior while deliberately excluding Settlement and Gmail evidence features.

The source application is read-only. All development and test data live in this directory or in the target platform's isolated `commercial_planning` database schema. The deployed copy has no runtime dependency on the source application, its APIs, or its cloud database.

## Local Verification

```bash
npm install
npm run db:init
npm test
npm run build
```

The app runs locally at `http://localhost:3010`. Its cloud deployment is an independent UAT environment connected only to the Operations Planning Hub Supabase project.

## Platform Preview

Start this app with `npm run dev`. In a second terminal, serve `cloud-app` on port `4173`, then open:

`http://127.0.0.1:4173/index.html?offline=1&commercialPlanningPreview=1&commercialPlanningUrl=http%3A%2F%2F127.0.0.1%3A3010`

The query parameters remain available for local overrides. In cloud UAT, the platform receives the independent app URL from its own `COMMERCIAL_PLANNING_URL` environment variable.

## Platform Authentication

Production uses the collaboration platform's existing Supabase Google exact-email authorization:

```dotenv
AUTH_REQUIRED=1
AUTH_PROVIDER=supabase
APP_URL=https://commercial-planning.example.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Only members of the `operations-planning` workspace can sign in. Optional records in `commercial_planning.app_user_roles` refine the business role without creating another account directory.

Run `npm run validate:copy-scope`, `npm test`, and `npm run build:vercel` before every deployment. Test data can be copied from `prisma/dev.db` into a new, empty target schema with `npm run db:copy:test-to:prod`. Formal source data is migrated only after business UAT acceptance and an explicit cutover approval.
