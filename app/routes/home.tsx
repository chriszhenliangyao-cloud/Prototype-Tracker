import { Link, useFetcher, useNavigate, useRevalidator } from "react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Route } from "./+types/home";
import {
	getUser,
	getProtos,
	getRecentLogs,
	listOwners,
	addProto,
	dispatch,
	updateStatus,
	returnToStock,
	confirmReceive,
	todayStr,
	type LogRow,
	type Proto,
} from "../lib/protrack";

export function meta() {
	return [{ title: "ProtoTrack · Europe Prototype Tracker" }];
}

const COUNTRIES = ["Germany", "France", "UK", "Netherlands", "Italy", "Spain", "Poland", "Belgium", "Denmark", "Sweden"];
const SAMPLE_TYPES = ["Dummy", "Engineering Sample", "Preproduction Sample", "Mass Production"];
const ALL_STATUSES = ["In Stock", "In Transit", "On Loan", "Returned", "Gifted", "Lost"];

const FL: Record<string, string> = {
	Germany: "🇩🇪", France: "🇫🇷", UK: "🇬🇧", Italy: "🇮🇹", Spain: "🇪🇸",
	Denmark: "🇩🇰", Netherlands: "🇳🇱", Belgium: "🇧🇪", Poland: "🇵🇱", Sweden: "🇸🇪",
};

// status → badge class (task palette: stock=green, loan=amber, transit=violet, returned=blue, gifted=red, lost=gray)
const SC: Record<string, string> = {
	"In Stock": "bgr", "On Loan": "bam", "In Transit": "bit", Returned: "bbl", Gifted: "bre", Lost: "bgy",
};
// status → CSS colour var (for charts / KPI)
const SCOL: Record<string, string> = {
	"In Stock": "var(--green)", "On Loan": "var(--amber)", "In Transit": "var(--violet)",
	Returned: "var(--blue)", Gifted: "var(--red)", Lost: "var(--gray)",
};
const TYPE_COL: Record<string, string> = {
	Dummy: "var(--gray)", "Engineering Sample": "var(--blue)",
	"Preproduction Sample": "var(--amber)", "Mass Production": "var(--green)",
};

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const me = await getUser(request, env);
	if (me.role === "denied") {
		return { me, protos: [] as Proto[], owners: [] as string[], logs: [] as LogRow[] };
	}
	const [protos, owners, logs] = await Promise.all([
		getProtos(env, me),
		listOwners(env),
		getRecentLogs(env, me, 300),
	]);
	return { me, protos, owners, logs };
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const me = await getUser(request, env);
	if (me.role === "denied") return { ok: false, error: "无权限 / Access denied" };
	const f = await request.formData();
	const intent = String(f.get("intent") || "");
	try {
		if (intent === "add") {
			const model = String(f.get("model") || "").trim();
			// SN auto-generated from model + timestamp (matches original SPA behaviour)
			const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
			const sn = (String(f.get("sn") || "").trim() ||
				`${(model || "PROTO").replace(/\s+/g, "-").toUpperCase()}-${stamp}`).slice(0, 50);
			await addProto(
				env,
				{
					sn,
					model,
					pname: String(f.get("pname") || ""),
					sample_type: String(f.get("sample_type") || ""),
					owner: String(f.get("owner") || me.name),
					country: String(f.get("country") || ""),
					qty: Number(f.get("qty") || 1),
					tracking_no: String(f.get("tracking_no") || ""),
					ship_date: String(f.get("ship_date") || ""),
					customer: String(f.get("customer") || ""),
					co: String(f.get("co") || ""),
					notes: String(f.get("notes") || ""),
				},
				me.name,
			);
		} else if (intent === "dispatch") {
			await dispatch(env, Number(f.get("id")), Number(f.get("qty")), String(f.get("channel") || ""), String(f.get("date") || ""), me);
		} else if (intent === "status") {
			await updateStatus(env, Number(f.get("id")), String(f.get("status")), me, String(f.get("note") || ""));
		} else if (intent === "return") {
			await returnToStock(env, Number(f.get("id")), me);
		} else if (intent === "confirm") {
			await confirmReceive(env, Number(f.get("id")), me);
		}
		return { ok: true, intent };
	} catch (e: any) {
		return { ok: false, error: e.message || String(e) };
	}
}

function fmtDate(v?: string | null) {
	if (!v) return "";
	const s = String(v);
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	return s;
}
function daysSince(v?: string | null) {
	if (!v) return 0;
	const d = new Date(v).getTime();
	if (isNaN(d)) return 0;
	return Math.max(0, Math.floor((Date.now() - d) / 86400000));
}
function StatusBadge({ s }: { s: string }) {
	return <span className={`badge ${SC[s] || "bgy"}`}>{s || "—"}</span>;
}
function TypeBadge({ t }: { t?: string | null }) {
	if (!t) return <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>;
	const cls = { Dummy: "st-dummy", "Engineering Sample": "st-es", "Preproduction Sample": "st-pps", "Mass Production": "st-mp" }[t] || "st-dummy";
	return <span className={`stbadge ${cls}`} title={t}>{t}</span>;
}
function logMeta(action: string): { icon: string; bg: string } {
	const a = action.toLowerCase();
	if (a.includes("dispatch")) return { icon: "📤", bg: "var(--blue-bg)" };
	if (a.includes("receiv")) return { icon: "📦", bg: "var(--violet-bg)" };
	if (a.includes("return")) return { icon: "📥", bg: "var(--green-bg)" };
	if (a.includes("ship")) return { icon: "✈️", bg: "var(--violet-bg)" };
	if (a.includes("stock entry")) return { icon: "📦", bg: "var(--gray-bg)" };
	if (a.includes("status")) return { icon: "✏️", bg: "var(--amber-bg)" };
	return { icon: "📋", bg: "var(--bg3)" };
}

// ── SVG donut ─────────────────────────────────────────────────
function Donut({ segments }: { segments: { label: string; val: number; color: string }[] }) {
	const total = segments.reduce((a, s) => a + s.val, 0);
	const active = segments.filter((s) => s.val > 0);
	const r = 54, C = 2 * Math.PI * r, cx = 70, cy = 70, sw = 22;
	let offset = 0;
	return (
		<div className="donut-wrap">
			<svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
				<circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg3)" strokeWidth={sw} />
				{total > 0 && active.map((s) => {
					const dash = (s.val / total) * C;
					const el = (
						<circle key={s.label} cx={cx} cy={cy} r={r} fill="none" style={{ stroke: s.color }}
							strokeWidth={sw} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
							transform={`rotate(-90 ${cx} ${cy})`} />
					);
					offset += dash;
					return el;
				})}
				<text x={cx} y={cy - 1} textAnchor="middle" style={{ fill: "var(--text)", fontSize: 20, fontWeight: 600 }}>{total}</text>
				<text x={cx} y={cy + 16} textAnchor="middle" style={{ fill: "var(--text3)", fontSize: 11 }}>units</text>
			</svg>
			<div className="legend">
				{active.length ? active.map((s) => (
					<div className="leg-row" key={s.label}>
						<span className="leg-dot" style={{ background: s.color }} />
						<span className="leg-lbl">{s.label}</span>
						<span className="leg-val">{s.val}</span>
						<span className="leg-pct">{Math.round((s.val / total) * 100)}%</span>
					</div>
				)) : <div style={{ fontSize: 12, color: "var(--text3)" }}>No data</div>}
			</div>
		</div>
	);
}
function BarList({ rows, color, flag }: { rows: [string, number][]; color: string; flag?: boolean }) {
	if (!rows.length) return <div style={{ color: "var(--text3)", fontSize: 13, padding: "8px 0" }}>No prototypes on loan</div>;
	const max = Math.max(...rows.map((r) => r[1]), 1);
	return (
		<>
			{rows.map(([label, n]) => (
				<div className="brow" key={label}>
					<span className="blbl">{flag ? (FL[label] || "") + " " : ""}{label}</span>
					<div className="btrack"><div className="bfill" style={{ width: `${Math.round((n / max) * 100)}%`, background: color }} /></div>
					<span className="bcnt">{n}</span>
				</div>
			))}
		</>
	);
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { me, protos, owners, logs } = loaderData;
	const navigate = useNavigate();
	const revalidator = useRevalidator();
	const fx = useFetcher<{ ok: boolean; error?: string; intent?: string }>();

	const isAdmin = me.role === "admin";
	const salesNames = owners.filter((o) => o !== me.realName);

	// ── client state ──
	const [mode, setMode] = useState<"ct" | "fv">(isAdmin && !me.impersonating ? "ct" : "fv");
	const [ctView, setCtView] = useState<"dashboard" | "analytics" | "log">("dashboard");
	const [ctFilter, setCtFilter] = useState("all");
	const [q, setQ] = useState("");
	const [showAdd, setShowAdd] = useState(false);
	const [direct, setDirect] = useState(false);
	const [modalId, setModalId] = useState<number | null>(null);
	const [dispatchOpen, setDispatchOpen] = useState(false);
	const [fvOwner, setFvOwner] = useState<string>(
		me.impersonating || !isAdmin ? me.name : (owners.includes(me.name) ? me.name : owners[0] || me.name),
	);
	const [toast, setToast] = useState("");
	const [theme, setTheme] = useState<string | null>(null);
	const lastIntent = useRef("");

	// theme label (client-only to avoid hydration mismatch)
	useEffect(() => {
		const attr = document.documentElement.getAttribute("data-theme");
		const eff = attr || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
		setTheme(eff);
	}, []);
	function toggleTheme() {
		const next = theme === "dark" ? "light" : "dark";
		document.documentElement.setAttribute("data-theme", next);
		try { localStorage.setItem("pt-theme", next); } catch { /* ignore */ }
		setTheme(next);
	}

	// react to fetcher completion: close panels, toast
	useEffect(() => {
		if (fx.state === "idle" && fx.data) {
			if (fx.data.ok) {
				setModalId(null);
				setDispatchOpen(false);
				setShowAdd(false);
				setDirect(false);
				setToast(successMsg(lastIntent.current));
			} else {
				setToast("⚠ " + (fx.data.error || "Operation failed"));
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fx.state, fx.data]);
	useEffect(() => {
		if (!toast) return;
		const t = setTimeout(() => setToast(""), 3200);
		return () => clearTimeout(t);
	}, [toast]);

	function submit(form: Record<string, string | number>) {
		lastIntent.current = String(form.intent || "");
		const fd = new FormData();
		Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
		fx.submit(fd, { method: "post" });
	}

	// ── derived: logs by SN (ascending → last is current) ──
	const logsBySn = useMemo(() => {
		const m: Record<string, LogRow[]> = {};
		for (const l of logs) (m[l.sn] ||= []).push(l);
		for (const k in m) m[k].sort((a, b) => a.id - b.id);
		return m;
	}, [logs]);

	if (me.role === "denied") {
		return (
			<div className="pt-root" style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
				<div style={{ maxWidth: 380, textAlign: "center" }}>
					<div style={{ fontSize: 46 }}>🔒</div>
					<h1 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 6px" }}>Access Denied</h1>
					<p style={{ fontSize: 13, color: "var(--text2)" }}>
						你的账号 <b>{me.email}</b> 不在授权名单中。请联系管理员，或确认已通过 Cloudflare Access 用公司邮箱登录。
					</p>
				</div>
			</div>
		);
	}

	// ── KPI ──
	const sum = (list: Proto[]) => list.reduce((a, p) => a + (p.qty || 0), 0);
	const totalUnits = sum(protos);
	const kpi = (st: string) => sum(protos.filter((p) => p.status === st));
	const kpis = [
		{ label: "Total Units", val: totalUnits, cls: "b", pct: 100 },
		{ label: "On Loan", val: kpi("On Loan"), cls: "a", pct: totalUnits ? Math.round((kpi("On Loan") / totalUnits) * 100) : 0 },
		{ label: "In Stock", val: kpi("In Stock"), cls: "g", pct: totalUnits ? Math.round((kpi("In Stock") / totalUnits) * 100) : 0 },
		{ label: "In Transit", val: kpi("In Transit"), cls: "pu", pct: totalUnits ? Math.round((kpi("In Transit") / totalUnits) * 100) : 0 },
		{ label: "Gifted", val: kpi("Gifted"), cls: "r", pct: totalUnits ? Math.round((kpi("Gifted") / totalUnits) * 100) : 0 },
	];

	// ── filtered register ──
	const filtered = protos.filter((p) => {
		const mf = ctFilter === "all" ? true : ctFilter === "__loan__" ? p.status === "On Loan" : p.status === ctFilter;
		const mq = !q || [p.sn, p.owner, p.customer, p.model, p.pname, p.country].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()));
		return mf && mq;
	});

	// ── analytics ──
	const statusSeg = ALL_STATUSES.map((s) => ({ label: s, val: kpi(s), color: SCOL[s] }));
	const typeSeg = SAMPLE_TYPES.map((t) => ({ label: t.replace("Engineering Sample", "ES").replace("Preproduction Sample", "PPS").replace("Mass Production", "MP"), val: sum(protos.filter((p) => p.sample_type === t)), color: TYPE_COL[t] }));
	const onLoan = protos.filter((p) => p.status === "On Loan");
	const byCountry = Object.entries(onLoan.reduce<Record<string, number>>((m, p) => { const k = p.country || "—"; m[k] = (m[k] || 0) + p.qty; return m; }, {})).sort((a, b) => b[1] - a[1]) as [string, number][];
	const byRep = Object.entries(onLoan.reduce<Record<string, number>>((m, p) => { const k = p.owner || "—"; m[k] = (m[k] || 0) + p.qty; return m; }, {})).sort((a, b) => b[1] - a[1]) as [string, number][];

	// ── activity log list ──
	const logList = [...logs].sort((a, b) => b.id - a.id);

	// ── field view scope ──
	const fvProtos = protos.filter((p) => p.owner === fvOwner);
	const fvStock = sum(fvProtos.filter((p) => p.status === "In Stock"));
	const fvLoan = sum(fvProtos.filter((p) => p.status === "On Loan"));
	const fvTransit = sum(fvProtos.filter((p) => p.status === "In Transit"));
	const fvActive = fvProtos.filter((p) => p.status !== "In Transit");
	const fvIncoming = fvProtos.filter((p) => p.status === "In Transit" && p.received !== "yes");

	const modalProto = modalId != null ? protos.find((p) => p.id === modalId) || null : null;

	function successMsg(intent: string) {
		switch (intent) {
			case "add": return "✓ Prototype registered";
			case "dispatch": return "✓ Dispatched";
			case "status": return "✓ Status updated";
			case "return": return "✓ Returned to stock";
			case "confirm": return "✓ Received — moved to stock";
			default: return "✓ Done";
		}
	}

	function exportCSV() {
		const cols = ["Model", "Product Name", "Sample Type", "Sales Rep", "Channel", "Country", "Qty", "Tracking No", "Ship Date", "Dispatch Date", "Return Date", "Status", "Notes"];
		const rows = filtered.map((r) => [r.model, r.pname, r.sample_type, r.owner, r.customer, r.country, r.qty, r.tracking_no, r.ship_date, r.co, r.ret, r.status, r.notes]
			.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
		const csv = "﻿" + [cols.join(","), ...rows].join("\n");
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url; a.download = `ProtoTrack_EU_${todayStr()}.csv`; a.click();
		URL.revokeObjectURL(url);
	}

	const ctTitles: Record<string, [string, string]> = {
		dashboard: ["Dashboard", "Europe prototype tracking"],
		analytics: ["Analytics", "Asset distribution analysis"],
		log: ["Activity Log", "Full activity history"],
	};

	return (
		<div className="pt-root">
			{/* ── MODE BAR ── */}
			<div className="mode-bar">
				<div className="brand">
					<div className="brand-icon">📦</div>
					<span className="brand-name">ProtoTrack</span>
					<span className="brand-sep">·</span>
					<span className="brand-sub">Europe Prototype Tracker</span>
				</div>
				<div className="mode-toggle">
					{isAdmin && !me.impersonating && (
						<button className={`mbtn${mode === "ct" ? " ct-on" : ""}`} onClick={() => setMode("ct")}>🛰️ Control Tower</button>
					)}
					<button className={`mbtn${mode === "fv" ? " fv-on" : ""}`} onClick={() => setMode("fv")}>🧳 Field View</button>
					<Link className="mbtn" to="/project-progress">📈 Project Progress</Link>
				</div>
				<div className="mode-right">
					<button className="theme-btn" title="Toggle light / dark" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
					<span className="live-lbl"><span className="sync-dot" />Live sync</span>
				</div>
			</div>

			{/* ══ CONTROL TOWER ══ */}
			{mode === "ct" && isAdmin && !me.impersonating && (
				<div className="shell">
					<nav className="sidebar">
						<div className="sb-logo">
							<div className="sb-tag ct">🛰️ Control Tower</div>
							<div className="sb-title">Admin Dashboard</div>
							<div className="sb-sub">Full visibility · Global view</div>
						</div>
						<div className="nav">
							<div className="nav-sec">
								<div className="nav-lbl">Overview</div>
								<button className={`ni${ctView === "dashboard" ? " on" : ""}`} onClick={() => setCtView("dashboard")}><span className="ni-icon">⬛</span>Dashboard</button>
								<button className={`ni${ctView === "analytics" ? " on" : ""}`} onClick={() => setCtView("analytics")}><span className="ni-icon">◎</span>Analytics</button>
							</div>
							<div className="nav-sec">
								<div className="nav-lbl">Quick Filters</div>
								<button className="ni" onClick={() => { setCtView("dashboard"); setCtFilter("On Loan"); }}><span className="ni-icon">↗</span>On Loan<span className="nbadge">{protos.filter((p) => p.status === "On Loan").length}</span></button>
								<button className="ni" onClick={() => { setCtView("dashboard"); setCtFilter("In Stock"); }}><span className="ni-icon">📦</span>In Stock<span className="nbadge gr">{protos.filter((p) => p.status === "In Stock").length}</span></button>
								<button className="ni" onClick={() => { setCtView("dashboard"); setCtFilter("In Transit"); }}><span className="ni-icon">✈</span>In Transit<span className="nbadge pu">{protos.filter((p) => p.status === "In Transit").length}</span></button>
							</div>
							<div className="nav-sec">
								<div className="nav-lbl">Logs</div>
								<button className={`ni${ctView === "log" ? " on" : ""}`} onClick={() => setCtView("log")}><span className="ni-icon">≡</span>Activity Log</button>
							</div>
						</div>
						<div className="sb-foot"><span className="sync-dot" />{protos.length} records</div>
					</nav>

					<div className="main">
						<div className="topbar">
							<div><div className="tb-title">{ctTitles[ctView][0]}</div><div className="tb-sub">{ctTitles[ctView][1]}</div></div>
							<div className="sp" />
							<button className="btn btn-p" onClick={() => setShowAdd((v) => !v)}>＋ Add Prototype</button>
							<button className="btn" onClick={() => revalidator.revalidate()} disabled={revalidator.state !== "idle"}>↻ Refresh</button>
							<button className="btn" onClick={exportCSV}>⬇ Export CSV</button>
						</div>

						{!me.viaAccess && (
							<div className="banner banner-warn">⚠️ 未启用登录鉴权（Cloudflare Access 未生效）—— 当前以 <b>&nbsp;{me.name}&nbsp;</b> 管理员身份访问。上线前请先配置 Access。</div>
						)}

						{/* DASHBOARD */}
						{ctView === "dashboard" && (
							<div className="content">
								<div className="kpi-row">
									{kpis.map((k) => (
										<div className="kpi" key={k.label}>
											<div className="kpi-l">{k.label}</div>
											<div className={`kpi-v ${k.cls}`}>{k.val}</div>
											<div className={`kpi-bar ${k.cls}`} style={{ width: `${k.pct}%` }} />
										</div>
									))}
								</div>

								{showAdd && (
									<div className="fp">
										<div className="fp-title">Add New Prototype</div>
										<fx.Form method="post" onSubmit={() => { lastIntent.current = "add"; }}>
											<input type="hidden" name="intent" value="add" />
											<div className="fg">
												<div><label className="fl">Model</label><input className="fi" name="model" required placeholder="e.g. Pro X1" /></div>
												<div><label className="fl">Product Name</label><input className="fi" name="pname" placeholder="e.g. Smart Sensor" /></div>
												<div><label className="fl">Sample Type</label><select className="fi" name="sample_type" defaultValue=""><option value="">-- Select --</option>{SAMPLE_TYPES.map((s) => <option key={s}>{s}</option>)}</select></div>
												<div><label className="fl">Sales Rep</label><select className="fi" name="owner" required defaultValue={isAdmin ? "" : me.name}><option value="">-- Select --</option>{owners.map((o) => <option key={o}>{o}</option>)}</select></div>
												<div><label className="fl">Country</label><select className="fi" name="country" defaultValue="Germany">{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
												<div><label className="fl">Qty</label><input className="fi" name="qty" type="number" min={1} defaultValue={1} /></div>
												<div><label className="fl">Tracking No (optional)</label><input className="fi" name="tracking_no" placeholder="e.g. 1Z999AA1…" /></div>
												<div><label className="fl">Ship Date</label><input className="fi" name="ship_date" type="date" /></div>
											</div>
											<div style={{ marginBottom: 14 }}><label className="fl">Notes / Purpose</label><textarea className="fi" name="notes" placeholder="Purpose, location, requirements…" /></div>
											<div className="direct-box">
												<label className="direct-lbl">
													<input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} style={{ width: 14, height: 14 }} />
													<span>🚀 Ship directly to channel (skip rep's stock)</span>
												</label>
												{direct && (
													<div className="fg fg2" style={{ marginTop: 10, marginBottom: 0 }}>
														<div><label className="fl">Channel / Customer</label><input className="fi" name="customer" required={direct} placeholder="e.g. Orange, Linku" /></div>
														<div><label className="fl">Dispatch Date</label><input className="fi" name="co" type="date" required={direct} defaultValue={todayStr()} /></div>
													</div>
												)}
											</div>
											<div style={{ display: "flex", gap: 8 }}>
												<button className="btn btn-p" type="submit" disabled={fx.state !== "idle"}>Confirm</button>
												<button className="btn" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
											</div>
										</fx.Form>
									</div>
								)}

								<div className="sec">
									<div className="sec-head">
										<span className="sec-title">Prototype Register</span>
										<div className="filters">
											{["all", "In Stock", "On Loan", "In Transit", "Returned", "Gifted", "Lost"].map((s) => (
												<button key={s} className={`pill${ctFilter === s ? " on" : ""}`} onClick={() => setCtFilter(s)}>{s === "all" ? "All" : s}</button>
											))}
										</div>
										<div className="sp" />
										<div className="srch"><span className="srch-ico">🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" /></div>
									</div>
									<div className="tw">
										<table>
											<thead><tr>
												<th>Model</th><th>Product Name</th><th>Sample Type</th><th>Sales Rep</th><th>Channel</th><th>Country</th><th className="c">Qty</th><th>Tracking No</th><th>Ship Date</th><th>Dispatch Date</th><th>Status</th><th></th>
											</tr></thead>
											<tbody>
												{filtered.map((p) => (
													<tr key={p.id} className="clickable" onClick={() => { setDispatchOpen(false); setModalId(p.id); }}>
														<td className="bold">{p.model || p.sn}</td>
														<td style={{ fontSize: 12, color: "var(--text2)" }}>{p.pname || "—"}</td>
														<td><TypeBadge t={p.sample_type} /></td>
														<td>{p.owner}</td>
														<td>{p.customer || "—"}</td>
														<td style={{ fontSize: 12, color: "var(--text2)" }}>{FL[p.country || ""] || ""} {p.country}</td>
														<td className="c" style={{ fontWeight: 500 }}>{p.qty}</td>
														<td className="mono" style={{ fontSize: 11, color: "var(--text3)" }}>{p.tracking_no || "—"}</td>
														<td style={{ fontSize: 12, color: "var(--text3)" }}>{fmtDate(p.ship_date) || "—"}</td>
														<td style={{ fontSize: 12, color: "var(--text3)" }}>{p.status === "In Stock" || p.status === "In Transit" ? "—" : fmtDate(p.co) || "—"}</td>
														<td><StatusBadge s={p.status} /></td>
														<td><button className="btn btn-s ra" onClick={(e) => { e.stopPropagation(); setDispatchOpen(false); setModalId(p.id); }}>Details →</button></td>
													</tr>
												))}
											</tbody>
										</table>
										{filtered.length === 0 && <div className="empty">🔍 No matching records</div>}
									</div>
								</div>
							</div>
						)}

						{/* ANALYTICS */}
						{ctView === "analytics" && (
							<div className="content">
								<div className="agrid">
									<div className="acard"><div className="atitle">By Status (units)</div><Donut segments={statusSeg} /></div>
									<div className="acard"><div className="atitle">By Sample Type (units)</div><Donut segments={typeSeg} /></div>
								</div>
								<div className="agrid">
									<div className="acard"><div className="atitle">By Country (on loan)</div><BarList rows={byCountry} color="var(--accent)" flag /></div>
									<div className="acard"><div className="atitle">By Sales Rep (on loan)</div><BarList rows={byRep} color="var(--violet)" /></div>
								</div>
							</div>
						)}

						{/* LOG */}
						{ctView === "log" && (
							<div className="content">
								<div className="sec">
									<div className="sec-head"><span className="sec-title">Activity Log</span><span style={{ fontSize: 12, color: "var(--text3)" }}>{logList.length} events</span></div>
									{logList.length ? logList.map((l) => {
										const m = logMeta(l.action);
										return (
											<div className="litem" key={l.id}>
												<div className="lico" style={{ background: m.bg }}>{m.icon}</div>
												<div className="linf">
													<div className="lmain"><strong>{l.action}</strong> · <span className="mono" style={{ fontSize: 11, color: "var(--text3)" }}>{l.sn}</span></div>
													<div className="lmeta">By: {l.actor}{l.note ? " · " + l.note : ""}</div>
												</div>
												<div className="ldate">{fmtDate(l.ts)}</div>
											</div>
										);
									}) : <div className="empty">No activity yet</div>}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ══ FIELD VIEW ══ */}
			{mode === "fv" && (
				<div className="shell">
					<nav className="sidebar fv-sb">
						<div className="fv-sb-logo">
							<div className="fv-me-tag">🧳 Field View · {isAdmin && !me.impersonating ? "Admin preview" : "Sales"}</div>
							<div className="fv-oname">{fvOwner}</div>
							<div className="fv-osub">Europe Sales Rep</div>
							{isAdmin && !me.impersonating && (
								<div className="fv-osel">
									<select value={fvOwner} onChange={(e) => setFvOwner(e.target.value)}>
										{owners.map((o) => <option key={o} value={o}>{o}</option>)}
									</select>
								</div>
							)}
						</div>
						<div className="nav">
							<div className="nav-sec">
								<div className="nav-lbl">My Prototypes</div>
								<div className="ni fv-ni on"><span className="ni-icon">📋</span>Active &amp; Stock</div>
								<div className="ni fv-ni"><span className="ni-icon">✈</span>Incoming<span className="nbadge pu">{fvIncoming.length}</span></div>
							</div>
						</div>
						<div className="sb-foot"><span className="sync-dot" />Live sync</div>
					</nav>

					<div className="main">
						<div className="topbar">
							<div><div className="fv-hello">👋 Hi, {fvOwner.split(" ")[0]}</div><div className="fv-hsub">Your prototypes — click a card to update status</div></div>
							<div className="sp" />
							<button className="btn" onClick={() => revalidator.revalidate()} disabled={revalidator.state !== "idle"}>↻ Refresh</button>
						</div>

						{me.impersonating && (
							<div className="banner banner-info">
								<span>👁 正在以 <b>&nbsp;{me.name}&nbsp;</b>（销售）的视角预览 —— 只显示 TA 名下的样机。</span>
								<Link to="/" className="btn btn-s btn-p" style={{ textDecoration: "none" }}>返回管理员</Link>
							</div>
						)}
						{!me.viaAccess && !me.impersonating && (
							<div className="banner banner-warn">⚠️ 未启用登录鉴权（Cloudflare Access 未生效）—— 当前以 <b>&nbsp;{me.name}&nbsp;</b> 身份访问。</div>
						)}

						<div className="content">
							<div className="fvkrow">
								<div className="fvk"><div className="fvkl">In Stock</div><div className="fvkv g">{fvStock}</div></div>
								<div className="fvk"><div className="fvkl">On Loan</div><div className="fvkv a">{fvLoan}</div></div>
								<div className="fvk"><div className="fvkl">In Transit</div><div className="fvkv pu">{fvTransit}</div></div>
							</div>

							{/* Incoming / pending receipt */}
							{fvIncoming.length > 0 && (
								<div style={{ marginBottom: 22 }}>
									<div className="atitle" style={{ marginBottom: 10 }}>✈️ Incoming / pending receipt</div>
									<div className="cgrid">
										{fvIncoming.map((p) => {
											const days = daysSince(p.ship_date);
											return (
												<div className="incoming-card" key={p.id}>
													<div className="ic-header">
														<span style={{ fontSize: 16 }}>✈</span>
														<div>
															<div className="ic-tracking">{p.tracking_no || "No tracking"}</div>
															<div className="ic-date">Shipped: {fmtDate(p.ship_date) || "—"} · <span className={days >= 7 ? "days-badge warn" : "days-badge"}>{days} day(s)</span></div>
														</div>
													</div>
													<div className="ic-items"><div className="ic-item"><span>{p.model}{p.pname ? " — " + p.pname : ""}</span><span style={{ fontWeight: 500 }}>{p.qty} unit(s)</span></div></div>
													<button className="btn btn-receive" style={{ width: "100%", justifyContent: "center" }} onClick={() => submit({ intent: "confirm", id: p.id })} disabled={fx.state !== "idle"}>📦 Confirm Received</button>
												</div>
											);
										})}
									</div>
								</div>
							)}

							{/* product cards */}
							<div className="atitle" style={{ marginBottom: 10 }}>📋 My Prototypes</div>
							{fvActive.length ? (
								<div className="cgrid">
									{fvActive.map((p) => (
										<div className="pcard" key={p.id} onClick={() => { setDispatchOpen(false); setModalId(p.id); }}>
											<div className="ctop">
												<div className="csn">{p.sn}</div>
												<div className="cmod">{p.model || "—"}</div>
												<div className="ccust">{p.pname || "—"}</div>
											</div>
											<div className="cbody">
												<div className="crow2"><span className="ck">Channel</span><span className="cv">{p.customer || "—"}</span></div>
												<div className="crow2"><span className="ck">Country</span><span className="cv">{FL[p.country || ""] || ""} {p.country || "—"}</span></div>
												<div className="crow2"><span className="ck">Qty</span><span className="cv">{p.qty}</span></div>
											</div>
											<div className="cfoot">
												<StatusBadge s={p.status} />
												<button className="btn btn-s" onClick={(e) => { e.stopPropagation(); setDispatchOpen(false); setModalId(p.id); }}>Manage →</button>
											</div>
										</div>
									))}
								</div>
							) : <div className="sec"><div className="empty">✅ No prototypes for {fvOwner}</div></div>}
						</div>
					</div>
				</div>
			)}

			{/* ══ DETAIL MODAL ══ */}
			{modalProto && (
				<Modal
					p={modalProto}
					logs={logsBySn[modalProto.sn] || []}
					mode={mode}
					busy={fx.state !== "idle"}
					dispatchOpen={dispatchOpen}
					onDispatchToggle={() => setDispatchOpen((v) => !v)}
					onClose={() => { setModalId(null); setDispatchOpen(false); }}
					onSubmit={submit}
				/>
			)}

			{toast && <div className="toast">{toast}</div>}
		</div>
	);
}

// ── DETAIL MODAL ──────────────────────────────────────────────
function Modal({ p, logs, mode, busy, dispatchOpen, onDispatchToggle, onClose, onSubmit }: {
	p: Proto; logs: LogRow[]; mode: "ct" | "fv"; busy: boolean; dispatchOpen: boolean;
	onDispatchToggle: () => void; onClose: () => void; onSubmit: (f: Record<string, string | number>) => void;
}) {
	const [dqty, setDqty] = useState(1);
	const [dch, setDch] = useState("");
	const [ddate, setDdate] = useState(todayStr());
	const canDispatch = (p.status === "In Stock" || p.status === "On Loan") && p.qty > 0;
	const statusOptions = ALL_STATUSES.filter((s) => s !== p.status);

	return (
		<div className="moverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
			<div className="modal">
				<div className="mtop">
					<div>
						<div className="mtitle">{p.sn} · {p.model}</div>
						<div className="msub">{FL[p.country || ""] || ""} {p.customer || ""} <StatusBadge s={p.status} /></div>
					</div>
					<button className="mcls" onClick={onClose}>×</button>
				</div>

				<div className="mbody">
					{([
						["Sales Rep", p.owner || "—"],
						["Product Name", p.pname || "—"],
						["Sample Type", <TypeBadge t={p.sample_type} key="t" />],
						["Channel", p.customer || "—"],
						["Country", `${FL[p.country || ""] || ""} ${p.country || "—"}`],
						["Qty", `${p.qty} unit(s)`],
						["Tracking No", p.tracking_no || "—"],
						["Ship Date", fmtDate(p.ship_date) || "—"],
						["Dispatch Date", fmtDate(p.co) || "—"],
						["Return Date", fmtDate(p.ret) || "—"],
						["Notes", p.notes || "—"],
					] as [string, ReactNode][]).map(([k, v]) => (
						<div className="mrow" key={k}><span className="mk">{k}</span><span className="mv">{v}</span></div>
					))}
				</div>

				<div className="tl">
					<div className="tll">Activity Log</div>
					{logs.length ? logs.map((h, i) => {
						const last = i === logs.length - 1;
						return (
							<div className="tli" key={h.id}>
								<div><div className={`tldot${last ? " cur" : ""}`} /></div>
								<div className="tlt"><strong>{fmtDate(h.ts)}</strong> · {h.action}{h.note ? " — " + h.note : ""}</div>
							</div>
						);
					}) : <div style={{ fontSize: 12, color: "var(--text3)" }}>No activity recorded</div>}
				</div>

				<div className="mact">
					{p.status === "In Transit" && p.received !== "yes" && (
						<button className="btn btn-s btn-receive" disabled={busy} onClick={() => onSubmit({ intent: "confirm", id: p.id })}>📦 Confirm Receive</button>
					)}
					{canDispatch && (
						<button className="btn btn-s btn-fv" disabled={busy} onClick={onDispatchToggle}>🚀 Dispatch</button>
					)}
					{p.status === "On Loan" && (
						<button className="btn btn-s" disabled={busy} onClick={() => onSubmit({ intent: "return", id: p.id })}>↩ Return to stock</button>
					)}

					{dispatchOpen && canDispatch && (
						<div className="mpanel">
							<div className="mpanel-t">🚀 Dispatch Sample</div>
							<div className="fg" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 10 }}>
								<div><label className="fl">Qty</label>
									<select className="fi" value={dqty} onChange={(e) => setDqty(Number(e.target.value))}>
										{Array.from({ length: p.qty }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} unit(s)</option>)}
									</select>
								</div>
								<div><label className="fl">Channel / Customer</label><input className="fi" value={dch} onChange={(e) => setDch(e.target.value)} placeholder="Channel or customer…" /></div>
								<div><label className="fl">Dispatch Date</label><input className="fi" type="date" value={ddate} onChange={(e) => setDdate(e.target.value)} /></div>
							</div>
							<div style={{ display: "flex", gap: 8 }}>
								<button className="btn btn-s btn-fv" disabled={busy || !dch.trim()} onClick={() => onSubmit({ intent: "dispatch", id: p.id, qty: dqty, channel: dch.trim(), date: ddate })}>Confirm Dispatch</button>
								<button className="btn btn-s" onClick={onDispatchToggle}>Cancel</button>
							</div>
						</div>
					)}

					<div style={{ width: "100%" }}>
						<div style={{ fontSize: 12, color: "var(--text3)", margin: "6px 0 4px", fontWeight: 500 }}>Change Status</div>
						<div className="spick">
							{statusOptions.map((s) => (
								<button key={s} className={`spb${s === "Lost" ? "" : ""}`} disabled={busy} onClick={() => onSubmit({ intent: "status", id: p.id, status: s, note: mode === "fv" ? "Sales update" : "Admin update" })}>{s}</button>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
