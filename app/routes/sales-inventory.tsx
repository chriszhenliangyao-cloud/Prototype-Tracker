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
const monthShortLabel = (month: string) =>
	new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
		.format(new Date(`${month}-01T00:00:00Z`));
const compactNumber = (value: number) => {
	if (Math.abs(value) < 1000) return formatNumber(value);
	const compact = value / 1000;
	return `${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1)}K`;
};
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
	forecastSnapshots: ForecastSnapshot[];
	lastClosingBackup: ClosingBackup | null;
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
	projectedOnHand: number;
};

type ClosingBackup = {
	rows: PlanningRow[];
	months: string[];
	history: HistoryRow[];
	lastClosedMonth: string | null;
	forecastSnapshots: ForecastSnapshot[];
	rangeFrom: string;
	rangeTo: string;
};

type ProductDraft = Omit<PlanningRow, "months">;
type ProductTextField = "model" | "product" | "category" | "launchDate";
type ProductNumberField = "inventory" | "firstForecast" | "firstMass";

const emptyProduct: ProductDraft = {
	model: "",
	product: "",
	category: "",
	launchDate: "2026-07-31",
	inventory: 0,
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

function stockTone(ending: number) {
	return ending < 0 ? "risk" : "healthy";
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

function ModelMultiSelect({
	options,
	selected,
	onChange,
}: {
	options: string[];
	selected: string[];
	onChange: (models: string[]) => void;
}) {
	const label = selected.length === 0 ? "All Models" : selected.length === 1 ? selected[0] : `${selected.length} Models`;
	return (
		<div className="sip-filter-field">
			<span>Model</span>
			<details className="sip-multi-select">
				<summary>{label}</summary>
				<div className="sip-multi-menu">
					<button className={selected.length === 0 ? "active" : ""} onClick={() => onChange([])} type="button">
						<span>{selected.length === 0 ? "✓" : ""}</span>All Models
					</button>
					{options.map((model) => {
						const checked = selected.includes(model);
						return <label key={model}>
							<input
								checked={checked}
								onChange={() => onChange(checked ? selected.filter((item) => item !== model) : [...selected, model])}
								type="checkbox"
							/>
							{model}
						</label>;
					})}
				</div>
			</details>
		</div>
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
}: {
	rows: PlanningRow[];
	months: string[];
}) {
	const summaryMonths = months.slice(0, 3);
	const totals = summaryMonths.map((month) => ({
		month,
		forecast: rows.reduce((sum, row) => sum + (row.months[month]?.forecast || 0), 0),
		supply: rows.reduce((sum, row) => sum + (row.months[month]?.supply || 0), 0),
	}));
	return (
		<section className="sip-summary" aria-label="Planning summary">
			<article className="sip-summary-card">
				<span>FORECAST</span>
				<div className="sip-summary-months">
					{totals.map((item) => <div key={item.month}>
						<time dateTime={item.month}>{monthShortLabel(item.month)}</time>
						<strong>{compactNumber(item.forecast)}</strong>
					</div>)}
				</div>
			</article>
			<article className="sip-summary-card supply">
				<span>SUPPLY PLAN</span>
				<div className="sip-summary-months">
					{totals.map((item) => <div key={item.month}>
						<time dateTime={item.month}>{monthShortLabel(item.month)}</time>
						<strong>{compactNumber(item.supply)}</strong>
					</div>)}
				</div>
			</article>
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
					<div><h2 id="sip-close-title">Month Closing · {monthLabel(month)}</h2><p>Confirm actual shipment and supply before archiving this month.</p></div>
					<button onClick={onClose} aria-label="Close">×</button>
				</header>
				<div className="sip-table-scroll">
					<table className="sip-table compact">
						<thead><tr><th>Model</th><th>Product</th><th>Forecast</th><th>Actual Shipment</th><th>Supply Plan</th><th>Actual Supply</th><th>Beginning Inventory</th><th>Ending Inventory</th></tr></thead>
						<tbody>{rows.map((row) => {
							const entry = entries.find((item) => item.model === row.model)!;
							const ending = row.inventory + entry.actualSupply - entry.actualSales;
							return <tr key={row.model}>
								<td className="model">{row.model}</td><td>{row.product}</td>
								<td>{formatNumber(row.months[month]?.forecast || 0)}</td>
								<td><NumberInput label={`${row.model} actual shipment`} value={entry.actualSales} onChange={(value) => update(row.model, "actualSales", value)} /></td>
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

function SnapshotTrend({ entries, detailed = false }: { entries: ForecastSnapshot[]; detailed?: boolean }) {
	const sorted = [...entries].sort((a, b) => a.archiveMonth.localeCompare(b.archiveMonth));
	const width = detailed ? 920 : 430;
	const height = detailed ? 270 : 112;
	const margin = detailed ? { top: 28, right: 26, bottom: 48, left: 58 } : { top: 14, right: 14, bottom: 28, left: 14 };
	const plotWidth = width - margin.left - margin.right;
	const plotHeight = height - margin.top - margin.bottom;
	const maximum = Math.max(1, ...sorted.flatMap((item) => [item.shipmentForecast, item.supplyPlan]));
	const x = (index: number) => sorted.length === 1 ? margin.left + plotWidth / 2 : margin.left + (plotWidth * index) / (sorted.length - 1);
	const y = (value: number) => margin.top + plotHeight - (value / maximum) * plotHeight;
	const shipmentPoints = sorted.map((item, index) => `${x(index)},${y(item.shipmentForecast)}`).join(" ");
	const supplyPoints = sorted.map((item, index) => `${x(index)},${y(item.supplyPlan)}`).join(" ");
	return <svg className={`sip-archive-chart${detailed ? " detailed" : ""}`} role="img" aria-label="Shipment forecast and supply plan across monthly archives" viewBox={`0 0 ${width} ${height}`}>
		{detailed && [0, 0.5, 1].map((ratio) => {
			const value = maximum * ratio;
			const tickY = margin.top + plotHeight - plotHeight * ratio;
			return <g key={ratio}><line className="grid" x1={margin.left} x2={width - margin.right} y1={tickY} y2={tickY} /><text className="axis" textAnchor="end" x={margin.left - 9} y={tickY + 4}>{formatNumber(value)}</text></g>;
		})}
		{sorted.map((item, index) => item.shipmentForecast > item.supplyPlan && <g key={`risk-${item.archiveMonth}`}>
			<rect className="risk-zone" height={plotHeight} width={Math.max(24, plotWidth / Math.max(sorted.length, 1) * 0.45)} x={x(index) - Math.max(24, plotWidth / Math.max(sorted.length, 1) * 0.45) / 2} y={margin.top} />
			<line className="risk-gap" x1={x(index)} x2={x(index)} y1={y(item.supplyPlan)} y2={y(item.shipmentForecast)} />
		</g>)}
		<polyline className="supply-line" points={supplyPoints} />
		<polyline className="shipment-line" points={shipmentPoints} />
		{sorted.map((item, index) => <g key={item.archiveMonth}>
			<circle className="supply-point" cx={x(index)} cy={y(item.supplyPlan)} r={detailed ? 5 : 3.5}><title>{`${monthLabel(item.archiveMonth)} archive\nSupply Plan: ${formatNumber(item.supplyPlan)}`}</title></circle>
			<circle className="shipment-point" cx={x(index)} cy={y(item.shipmentForecast)} r={detailed ? 5 : 3.5}><title>{`${monthLabel(item.archiveMonth)} archive\nShipment Forecast: ${formatNumber(item.shipmentForecast)}`}</title></circle>
			<text className="month" textAnchor="middle" x={x(index)} y={height - 8}>{monthShortLabel(item.archiveMonth)}</text>
			{detailed && <><text className="value shipment" textAnchor="middle" x={x(index)} y={Math.max(12, y(item.shipmentForecast) - 10)}>{formatNumber(item.shipmentForecast)}</text><text className="value supply" textAnchor="middle" x={x(index)} y={Math.min(height - margin.bottom - 5, y(item.supplyPlan) + 17)}>{formatNumber(item.supplyPlan)}</text></>}
		</g>)}
	</svg>;
}

function ForecastArchiveModal({ snapshots, onClose }: { snapshots: ForecastSnapshot[]; onClose: () => void }) {
	const forecastMonths = [...new Set(snapshots.map((item) => item.forecastMonth))].sort();
	const defaultForecastMonth = [...forecastMonths].sort((a, b) => {
		const aCount = new Set(snapshots.filter((item) => item.forecastMonth === a).map((item) => item.archiveMonth)).size;
		const bCount = new Set(snapshots.filter((item) => item.forecastMonth === b).map((item) => item.archiveMonth)).size;
		return bCount - aCount || b.localeCompare(a);
	})[0] || "";
	const [forecastMonth, setForecastMonth] = useState(defaultForecastMonth);
	const availableArchives = [...new Set(snapshots.filter((item) => item.forecastMonth === forecastMonth).map((item) => item.archiveMonth))].sort();
	const [fromArchive, setFromArchive] = useState(availableArchives[0] || "");
	const [toArchive, setToArchive] = useState(availableArchives.at(-1) || "");
	const [selectedModel, setSelectedModel] = useState("all");
	const chooseForecastMonth = (value: string) => {
		const archives = [...new Set(snapshots.filter((item) => item.forecastMonth === value).map((item) => item.archiveMonth))].sort();
		setForecastMonth(value);
		setFromArchive(archives[0] || "");
		setToArchive(archives.at(-1) || "");
		setSelectedModel("all");
	};
	const inRange = snapshots.filter((item) => item.forecastMonth === forecastMonth && item.archiveMonth >= fromArchive && item.archiveMonth <= toArchive);
	const groups = [...new Set(inRange.map((item) => item.model))].sort()
		.map((model) => ({ model, entries: inRange.filter((item) => item.model === model).sort((a, b) => a.archiveMonth.localeCompare(b.archiveMonth)) }))
		.filter(({ entries }) => entries.length > 1 && new Set(entries.map((item) => item.shipmentForecast)).size > 1);
	const models = groups.map((group) => group.model);
	const detail = groups.find((group) => group.model === selectedModel);
	return <div className="sip-overlay">
		<div className="sip-modal archive" role="dialog" aria-modal="true" aria-labelledby="sip-archive-title">
			<header>
				<div><h2 id="sip-archive-title">Forecast Archive</h2><p>Review models whose shipment forecast changed across the selected monthly archives.</p></div>
				<button onClick={onClose} aria-label="Close">×</button>
			</header>
			{snapshots.length === 0 ? <div className="sip-archive-empty"><strong>No forecast snapshots yet</strong><span>Complete Month Closing to archive the next three planning months. Archived versions will appear here and remain read only.</span></div> : <>
				<div className="sip-archive-filters">
					<label>Forecast Month<select value={forecastMonth} onChange={(event) => chooseForecastMonth(event.target.value)}>{forecastMonths.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select></label>
					<label>Model<select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}><option value="all">All Models</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
					<label>From Archive<select value={fromArchive} onChange={(event) => { const value = event.target.value; setFromArchive(value); if (value > toArchive) setToArchive(value); setSelectedModel("all"); }}>{availableArchives.filter((month) => month <= toArchive).map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select></label>
					<label>To Archive<select value={toArchive} onChange={(event) => { setToArchive(event.target.value); setSelectedModel("all"); }}>{availableArchives.filter((month) => month >= fromArchive).map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select></label>
				</div>
				<div className="sip-archive-legend"><span><i className="shipment" />Shipment Forecast</span><span><i className="supply" />Supply Plan</span><span><i className="risk" />Forecast above supply</span></div>
				{groups.length === 0 ? <div className="sip-archive-empty compact"><strong>No forecast changes in this range</strong><span>Models with an unchanged Shipment Forecast are hidden. Select a wider archive range after another Month Closing to review changes.</span></div> : detail ? <div className="sip-archive-detail">
					<button className="sip-back-link" onClick={() => setSelectedModel("all")}>← All Models</button>
					<div className="sip-archive-detail-title"><div><strong>{detail.model}</strong><span>{detail.entries[0]?.product}</span></div><span>Forecast for {monthLabel(forecastMonth)}</span></div>
					<SnapshotTrend entries={detail.entries} detailed />
				</div> : <div className="sip-archive-list">{groups.map(({ model, entries }) => {
					const first = entries[0];
					const last = entries.at(-1)!;
					const shipmentChange = last.shipmentForecast - first.shipmentForecast;
					const supplyChange = last.supplyPlan - first.supplyPlan;
					const signed = (value: number) => `${value > 0 ? "+" : ""}${formatNumber(value)}`;
					return <button className="sip-archive-row" key={model} onClick={() => setSelectedModel(model)}>
						<span className="identity"><strong>{model}</strong><small>{first.product}</small></span>
						<SnapshotTrend entries={entries} />
						<span className="changes"><small>First → latest</small><b className={shipmentChange > 0 ? "up" : ""}>Shipment {signed(shipmentChange)}</b><b>Supply {signed(supplyChange)}</b></span>
					</button>;
				})}</div>}
			</>}
			<footer><span className="sip-read-only">Read-only monthly snapshots</span><button className="sip-btn" onClick={onClose}>Close</button></footer>
		</div>
	</div>;
}

function InventoryTrend({
	rows,
	history,
	months,
	availableMonths,
	tableModels,
	tableCategory,
	tableFrom,
	tableTo,
}: {
	rows: PlanningRow[];
	history: HistoryRow[];
	months: string[];
	availableMonths: string[];
	tableModels: string[];
	tableCategory: string;
	tableFrom: string;
	tableTo: string;
}) {
	const [models, setModels] = useState<string[]>(tableModels);
	const [category, setCategory] = useState(tableCategory);
	const [from, setFrom] = useState(tableFrom);
	const [to, setTo] = useState(tableTo);
	const [focusedSeries, setFocusedSeries] = useState<number | null>(null);

	useEffect(() => setModels([...tableModels]), [tableModels]);
	useEffect(() => setCategory(tableCategory), [tableCategory]);
	useEffect(() => setFrom(tableFrom), [tableFrom]);
	useEffect(() => setTo(tableTo), [tableTo]);

	const categories = [...new Set(rows.map((row) => row.category))].sort();
	const modelOptions = rows
		.filter((row) => category === "all" || row.category === category)
		.map((row) => row.model)
		.sort();
	const chartRows = rows.filter((row) =>
		(models.length === 0 || models.includes(row.model)) &&
		(category === "all" || row.category === category));
	const chartMonths = availableMonths.filter((month) => month >= from && month <= to);
	const allSeries = chartRows.map((row) => ({
		model: row.model,
		product: row.product,
		data: chartMonths.map((month) => {
			const planning = months.includes(month);
			const record = history.find((entry) => entry.month === month && entry.model === row.model);
			return {
				month,
				production: planning ? row.months[month]?.supply || 0 : record?.actualSupply || 0,
				shipment: planning ? row.months[month]?.forecast || 0 : record?.actualSales || 0,
				forecast: month > months[0],
			};
		}),
	}));
	const series = allSeries.slice(0, 4);

	const width = 1120;
	const height = 390;
	const margin = { top: 30, right: 32, bottom: 70, left: 72 };
	const plotWidth = width - margin.left - margin.right;
	const plotHeight = height - margin.top - margin.bottom;
	const maximum = Math.max(1, ...series.flatMap((product) => product.data.flatMap((item) => [item.production, item.shipment])));
	const axisMax = Math.ceil(maximum / 100) * 100;
	const x = (index: number) => margin.left + plotWidth * ((index + 0.5) / Math.max(chartMonths.length, 1));
	const y = (value: number) => margin.top + plotHeight - (value / axisMax) * plotHeight;
	const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, value: axisMax * ratio }));
	const slotWidth = plotWidth / Math.max(chartMonths.length, 1);
	const barGap = 3;
	const barWidth = Math.min(28, Math.max(9, (slotWidth * 0.58 - barGap * Math.max(series.length - 1, 0)) / Math.max(series.length, 1)));
	const barGroupWidth = barWidth * series.length + barGap * Math.max(series.length - 1, 0);
	const dashPatterns = ["none", "10 6", "3 5", "13 4 3 4"];
	const markerShapes = ["circle", "square", "diamond", "triangle"];
	const seriesColors = ["#059669", "#2563eb", "#d97706", "#7c3aed"];
	const seriesLabel = (product: typeof series[number]) => `${product.model} · ${product.product}`;

	return (
		<section className="sip-trend">
			<header className="sip-trend-head">
				<div>
					<span>SALES &amp; SUPPLY TREND</span>
					<h3>Supply &amp; Sales Trend</h3>
					<p>Compare historical actuals with future supply plans and sales forecasts across the selected period.</p>
				</div>
				<div className="sip-filter-controls">
					<ModelMultiSelect onChange={setModels} options={modelOptions} selected={models} />
					<label>Category<select value={category} onChange={(event) => {
						const value = event.target.value;
						setCategory(value);
						setModels((current) => current.filter((model) => rows.some((row) => row.model === model && (value === "all" || row.category === value))));
					}}><option value="all">All Categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
					<label>From<select value={from} onChange={(event) => {
						const value = event.target.value;
						setFrom(value);
						if (value > to) setTo(value);
					}}>{availableMonths.filter((month) => month <= to).map((month) => <option value={month} key={month}>{monthLabel(month)}</option>)}</select></label>
					<label>To<select value={to} onChange={(event) => setTo(event.target.value)}>{availableMonths.filter((month) => month >= from).map((month) => <option value={month} key={month}>{monthLabel(month)}</option>)}</select></label>
				</div>
			</header>
			<div className="sip-chart-legend">
				<span><i className="production" />Supply</span>
				<span><i className="shipment" />Sales</span>
			</div>
			<div className="sip-chart-wrap">
				{series.length === 0 || chartMonths.length === 0 ? <div className="sip-chart-empty">No data in the selected range.</div> : (
					<div className="sip-combined-chart">
						<div className="sip-product-legend" aria-label="Products shown in chart">
							{series.map((product, seriesIndex) => <button
								className={focusedSeries === seriesIndex ? "active" : ""}
								key={`${product.model}-${product.product}-${seriesIndex}`}
								onBlur={() => setFocusedSeries(null)}
								onFocus={() => setFocusedSeries(seriesIndex)}
								onMouseEnter={() => setFocusedSeries(seriesIndex)}
								onMouseLeave={() => setFocusedSeries(null)}
								type="button"
							>
								<svg aria-hidden="true" style={{ color: seriesColors[seriesIndex] }} viewBox="0 0 36 14">
									<rect className="sip-product-key-bar" height="10" width="7" x="27" y="3" />
									<line className="sip-product-key-line" strokeDasharray={dashPatterns[seriesIndex]} x1="1" x2="25" y1="7" y2="7" />
									{markerShapes[seriesIndex] === "circle" && <circle className="sip-product-key-point" cx="14" cy="7" r="3" />}
									{markerShapes[seriesIndex] === "square" && <rect className="sip-product-key-point" height="6" width="6" x="11" y="4" />}
									{markerShapes[seriesIndex] === "diamond" && <rect className="sip-product-key-point" height="6" transform="rotate(45 14 7)" width="6" x="11" y="4" />}
									{markerShapes[seriesIndex] === "triangle" && <polygon className="sip-product-key-point" points="14,3 18,11 10,11" />}
								</svg>
								<span><strong>{product.model}</strong>{product.product}</span>
							</button>)}
						</div>
						{allSeries.length > 4 && <p className="sip-chart-limit">Showing the first 4 selected products. Refine the Model filter to compare a different set.</p>}
					<svg className="sip-chart combined" role="img" aria-label="Combined supply line and sales bar trends by product" viewBox={`0 0 ${width} ${height}`}>
						<defs>
							{series.map((_, seriesIndex) => <pattern height="8" id={`sip-bar-pattern-${seriesIndex}`} key={seriesIndex} patternUnits="userSpaceOnUse" width="8">
								<rect fill={seriesColors[seriesIndex]} height="8" opacity="0.82" width="8" />
									{seriesIndex === 1 && <path d="M0 8L8 0" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.5" />}
									{seriesIndex === 2 && <path d="M0 2H8M0 6H8" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" />}
									{seriesIndex === 3 && <circle cx="2" cy="2" fill="#ffffff" fillOpacity="0.6" r="1" />}
								</pattern>)}
							</defs>
							{ticks.map(({ ratio, value }) => {
								const tickY = margin.top + plotHeight - ratio * plotHeight;
								return <g key={ratio}>
									<line className="sip-chart-grid" x1={margin.left} x2={width - margin.right} y1={tickY} y2={tickY} />
									<text className="sip-chart-axis" textAnchor="end" x={margin.left - 11} y={tickY + 4}>{formatNumber(value)}</text>
								</g>;
							})}
							{chartMonths.map((month, monthIndex) => {
								const forecast = month > months[0];
								return <g key={month}>
									<text className="sip-chart-month" textAnchor="middle" x={x(monthIndex)} y={height - 36}>{monthLabel(month)}</text>
									{forecast && <text className="sip-chart-forecast" textAnchor="middle" x={x(monthIndex)} y={height - 18}>Forecast</text>}
								</g>;
							})}
							{series.map((product, seriesIndex) => {
								const dimmed = focusedSeries !== null && focusedSeries !== seriesIndex;
								return <g
									className={`sip-chart-series${dimmed ? " dimmed" : ""}`}
									key={`${product.model}-${product.product}-${seriesIndex}`}
									onMouseEnter={() => setFocusedSeries(seriesIndex)}
									onMouseLeave={() => setFocusedSeries(null)}
								>
									{product.data.map((item, monthIndex) => {
										const barY = y(item.shipment);
										const barX = x(monthIndex) - barGroupWidth / 2 + seriesIndex * (barWidth + barGap);
										return <rect
											className="sip-shipment-bar"
											fill={`url(#sip-bar-pattern-${seriesIndex})`}
											height={margin.top + plotHeight - barY}
											key={item.month}
											rx="3"
											width={barWidth}
											x={barX}
											y={barY}
										>
											<title>{`${seriesLabel(product)} · ${monthLabel(item.month)}${item.forecast ? " · Forecast" : ""}\nSales: ${formatNumber(item.shipment)}\nSupply: ${formatNumber(item.production)}`}</title>
										</rect>;
									})}
									<polyline
										className="sip-production-line"
										points={product.data.map((item, monthIndex) => `${x(monthIndex)},${y(item.production)}`).join(" ")}
										strokeDasharray={dashPatterns[seriesIndex]}
										style={{ stroke: seriesColors[seriesIndex] }}
									/>
									{product.data.map((item, monthIndex) => {
										const pointX = x(monthIndex);
										const pointY = y(item.production);
										const title = `${seriesLabel(product)} · ${monthLabel(item.month)}${item.forecast ? " · Forecast" : ""}\nSupply: ${formatNumber(item.production)}\nSales: ${formatNumber(item.shipment)}`;
										const pointStyle = { stroke: seriesColors[seriesIndex] };
										if (markerShapes[seriesIndex] === "square") return <rect className="sip-production-point" height="8" key={item.month} style={pointStyle} width="8" x={pointX - 4} y={pointY - 4}><title>{title}</title></rect>;
										if (markerShapes[seriesIndex] === "diamond") return <rect className="sip-production-point" height="8" key={item.month} style={pointStyle} transform={`rotate(45 ${pointX} ${pointY})`} width="8" x={pointX - 4} y={pointY - 4}><title>{title}</title></rect>;
										if (markerShapes[seriesIndex] === "triangle") return <polygon className="sip-production-point" key={item.month} points={`${pointX},${pointY - 5} ${pointX + 5},${pointY + 5} ${pointX - 5},${pointY + 5}`} style={pointStyle}><title>{title}</title></polygon>;
										return <circle className="sip-production-point" cx={pointX} cy={pointY} key={item.month} r="4" style={pointStyle}><title>{title}</title></circle>;
									})}
								</g>;
							})}
						</svg>
					</div>
				)}
			</div>
		</section>
	);
}

export default function SalesInventory() {
	const [rows, setRows] = useState<PlanningRow[]>(() => clone(initialPlanningRows));
	const [months, setMonths] = useState(() => [...initialPlanningMonths]);
	const [history, setHistory] = useState<HistoryRow[]>(() => clone(initialHistoryRows));
	const [lastClosedMonth, setLastClosedMonth] = useState<string | null>(null);
	const [forecastSnapshots, setForecastSnapshots] = useState<ForecastSnapshot[]>([]);
	const [lastClosingBackup, setLastClosingBackup] = useState<ClosingBackup | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [modelFilter, setModelFilter] = useState<string[]>([]);
	const [categoryFilter, setCategoryFilter] = useState("all");
	const historyRange = useMemo(() => [...new Set(history.map((row) => row.month))].sort(), [history]);
	const [rangeFrom, setRangeFrom] = useState(initialPlanningMonths[0]);
	const [rangeTo, setRangeTo] = useState(initialPlanningMonths.at(-1) || initialPlanningMonths[0]);
	const [editing, setEditing] = useState(false);
	const [draftRows, setDraftRows] = useState<PlanningRow[]>([]);
	const [addOpen, setAddOpen] = useState(false);
	const [closingOpen, setClosingOpen] = useState(false);
	const [archiveOpen, setArchiveOpen] = useState(false);
	const [theme, setTheme] = useState<string | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as Partial<Workspace>;
				if (Array.isArray(parsed.rows) && Array.isArray(parsed.months) && Array.isArray(parsed.history)) {
					const firstMonth = parsed.months[0] || initialPlanningMonths[0];
					const normalizedMonths = [firstMonth];
					while (normalizedMonths.length < 4) normalizedMonths.push(nextMonth(normalizedMonths[normalizedMonths.length - 1]));
					setRows(parsed.rows.map((row) => {
						const mockRow = initialPlanningRows.find((item) => item.model === row.model);
						return {
							...row,
							months: Object.fromEntries(normalizedMonths.map((month) => [
								month,
								row.months?.[month] || mockRow?.months[month] || { forecast: 0, supply: 0 },
							])),
						};
						}));
						setMonths(normalizedMonths);
						setRangeFrom(normalizedMonths[0]);
						setRangeTo(normalizedMonths.at(-1) || normalizedMonths[0]);
						setHistory(parsed.history);
					setLastClosedMonth(parsed.lastClosedMonth || null);
					setForecastSnapshots(Array.isArray(parsed.forecastSnapshots) ? parsed.forecastSnapshots : []);
					setLastClosingBackup(parsed.lastClosingBackup || null);
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
		const workspace: Workspace = { rows, months, history, lastClosedMonth, forecastSnapshots, lastClosingBackup };
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
	}, [forecastSnapshots, history, lastClosedMonth, lastClosingBackup, loaded, months, rows]);

	const toggleTheme = () => {
		const next = theme === "dark" ? "light" : "dark";
		document.documentElement.setAttribute("data-theme", next);
		window.localStorage.setItem("pt-theme", next);
		setTheme(next);
	};

	const tableRows = editing ? draftRows : rows;
	const modelOptions = [...new Set(tableRows.map((row) => row.model))].sort();
	const categoryOptions = [...new Set(tableRows.map((row) => row.category))].sort();
	const visibleRows = tableRows.filter((row) =>
		(modelFilter.length === 0 || modelFilter.includes(row.model)) &&
		(categoryFilter === "all" || row.category === categoryFilter));
	const availableMonths = [...new Set([...historyRange, ...months])].sort();
	const visibleHistoryMonths = historyRange.filter((month) => month >= rangeFrom && month <= rangeTo);
	const visiblePlanningMonths = months.filter((month) => month >= rangeFrom && month <= rangeTo);
	const planningColumnCount = visiblePlanningMonths.length * 3;
	const tableWidth = (5 + visibleHistoryMonths.length * 3 + 3 + planningColumnCount + (visiblePlanningMonths.length ? 2 : 0)) * 100;

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
		setLastClosingBackup(clone({ rows, months, history, lastClosedMonth, forecastSnapshots, rangeFrom, rangeTo }));
		const savedAt = new Date().toISOString();
		const futureMonths = months.slice(1, 4);
		const snapshots = rows.flatMap((row) => {
			const endings = calculateEndings(row, months);
			return futureMonths.map((forecastMonth) => ({
				archiveMonth: closed,
				savedAt,
				model: row.model,
				product: row.product,
				category: row.category,
				forecastMonth,
				shipmentForecast: row.months[forecastMonth]?.forecast || 0,
				supplyPlan: row.months[forecastMonth]?.supply || 0,
				projectedOnHand: endings[forecastMonth] || 0,
			}));
		});
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
		const nextPlanningMonths = [...months.slice(1), added];
		setRows((current) => current.map((row) => {
			const result = newHistory.find((item) => item.model === row.model)!;
			const monthPlans = { ...row.months };
			delete monthPlans[closed];
			return { ...row, inventory: result.endingInventory, months: { ...monthPlans, [added]: { forecast: 0, supply: 0 } } };
		}));
		setHistory((current) => [...current, ...newHistory]);
		setForecastSnapshots((current) => [...current.filter((item) => item.archiveMonth !== closed), ...snapshots]);
		setMonths(nextPlanningMonths);
		setRangeFrom(nextPlanningMonths[0]);
		setRangeTo(nextPlanningMonths.at(-1) || nextPlanningMonths[0]);
		setLastClosedMonth(closed);
		setClosingOpen(false);
	};

	const undoMonthClosing = () => {
		if (!lastClosingBackup) return;
		if (!window.confirm(`Undo the most recent Month Closing and return to ${monthLabel(lastClosingBackup.months[0])}? Changes made after closing will be discarded.`)) return;
		setRows(clone(lastClosingBackup.rows));
		setMonths([...lastClosingBackup.months]);
		setHistory(clone(lastClosingBackup.history));
		setLastClosedMonth(lastClosingBackup.lastClosedMonth);
		setForecastSnapshots(clone(lastClosingBackup.forecastSnapshots));
		setLastClosingBackup(null);
		setModelFilter([]);
		setCategoryFilter("all");
		setRangeFrom(lastClosingBackup.rangeFrom || lastClosingBackup.months[0]);
		setRangeTo(lastClosingBackup.rangeTo || lastClosingBackup.months.at(-1) || lastClosingBackup.months[0]);
	};

	return (
		<div className="sip-app">
			<ModeHeader theme={theme} onToggleTheme={toggleTheme} />
			<main className="sip-main">
				<section className="sip-page-head">
					<div>
						<span>GTM OPERATIONS</span>
						<h1>Sales &amp; Inventory Planning</h1>
						<p>Plan the current month plus the next three months, with historical actuals available on demand.</p>
					</div>
					<div className="sip-state"><i />Mock data · Saved locally</div>
				</section>

				<SummaryCards rows={visibleRows} months={months} />

				<section className="sip-panel" id="planning">
					<header className="sip-section-head">
						<div><span>SALES &amp; INVENTORY</span><h2>Sales &amp; Inventory Overview</h2><p>Review historical actuals, future sales forecasts, supply plans, and projected inventory across the selected period.</p></div>
						<div className="sip-actions">
							{editing ? <>
								<button className="sip-btn" onClick={() => { setEditing(false); setError(""); }}>Cancel</button>
								<button className="sip-btn primary" onClick={saveRows}>Save Table</button>
							</> : <>
								<button className="sip-btn" onClick={beginEdit}>Edit Table</button>
								<button className="sip-btn" onClick={() => setAddOpen(true)}>＋ Add Product</button>
								<button className="sip-btn" onClick={() => setArchiveOpen(true)}>Forecast Archive</button>
								{lastClosingBackup && <button className="sip-btn warning" onClick={undoMonthClosing}>Undo Closing</button>}
								<button className="sip-btn primary" onClick={() => setClosingOpen(true)}>Month Closing</button>
							</>}
						</div>
					</header>
					<div className="sip-open-row"><span><i />{monthLabel(months[0])} · Open</span><span>{lastClosedMonth ? `${monthLabel(lastClosedMonth)} · Closed` : "Mock data"}</span></div>
					<div className="sip-filter-controls sip-planning-filters">
						<ModelMultiSelect onChange={setModelFilter} options={modelOptions} selected={modelFilter} />
						<label>Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All Categories</option>{categoryOptions.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
						<label>From<select value={rangeFrom} onChange={(event) => {
							const value = event.target.value;
							setRangeFrom(value);
							if (value > rangeTo) setRangeTo(value);
						}}>{availableMonths.filter((month) => month <= rangeTo).map((month) => <option value={month} key={month}>{monthLabel(month)}</option>)}</select></label>
						<label>To<select value={rangeTo} onChange={(event) => setRangeTo(event.target.value)}>{availableMonths.filter((month) => month >= rangeFrom).map((month) => <option value={month} key={month}>{monthLabel(month)}</option>)}</select></label>
					</div>
					{error && <p className="sip-error">{error}</p>}
					<div className="sip-table-scroll">
						<table className="sip-table planning" style={{ minWidth: `${tableWidth}px`, width: `${tableWidth}px` }}>
							<colgroup>
								<col className="sip-col-model" />
								<col className="sip-col-product" />
								<col className="sip-col-category" />
								<col className="sip-col-date" />
								<col className="sip-col-number" />
								{visibleHistoryMonths.flatMap((month) => [
									<col className="sip-col-number" key={`${month}-history-actual-col`} />,
									<col className="sip-col-number" key={`${month}-history-supply-col`} />,
									<col className="sip-col-number" key={`${month}-history-ending-col`} />,
								])}
								{["fcst", "mass", "gap"].map((name) => <col className="sip-col-number" key={`first-${name}-col`} />)}
								{visiblePlanningMonths.flatMap((month) => [
									<col className="sip-col-number" key={`${month}-forecast-col`} />,
									<col className="sip-col-number" key={`${month}-supply-col`} />,
									<col className="sip-col-number" key={`${month}-ending-col`} />,
								])}
								{visiblePlanningMonths.length > 0 && <>
									<col className="sip-col-number" />
									<col className="sip-col-number" />
								</>}
							</colgroup>
							<thead>
								<tr className="sip-month-row">
									<th className="sip-group-base" colSpan={5} />
									{visibleHistoryMonths.map((month) => <th className="sip-group-history" colSpan={3} key={`history-${month}`}>{monthLabel(month)}</th>)}
									<th className="sip-group-first" colSpan={3}>First Batch</th>
									{visiblePlanningMonths.map((month) => <th className={month === months[0] ? "sip-group-current" : "sip-group-month"} colSpan={3} key={month}>
										{month === months[0] && <span className="sip-current-tag">Current</span>}{monthLabel(month)}
									</th>)}
									{visiblePlanningMonths.length > 0 && <th className="sip-group-total" colSpan={2}>{visiblePlanningMonths.length}-Month Total</th>}
								</tr>
								<tr>
									{["Model", "Product Name", "Category", "Launch Date", "Current Inventory"].map((heading) => <th className="sip-group-base" key={heading}>{heading}</th>)}
									{visibleHistoryMonths.flatMap((month) => [
										<th className="sip-group-history" key={`${month}-actual`}>Actual Shipment</th>,
										<th className="sip-group-history" key={`${month}-history-supply`}>Supply Plan</th>,
										<th className="sip-group-history" key={`${month}-history-ending`}>Ending Inventory</th>,
									])}
									{["FCST 1st", "Mass 1st", "Gap"].map((heading) => <th className="sip-group-first" key={heading}>{heading}</th>)}
									{visiblePlanningMonths.flatMap((month) => [
										<th className={month === months[0] ? "sip-group-current" : "sip-group-month"} key={`${month}-f`}>Shipment Forecast</th>,
										<th className={month === months[0] ? "sip-group-current" : "sip-group-month"} key={`${month}-s`}>Supply Plan</th>,
										<th className={month === months[0] ? "sip-group-current" : "sip-group-month"} key={`${month}-e`}>Projected On Hand</th>,
									])}
									{visiblePlanningMonths.length > 0 && <>
									<th className="sip-group-total">Shipment Forecast</th>
										<th className="sip-group-total">Supply Plan</th>
									</>}
								</tr>
							</thead>
							<tbody>{visibleRows.map((row) => {
								const endings = calculateEndings(row, months);
								const gap = row.firstMass - row.firstForecast;
								const totalForecast = visiblePlanningMonths.reduce((sum, month) => sum + (row.months[month]?.forecast || 0), 0);
								const totalSupply = visiblePlanningMonths.reduce((sum, month) => sum + (row.months[month]?.supply || 0), 0);
								return <tr key={row.model}>
									{(["model", "product", "category", "launchDate"] as const).map((field) => <td key={field} className={`sip-group-base${field === "model" ? " model" : ""}`}>{editing ? <input className="sip-input" type={field === "launchDate" ? "date" : "text"} value={row[field]} onChange={(event) => updateRow(row.model, (current) => ({ ...current, [field]: event.target.value }))} /> : row[field]}</td>)}
									<td className="sip-group-base">{editing ? <NumberInput label={`${row.model} current inventory`} value={row.inventory} onChange={(value) => updateRow(row.model, (current) => ({ ...current, inventory: value }))} /> : formatNumber(row.inventory)}</td>
									{visibleHistoryMonths.flatMap((month) => {
										const record = history.find((item) => item.model === row.model && item.month === month);
										return [
											<td className="sip-group-history" key={`${month}-actual`}>{record ? formatNumber(record.actualSales) : "—"}</td>,
											<td className="sip-group-history" key={`${month}-history-supply`}>{record ? formatNumber(record.supplyPlan) : "—"}</td>,
											<td className="sip-group-history" key={`${month}-history-ending`}>{record ? formatNumber(record.endingInventory) : "—"}</td>,
										];
									})}
									{(["firstForecast", "firstMass"] as const).map((field) => <td className="sip-group-first" key={field}>{editing ? <NumberInput label={`${row.model} ${field}`} value={row[field]} onChange={(value) => updateRow(row.model, (current) => ({ ...current, [field]: value }))} /> : formatNumber(row[field])}</td>)}
									<td className={`sip-group-first sip-gap ${gap >= 0 ? "positive" : "negative"}`}>{gap > 0 ? "+" : ""}{formatNumber(gap)}</td>
									{visiblePlanningMonths.flatMap((month) => {
										const plan = row.months[month] || { forecast: 0, supply: 0 };
										const change = (field: "forecast" | "supply", value: number) => updateRow(row.model, (current) => ({ ...current, months: { ...current.months, [month]: { ...plan, [field]: value } } }));
										const groupClass = month === months[0] ? "sip-group-current" : "sip-group-month";
										return [
											<td className={groupClass} key={`${month}-f`}>{editing ? <NumberInput label={`${row.model} ${month} forecast`} value={plan.forecast} onChange={(value) => change("forecast", value)} /> : formatNumber(plan.forecast)}</td>,
											<td className={groupClass} key={`${month}-s`}>{editing ? <NumberInput label={`${row.model} ${month} supply`} value={plan.supply} onChange={(value) => change("supply", value)} /> : formatNumber(plan.supply)}</td>,
											<td className={`${groupClass} sip-projected ${stockTone(endings[month])}`} key={`${month}-e`}><span>{formatNumber(endings[month])}</span></td>,
										];
									})}
									{visiblePlanningMonths.length > 0 && <>
										<td className="sip-group-total sip-total-value">{formatNumber(totalForecast)}</td>
										<td className="sip-group-total sip-total-value">{formatNumber(totalSupply)}</td>
									</>}
								</tr>;
							})}</tbody>
						</table>
					</div>
					<footer className="sip-table-foot"><span>{visibleRows.length} products</span><span>{monthLabel(rangeFrom)} – {monthLabel(rangeTo)} · Mock Data + localStorage</span></footer>
					<InventoryTrend
						availableMonths={availableMonths}
						history={history}
						months={months}
						rows={tableRows}
						tableCategory={categoryFilter}
						tableFrom={rangeFrom}
						tableModels={modelFilter}
						tableTo={rangeTo}
					/>
				</section>
			</main>
			{addOpen && <AddProductModal months={months} rows={rows} onClose={() => setAddOpen(false)} onAdd={(row) => { setRows((current) => [...current, row]); setAddOpen(false); }} />}
			{closingOpen && <ClosingModal rows={rows} month={months[0]} onClose={() => setClosingOpen(false)} onConfirm={closeMonth} />}
			{archiveOpen && <ForecastArchiveModal snapshots={forecastSnapshots} onClose={() => setArchiveOpen(false)} />}
		</div>
	);
}
