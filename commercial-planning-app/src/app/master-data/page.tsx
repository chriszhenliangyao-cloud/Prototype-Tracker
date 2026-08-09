import {
  createMasterRecord,
  createUserCountryAccess,
  deleteMasterRecord,
  deleteUserCountryAccess,
  type ImportActionState,
  type ImportSheetSummary,
  updateMasterRecord
} from "./actions";
import Link from "next/link";
import { EuropeanDateInput } from "@/components/EuropeanDateInput";
import { MasterDataImportPanel } from "@/components/MasterDataImportPanel";
import { requireMasterDataEditor } from "@/lib/auth/server";
import {
  getMasterData,
  getRecentMasterDataArchives,
  getUserCountryAccesses
} from "@/lib/data";
import {
  canEditMasterData,
  canManageUserCountryAccess
} from "@/lib/auth/roles";
import {
  formatEuropeanDateTime,
  formatMoney,
  formatPercent,
  toInputDate
} from "@/lib/format";
import type {
  MasterDataArchiveOption,
  ProductLifecycleStatus,
  ReferenceData,
  RecordStatus,
  UserCountryAccessOption
} from "@/lib/types";

export const dynamic = "force-dynamic";

const inputClass =
  "h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200";
const buttonClass =
  "rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white";
const ghostButtonClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
const deleteButtonClass =
  "rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50";

type MasterDataPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type MasterDataSection =
  | "overview"
  | "markets"
  | "products"
  | "pricing"
  | "margins"
  | "access";

export default async function MasterDataPage({
  searchParams
}: MasterDataPageProps) {
  return MasterDataWorkspace({
    searchParams,
    returnTo: "/master-data"
  });
}

export async function MasterDataWorkspace({
  searchParams,
  returnTo
}: MasterDataPageProps & { returnTo: string }) {
  const session = await requireMasterDataEditor(returnTo);
  const params = searchParams ? await searchParams : {};
  const activeSection = parseMasterDataSection(params.section);
  const importResult = parseImportResult(params);
  const showCountryAccess =
    activeSection === "access" && canManageUserCountryAccess(session.role);
  const [data, archives, countryAccesses] = await Promise.all([
    getMasterData(),
    activeSection === "overview"
      ? getRecentMasterDataArchives()
      : Promise.resolve([]),
    showCountryAccess ? getUserCountryAccesses() : Promise.resolve([])
  ]);

  return (
    <div className="grid min-w-0 gap-3 overflow-x-clip">
      <section className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">Master Data</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Govern product, market, price, cost and margin defaults for every module.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="rounded-md bg-slate-100 px-2 py-1">Preview before publish</span>
          <span className="rounded-md bg-slate-100 px-2 py-1">Snapshots retained</span>
          <span className="rounded-md bg-slate-100 px-2 py-1">Platform-wide refresh</span>
        </div>
      </section>

      <MasterDataSectionNav
        activeSection={activeSection}
        showAccess={canManageUserCountryAccess(session.role)}
      />

      {activeSection === "overview" ? (
        <>
          <ImportSection importResult={importResult} />
          <ArchiveReminderSection
            archives={archives}
            showArchiveLinks={canEditMasterData(session.role)}
          />
          <DataOverview data={data} />
        </>
      ) : null}
      {showCountryAccess ? (
        <UserCountryAccessSection data={data} accessRows={countryAccesses} />
      ) : null}
      {activeSection === "markets" ? (
        <>
          <CountriesSection data={data} />
          <ExchangeRateSection data={data} />
        </>
      ) : null}
      {activeSection === "products" ? (
        <>
          <ProductsSection data={data} />
          <BomSection data={data} />
        </>
      ) : null}
      {activeSection === "pricing" ? (
        <>
          <ProductCountryRrpSection data={data} />
          <LogisticsSection data={data} />
        </>
      ) : null}
      {activeSection === "margins" ? (
        <OperationalMarginsSection data={data} />
      ) : null}
    </div>
  );
}

function MasterDataSectionNav({
  activeSection,
  showAccess
}: {
  activeSection: MasterDataSection;
  showAccess: boolean;
}) {
  const sections: Array<{ key: MasterDataSection; label: string }> = [
    { key: "overview", label: "Overview & Import" },
    { key: "markets", label: "Markets & FX" },
    { key: "products", label: "Products & BOM" },
    { key: "pricing", label: "RRP & Logistics" },
    { key: "margins", label: "Commercial Margins" },
    ...(showAccess
      ? [{ key: "access" as const, label: "Country Access" }]
      : [])
  ];

  return (
    <nav
      aria-label="Master Data sections"
      className="flex min-w-0 flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
    >
      {sections.map((section) => (
        <Link
          key={section.key}
          href={`?section=${section.key}`}
          prefetch={false}
          aria-current={activeSection === section.key ? "page" : undefined}
          className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
            activeSection === section.key
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          }`}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}

function parseMasterDataSection(
  value: string | string[] | undefined
): MasterDataSection {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "markets" ||
    candidate === "products" ||
    candidate === "pricing" ||
    candidate === "margins" ||
    candidate === "access"
    ? candidate
    : "overview";
}

function ImportSection({
  importResult
}: {
  importResult: ImportActionState | null;
}) {
  return (
    <section className="grid min-w-0 gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <div className="grid min-w-0 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Master Data Workbook Upload
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload one Excel file containing the required sheets. The importer
            uses EXR for country VAT, currency, and local-to-EUR RRP conversion.
          </p>
        </div>
        <MasterDataImportPanel
          title="Single source workbook"
          description="Updates products, BOM, country RRP, logistics, VAT/FX, and retailer/FD margins in one pass."
          columns={[
            "Bom cost",
            "RRP",
            "Margin data",
            "Logistic cost",
            "EXR"
          ]}
          aliases={[
            "BOM/RRP/Margin/Logistics/FX sheets in the same .xlsx file"
          ]}
          example={[
            "Launched",
            "P72-P1",
            "59.99 EUR",
            "DDP Power bank",
            "23% VAT"
          ]}
          fieldsLabel="Required sheets"
          submitLabel="Import workbook"
          result={importResult}
        />
      </div>
      <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-950">
          Workbook contract
        </h3>
        <div className="mt-3 min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full table-fixed border-collapse text-xs">
            <tbody>
              <SheetGuideRow sheet="Bom cost" fields="Lifecycle Status, Model, Name/Product, Category, Bom (RMB), Bom (EUR)" />
              <SheetGuideRow sheet="RRP" fields="Country, Model, Product, RRP, Currency" />
              <SheetGuideRow sheet="Margin data" fields="Country, Retailer, FD, Incoterms, Category, KA/FD margins" />
              <SheetGuideRow sheet="Logistic cost" fields="Incoterms, Category, RMB, EUR" />
              <SheetGuideRow sheet="EXR" fields="Country code, Currency, EXR, VAT" />
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
          <p><strong className="text-slate-900">Current defaults</strong> update selectors and calculations after publish.</p>
          <p><strong className="text-slate-900">Historical records</strong> retain saved prices, costs, margins and approval snapshots.</p>
          <p><strong className="text-slate-900">Removed rows</strong> become inactive and remain available for audit.</p>
        </div>
      </div>
    </section>
  );
}

function ArchiveReminderSection({
  archives,
  showArchiveLinks
}: {
  archives: MasterDataArchiveOption[];
  showArchiveLinks: boolean;
}) {
  const latestArchive = archives[0];
  const historicalArchives = archives.slice(1);

  return (
    <section className="grid min-w-0 gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Master Data Update Archive
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Every formal list save or Master Data change generates an Excel
            snapshot for manager review and future Google Drive filing.
          </p>
        </div>
        <a
          className={ghostButtonClass}
          href="/api/master-data/export?source=manual"
        >
          Export current workbook
        </a>
      </div>

      {archives.length === 0 ? (
        <EmptyState>No Master Data archive has been generated yet.</EmptyState>
      ) : (
        <div className="grid gap-2">
          <ArchiveRecordRow
            archive={latestArchive}
            showArchiveLinks={showArchiveLinks}
          />
          {historicalArchives.length > 0 ? (
            <details className="group rounded-md border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-slate-600 marker:hidden hover:bg-slate-50">
                <span>
                  Archive history · {historicalArchives.length} older records
                </span>
                <span className="text-slate-400 group-open:hidden">Open</span>
                <span className="hidden text-slate-400 group-open:inline">
                  Close
                </span>
              </summary>
              <div className="grid gap-2 border-t border-slate-200 p-2">
                {historicalArchives.map((archive) => (
                  <ArchiveRecordRow
                    key={archive.id}
                    archive={archive}
                    showArchiveLinks={showArchiveLinks}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ArchiveRecordRow({
  archive,
  showArchiveLinks
}: {
  archive: MasterDataArchiveOption;
  showArchiveLinks: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-950">
            {archive.title}
          </h3>
          <ArchiveStatusBadge status={archive.driveStatus} />
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {archive.message}
        </p>
      </div>
      <div className="min-w-0 text-xs text-slate-500">
        <p className="truncate">
          {archive.sourceReference
            ? `${sourceLabel(archive.source)} · ${archive.sourceReference}`
            : sourceLabel(archive.source)}
        </p>
        <p>{formatArchiveDate(archive.createdAt)}</p>
        {archive.createdByEmail ? (
          <p className="truncate">{archive.createdByEmail}</p>
        ) : null}
      </div>
      {showArchiveLinks ? (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {archive.driveUrl ? (
            <a
              className="rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-800"
              href={archive.driveUrl}
              rel="noreferrer"
              target="_blank"
            >
              Drive
            </a>
          ) : null}
          <a
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            href={`/api/master-data/archives/${archive.id}/download`}
          >
            Download Excel
          </a>
        </div>
      ) : null}
    </div>
  );
}

function parseImportResult(
  searchParams: Record<string, string | string[] | undefined>
): ImportActionState | null {
  const status = singleValue(searchParams.importStatus);
  if (status !== "success" && status !== "error") {
    return null;
  }

  return {
    status,
    message: singleValue(searchParams.message),
    imported: numberValue(searchParams.imported),
    updated: numberValue(searchParams.updated),
    skipped: numberValue(searchParams.skipped),
    summary: parseSummary(singleValue(searchParams.summary)),
    errors: [0, 1, 2, 3]
      .map((index) => singleValue(searchParams[`error${index}`]))
      .filter(Boolean)
      .map((message) => ({
        rowNumber: 0,
        message
      })),
    duplicateKeys: []
  };
}

function parseSummary(value: string): ImportSheetSummary[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as ImportSheetSummary[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item) => typeof item.label === "string" && typeof item.rows === "number"
    );
  } catch {
    return [];
  }
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function numberValue(value: string | string[] | undefined) {
  const number = Number(singleValue(value));
  return Number.isFinite(number) ? number : 0;
}

function SheetGuideRow({ sheet, fields }: { sheet: string; fields: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <th className="w-[112px] px-3 py-2 text-left align-top font-semibold text-slate-800">
        {sheet}
      </th>
      <td className="break-words px-3 py-2 text-slate-500">{fields}</td>
    </tr>
  );
}

function DataOverview({ data }: { data: ReferenceData }) {
  const activeCount = (items: Array<{ status: RecordStatus }>) =>
    items.filter((item) => item.status === "ACTIVE").length;
  const exchangeRates = data.exchangeRates ?? [];
  const stats = [
    ["Countries", activeCount(data.countries), data.countries.length],
    ["EXR", activeCount(exchangeRates), exchangeRates.length],
    ["Products", activeCount(data.products), data.products.length],
    ["BOM", activeCount(data.bomCosts), data.bomCosts.length],
    ["RRP", activeCount(data.productCountryRrps), data.productCountryRrps.length],
    ["Logistics", activeCount(data.logisticsCosts), data.logisticsCosts.length],
    [
      "Operational Margin",
      activeCount(data.operationalMargins),
      data.operationalMargins.length
    ]
  ];

  return (
    <section className="grid min-w-0 gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          Data Coverage
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Compact import status across the records used by On-sale Product
          Simulation and Promotion Plan.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {stats.map(([label, active, total]) => (
          <div
            key={label}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <p className="text-xs font-semibold uppercase text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              {active} active
            </p>
            <p className="text-xs text-slate-500">{total} total records</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserCountryAccessSection({
  data,
  accessRows
}: {
  data: ReferenceData;
  accessRows: UserCountryAccessOption[];
}) {
  return (
    <MasterSection
      title="User Roles & Permissions"
      count={accessRows.length}
      defaultOpen
    >
      <form
        action={createUserCountryAccess}
        className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(220px,1.2fr)_minmax(150px,0.8fr)_160px_180px_180px_150px_130px_auto]"
      >
        <Input name="email" placeholder="user@example.com" type="email" />
        <Input name="label" placeholder="Team / owner" required={false} />
        <select className={inputClass} name="role" defaultValue="VIEWER">
          <option value="VIEWER">Viewer</option>
          <option value="KA_OWNER">KA owner</option>
          <option value="SALES_MANAGER">Sales manager</option>
          <option value="FINANCE">Finance</option>
          <option value="GM">GM</option>
          <option value="ADMIN">Admin</option>
          <option value="GTM_LEADER">GTM leader</option>
          <option value="OWNER">Owner</option>
        </select>
        <select className={inputClass} name="countryCode" defaultValue="GLOBAL">
          <option value="GLOBAL">All countries</option>
          {data.countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.code} - {country.name}
            </option>
          ))}
        </select>
        <select className={inputClass} name="approvalRole" defaultValue="NONE">
          <option value="NONE">No approval</option>
          <option value="FIRST_APPROVER">First approver</option>
          <option value="FINAL_APPROVER">Final approver</option>
        </select>
        <select
          className={inputClass}
          name="receivesPromotionPlanEmail"
          defaultValue="NO"
        >
          <option value="NO">No email copy</option>
          <option value="YES">Email copy</option>
        </select>
        <StatusSelect />
        <button className={buttonClass} type="submit">
          Save user
        </button>
      </form>
      <div className="grid gap-2">
        {accessRows.length === 0 ? (
          <EmptyState>No user permission records yet.</EmptyState>
        ) : (
          accessRows.map((access) => (
            <form
              key={access.id}
              action={deleteUserCountryAccess}
              className="grid gap-2 rounded-md border border-slate-200 p-3 lg:grid-cols-[minmax(210px,1.2fr)_minmax(130px,0.8fr)_130px_130px_145px_125px_120px_160px_auto]"
            >
              <input type="hidden" name="id" value={access.id} />
              <ReadOnlyField label="Email">{access.email}</ReadOnlyField>
              <ReadOnlyField label="Label">
                {access.label ?? "-"}
              </ReadOnlyField>
              <ReadOnlyField label="Role">
                {formatUserRole(access.role)}
              </ReadOnlyField>
              <ReadOnlyField label="Scope">
                {access.countryCode === "GLOBAL"
                  ? "All countries"
                  : access.countryCode}
              </ReadOnlyField>
              <ReadOnlyField label="Approval">
                {formatApprovalRole(access.approvalRole)}
              </ReadOnlyField>
              <ReadOnlyField label="Email copy">
                {access.receivesPromotionPlanEmail ? "Yes" : "No"}
              </ReadOnlyField>
              <ReadOnlyField label="Status">
                <StatusBadge status={access.status} />
              </ReadOnlyField>
              <ReadOnlyField label="Created by">
                {access.createdByEmail ?? "-"}
              </ReadOnlyField>
              <button className={deleteButtonClass} type="submit">
                Remove
              </button>
            </form>
          ))
        )}
      </div>
    </MasterSection>
  );
}

function formatUserRole(role: UserCountryAccessOption["role"]) {
  const labels: Record<UserCountryAccessOption["role"], string> = {
    OWNER: "Owner",
    GTM_LEADER: "GTM leader",
    GM: "GM",
    ADMIN: "Admin",
    FINANCE: "Finance",
    SALES_MANAGER: "Sales manager",
    KA_OWNER: "KA owner",
    VIEWER: "Viewer"
  };
  return labels[role];
}

function formatApprovalRole(
  approvalRole: UserCountryAccessOption["approvalRole"]
) {
  const labels: Record<UserCountryAccessOption["approvalRole"], string> = {
    NONE: "No approval",
    FIRST_APPROVER: "First approver",
    FINAL_APPROVER: "Final approver"
  };
  return labels[approvalRole];
}

function CountriesSection({ data }: { data: ReferenceData }) {
  return (
    <MasterSection title="Countries / VAT" count={data.countries.length}>
      <form action={createMasterRecord} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <input type="hidden" name="entity" value="country" />
        <Input name="name" placeholder="Spain" />
        <Input name="code" placeholder="ES" />
        <Input name="vatRate" placeholder="0.21" type="number" step="0.001" />
        <Input name="currency" placeholder="EUR" />
        <Input name="effectiveDate" type="date" defaultValue="2026-01-01" />
        <StatusSelect />
        <button className={buttonClass} type="submit">
          Add country
        </button>
      </form>
      <div className="grid gap-2">
        {data.countries.map((country) => (
          <form
            key={country.id}
            action={updateMasterRecord}
            className="grid min-w-0 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
          >
            <input type="hidden" name="entity" value="country" />
            <input type="hidden" name="id" value={country.id} />
            <Input name="name" defaultValue={country.name} />
            <Input name="code" defaultValue={country.code} />
            <Input
              name="vatRate"
              defaultValue={country.vatRate}
              type="number"
              step="0.001"
            />
            <Input name="currency" defaultValue={country.currency} />
            <Input
              name="effectiveDate"
              type="date"
              defaultValue={toInputDate(country.effectiveDate)}
            />
            <StatusSelect defaultValue={country.status} />
            <button className={ghostButtonClass} type="submit">
              Save
            </button>
            <button className={deleteButtonClass} formAction={deleteMasterRecord} formNoValidate>
              Delete
            </button>
          </form>
        ))}
      </div>
    </MasterSection>
  );
}

function ExchangeRateSection({ data }: { data: ReferenceData }) {
  const exchangeRates = data.exchangeRates ?? [];

  return (
    <MasterSection title="EXR / Currency Rates" count={exchangeRates.length}>
      <form action={createMasterRecord} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <input type="hidden" name="entity" value="exchangeRate" />
        <Input name="currency" placeholder="RMB" />
        <Input
          name="exchangeRateToEur"
          placeholder="7.80"
          type="number"
          step="0.0001"
        />
        <Input name="effectiveDate" type="date" defaultValue="2026-01-01" />
        <StatusSelect />
        <button className={buttonClass} type="submit">
          Add EXR
        </button>
      </form>
      <div className="grid gap-2">
        {exchangeRates.length === 0 ? (
          <EmptyState>No exchange-rate records.</EmptyState>
        ) : (
          exchangeRates.map((rate) => (
            <form
              key={rate.id}
              action={updateMasterRecord}
              className="grid min-w-0 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            >
              <input type="hidden" name="entity" value="exchangeRate" />
              <input type="hidden" name="id" value={rate.id} />
              <Input name="currency" defaultValue={rate.currency} />
              <Input
                name="exchangeRateToEur"
                defaultValue={rate.exchangeRateToEur}
                type="number"
                step="0.0001"
              />
              <Input
                name="effectiveDate"
                type="date"
                defaultValue={toInputDate(rate.effectiveDate)}
              />
              <StatusSelect defaultValue={rate.status} />
              <button className={ghostButtonClass} type="submit">
                Save
              </button>
              <button className={deleteButtonClass} formAction={deleteMasterRecord} formNoValidate>
                Delete
              </button>
            </form>
          ))
        )}
      </div>
    </MasterSection>
  );
}

function ProductsSection({ data }: { data: ReferenceData }) {
  return (
    <MasterSection title="Products" count={data.products.length}>
      <form action={createMasterRecord} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <input type="hidden" name="entity" value="product" />
        <Input name="sku" placeholder="CHG-65W-EU" />
        <Input name="name" placeholder="65W GaN Fast Charger" />
        <Input name="category" placeholder="Charger" />
        <Input name="capacity" placeholder="Compact" required={false} />
        <LifecycleSelect />
        <Input
          name="plannedLaunchAt"
          type="date"
          placeholder="Planned launch date"
          required={false}
        />
        <StatusSelect />
        <button className={buttonClass} type="submit">
          Add product
        </button>
      </form>
      <div className="grid gap-2">
        {data.products.map((product) => (
          <form
            key={product.id}
            action={updateMasterRecord}
            className="grid min-w-0 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-9"
          >
            <input type="hidden" name="entity" value="product" />
            <input type="hidden" name="id" value={product.id} />
            <Input name="sku" defaultValue={product.sku} />
            <Input name="name" defaultValue={product.name} />
            <Input name="category" defaultValue={product.category} />
            <Input
              name="capacity"
              defaultValue={product.capacity ?? ""}
              required={false}
            />
            <LifecycleSelect defaultValue={product.lifecycleStatus} />
            <Input
              name="plannedLaunchAt"
              type="date"
              defaultValue={toInputDate(product.plannedLaunchAt ?? "")}
              placeholder="Planned launch date"
              required={false}
            />
            <StatusSelect defaultValue={product.status} />
            <button className={ghostButtonClass} type="submit">
              Save
            </button>
            <button className={deleteButtonClass} formAction={deleteMasterRecord} formNoValidate>
              Delete
            </button>
          </form>
        ))}
      </div>
    </MasterSection>
  );
}

function BomSection({ data }: { data: ReferenceData }) {
  return (
    <MasterSection title="BOM Costs" count={data.bomCosts.length}>
      <form action={createMasterRecord} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <input type="hidden" name="entity" value="bomCost" />
        <ProductSelect data={data} />
        <Input name="bomCost" placeholder="18.50" type="number" step="0.01" />
        <Input
          name="bomCostRmb"
          placeholder="145.00"
          type="number"
          step="0.01"
          required={false}
        />
        <Input name="currency" placeholder="EUR" />
        <Input name="effectiveDate" type="date" defaultValue="2026-01-01" />
        <StatusSelect />
        <button className={buttonClass} type="submit">
          Add BOM
        </button>
      </form>
      <div className="grid gap-2">
        {data.bomCosts.map((cost) => (
          <form
            key={cost.id}
            action={updateMasterRecord}
            className="grid min-w-0 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8"
          >
            <input type="hidden" name="entity" value="bomCost" />
            <input type="hidden" name="id" value={cost.id} />
            <ProductSelect data={data} defaultValue={cost.productId} />
            <Input
              name="bomCost"
              defaultValue={cost.bomCost}
              type="number"
              step="0.01"
            />
            <Input
              name="bomCostRmb"
              defaultValue={cost.bomCostRmb ?? ""}
              type="number"
              step="0.01"
              required={false}
            />
            <Input name="currency" defaultValue={cost.currency} />
            <Input
              name="effectiveDate"
              type="date"
              defaultValue={toInputDate(cost.effectiveDate)}
            />
            <StatusSelect defaultValue={cost.status} />
            <button className={ghostButtonClass} type="submit">
              Save
            </button>
            <button className={deleteButtonClass} formAction={deleteMasterRecord} formNoValidate>
              Delete
            </button>
          </form>
        ))}
      </div>
    </MasterSection>
  );
}

function ProductCountryRrpSection({ data }: { data: ReferenceData }) {
  return (
    <MasterSection
      title="Product Country RRP"
      count={data.productCountryRrps.length}
    >
      <div className="grid gap-2">
        {data.productCountryRrps.length === 0 ? (
          <EmptyState>No RRP records.</EmptyState>
        ) : (
          data.productCountryRrps.map((rrp) => (
            <div
              key={rrp.id}
              className="grid min-w-0 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8"
            >
              <ReadOnlyField label="Status">
                <StatusBadge status={rrp.status} />
              </ReadOnlyField>
              <ReadOnlyField label="Country">{rrp.countryCode}</ReadOnlyField>
              <ReadOnlyField label="Model">{rrp.productSku}</ReadOnlyField>
              <ReadOnlyField label="Product">{rrp.productName}</ReadOnlyField>
              <ReadOnlyField label="RRP local">
                {formatMoney(rrp.rrpLocal, rrp.currency)}
              </ReadOnlyField>
              <ReadOnlyField label="RRP EUR">
                {formatMoney(rrp.rrpEur, "EUR")}
              </ReadOnlyField>
              <ReadOnlyField label="Currency">{rrp.currency}</ReadOnlyField>
              <ReadOnlyField label="Effective">
                {toInputDate(rrp.effectiveDate)}
              </ReadOnlyField>
            </div>
          ))
        )}
      </div>
    </MasterSection>
  );
}

function LogisticsSection({ data }: { data: ReferenceData }) {
  return (
    <MasterSection title="Logistics Costs" count={data.logisticsCosts.length}>
      <form action={createMasterRecord} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        <input type="hidden" name="entity" value="logisticsCost" />
        <CountrySelect data={data} />
        <Input name="category" placeholder="Charger" />
        <Input name="productSize" placeholder="Compact" />
        <Input
          name="logisticsCost"
          placeholder="2.10"
          type="number"
          step="0.01"
        />
        <Input name="currency" placeholder="EUR" />
        <Input name="effectiveDate" type="date" defaultValue="2026-01-01" />
        <StatusSelect />
        <button className={buttonClass} type="submit">
          Add logistics
        </button>
      </form>
      <div className="grid gap-2">
        {data.logisticsCosts.map((cost) => (
          <form
            key={cost.id}
            action={updateMasterRecord}
            className="grid min-w-0 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-9"
          >
            <input type="hidden" name="entity" value="logisticsCost" />
            <input type="hidden" name="id" value={cost.id} />
            <CountrySelect data={data} defaultValue={cost.countryId} />
            <Input name="category" defaultValue={cost.category} />
            <Input name="productSize" defaultValue={cost.productSize} />
            <Input
              name="logisticsCost"
              defaultValue={cost.logisticsCost}
              type="number"
              step="0.01"
            />
            <Input name="currency" defaultValue={cost.currency} />
            <Input
              name="effectiveDate"
              type="date"
              defaultValue={toInputDate(cost.effectiveDate)}
            />
            <StatusSelect defaultValue={cost.status} />
            <button className={ghostButtonClass} type="submit">
              Save
            </button>
            <button className={deleteButtonClass} formAction={deleteMasterRecord} formNoValidate>
              Delete
            </button>
          </form>
        ))}
      </div>
    </MasterSection>
  );
}

function OperationalMarginsSection({ data }: { data: ReferenceData }) {
  return (
    <MasterSection
      title="Operational Margins"
      count={data.operationalMargins.length}
    >
      <div className="grid gap-2">
        {data.operationalMargins.length === 0 ? (
          <EmptyState>No operational margin records.</EmptyState>
        ) : (
          data.operationalMargins.map((margin) => (
            <div
              key={margin.id}
              className="grid min-w-0 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
            >
              <ReadOnlyField label="Status">
                <StatusBadge status={margin.status} />
              </ReadOnlyField>
              <ReadOnlyField label="Country">
                {margin.countryCode}
              </ReadOnlyField>
              <ReadOnlyField label="Retailer">
                {margin.retailerName}
              </ReadOnlyField>
              <ReadOnlyField label="FD">{margin.fdName}</ReadOnlyField>
              <ReadOnlyField label="Incoterms">
                {margin.incoterms}
              </ReadOnlyField>
              <ReadOnlyField label="Category">
                {margin.category}
              </ReadOnlyField>
              <ReadOnlyField label="KA buying">
                {formatPercent(margin.kaBuyingMargin)}
              </ReadOnlyField>
              <ReadOnlyField label="KA front">
                {formatPercent(margin.kaFrontMargin)}
              </ReadOnlyField>
              <ReadOnlyField label="KA back">
                {formatPercent(margin.kaBackMargin)}
              </ReadOnlyField>
              <ReadOnlyField label="FD margin">
                {formatPercent(margin.fdMargin)}
              </ReadOnlyField>
              <ReadOnlyField label="Effective">
                {toInputDate(margin.effectiveDate)}
              </ReadOnlyField>
            </div>
          ))
        )}
      </div>
    </MasterSection>
  );
}

function ReadOnlyField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="truncate text-sm font-medium text-slate-900">
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RecordStatus }) {
  const statusClass =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}
    >
      {status}
    </span>
  );
}

function ArchiveStatusBadge({
  status
}: {
  status: MasterDataArchiveOption["driveStatus"];
}) {
  const label =
    status === "UPLOADED"
      ? "Drive archived"
      : status === "FAILED"
        ? "Drive failed"
        : "Drive pending";
  const statusClass =
    status === "UPLOADED"
      ? "bg-sky-50 text-sky-700"
      : status === "FAILED"
        ? "bg-amber-50 text-amber-800"
        : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}
    >
      {label}
    </span>
  );
}

function sourceLabel(source: string) {
  switch (source) {
    case "QUICK_SIMULATION":
      return "Quick Simulation";
    case "MASTER_DATA_IMPORT":
      return "Workbook import";
    case "MASTER_DATA_MANUAL_CREATE":
      return "Manual create";
    case "MASTER_DATA_MANUAL_UPDATE":
      return "Manual update";
    case "MASTER_DATA_MANUAL_DELETE":
      return "Manual delete";
    default:
      return source;
  }
}

function formatArchiveDate(value: string) {
  return formatEuropeanDateTime(value);
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">
      {children}
    </p>
  );
}

function MasterSection({
  title,
  count,
  defaultOpen = false,
  children
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm open:p-4"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {count === undefined ? null : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {count} records
          </span>
        )}
      </summary>
      <div className="grid min-w-0 max-h-[520px] gap-3 overflow-x-hidden overflow-y-auto border-t border-slate-100 pt-3">
        {children}
      </div>
    </details>
  );
}

function Input({
  name,
  type = "text",
  step,
  placeholder,
  defaultValue,
  required = true
}: {
  name: string;
  type?: string;
  step?: string;
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
}) {
  if (type === "date") {
    return (
      <EuropeanDateInput
        className={inputClass}
        defaultValue={defaultValue}
        label={placeholder ?? name}
        name={name}
        required={required}
      />
    );
  }

  return (
    <input
      className={inputClass}
      name={name}
      type={type}
      step={step}
      placeholder={placeholder}
      defaultValue={defaultValue}
      required={required}
    />
  );
}

function StatusSelect({ defaultValue = "ACTIVE" }: { defaultValue?: RecordStatus }) {
  return (
    <select className={inputClass} name="status" defaultValue={defaultValue}>
      <option value="ACTIVE">Active</option>
      <option value="INACTIVE">Inactive</option>
    </select>
  );
}

function LifecycleSelect({
  defaultValue = "LAUNCHED"
}: {
  defaultValue?: ProductLifecycleStatus;
}) {
  return (
    <select
      className={inputClass}
      name="lifecycleStatus"
      defaultValue={defaultValue}
      aria-label="Product lifecycle"
    >
      <option value="LAUNCHED">Launched</option>
      <option value="UNLAUNCHED">Unlaunched</option>
      <option value="EOL">EOL</option>
    </select>
  );
}

function CountrySelect({
  data,
  defaultValue
}: {
  data: ReferenceData;
  defaultValue?: string;
}) {
  return (
    <select
      className={inputClass}
      name="countryId"
      defaultValue={defaultValue ?? data.countries[0]?.id}
    >
      {data.countries.map((country) => (
        <option key={country.id} value={country.id}>
          {country.code} - {country.name}
        </option>
      ))}
    </select>
  );
}

function ProductSelect({
  data,
  defaultValue
}: {
  data: ReferenceData;
  defaultValue?: string;
}) {
  return (
    <select
      className={inputClass}
      name="productId"
      defaultValue={defaultValue ?? data.products[0]?.id}
    >
      {data.products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.sku} - {product.name}
        </option>
      ))}
    </select>
  );
}
