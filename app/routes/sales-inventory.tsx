import { Link } from "react-router";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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
	return [{ title: "Sales & Inventory Planning · ProtoTrack" }];
}

const STORAGE_KEY = "prototrack-sales-inventory-v1";
const clone = <T,>(value: T): T => structuredClone(value);
const numberValue = (value: string) => Math.max(0, Number(value) || 0);
const monthLabel = (month: string) =>
	new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
		.format(new Date(`${month}-01T00:00:00Z`));
const nextMonth = (month: string) => {
	const [year, number] = month.split("-").map(Number);
	const date = new Date(Date.UTC(year, number, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

type Workspace = {
	rows: PlanningRow[];
	months: string[];
	history: HistoryRow[];
	lastClosedMonth: string | null;
};

type ProductDraft = Omit<PlanningRow, "months">;
type ProductTextField = "model" | "product" | "category" | "launchDate";
type ProductNumberField = "inventory" | "safetyStock" | "firstForecast" | "firstMass";

const emptyProduct: ProductDraft = {
	model: "",
	product: "",
	category: "",
	launchDate: "2026-07-31",
	inventory: 0,
	safetyStock: 0,
	firstForecast: 0,
	firstMass: 0,
};

function calculateEndings(row: PlanningRow, months: string[]) {
	let previous = row.inventory;
	return Object.fromEntries(months.map((month) => {
		const plan = row.months[month] || { forecast: 0, supply: 0 };
		previous = previous + plan.supply - plan.forecast;
		return [month, previous];
	}));
}

function stockTone(ending: number, safetyStock: number) {
	if (ending < safetyStock) return "risk";
	if (ending <= safetyStock * 1.2) return "watch";
	return "healthy";
}

function NumberInput({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);
	return (
		<input
			aria-label={label}
			className="sip-input sip-number"
			inputMode="numeric"
			min="0"
			onBlur={() => {
				if (!draft) {
					setDraft("0");
					onChange(0);
				}
			}}
			onChange={(event) => {
				setDraft(event.target.value);
				if (event.target.value !== "") onChange(numberValue(event.target.value));
			}}
			onFocus={(event) => event.currentTarget.select()}
			type="number"
			value={draft}
		/>
	);
}

function ModeHeader({ theme, onToggleTheme }: { theme: string | null; onToggleTheme: () => void }) {
	return (
		<header className="sip-mode-bar">
			<div className="sip-brand">
				<div className="sip-brand-icon">📦</div>
				<span className="sip-brand-name">ProtoTrack</span>
				<span className="sip-brand-sep">·</span>
				<span className="sip-brand-sub">Europe Prototype Tracker</span>
			</div>
			<nav className="sip-mode-toggle" aria-label="ProtoTrack modes">
				<Link className="sip-mode-btn" to="/">🛰️ Control Tower</Link>
				<Link className="sip-mode-btn" to="/?view=field">🧳 Field View</Link>
				<Link className="sip-mode-btn" to="/project-progress">📈 Project Progress</Link>
				<span className="sip-mode-btn active">📊 Sales &amp; Inventory</span>
			</nav>
			<div className="sip-mode-right">
				<button className="sip-theme-btn" title="Toggle light / dark" onClick={onToggleTheme}>
					{theme === "dark" ? "☀️" : "🌙"}
				</button>
				<span className="sip-local"><i />Local mock data</span>
			</div>
		</header>
	);
}

function SummaryCards({
	rows,
	months,
	riskOnly,
	setRiskOnly,
}: {
	rows: PlanningRow[];
	months: string[];
	riskOnly: boolean;
	setRiskOnly: (value: boolean) => void;
}) {
	const riskCount = rows.filter((row) => {
		const endings = calculateEndings(row, months);
		return months.some((month) => endings[month] < row.safetyStock);
	}).length;
	return (
		<section className="sip-summary" aria-label="Planning summary">
			<button className={`sip-summary-card${!riskOnly ? " active" : ""}`} onClick={() => setRiskOnly(false)}>
				<span>ACTIVE PRODUCTS</span>
				<strong>{rows.length}</strong>
				<small>{!riskOnly ? "Showing all products" : "Click to show all"}</small>
			</button>
			<button className={`sip-summary-card risk${riskOnly ? " active" : ""}`} onClick={() => setRiskOnly(true)}>
				<span>STOCK RISK</span>
				<strong>{riskCount}</strong>
				<small>{riskOnly ? "Showing risk products" : "Click to filter"}</small>
			</button>
		</section>
	);
}

function AddProductModal({
	months,
	rows,
	onClose,
	onAdd,
}: {
	months: string[];
	rows: PlanningRow[];
	onClose: () => void;
	onAdd: (row: PlanningRow) => void;
}) {
	const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
	const [error, setError] = useState("");
	const text = (field: ProductTextField) => (event: ChangeEvent<HTMLInputElement>) =>
		setDraft((current) => ({ ...current, [field]: event.target.value }));
	const numeric = (field: ProductNumberField) => (value: number) =>
		setDraft((current) => ({ ...current, [field]: value }));
	const save = () => {
		const model = draft.model.trim().toUpperCase();
		if (!model || !draft.product.trim() || !draft.launchDate) {
			setError("Model, Product Name and Launch Date are required.");
			return;
		}
		if (rows.some((row) => row.model.toUpperCase() === model)) {
			setError("This model already exists.");
			return;
		}
		onAdd({
			...draft,
			model,
			product: draft.product.trim(),
			category: draft.category.trim() || "Uncategorized",
			months: Object.fromEntries(months.map((month) => [month, { forecast: 0, supply: 0 }])),
		});
	};
	return (
		<div className="sip-overlay" role="presentation">
			<div className="sip-modal" role="dialog" aria-modal="true" aria-labelledby="sip-add-title">
				<header>
					<div><h2 id="sip-add-title">Add Product</h2><p>Create a local planning record with zeroed monthly plans.</p></div>
					<button onClick={onClose} aria-label="Close">×</button>
				</header>
				<div className="sip-form-grid">
					<label>Model<input value={draft.model} onChange={text("model")} /></label>
					<label>Product Name<input value={draft.product} onChange={text("product")} /></label>
					<label>Category<input value={draft.category} onChange={text("category")} /></label>
					<label>Launch Date<input type="date" value={draft.launchDate} onChange={text("launchDate")} /></label>
					<label>Current Inventory<NumberInput label="New product current inventory" value={draft.inventory} onChange={numeric("inventory")} /></label>
					<label>Safety Stock<NumberInput label="New product safety stock" value={draft.safetyStock} onChange={numeric("safetyStock")} /></label>
					<label>FCST 1st<NumberInput label="New product first forecast" value={draft.firstForecast} onChange={numeric("firstForecast")} /></label>
					<label>Mass 1st<NumberInput label="New product first mass" value={draft.firstMass} onChange={numeric("firstMass")} /></label>
				</div>
				{error && <p className="sip-error">{error}</p>}
				<footer><button className="sip-btn" onClick={onClose}>Cancel</button><button className="sip-btn primary" onClick={save}>Add Product</button></footer>
			</div>
		</div>
	);
}

function ClosingModal({
	rows,
	month,
	onClose,
	onConfirm,
}: {
	rows: PlanningRow[];
	month: string;
	onClose: () => void;
	onConfirm: (entries: Array<{ model: string; actualSales: number; actualSupply: number }>) => void;
}) {
	const [entries, setEntries] = useState(() => rows.map((row) => ({
		model: row.model,
		actualSales: row.months[month]?.forecast || 0,
		actualSupply: row.months[month]?.supply || 0,
	})));
	const update = (model: string, field: "actualSales" | "actualSupply", value: number) =>
		setEntries((current) => current.map((entry) => entry.model === model ? { ...entry, [field]: value } : entry));
	return (
		<div className="sip-overlay">
			<div className="sip-modal wide" role="dialog" aria-modal="true" aria-labelledby="sip-close-title">
				<header>
					<div><h2 id="sip-close-title">Month Closing · {monthLabel(month)}</h2><p>Confirm actual sales and supply before archiving this month.</p></div>
					<button onClick={onClose} aria-label="Close">×</button>
				</header>
				<div className="sip-table-scroll">
					<table className="sip-table compact">
						<thead><tr><th>Model</th><th>Product</th><th>Forecast</th><th>Actual Sales</th><th>Supply Plan</th><th>Actual Supply</th><th>Beginning Inventory</th><th>Ending Inventory</th></tr></thead>
						<tbody>{rows.map((row) => {
							const entry = entries.find((item) => item.model === row.model)!;
							const ending = row.inventory + entry.actualSupply - entry.actualSales;
							return <tr key={row.model}>
								<td className="model">{row.model}</td><td>{row.product}</td>
								<td>{formatNumber(row.months[month]?.forecast || 0)}</td>
								<td><NumberInput label={`${row.model} actual sales`} value={entry.actualSales} onChange={(value) => update(row.model, "actualSales", value)} /></td>
								<td>{formatNumber(row.months[month]?.supply || 0)}</td>
								<td><NumberInput label={`${row.model} actual supply`} value={entry.actualSupply} onChange={(value) => update(row.model, "actualSupply", value)} /></td>
								<td>{formatNumber(row.inventory)}</td><td>{formatNumber(ending)}</td>
							</tr>;
						})}</tbody>
					</table>
				</div>
				<footer><button className="sip-btn" onClick={onClose}>Cancel</button><button className="sip-btn primary" onClick={() => onConfirm(entries)}>Confirm Closing</button></footer>
			</div>
		</div>
	);
}

export default function SalesInventory() {
	const [rows, setRows] = useState<PlanningRow[]>(() => clone(initialPlanningRows));
	const [months, setMonths] = useState(() => [...initialPlanningMonths]);
	const [history, setHistory] = useState<HistoryRow[]>(() => clone(initialHistoryRows));
	const [lastClosedMonth, setLastClosedMonth] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [riskOnly, setRiskOnly] = useState(false);
	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState(false);
	const [draftRows, setDraftRows] = useState<PlanningRow[]>([]);
	const [addOpen, setAddOpen] = useState(false);
	const [closingOpen, setClosingOpen] = useState(false);
	const [historyEditing, setHistoryEditing] = useState(false);
	const [historyDraft, setHistoryDraft] = useState<HistoryRow[]>([]);
	const [historyMonth, setHistoryMonth] = useState("all");
	const [historyModel, setHistoryModel] = useState("");
	const [historyCategory, setHistoryCategory] = useState("all");
	const [theme, setTheme] = useState<string | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as Partial<Workspace>;
				if (Array.isArray(parsed.rows) && Array.isArray(parsed.months) && Array.isArray(parsed.history)) {
					setRows(parsed.rows);
					setMonths(parsed.months);
					setHistory(parsed.history);
					setLastClosedMonth(parsed.lastClosedMonth || null);
				}
			}
		} catch {
			window.localStorage.removeItem(STORAGE_KEY);
		} finally {
			setLoaded(true);
		}
		const attr = document.documentElement.getAttribute("data-theme");
		setTheme(attr || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
	}, []);

	useEffect(() => {
		if (!loaded) return;
		const workspace: Workspace = { rows, months, history, lastClosedMonth };
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
	}, [history, lastClosedMonth, loaded, months, rows]);

	const toggleTheme = () => {
		const next = theme === "dark" ? "light" : "dark";
		document.documentElement.setAttribute("data-theme", next);
		window.localStorage.setItem("pt-theme", next);
		setTheme(next);
	};

	const riskModels = useMemo(() => new Set(rows.filter((row) => {
		const endings = calculateEndings(row, months);
		return months.some((month) => endings[month] < row.safetyStock);
	}).map((row) => row.model)), [months, rows]);

	const tableRows = editing ? draftRows : rows;
	const visibleRows = tableRows.filter((row) =>
		(!riskOnly || riskModels.has(row.model)) &&
		(!query.trim() || `${row.model} ${row.product}`.toLowerCase().includes(query.trim().toLowerCase())));

	const beginEdit = () => {
		setDraftRows(clone(rows));
		setEditing(true);
		setError("");
	};
	const updateRow = (model: string, updater: (row: PlanningRow) => PlanningRow) =>
		setDraftRows((current) => current.map((row) => row.model === model ? updater(row) : row));
	const saveRows = () => {
		const normalized = draftRows.map((row) => ({ ...row, model: row.model.trim().toUpperCase(), product: row.product.trim(), category: row.category.trim() || "Uncategorized" }));
		if (normalized.some((row) => !row.model || !row.product || !row.launchDate)) return setError("Model, Product Name and Launch Date are required.");
		if (new Set(normalized.map((row) => row.model)).size !== normalized.length) return setError("Model values must be unique.");
		const changes = new Map(rows.map((row, index) => [row.model, normalized[index]]));
		setRows(normalized);
		setHistory((current) => current.map((item) => {
			const changed = changes.get(item.model);
			return changed ? { ...item, model: changed.model, product: changed.product, category: changed.category } : item;
		}));
		setEditing(false);
		setError("");
	};

	const closeMonth = (entries: Array<{ model: string; actualSales: number; actualSupply: number }>) => {
		const closed = months[0];
		const newHistory = rows.map((row) => {
			const entry = entries.find((item) => item.model === row.model)!;
			return {
				month: closed,
				model: row.model,
				product: row.product,
				category: row.category,
				forecast: row.months[closed]?.forecast || 0,
				actualSales: entry.actualSales,
				supplyPlan: row.months[closed]?.supply || 0,
				actualSupply: entry.actualSupply,
				beginningInventory: row.inventory,
				endingInventory: row.inventory + entry.actualSupply - entry.actualSales,
			};
		});
		const added = nextMonth(months[months.length - 1]);
		setRows((current) => current.map((row) => {
			const result = newHistory.find((item) => item.model === row.model)!;
			const monthPlans = { ...row.months };
			delete monthPlans[closed];
			return { ...row, inventory: result.endingInventory, months: { ...monthPlans, [added]: { forecast: 0, supply: 0 } } };
		}));
		setHistory((current) => [...current, ...newHistory]);
		setMonths((current) => [...current.slice(1), added]);
		setLastClosedMonth(closed);
		setClosingOpen(false);
	};

	const historyRows = historyEditing ? historyDraft : history;
	const categories = [...new Set(historyRows.map((row) => row.category))].sort();
	const historyFiltered = historyRows
		.filter((row) => historyMonth === "all" || row.month === historyMonth)
		.filter((row) => !historyModel.trim() || row.model.toLowerCase().includes(historyModel.toLowerCase()))
		.filter((row) => historyCategory === "all" || row.category === historyCategory)
		.sort((a, b) => b.month.localeCompare(a.month) || a.model.localeCompare(b.model));
	const saveHistory = () => {
		const recalculated = clone(historyDraft);
		for (const model of new Set(recalculated.map((row) => row.model))) {
			const productRows = recalculated.filter((row) => row.model === model).sort((a, b) => a.month.localeCompare(b.month));
			let ending = productRows[0]?.beginningInventory || 0;
			for (const row of productRows) {
				row.beginningInventory = ending;
				row.endingInventory = ending + row.actualSupply - row.actualSales;
				ending = row.endingInventory;
			}
			setRows((current) => current.map((row) => row.model === model ? { ...row, inventory: ending } : row));
		}
		setHistory(recalculated);
		setHistoryEditing(false);
	};

	return (
		<div className="sip-app">
			<ModeHeader theme={theme} onToggleTheme={toggleTheme} />
			<main className="sip-main">
				<section className="sip-page-head">
					<div>
						<span>GTM OPERATIONS</span>
						<h1>Sales &amp; Inventory Planning</h1>
						<p>Plan the next three months and review historical performance in one workspace.</p>
					</div>
					<div className="sip-state"><i />Mock data · Saved locally</div>
				</section>

				<SummaryCards rows={rows} months={months} riskOnly={riskOnly} setRiskOnly={setRiskOnly} />

				<section className="sip-panel" id="planning">
					<header className="sip-section-head">
						<div><span>ROLLING 3-MONTH VIEW</span><h2>Planning</h2><p>Expected inventory and first-batch gap update automatically.</p></div>
						<div className="sip-actions">
							<input className="sip-search" placeholder="Search model or product" value={query} onChange={(event) => setQuery(event.target.value)} />
							{editing ? <>
								<button className="sip-btn" onClick={() => { setEditing(false); setError(""); }}>Cancel</button>
								<button className="sip-btn primary" onClick={saveRows}>Save Table</button>
							</> : <>
								<button className="sip-btn" onClick={beginEdit}>Edit Table</button>
								<button className="sip-btn" onClick={() => setAddOpen(true)}>＋ Add Product</button>
								<button className="sip-btn primary" onClick={() => setClosingOpen(true)}>Month Closing</button>
							</>}
						</div>
					</header>
					<div className="sip-open-row"><span><i />{monthLabel(months[0])} · Open</span><span>{lastClosedMonth ? `${monthLabel(lastClosedMonth)} · Closed` : "Mock data"}</span></div>
					{error && <p className="sip-error">{error}</p>}
					<div className="sip-table-scroll">
						<table className="sip-table planning">
							<thead>
								<tr className="sip-month-row"><th colSpan={6} /><th colSpan={3}>FIRST BATCH</th>{months.map((month) => <th colSpan={3} key={month}>{monthLabel(month)}</th>)}</tr>
								<tr><th>Model</th><th>Product Name</th><th>Category</th><th>Launch Date</th><th>Inventory</th><th>Safety Stock</th><th>FCST 1st</th><th>Mass 1st</th><th>Gap</th>{months.flatMap((month) => [<th key={`${month}-f`}>Forecast</th>, <th key={`${month}-s`}>Supply Plan</th>, <th key={`${month}-e`}>Expected Ending</th>])}</tr>
							</thead>
							<tbody>{visibleRows.map((row) => {
								const endings = calculateEndings(row, months);
								const gap = row.firstMass - row.firstForecast;
								return <tr key={row.model}>
									{(["model", "product", "category", "launchDate"] as const).map((field) => <td key={field} className={field === "model" ? "model" : ""}>{editing ? <input className="sip-input" type={field === "launchDate" ? "date" : "text"} value={row[field]} onChange={(event) => updateRow(row.model, (current) => ({ ...current, [field]: event.target.value }))} /> : row[field]}</td>)}
									{(["inventory", "safetyStock", "firstForecast", "firstMass"] as const).map((field) => <td key={field}>{editing ? <NumberInput label={`${row.model} ${field}`} value={row[field]} onChange={(value) => updateRow(row.model, (current) => ({ ...current, [field]: value }))} /> : formatNumber(row[field])}</td>)}
									<td className={`sip-gap ${gap >= 0 ? "positive" : "negative"}`}>{gap > 0 ? "+" : ""}{formatNumber(gap)}</td>
									{months.flatMap((month) => {
										const plan = row.months[month] || { forecast: 0, supply: 0 };
										const change = (field: "forecast" | "supply", value: number) => updateRow(row.model, (current) => ({ ...current, months: { ...current.months, [month]: { ...plan, [field]: value } } }));
										return [
											<td key={`${month}-f`}>{editing ? <NumberInput label={`${row.model} ${month} forecast`} value={plan.forecast} onChange={(value) => change("forecast", value)} /> : formatNumber(plan.forecast)}</td>,
											<td key={`${month}-s`}>{editing ? <NumberInput label={`${row.model} ${month} supply`} value={plan.supply} onChange={(value) => change("supply", value)} /> : formatNumber(plan.supply)}</td>,
											<td className={`sip-ending ${stockTone(endings[month], row.safetyStock)}`} key={`${month}-e`}>{formatNumber(endings[month])}</td>,
										];
									})}
								</tr>;
							})}</tbody>
						</table>
					</div>
					<footer className="sip-table-foot"><span>{visibleRows.length} products</span><span>Mock Data + localStorage</span></footer>
				</section>

				<section className="sip-panel" id="history">
					<header className="sip-section-head">
						<div><span>CLOSED MONTH ARCHIVE</span><h2>Performance History</h2><p>Correct actual results when needed; inventory recalculates through following months.</p></div>
						<div className="sip-actions">{historyEditing ? <>
							<button className="sip-btn" onClick={() => setHistoryEditing(false)}>Cancel</button>
							<button className="sip-btn primary" onClick={saveHistory}>Save Table</button>
						</> : <button className="sip-btn" onClick={() => { setHistoryDraft(clone(history)); setHistoryEditing(true); }}>Edit Table</button>}</div>
					</header>
					<div className="sip-filters">
						<label>Month<select value={historyMonth} onChange={(event) => setHistoryMonth(event.target.value)}><option value="all">All Months</option>{[...new Set(historyRows.map((row) => row.month))].sort().reverse().map((month) => <option value={month} key={month}>{monthLabel(month)}</option>)}</select></label>
						<label>Model<input placeholder="All Models" value={historyModel} onChange={(event) => setHistoryModel(event.target.value)} /></label>
						<label>Category<select value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}><option value="all">All Categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
					</div>
					<div className="sip-table-scroll">
						<table className="sip-table history">
							<thead><tr><th>Month</th><th>Model</th><th>Product</th><th>Category</th><th>Forecast</th><th>Actual Sales</th><th>Supply Plan</th><th>Actual Supply</th><th>Beginning Inventory</th><th>Ending Inventory</th></tr></thead>
							<tbody>{historyFiltered.map((row) => <tr key={`${row.month}-${row.model}`}>
								<td>{monthLabel(row.month)}</td><td className="model">{row.model}</td><td>{row.product}</td><td>{row.category}</td><td>{formatNumber(row.forecast)}</td>
								<td>{historyEditing ? <NumberInput label={`${row.model} ${row.month} actual sales`} value={row.actualSales} onChange={(value) => setHistoryDraft((current) => current.map((item) => item.model === row.model && item.month === row.month ? { ...item, actualSales: value } : item))} /> : formatNumber(row.actualSales)}</td>
								<td>{formatNumber(row.supplyPlan)}</td>
								<td>{historyEditing ? <NumberInput label={`${row.model} ${row.month} actual supply`} value={row.actualSupply} onChange={(value) => setHistoryDraft((current) => current.map((item) => item.model === row.model && item.month === row.month ? { ...item, actualSupply: value } : item))} /> : formatNumber(row.actualSupply)}</td>
								<td>{formatNumber(row.beginningInventory)}</td><td>{formatNumber(row.endingInventory)}</td>
							</tr>)}</tbody>
						</table>
					</div>
					<footer className="sip-table-foot"><span>{historyFiltered.length} records</span><span>{historyEditing ? "Editing actual values" : "History is read only"}</span></footer>
				</section>
			</main>
			{addOpen && <AddProductModal months={months} rows={rows} onClose={() => setAddOpen(false)} onAdd={(row) => { setRows((current) => [...current, row]); setAddOpen(false); }} />}
			{closingOpen && <ClosingModal rows={rows} month={months[0]} onClose={() => setClosingOpen(false)} onConfirm={closeMonth} />}
		</div>
	);
}
