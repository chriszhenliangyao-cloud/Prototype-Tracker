import { Link } from "react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
	formatNumber,
	initialHistoryRows,
	initialPlanningMonths,
	initialPlanningRows,
	type HistoryRow,
	type PlanningRow,
} from "../lib/sales-inventory-mock";
import "../sales-inventory.css";

export function meta() {
	return [{ title: "Sales & Inventory · ProtoTrack" }];
}

const STORAGE_KEY = "prototrack-sales-inventory-matrix-v2";
const clone = <T,>(value: T): T => structuredClone(value);
const numberValue = (value: string) => Math.max(0, Number(value) || 0);
const monthLabel = (month: string) => new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const shortMonth = (month: string) => new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const compact = (value: number) => Math.abs(value) < 1000 ? formatNumber(value) : `${Number((value / 1000).toFixed(1))}K`;
const signedCompact = (value: number) => `${value > 0 ? "+" : ""}${compact(value)}`;
const nextMonth = (month: string) => {
	const [year, value] = month.split("-").map(Number);
	const date = new Date(Date.UTC(year, value, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const lastMonth = (month: string) => {
	const [year, value] = month.split("-").map(Number);
	const date = new Date(Date.UTC(year, value - 2, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

type ForecastSnapshot = {
	archiveMonth: string;
	savedAt: string;
	model: string;
	product: string;
	category: string;
	forecastMonth: string;
	shipmentForecast: number;
	supplyPlan: number;
};

type Workspace = {
	rows: PlanningRow[];
	draftRows?: PlanningRow[] | null;
	months: string[];
	history: HistoryRow[];
	lastClosedMonth: string | null;
	forecastSnapshots: ForecastSnapshot[];
	revisionLogs?: ChangeLog[];
};

type Lifecycle = "New" | "Launched";
type ExceptionType = "Stockout" | "First Batch Risk" | "Gap" | "Watch";
type ExceptionItem = { type: ExceptionType; row: PlanningRow; month: string; issue: string; detail: string };
type ChangeLog = { model: string; month: string; field: string; before: number; after: number; user: string; time: string };

const seedSnapshots: ForecastSnapshot[] = initialPlanningRows.flatMap((row) => initialPlanningMonths.flatMap((forecastMonth) => {
	const plan = row.months[forecastMonth];
	const shift = row.model === "PX51" ? 400 : row.model === "P61L-P2" ? 300 : row.model === "WAL101" ? 80 : 0;
	return [
		{ archiveMonth: "2026-06", savedAt: "2026-06-30T09:00:00Z", model: row.model, product: row.product, category: row.category, forecastMonth, shipmentForecast: Math.max(0, plan.forecast - shift), supplyPlan: Math.max(0, plan.supply - Math.round(shift / 2)) },
		{ archiveMonth: "2026-07", savedAt: "2026-07-31T09:00:00Z", model: row.model, product: row.product, category: row.category, forecastMonth, shipmentForecast: plan.forecast, supplyPlan: plan.supply },
	];
}));

function snapshotRevisionLogs(snapshots: ForecastSnapshot[]) {
	const archives = [...new Set(snapshots.map((item) => item.archiveMonth))].sort();
	return archives.slice(1).flatMap((archiveMonth, archiveIndex) => {
		const previousMonth = archives[archiveIndex];
		return snapshots.filter((item) => item.archiveMonth === archiveMonth).flatMap<ChangeLog>((item) => {
			const previous = snapshots.find((value) => value.archiveMonth === previousMonth && value.model === item.model && value.forecastMonth === item.forecastMonth);
			if (!previous) return [];
			return ([{ field: "Shipment Forecast", before: previous.shipmentForecast, after: item.shipmentForecast }, { field: "Supply Plan", before: previous.supplyPlan, after: item.supplyPlan }]).flatMap((change) => change.before === change.after ? [] : [{ model: item.model, month: item.forecastMonth, field: change.field, before: change.before, after: change.after, user: "Ivy", time: item.savedAt }]);
		});
	});
}

function calculateEndings(row: PlanningRow, months: string[]) {
	let ending = row.inventory;
	return Object.fromEntries(months.map((month) => {
		const plan = row.months[month] || { forecast: 0, supply: 0 };
		ending += plan.supply - plan.forecast;
		return [month, ending];
	}));
}

function lifecycleOf(row: PlanningRow, currentMonth: string): Lifecycle {
	return row.launchDate < `${currentMonth}-01` ? "Launched" : "New";
}

function firstBatchMonth(row: PlanningRow, months: string[]) {
	return months.find((month) => (row.months[month]?.supply || 0) > 0) || null;
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);
	return <input aria-label={label} className="sip-v2-number" inputMode="numeric" min="0" type="number" value={draft}
		onFocus={(event) => event.currentTarget.select()}
		onChange={(event) => { setDraft(event.target.value); if (event.target.value !== "") onChange(numberValue(event.target.value)); }}
		onBlur={() => { if (draft === "") { setDraft("0"); onChange(0); } }} />;
}

function ModeHeader({ theme, onToggleTheme }: { theme: string; onToggleTheme: () => void }) {
	return <header className="sip-mode-bar">
		<div className="sip-brand"><div className="sip-brand-icon">📦</div><span className="sip-brand-name">ProtoTrack</span><span className="sip-brand-sep">·</span><span className="sip-brand-sub">Europe Prototype Tracker</span></div>
		<nav className="sip-mode-toggle" aria-label="ProtoTrack modes"><Link className="sip-mode-btn" to="/">🛰️ Control Tower</Link><Link className="sip-mode-btn" to="/?view=field">🧳 Field View</Link><Link className="sip-mode-btn" to="/project-progress">📈 Project Progress</Link><span className="sip-mode-btn active">📊 Sales &amp; Inventory</span></nav>
		<div className="sip-mode-right"><button className="sip-theme-btn" onClick={onToggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button><span className="sip-local">Local mock data</span></div>
	</header>;
}

function ModelMultiSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (models: string[]) => void }) {
	const [query, setQuery] = useState("");
	const visibleOptions = options.filter((model) => model.toLowerCase().includes(query.toLowerCase()));
	return <label className="sip-v2-field"><span>Model</span><details className="sip-v2-model"><summary>{selected.length ? `${selected.length} Models` : "All Models"}</summary><div>
		<input aria-label="Search model" placeholder="Search Model" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
		<button type="button" onClick={() => onChange([])}>✓ All Models</button>
		{visibleOptions.map((model) => <label key={model}><input type="checkbox" checked={selected.includes(model)} onChange={() => onChange(selected.includes(model) ? selected.filter((item) => item !== model) : [...selected, model])} />{model}</label>)}
	</div></details></label>;
}

function ModelFilter({ rows, selected, onChange }: { rows: PlanningRow[]; selected: string[]; onChange: (models: string[]) => void }) {
	return <ModelMultiSelect options={rows.map((row) => row.model)} selected={selected} onChange={onChange} />;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
	return <label className="sip-v2-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /><span>{label}</span></label>;
}

function HistoryModal({ history, snapshots, revisionLogs, syncedMonth, onClose }: { history: HistoryRow[]; snapshots: ForecastSnapshot[]; revisionLogs: ChangeLog[]; syncedMonth: string; onClose: () => void }) {
	const availableMonths = [...new Set([...history.map((item) => item.month), ...snapshots.map((item) => item.archiveMonth), syncedMonth])].sort();
	const [fromMonth, setFromMonth] = useState(availableMonths[0] || syncedMonth);
	const [toMonth, setToMonth] = useState(availableMonths.at(-1) || syncedMonth);
	const [selectedModels, setSelectedModels] = useState<string[]>([]);
	const [category, setCategory] = useState("all");
	const [tab, setTab] = useState<"actuals" | "snapshots" | "revisions">("actuals");
	const categories = [...new Set([...history.map((item) => item.category), ...snapshots.map((item) => item.category)])].sort();
	const modelOptions = [...new Set([...history.map((item) => item.model), ...snapshots.map((item) => item.model)])].sort();
	const modelMatches = (model: string) => selectedModels.length === 0 || selectedModels.includes(model);
	const categoryFor = (model: string) => history.find((item) => item.model === model)?.category || snapshots.find((item) => item.model === model)?.category || "";
	const inRange = (value: string) => value >= fromMonth && value <= toMonth;
	const actualRows = history.filter((item) => inRange(item.month) && modelMatches(item.model) && (category === "all" || item.category === category));
	const snapshotRows = snapshots.filter((item) => inRange(item.archiveMonth) && modelMatches(item.model) && (category === "all" || item.category === category));
	const logRows = revisionLogs.filter((item) => inRange(item.time === "Now" ? item.month : item.time.slice(0, 7)) && modelMatches(item.model) && (category === "all" || categoryFor(item.model) === category));
	return <div className="sip-overlay"><section className="sip-modal wide sip-v2-history" role="dialog" aria-modal="true"><header><div><h2>Pull History</h2><p>Read-only actuals, inventory, forecast snapshots and revision history for all closed months.</p></div><button onClick={onClose}>×</button></header><div className="sip-v2-history-filter"><ModelMultiSelect options={modelOptions} selected={selectedModels} onChange={setSelectedModels} /><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All Categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>From<select value={fromMonth} onChange={(event) => { const value = event.target.value; setFromMonth(value); if (value > toMonth) setToMonth(value); }}>{availableMonths.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}</select></label><label>To<select value={toMonth} onChange={(event) => { const value = event.target.value; setToMonth(value); if (value < fromMonth) setFromMonth(value); }}>{availableMonths.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}</select></label><span>History synced: {monthLabel(syncedMonth)} ✓</span></div><nav className="sip-v2-tabs"><button className={tab === "actuals" ? "active" : ""} onClick={() => setTab("actuals")}>Monthly Actuals</button><button className={tab === "snapshots" ? "active" : ""} onClick={() => setTab("snapshots")}>Forecast Snapshots</button><button className={tab === "revisions" ? "active" : ""} onClick={() => setTab("revisions")}>Revision Log</button></nav>
	{tab === "actuals" && <div className="sip-table-scroll"><table><thead><tr><th>Month</th><th>Model</th><th>Product</th><th>Actual Shipment</th><th>Actual Supply</th><th>Ending Inventory</th></tr></thead><tbody>{actualRows.length ? actualRows.map((item, index) => <tr key={`${item.month}-${item.model}-${index}`}><td>{monthLabel(item.month)}</td><td>{item.model}</td><td>{item.product}</td><td>{formatNumber(item.actualSales)}</td><td>{formatNumber(item.actualSupply)}</td><td>{formatNumber(item.endingInventory)}</td></tr>) : <tr><td colSpan={6}>No mock actuals for this month.</td></tr>}</tbody></table></div>}
	{tab === "snapshots" && <div className="sip-table-scroll"><table><thead><tr><th>Snapshot Month</th><th>Forecast Month</th><th>Model</th><th>Shipment Forecast</th><th>Supply Plan</th></tr></thead><tbody>{snapshotRows.map((item, index) => <tr key={`${item.archiveMonth}-${item.forecastMonth}-${item.model}-${index}`}><td>{monthLabel(item.archiveMonth)}</td><td>{monthLabel(item.forecastMonth)}</td><td>{item.model}</td><td>{formatNumber(item.shipmentForecast)}</td><td>{formatNumber(item.supplyPlan)}</td></tr>)}</tbody></table></div>}
	{tab === "revisions" && <div className="sip-table-scroll"><table><thead><tr><th>Time</th><th>User</th><th>SKU</th><th>Forecast Month</th><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>{logRows.length ? logRows.map((item, index) => <tr key={`${item.model}-${item.month}-${item.field}-${index}`}><td>{item.time === "Now" ? item.time : new Date(item.time).toLocaleString()}</td><td>{item.user}</td><td>{item.model}</td><td>{monthLabel(item.month)}</td><td>{item.field}</td><td>{formatNumber(item.before)}</td><td>{formatNumber(item.after)}</td></tr>) : <tr><td colSpan={7}>No revisions for this month.</td></tr>}</tbody></table></div>}
	<footer><span>History is read only</span><button className="sip-btn" onClick={onClose}>Close</button></footer></section></div>;
}

function ForecastArchiveModal({ snapshots, onClose }: { snapshots: ForecastSnapshot[]; onClose: () => void }) {
	const [month, setMonth] = useState(initialPlanningMonths[0]);
	const visible = snapshots.filter((item) => item.forecastMonth === month);
	const grouped = initialPlanningRows.map((row) => ({ row, values: visible.filter((item) => item.model === row.model).sort((a, b) => a.archiveMonth.localeCompare(b.archiveMonth)) })).filter((item) => item.values.length > 1 && new Set(item.values.map((value) => value.shipmentForecast)).size > 1);
	return <div className="sip-overlay"><section className="sip-modal wide" role="dialog" aria-modal="true"><header><div><h2>Forecast Archive</h2><p>Read-only monthly plan snapshots. Select a row to compare revision history.</p></div><button onClick={onClose}>×</button></header><div className="sip-v2-archive-filter"><label>Forecast Month<select value={month} onChange={(event) => setMonth(event.target.value)}>{initialPlanningMonths.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}</select></label></div><div className="sip-table-scroll"><table><thead><tr><th>Model / Product</th><th>From</th><th>To</th><th>Shipment Forecast</th><th>Change</th><th>Current Supply</th><th>Supply Gap</th></tr></thead><tbody>{grouped.map(({ row, values }) => { const first = values[0]; const last = values.at(-1)!; const change = last.shipmentForecast - first.shipmentForecast; const gap = last.supplyPlan - last.shipmentForecast; return <tr key={row.model}><td><strong>{row.model}</strong><small>{row.product}</small></td><td>{monthLabel(first.archiveMonth)}</td><td>{monthLabel(last.archiveMonth)}</td><td>{formatNumber(first.shipmentForecast)} → {formatNumber(last.shipmentForecast)}</td><td className={change > 0 ? "risk" : "safe"}>{signedCompact(change)}</td><td>{formatNumber(last.supplyPlan)}</td><td className={gap < 0 ? "risk" : "safe"}>{signedCompact(gap)}</td></tr>; })}</tbody></table></div><footer><span>Published snapshots cannot be overwritten</span><button className="sip-btn" onClick={onClose}>Close</button></footer></section></div>;
}

function ClosingModal({ rows, month, onClose, onConfirm }: { rows: PlanningRow[]; month: string; onClose: () => void; onConfirm: (actuals: Array<{ model: string; sales: number; supply: number }>) => void }) {
	const [actuals, setActuals] = useState(() => rows.map((row) => ({ model: row.model, sales: row.months[month]?.forecast || 0, supply: row.months[month]?.supply || 0 })));
	const update = (model: string, field: "sales" | "supply", value: number) => setActuals((current) => current.map((item) => item.model === model ? { ...item, [field]: value } : item));
	return <div className="sip-overlay"><section className="sip-modal wide" role="dialog" aria-modal="true"><header><div><h2>Month Closing · {monthLabel(month)}</h2><p>Enter actual shipment and actual supply. Ending inventory recalculates automatically.</p></div><button onClick={onClose}>×</button></header><div className="sip-table-scroll"><table><thead><tr><th>Model</th><th>Actual Shipment</th><th>Actual Supply</th><th>Beginning Inventory</th><th>Ending Inventory</th></tr></thead><tbody>{rows.map((row) => { const item = actuals.find((entry) => entry.model === row.model)!; return <tr key={row.model}><td>{row.model}</td><td><NumberInput label={`${row.model} actual shipment`} value={item.sales} onChange={(value) => update(row.model, "sales", value)} /></td><td><NumberInput label={`${row.model} actual supply`} value={item.supply} onChange={(value) => update(row.model, "supply", value)} /></td><td>{formatNumber(row.inventory)}</td><td>{formatNumber(row.inventory + item.supply - item.sales)}</td></tr>; })}</tbody></table></div><footer><button className="sip-btn" onClick={onClose}>Cancel</button><button className="sip-btn primary" onClick={() => onConfirm(actuals)}>Confirm Closing</button></footer></section></div>;
}

function PlanEditor({ rows, publishedRows, months, snapshots, revisionLogs, onClose, onSave }: { rows: PlanningRow[]; publishedRows: PlanningRow[]; months: string[]; snapshots: ForecastSnapshot[]; revisionLogs: ChangeLog[]; onClose: () => void; onSave: (rows: PlanningRow[], publish: boolean, logs: ChangeLog[]) => void }) {
	const [draft, setDraft] = useState(() => clone(rows));
	const [tab, setTab] = useState<"grid" | "versions">("grid");
	const [selectedModels, setSelectedModels] = useState<string[]>([]);
	const [selectedMonth, setSelectedMonth] = useState("all");
	const [compareArchive, setCompareArchive] = useState<string | null>(null);
	const [viewLogArchive, setViewLogArchive] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const update = (model: string, month: string, field: "forecast" | "supply", value: number) => setDraft((current) => current.map((row) => row.model === model ? { ...row, months: { ...row.months, [month]: { ...row.months[month], [field]: value } } } : row));
	const logs = useMemo<ChangeLog[]>(() => draft.flatMap((row) => months.flatMap((month) => (["forecast", "supply"] as const).flatMap((field) => {
		const before = publishedRows.find((item) => item.model === row.model)?.months[month]?.[field] || 0;
		const after = row.months[month]?.[field] || 0;
		return before === after ? [] : [{ model: row.model, month, field: field === "forecast" ? "Shipment Forecast" : "Supply Plan", before, after, user: "Ivy", time: "Now" }];
	}))), [draft, months, publishedRows]);
	const visibleRows = selectedModels.length ? draft.filter((row) => selectedModels.includes(row.model)) : draft;
	const visibleMonths = selectedMonth === "all" ? months : [selectedMonth];
	const archiveMonths = [...new Set(snapshots.map((item) => item.archiveMonth))].sort().reverse();
	const restoreArchive = (archiveMonth: string) => {
		setDraft((current) => current.map((row) => ({ ...row, months: { ...row.months, ...Object.fromEntries(months.map((month) => { const snapshot = snapshots.find((item) => item.archiveMonth === archiveMonth && item.model === row.model && item.forecastMonth === month); return [month, snapshot ? { forecast: snapshot.shipmentForecast, supply: snapshot.supplyPlan } : row.months[month]]; })) } })));
		setTab("grid");
	};
	const comparisonRows = compareArchive ? draft.flatMap((row) => months.flatMap((month) => { const snapshot = snapshots.find((item) => item.archiveMonth === compareArchive && item.model === row.model && item.forecastMonth === month); if (!snapshot) return []; const current = row.months[month] || { forecast: 0, supply: 0 }; const forecastChange = current.forecast - snapshot.shipmentForecast; const supplyChange = current.supply - snapshot.supplyPlan; return forecastChange || supplyChange ? [{ model: row.model, month, forecastChange, supplyChange }] : []; })) : [];
	const versionLogRows = viewLogArchive ? revisionLogs.filter((item) => item.time.startsWith(viewLogArchive)) : [];
	const commentFor = (row: PlanningRow, month: string) => {
		const plan = row.months[month] || { forecast: 0, supply: 0 };
		const first = lifecycleOf(row, months[0]) === "New" ? firstBatchMonth(row, months) : null;
		if (first === month && plan.supply < plan.forecast) return "First batch shortfall";
		if (first === month) return "First batch review";
		if (plan.supply < plan.forecast) return "Demand above supply";
		return "";
	};
	const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]; if (!file) return;
		const XLSX = await import("xlsx"); const workbook = XLSX.read(await file.arrayBuffer()); const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
		setDraft((current) => current.map((row) => { const next = clone(row); data.filter((item) => String(item.Model || "").toUpperCase() === row.model.toUpperCase()).forEach((item) => { const month = String(item.Month || ""); if (months.includes(month)) next.months[month] = { forecast: numberValue(String(item.Forecast ?? 0)), supply: numberValue(String(item["Supply Plan"] ?? item.Supply ?? 0)) }; }); return next; }));
	};
	return <div className="sip-overlay"><section className="sip-modal wide sip-v2-editor" role="dialog" aria-modal="true"><header><div><h2>Rolling Plan Editor</h2><p>Edit rolling monthly forecast and supply plan</p></div><button onClick={onClose}>×</button></header><div className="sip-v2-editor-meta"><div><span>▣ Plan Cycle: {monthLabel(months[0])}</span><span>▣ Window: {shortMonth(months[0])} – {shortMonth(months.at(-1)!)} {months[0].slice(0, 4)}</span><span className="autosaved">◉ Autosaved 2 min ago</span></div><div><b>Draft v4</b><small>Based on {monthLabel(lastMonth(months[0]))} archive</small></div></div><nav className="sip-v2-tabs"><button className={tab === "grid" ? "active" : ""} onClick={() => setTab("grid")}>Grid Input</button><button className={tab === "versions" ? "active" : ""} onClick={() => setTab("versions")}>Version History</button></nav>
		{tab === "grid" && <><section className="sip-v2-editor-scope"><b>Editable Scope</b><div><span>● Forecast editable: {months.map(shortMonth).join(", ")}</span><span>● Actuals read-only from history</span><span>● Supply Plan editable: {months.map(shortMonth).join(", ")}</span><span>● Current Inventory auto-calculated</span></div></section><div className="sip-v2-editor-tools"><button className="sip-btn" onClick={() => fileRef.current?.click()}>▧ Import Excel</button><input hidden ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importFile} /><label className="sip-v2-editor-month"><span>Month</span><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}><option value="all">All Months</option>{months.map((month) => <option value={month} key={month}>{monthLabel(month)}</option>)}</select></label><ModelFilter rows={rows} selected={selectedModels} onChange={setSelectedModels} /></div><div className="sip-table-scroll sip-v2-editor-scroll"><table className="sip-v2-editor-grid"><thead><tr><th>SKU</th><th>Month</th><th>Forecast</th><th>Supply Plan</th><th>Comment</th></tr></thead><tbody>{visibleRows.flatMap((row) => visibleMonths.map((month) => <tr key={`${row.model}-${month}`}><td><strong>{row.model}</strong></td><td>{shortMonth(month)}</td><td><NumberInput label={`${row.model} ${month} forecast`} value={row.months[month]?.forecast || 0} onChange={(value) => update(row.model, month, "forecast", value)} /></td><td><NumberInput label={`${row.model} ${month} supply`} value={row.months[month]?.supply || 0} onChange={(value) => update(row.model, month, "supply", value)} /></td><td>{commentFor(row, month)}</td></tr>))}</tbody></table></div></>}
		{tab === "versions" && <div className="sip-v2-version-list"><article><b>Draft v4</b><span>Current editable draft · Now</span><button className="sip-btn" onClick={() => { setViewLogArchive(null); setCompareArchive(archiveMonths[0] || null); }}>Compare</button></article>{archiveMonths.map((archiveMonth, index) => <article key={archiveMonth}><b>Plan Snapshot v{archiveMonths.length - index + 1}</b><span>Published by Ivy · {monthLabel(archiveMonth)}</span><div><button className="sip-btn" onClick={() => restoreArchive(archiveMonth)}>Restore as Draft</button><button className="sip-btn" onClick={() => { setCompareArchive(null); setViewLogArchive(archiveMonth); }}>View Log</button></div></article>)}{compareArchive && <section className="sip-v2-compare"><header><b>Draft v4 vs. {monthLabel(compareArchive)} Snapshot</b><button onClick={() => setCompareArchive(null)}>×</button></header><div className="sip-table-scroll"><table><thead><tr><th>SKU</th><th>Month</th><th>Forecast Change</th><th>Supply Change</th></tr></thead><tbody>{comparisonRows.length ? comparisonRows.map((item) => <tr key={`${item.model}-${item.month}`}><td>{item.model}</td><td>{monthLabel(item.month)}</td><td>{signedCompact(item.forecastChange)}</td><td>{signedCompact(item.supplyChange)}</td></tr>) : <tr><td colSpan={4}>No differences from this snapshot.</td></tr>}</tbody></table></div></section>}{viewLogArchive && <section className="sip-v2-compare"><header><b>{monthLabel(viewLogArchive)} Snapshot · Change Log</b><button onClick={() => setViewLogArchive(null)}>×</button></header><div className="sip-table-scroll"><table><thead><tr><th>SKU</th><th>Month</th><th>Field</th><th>Before</th><th>After</th><th>User</th><th>Time</th></tr></thead><tbody>{versionLogRows.length ? versionLogRows.map((item, index) => <tr key={`${item.model}-${item.month}-${item.field}-${index}`}><td>{item.model}</td><td>{monthLabel(item.month)}</td><td>{item.field}</td><td>{formatNumber(item.before)}</td><td>{formatNumber(item.after)}</td><td>{item.user}</td><td>{new Date(item.time).toLocaleString()}</td></tr>) : <tr><td colSpan={7}>No changes were recorded for this snapshot.</td></tr>}</tbody></table></div></section>}</div>}
		<footer><span>🔒 Published archives are read only</span><div><button className="sip-btn" onClick={onClose}>Cancel</button><button className="sip-btn" onClick={() => onSave(draft, false, logs)}>Save Draft</button><button className="sip-btn primary" onClick={() => onSave(draft, true, logs)}>Publish Plan Snapshot</button></div></footer></section></div>;
}

function AddProductModal({ months, rows, onClose, onAdd }: { months: string[]; rows: PlanningRow[]; onClose: () => void; onAdd: (row: PlanningRow) => void }) {
	const [draft, setDraft] = useState({ model: "", product: "", category: "", launchDate: "2026-10-01", inventory: 0 });
	return <div className="sip-overlay"><section className="sip-modal"><header><div><h2>Add Product</h2><p>Add a Mock SKU to the rolling plan.</p></div><button onClick={onClose}>×</button></header><div className="sip-form-grid">{(["model", "product", "category"] as const).map((field) => <label key={field}>{field === "product" ? "Product Name" : field[0].toUpperCase() + field.slice(1)}<input value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}<label>Launch Date<input type="date" value={draft.launchDate} onChange={(event) => setDraft({ ...draft, launchDate: event.target.value })} /></label><label>Current Inventory<NumberInput label="Current inventory" value={draft.inventory} onChange={(inventory) => setDraft({ ...draft, inventory })} /></label></div><footer><button className="sip-btn" onClick={onClose}>Cancel</button><button className="sip-btn primary" onClick={() => { const model = draft.model.trim().toUpperCase(); if (!model || !draft.product.trim() || rows.some((row) => row.model === model)) return; onAdd({ ...draft, model, category: draft.category.trim() || "Uncategorized", firstForecast: 0, firstMass: 0, months: Object.fromEntries(months.map((month) => [month, { forecast: 0, supply: 0 }])) }); }}>Add Product</button></footer></section></div>;
}

function TrendView({ rows, months, totals, exceptions, highlightedMonth, onFocus }: { rows: PlanningRow[]; months: string[]; totals: Array<{ month: string; demand: number; supply: number }>; exceptions: ExceptionItem[]; highlightedMonth: string; onFocus: (item: ExceptionItem) => void }) {
	const maxBar = Math.max(1, ...totals.flatMap((item) => [item.demand, item.supply, Math.abs(item.supply - item.demand)]));
	const heatRows = rows.map((row) => ({ row, life: lifecycleOf(row, months[0]), endings: calculateEndings(row, months), first: lifecycleOf(row, months[0]) === "New" ? firstBatchMonth(row, months) : null }));
	const riskRows = heatRows.filter(({ row, endings, first }) => Math.min(...Object.values(endings)) < 1000 || Boolean(first)).slice(0, 4);
	const eohValues = riskRows.flatMap((item) => months.map((month) => item.endings[month]));
	const chartMin = Math.min(0, ...eohValues);
	const chartMax = Math.max(1000, ...eohValues);
	const chartRange = Math.max(1, chartMax - chartMin);
	const xFor = (index: number) => 55 + index * 180;
	const yFor = (value: number) => 18 + ((chartMax - value) / chartRange) * 132;
	const colors = ["#dc2626", "#2563eb", "#079669", "#f97316"];
	const actions = [...exceptions].sort((a, b) => {
		const score = (item: ExceptionItem) => item.type === "Stockout" ? 4 : item.type === "First Batch Risk" ? 3 : item.type === "Gap" ? 2 : 1;
		return score(b) - score(a);
	}).filter((item, index, list) => list.findIndex((candidate) => candidate.row.model === item.row.model && candidate.type === item.type) === index).slice(0, 4);
	return <section className="sip-trend">
		<div className="sip-trend-top">
			<article className="sip-trend-card sip-demand-chart"><header><h2>Monthly Demand vs Supply <span className="sip-info" title="Demand, supply and net gap by month">i</span></h2></header><footer><span><i className="legend demand" /> Demand</span><span><i className="legend supply" /> Supply</span><span><i className="legend gap" /> Net Gap (S − D)</span></footer><div className="sip-bars" role="img" aria-label="Monthly demand, supply and net gap chart"><div className="sip-bar-y-axis"><b>{compact(maxBar)}</b><b>{compact(Math.round(maxBar / 2))}</b><b>0</b><b>−{compact(Math.round(maxBar / 2))}</b></div>{totals.map((item) => { const gap = item.supply - item.demand; const eventRow = heatRows.find(({ first }) => first === item.month); const eventGap = eventRow ? (eventRow.row.months[item.month]?.supply || 0) - (eventRow.row.months[item.month]?.forecast || 0) : 0; const eventEoh = eventRow?.endings[item.month] || 0; const eventTone = eventGap < 0 ? "risk" : eventEoh <= 500 ? "watch" : "ok"; return <div className="sip-bar-month" key={item.month}><div className="sip-bar-plot"><div className="sip-bar-positive"><i className="demand" style={{ height: `${Math.max(5, item.demand / maxBar * 100)}%` }}><b>{compact(item.demand)}</b></i><i className="supply" style={{ height: `${Math.max(5, item.supply / maxBar * 100)}%` }}><b>{compact(item.supply)}</b></i></div><div className="sip-gap-bar"><i style={{ height: `${Math.max(6, Math.abs(gap) / maxBar * 68)}px` }}><b>{signedCompact(gap)}</b></i></div></div><div className="sip-zero-line" /><strong>{monthLabel(item.month)}</strong>{eventRow && <span className={`sip-trend-fb ${eventTone}`}>{eventTone === "risk" ? "FB!" : eventTone === "watch" ? "FB~" : "FB✓"} {eventRow.row.model}</span>}</div>; })}</div></article>
			<article className="sip-trend-card sip-heatmap"><header><h2>SKU Gap Heatmap <span className="sip-info" title="Supply minus demand by SKU and month">i</span></h2><div className="sip-heatmap-legend"><b>Gap (S − D)</b><span className="severe">■ Severe &lt; −1K</span><span className="warning">■ Warning −1K to 0</span><span className="healthy">■ Healthy ≥ 0</span><span className="nodata">■ No Data</span></div></header><div className="sip-table-scroll"><table><thead><tr><th>SKU</th>{months.map((month) => <th className={highlightedMonth === month ? "selected-month" : ""} key={month}>{monthLabel(month)}</th>)}</tr></thead><tbody>{heatRows.map(({ row, endings, first }) => <tr key={row.model}><th>{row.model}</th>{months.map((month) => { const plan = row.months[month] || { forecast: 0, supply: 0 }; const gap = plan.supply - plan.forecast; const isFirst = first === month; const tone = gap < -Math.max(100, plan.forecast * .1) ? "severe" : gap < 0 ? "warning" : "healthy"; const fbTone = gap < 0 ? "risk" : endings[month] <= 500 ? "watch" : "ok"; const item = exceptions.find((candidate) => candidate.row.model === row.model && candidate.month === month) || { type: gap < 0 ? "Gap" as const : "Watch" as const, row, month, issue: `Gap ${signedCompact(gap)}`, detail: "Trend selection" }; return <td className={`${tone} ${highlightedMonth === month ? "selected-month" : ""}`} key={month} onClick={() => onFocus(item)}><b>{signedCompact(gap)}</b>{isFirst && <span className={fbTone}>{fbTone === "risk" ? "FB!" : fbTone === "watch" ? "FB~" : "FB✓"}</span>}</td>; })}</tr>)}</tbody></table></div></article>
		</div>
		<article className="sip-trend-card sip-eoh"><header><h2>EOH Risk Trend <small>(Risk SKUs only)</small> <span className="sip-info" title="Ending on hand for risk SKUs only">i</span></h2><div>{riskRows.map((item, index) => <span key={item.row.model}><i style={{ background: colors[index] }} />{item.row.model}</span>)}</div></header>{riskRows.length ? <div className="sip-eoh-plot"><b>EOH (Units)</b><svg viewBox="0 0 440 185" role="img" aria-label="Ending on hand risk trend">{[0, 1, 2, 3, 4].map((tick) => { const value = chartMax - chartRange * tick / 4; const y = yFor(value); return <g key={tick}><line className="grid-line" x1="42" y1={y} x2="420" y2={y} /><text x="36" y={y + 3} textAnchor="end">{compact(Math.round(value))}</text></g>; })}<line className="axis-line" x1="42" y1="18" x2="42" y2="150" /><line className="axis-line" x1="42" y1="150" x2="420" y2="150" /><line className="stockout-line" x1="42" y1={yFor(0)} x2="420" y2={yFor(0)} /><text className="stockout-label" x="415" y={yFor(0) - 4} textAnchor="end">Stockout line</text>{months.map((month, index) => <text key={month} x={xFor(index)} y="177" textAnchor="middle">{monthLabel(month)}</text>)}{riskRows.map((item, rowIndex) => { const points = months.map((month, index) => `${xFor(index)},${yFor(item.endings[month])}`).join(" "); return <g key={item.row.model}><polyline fill="none" stroke={colors[rowIndex]} strokeWidth="2.5" points={points} />{months.map((month, index) => { const first = item.first === month; const value = item.endings[month]; const tone = (item.row.months[month]?.supply || 0) - (item.row.months[month]?.forecast || 0) < 0 ? "risk" : value <= 500 ? "watch" : "ok"; return <g key={month}><circle cx={xFor(index)} cy={yFor(value)} r="4" fill={colors[rowIndex]} /><text x={xFor(index)} y={yFor(value) - 8} textAnchor="middle" fill={colors[rowIndex]}>{compact(value)}</text>{first && <g className={`svg-fb ${tone}`}><rect x={Math.min(385, xFor(index) + 8)} y={yFor(value) - 14} width="28" height="15" rx="3" /><text x={Math.min(399, xFor(index) + 22)} y={yFor(value) - 3} textAnchor="middle">{tone === "risk" ? "FB!" : tone === "watch" ? "FB~" : "FB✓"}</text></g>}</g>; })}</g>; })}</svg></div> : <p className="sip-v2-empty">No risk SKU in this view.</p>}</article>
		<article className="sip-trend-card sip-actions"><header><h2>Top Actions from Trend</h2><small>Highest-priority exceptions in the selected period</small></header><div>{actions.map((item, index) => { const high = item.type === "Stockout" || item.type === "First Batch Risk"; return <button className={high ? "high" : "medium"} key={`${item.row.model}-${item.month}-${item.type}`} onClick={() => onFocus(item)}><b>{index + 1}</b><strong>{item.row.model} · {shortMonth(item.month)} · {item.type}</strong><span>{item.issue}</span><small>{high ? "High Risk" : "Medium Risk"}</small></button>; })}</div></article>
	</section>;
}

export default function SalesInventory() {
	const [rows, setRows] = useState<PlanningRow[]>(() => clone(initialPlanningRows));
	const [draftRows, setDraftRows] = useState<PlanningRow[] | null>(null);
	const [months, setMonths] = useState(() => [...initialPlanningMonths]);
	const [history, setHistory] = useState<HistoryRow[]>(() => clone(initialHistoryRows));
	const [lastClosedMonth, setLastClosedMonth] = useState<string | null>("2026-07");
	const [snapshots, setSnapshots] = useState<ForecastSnapshot[]>(() => clone(seedSnapshots));
	const [revisionLogs, setRevisionLogs] = useState<ChangeLog[]>(() => snapshotRevisionLogs(seedSnapshots));
	const [loaded, setLoaded] = useState(false);
	const [theme, setTheme] = useState("light");
	const [models, setModels] = useState<string[]>([]);
	const [category, setCategory] = useState("all");
	const [lifecycle, setLifecycle] = useState<"All" | Lifecycle>("All");
	const [onlyGap, setOnlyGap] = useState(false);
	const [firstBatchOnly, setFirstBatchOnly] = useState(false);
	const [view, setView] = useState<"Matrix" | "Trend">("Matrix");
	const [highlightedMonth, setHighlightedMonth] = useState("");
	const [exceptionType, setExceptionType] = useState<"All" | ExceptionType>("All");
	const [highlight, setHighlight] = useState("");
	const [historyOpen, setHistoryOpen] = useState(false);
	const [archiveOpen, setArchiveOpen] = useState(false);
	const [editorOpen, setEditorOpen] = useState(false);
	const [closingOpen, setClosingOpen] = useState(false);
	const [addOpen, setAddOpen] = useState(false);

	useEffect(() => {
		try { const value = localStorage.getItem(STORAGE_KEY); if (value) { const stored = JSON.parse(value) as Workspace; if (stored.rows?.length && stored.months?.length === 3) { const savedSnapshots = stored.forecastSnapshots?.length ? stored.forecastSnapshots : clone(seedSnapshots); setRows(stored.rows); setDraftRows(stored.draftRows?.length ? stored.draftRows : null); setMonths(stored.months); setHistory(stored.history || []); setLastClosedMonth(stored.lastClosedMonth); setSnapshots(savedSnapshots); setRevisionLogs(stored.revisionLogs?.length ? stored.revisionLogs : snapshotRevisionLogs(savedSnapshots)); } } } catch { localStorage.removeItem(STORAGE_KEY); }
		setTheme(document.documentElement.getAttribute("data-theme") || "light"); setLoaded(true);
	}, []);
	useEffect(() => { if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, draftRows, months, history, lastClosedMonth, forecastSnapshots: snapshots, revisionLogs } satisfies Workspace)); }, [draftRows, history, lastClosedMonth, loaded, months, revisionLogs, rows, snapshots]);

	const categories = [...new Set(rows.map((row) => row.category))].sort();
	const filtered = rows.filter((row) => {
		const life = lifecycleOf(row, months[0]);
		const gaps = months.some((month) => (row.months[month]?.supply || 0) - (row.months[month]?.forecast || 0) < 0);
		return (!models.length || models.includes(row.model)) && (category === "all" || row.category === category) && (lifecycle === "All" || life === lifecycle) && (!onlyGap || gaps) && (!firstBatchOnly || (life === "New" && firstBatchMonth(row, months)));
	});
	const totals = months.map((month) => ({ month, demand: filtered.reduce((sum, row) => sum + (row.months[month]?.forecast || 0), 0), supply: filtered.reduce((sum, row) => sum + (row.months[month]?.supply || 0), 0) }));
	const demand = totals.reduce((sum, item) => sum + item.demand, 0);
	const supply = totals.reduce((sum, item) => sum + item.supply, 0);
	const worst = [...totals].sort((a, b) => (a.supply - a.demand) - (b.supply - b.demand))[0];
	const stockouts = filtered.filter((row) => Object.values(calculateEndings(row, months)).some((ending) => ending < 0)).length;
	const exceptions: ExceptionItem[] = filtered.flatMap((row) => {
		const life = lifecycleOf(row, months[0]); const endings = calculateEndings(row, months); const first = life === "New" ? firstBatchMonth(row, months) : null;
		return months.flatMap<ExceptionItem>((month): ExceptionItem[] => { const plan = row.months[month] || { forecast: 0, supply: 0 }; const gap = plan.supply - plan.forecast; const eoh = endings[month];
			if (eoh < 0) return [{ type: "Stockout" as const, row, month, issue: `EOH ${signedCompact(eoh)}`, detail: "Stockout risk" }];
			if (first === month && gap < 0) return [{ type: "First Batch Risk" as const, row, month, issue: `Gap ${signedCompact(gap)}`, detail: "FB! First batch risk" }];
			if (gap < 0) return [{ type: "Gap" as const, row, month, issue: `Gap ${signedCompact(gap)}`, detail: "Demand above supply" }];
			if ((first === month && gap >= 0) || eoh <= 500) return [{ type: "Watch" as const, row, month, issue: first === month ? "FB✓ OK" : `EOH ${compact(eoh)}`, detail: first === month ? "First batch OK" : "Low inventory" }];
			return [];
		});
	});
	const shownExceptions = exceptionType === "All" ? exceptions : exceptions.filter((item) => item.type === exceptionType);
	const focusCell = (item: ExceptionItem) => { const id = `${item.row.model}-${item.month}`; setView("Matrix"); setHighlight(id); window.setTimeout(() => document.getElementById(`sip-cell-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 0); window.setTimeout(() => setHighlight(""), 2200); };
	const closeMonth = (actuals: Array<{ model: string; sales: number; supply: number }>) => {
		const closed = months[0]; const savedAt = new Date().toISOString();
		setSnapshots((current) => [...current, ...rows.flatMap((row) => months.slice(1).map((month) => ({ archiveMonth: closed, savedAt, model: row.model, product: row.product, category: row.category, forecastMonth: month, shipmentForecast: row.months[month]?.forecast || 0, supplyPlan: row.months[month]?.supply || 0 })))]);
		const closedRows = rows.map((row) => { const actual = actuals.find((item) => item.model === row.model)!; return { month: closed, model: row.model, product: row.product, category: row.category, forecast: row.months[closed]?.forecast || 0, actualSales: actual.sales, supplyPlan: row.months[closed]?.supply || 0, actualSupply: actual.supply, beginningInventory: row.inventory, endingInventory: row.inventory + actual.supply - actual.sales }; });
		const added = nextMonth(months.at(-1)!); setHistory((current) => [...current, ...closedRows]); setRows((current) => current.map((row) => ({ ...row, inventory: closedRows.find((item) => item.model === row.model)!.endingInventory, months: { ...row.months, [added]: { forecast: 0, supply: 0 } } }))); setDraftRows(null); setMonths([...months.slice(1), added]); setLastClosedMonth(closed); setClosingOpen(false);
	};

	return <div className="sip-app sip-v2-app"><ModeHeader theme={theme} onToggleTheme={() => { const value = theme === "dark" ? "light" : "dark"; setTheme(value); document.documentElement.setAttribute("data-theme", value); }} /><main className="sip-v2-main">
		<header className="sip-v2-toolbar"><h1>Sales &amp; Inventory{view === "Trend" ? " · Trend Analysis" : ""}</h1><div className="sip-v2-tools"><button className="sip-btn" onClick={() => setHistoryOpen(true)}>↻ Pull History</button><span className="sip-v2-synced">History synced: {monthLabel(lastClosedMonth || "2026-07")} ✓</span><ModelFilter rows={rows} selected={models} onChange={setModels} /><label className="sip-v2-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All Categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="sip-v2-field"><span>Lifecycle</span><div className="sip-v2-segment">{(["All", "New", "Launched"] as const).map((item) => <button className={lifecycle === item ? "active" : ""} onClick={() => setLifecycle(item)} key={item}>{item}</button>)}</div></div><div className="sip-v2-field sip-v2-period"><span>Period</span><strong>{shortMonth(months[0])} – {shortMonth(months.at(-1)!)} {months[0].slice(0, 4)}</strong></div><Toggle checked={onlyGap} label="Only Gap" onChange={setOnlyGap} /><Toggle checked={firstBatchOnly} label="First Batch Only" onChange={setFirstBatchOnly} /><button className={`sip-btn ${draftRows ? "has-draft" : ""}`} onClick={() => setEditorOpen(true)}>Edit Plan{draftRows ? " · Draft saved" : ""}</button><button className="sip-btn" onClick={() => setArchiveOpen(true)}>Forecast Archive</button><button className="sip-btn primary" onClick={() => setClosingOpen(true)}>Month Closing</button><div className="sip-v2-field"><span>View</span><div className="sip-v2-segment sip-v2-view-switch">{(["Matrix", "Trend"] as const).map((item) => <button className={view === item ? "active" : ""} onClick={() => setView(item)} key={item}>{item}</button>)}</div></div></div></header>

		<section className="sip-v2-kpis"><article><span>3M DEMAND</span><strong>{compact(demand)}</strong><small>{shortMonth(months[0])} – {shortMonth(months.at(-1)!)}</small><b className="blue">⌁</b></article><article><span>3M SUPPLY</span><strong>{compact(supply)}</strong><small>{shortMonth(months[0])} – {shortMonth(months.at(-1)!)}</small><b className="green">◇</b></article><article className={supply - demand < 0 ? "danger" : ""}><span>NET GAP</span><strong>{signedCompact(supply - demand)}</strong><small>Supply − Demand</small></article><article className={`worst ${(worst?.supply || 0) - (worst?.demand || 0) < 0 ? "danger" : ""}`} role="button" tabIndex={0} onClick={() => { if (worst) { setView("Trend"); setHighlightedMonth(worst.month); } }}><span>WORST MONTH</span><strong>{worst ? monthLabel(worst.month) : "—"}</strong><em>{worst ? signedCompact(worst.supply - worst.demand) : "—"}</em><small>Gap · click to highlight</small></article><article className={stockouts ? "danger stockout" : "stockout"}><span>STOCKOUT SKU</span><strong>{stockouts}</strong><small>Any in 3M</small><b className="alert" aria-label="Attention">!</b></article></section>

		{view === "Matrix" ? <section className="sip-v2-workspace"><aside className="sip-v2-exceptions"><header><h2>Exception Board <b>{exceptions.length}</b></h2><div>{(["All", "Stockout", "First Batch Risk", "Gap", "Watch"] as const).map((type) => { const tone = type === "Stockout" || type === "First Batch Risk" ? "red" : type === "Gap" || type === "Watch" ? "orange" : "all"; return <button className={`${tone} ${exceptionType === type ? "active" : ""}`} onClick={() => setExceptionType(type)} key={type}>{type} ({type === "All" ? exceptions.length : exceptions.filter((item) => item.type === type).length})</button>; })}</div></header><table><thead><tr><th>Type</th><th>SKU</th><th>Lifecycle</th><th>Month</th><th>Issue</th></tr></thead><tbody>{shownExceptions.map((item, index) => { const tone = item.type === "Stockout" || item.type === "First Batch Risk" ? "red" : "orange"; return <tr className={`sip-v2-exception-${tone}`} key={`${item.row.model}-${item.month}-${index}`} onClick={() => focusCell(item)}><td>● {item.type}</td><td><strong>{item.row.model}</strong><small>{item.row.product}</small></td><td><span className={`sip-v2-life ${lifecycleOf(item.row, months[0]).toLowerCase()}`}>{lifecycleOf(item.row, months[0])}</span></td><td>{shortMonth(item.month)}</td><td><strong>{item.issue}</strong><small>{item.detail}</small></td></tr>; })}</tbody></table>{!shownExceptions.length && <p className="sip-v2-empty">No exceptions in this view.</p>}</aside>

		<section className="sip-v2-matrix"><header><h2>Demand–Supply Matrix <span>({shortMonth(months[0])} – {shortMonth(months.at(-1)!)} {months[0].slice(0, 4)})</span></h2><small>All values in units</small></header><div className="sip-v2-matrix-scroll"><table><thead><tr><th>Model</th><th>Product</th><th>Lifecycle</th><th>Launch</th><th>Current Inv</th>{months.map((month) => <th key={month}>{monthLabel(month)}</th>)}<th>3M Gap</th><th>Risk</th></tr></thead><tbody>{filtered.map((row) => { const life = lifecycleOf(row, months[0]); const endings = calculateEndings(row, months); const first = life === "New" ? firstBatchMonth(row, months) : null; const totalGap = months.reduce((sum, month) => sum + (row.months[month]?.supply || 0) - (row.months[month]?.forecast || 0), 0); const worstEoh = Math.min(...Object.values(endings)); const risk = worstEoh < 0 ? "Stockout" : totalGap < -1000 ? "High" : totalGap < 0 ? "Watch" : "Low"; return <tr key={row.model}><td><strong>{row.model}</strong></td><td>{row.product}</td><td><span className={`sip-v2-life ${life.toLowerCase()}`}>{life}</span></td><td>{row.launchDate}</td><td>{formatNumber(row.inventory)}</td>{months.map((month) => { const plan = row.months[month] || { forecast: 0, supply: 0 }; const gap = plan.supply - plan.forecast; const eoh = endings[month]; const isFirst = first === month; const fbTone = gap < 0 ? "risk" : eoh <= 500 ? "watch" : "ok"; return <td id={`sip-cell-${row.model}-${month}`} className={`sip-v2-month ${eoh < 0 ? "stockout" : gap < 0 ? "gap" : "healthy"} ${highlight === `${row.model}-${month}` ? "highlight" : ""}`} key={month}>{isFirst && <span className={`sip-v2-fb ${fbTone}`}>{fbTone === "risk" ? "FB!" : fbTone === "watch" ? "FB~" : "FB✓"}</span>}<div><span>D</span>{compact(plan.forecast)}</div><div><span>S</span>{compact(plan.supply)}</div><div className="gap-value"><span>Gap</span>{signedCompact(gap)}</div><div className="eoh"><span>EOH</span>{compact(eoh)}</div></td>; })}<td className={totalGap < 0 ? "sip-v2-total risk" : "sip-v2-total safe"}>{signedCompact(totalGap)}</td><td><span className={`sip-v2-risk ${risk.toLowerCase()}`}>{risk}</span></td></tr>; })}</tbody></table></div><footer><div><span className="red">●</span> Gap ≤ −10% demand <span className="orange">●</span> Gap −10% to −1% demand <span className="green">●</span> Gap ≥ 0</div><div><b>FB!</b> First Batch Risk <b>FB~</b> Watch <b>FB✓</b> OK</div><div>D = Demand　S = Supply　EOH = Ending On Hand</div></footer></section></section> : <TrendView rows={filtered} months={months} totals={totals} exceptions={exceptions} highlightedMonth={highlightedMonth} onFocus={focusCell} />}
	</main>
	{historyOpen && <HistoryModal history={history} snapshots={snapshots} revisionLogs={revisionLogs} syncedMonth={lastClosedMonth || "2026-07"} onClose={() => setHistoryOpen(false)} />}
	{archiveOpen && <ForecastArchiveModal snapshots={snapshots} onClose={() => setArchiveOpen(false)} />}
	{editorOpen && <PlanEditor rows={draftRows || rows} publishedRows={rows} months={months} snapshots={snapshots} revisionLogs={revisionLogs} onClose={() => setEditorOpen(false)} onSave={(next, publish, logs) => { const savedAt = new Date().toISOString(); if (!publish) { setDraftRows(next); setEditorOpen(false); return; } setRows(next); setDraftRows(null); setRevisionLogs((current) => [...current, ...logs.map((item) => ({ ...item, time: savedAt }))]); setSnapshots((current) => [...current, ...next.flatMap((row) => months.map((month) => ({ archiveMonth: months[0], savedAt, model: row.model, product: row.product, category: row.category, forecastMonth: month, shipmentForecast: row.months[month]?.forecast || 0, supplyPlan: row.months[month]?.supply || 0 })))]); setEditorOpen(false); }} />}
	{closingOpen && <ClosingModal rows={rows} month={months[0]} onClose={() => setClosingOpen(false)} onConfirm={closeMonth} />}
	{addOpen && <AddProductModal rows={rows} months={months} onClose={() => setAddOpen(false)} onAdd={(row) => { setRows([...rows, row]); setAddOpen(false); }} />}
	</div>;
}
