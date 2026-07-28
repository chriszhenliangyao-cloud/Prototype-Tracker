import { Form, Link, useNavigation } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/home";
import {
	getUser,
	getProtos,
	listOwners,
	addProto,
	dispatch,
	updateStatus,
	returnToStock,
	confirmReceive,
	STATUSES,
	type Proto,
} from "../lib/protrack";

export function meta() {
	return [{ title: "ProtoTrack EU — 样机管理" }];
}

const COUNTRIES = ["Germany", "France", "UK", "Netherlands", "Italy", "Spain", "Poland", "Belgium", "Denmark", "Sweden"];
const SAMPLE_TYPES = ["Dummy", "Engineering Sample", "Preproduction Sample", "Mass Production"];

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const me = await getUser(request, env);
	if (me.role === "denied") {
		return { me, protos: [] as Proto[], owners: [] as string[] };
	}
	const [protos, owners] = await Promise.all([getProtos(env, me), listOwners(env)]);
	return { me, protos, owners };
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const me = await getUser(request, env);
	if (me.role === "denied") return { ok: false, error: "无权限" };
	const f = await request.formData();
	const intent = String(f.get("intent") || "");
	try {
		if (intent === "add") {
			await addProto(
				env,
				{
					sn: String(f.get("sn") || "").trim(),
					model: String(f.get("model") || ""),
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
			await updateStatus(env, Number(f.get("id")), String(f.get("status")), me);
		} else if (intent === "return") {
			await returnToStock(env, Number(f.get("id")), me);
		} else if (intent === "confirm") {
			await confirmReceive(env, Number(f.get("id")), me);
		}
		return { ok: true };
	} catch (e: any) {
		return { ok: false, error: e.message || String(e) };
	}
}

const STATUS_STYLE: Record<string, string> = {
	"In Stock": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
	"In Transit": "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
	"On Loan": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
	Returned: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
	Gifted: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
	const { me, protos, owners } = loaderData;
	const nav = useNavigation();
	const busy = nav.state !== "idle";
	const [q, setQ] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [ownerFilter, setOwnerFilter] = useState("");
	const [showAdd, setShowAdd] = useState(false);
	const [dispatchId, setDispatchId] = useState<number | null>(null);

	if (me.role === "denied") {
		return (
			<main className="min-h-screen grid place-items-center bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-100 p-6">
				<div className="max-w-md text-center">
					<h1 className="text-xl font-bold">无访问权限</h1>
					<p className="mt-2 text-sm text-gray-500">
						你的账号 <b>{me.email}</b> 不在授权名单中。请联系管理员，或确认已通过 Cloudflare Access 用公司邮箱登录。
					</p>
				</div>
			</main>
		);
	}

	// KPI
	const totalUnits = protos.reduce((s, p) => s + (p.qty || 0), 0);
	const kpi = (st: string) => protos.filter((p) => p.status === st).reduce((s, p) => s + (p.qty || 0), 0);

	const filtered = protos.filter((p) => {
		if (statusFilter && p.status !== statusFilter) return false;
		if (ownerFilter && p.owner !== ownerFilter) return false;
		if (q) {
			const hay = `${p.sn} ${p.model} ${p.pname} ${p.customer} ${p.owner} ${p.country}`.toLowerCase();
			if (!hay.includes(q.toLowerCase())) return false;
		}
		return true;
	});

	return (
		<main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
			<div className="mx-auto max-w-7xl px-5 py-6">
				{/* header */}
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div>
						<h1 className="text-2xl font-bold">ProtoTrack EU · 样机管理</h1>
						<p className="text-sm text-gray-500">
							{me.name}（{me.role === "admin" ? "管理员 · 全部" : "销售 · 仅本人"}）· {protos.length} 条记录
						</p>
					</div>
					<div className="flex gap-2">
						<Link to="/activity" className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">活动日志</Link>
						<button onClick={() => setShowAdd((v) => !v)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">+ 添加样机</button>
					</div>
				</div>

				{!me.viaAccess && (
					<div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
						⚠️ 未启用登录鉴权（Cloudflare Access 未生效），当前以 <b>{me.name}</b> 管理员身份访问。上线给团队用前请先配置 Access。
					</div>
				)}
				{actionData && !actionData.ok && (
					<div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">{actionData.error}</div>
				)}

				{/* KPI */}
				<div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
					{[["总数量", totalUnits], ["On Loan 借出", kpi("On Loan")], ["In Stock 在库", kpi("In Stock")], ["In Transit 在途", kpi("In Transit")], ["Gifted 赠送", kpi("Gifted")]].map(([label, val]) => (
						<div key={label as string} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
							<div className="text-xs text-gray-500">{label}</div>
							<div className="mt-1 text-2xl font-semibold">{val}</div>
						</div>
					))}
				</div>

				{/* add form */}
				{showAdd && (
					<Form method="post" className="mt-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 grid grid-cols-2 md:grid-cols-4 gap-3" onSubmit={() => setShowAdd(false)}>
						<input type="hidden" name="intent" value="add" />
						<input name="sn" required placeholder="SN 编号 *" className="fi" />
						<input name="model" placeholder="Model 型号" className="fi" />
						<input name="pname" placeholder="产品名" className="fi" />
						<select name="sample_type" className="fi" defaultValue=""><option value="">样机类型</option>{SAMPLE_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
						<select name="owner" className="fi" defaultValue={me.role === "sales" ? me.name : ""}>{me.role === "admin" ? <option value="">销售负责人</option> : null}{owners.map((o) => <option key={o}>{o}</option>)}</select>
						<select name="country" className="fi" defaultValue=""><option value="">国家</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
						<input name="qty" type="number" min={1} defaultValue={1} placeholder="数量" className="fi" />
						<input name="tracking_no" placeholder="快递单号(可选)" className="fi" />
						<input name="ship_date" type="date" className="fi" title="发货日期" />
						<input name="notes" placeholder="备注" className="fi md:col-span-2" />
						<button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">保存</button>
					</Form>
				)}

				{/* filters */}
				<div className="mt-5 flex flex-wrap items-center gap-2">
					<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 搜索 SN/型号/产品/渠道…" className="fi flex-1 min-w-48" />
					<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="fi"><option value="">全部状态</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
					{me.role === "admin" && (
						<select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="fi"><option value="">全部销售</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
					)}
				</div>

				{/* table */}
				<div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
					<table className="w-full text-sm">
						<thead className="bg-gray-100 dark:bg-gray-800/60 text-gray-500 text-xs uppercase">
							<tr>
								{["型号", "产品", "类型", "销售", "渠道", "国家", "数量", "状态", "更新", "操作"].map((h) => <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}
							</tr>
						</thead>
						<tbody>
							{filtered.map((p) => (
								<tr key={p.id} className="border-t border-gray-100 dark:border-gray-800/60">
									<td className="px-3 py-2 font-medium whitespace-nowrap">{p.model || p.sn}</td>
									<td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.pname}</td>
									<td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{p.sample_type}</td>
									<td className="px-3 py-2 whitespace-nowrap">{p.owner}</td>
									<td className="px-3 py-2 whitespace-nowrap">{p.customer || "—"}</td>
									<td className="px-3 py-2 whitespace-nowrap">{p.country}</td>
									<td className="px-3 py-2 text-center">{p.qty}</td>
									<td className="px-3 py-2 whitespace-nowrap">
										<span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status] || "bg-gray-100 text-gray-700"}`}>{p.status}</span>
										{p.received !== "yes" && p.status === "In Transit" && <span className="ml-1 text-xs text-violet-500">待收货</span>}
									</td>
									<td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{(p.updated_at || "").slice(0, 10)}</td>
									<td className="px-3 py-2 whitespace-nowrap">
										<div className="flex items-center gap-1">
											{p.status === "In Transit" && p.received !== "yes" && (
												<Form method="post"><input type="hidden" name="intent" value="confirm" /><input type="hidden" name="id" value={p.id} /><button className="rounded px-2 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700">确认收货</button></Form>
											)}
											{(p.status === "In Stock" || p.status === "On Loan") && p.qty > 0 && (
												<button onClick={() => setDispatchId(dispatchId === p.id ? null : p.id)} className="rounded px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">发货</button>
											)}
											{p.status === "On Loan" && (
												<Form method="post"><input type="hidden" name="intent" value="return" /><input type="hidden" name="id" value={p.id} /><button className="rounded px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">退回</button></Form>
											)}
											<Form method="post" className="inline">
												<input type="hidden" name="intent" value="status" />
												<input type="hidden" name="id" value={p.id} />
												<select name="status" defaultValue={p.status} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-1 text-xs">
													{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
												</select>
											</Form>
										</div>
										{dispatchId === p.id && (
											<Form method="post" className="mt-2 flex items-center gap-1" onSubmit={() => setDispatchId(null)}>
												<input type="hidden" name="intent" value="dispatch" />
												<input type="hidden" name="id" value={p.id} />
												<input name="channel" required placeholder="渠道/客户" className="fi !py-1 !text-xs w-28" />
												<input name="qty" type="number" min={1} max={p.qty} defaultValue={1} className="fi !py-1 !text-xs w-16" />
												<input name="date" type="date" className="fi !py-1 !text-xs" />
												<button className="rounded px-2 py-1 text-xs bg-blue-600 text-white">确认</button>
											</Form>
										)}
									</td>
								</tr>
							))}
							{filtered.length === 0 && (
								<tr><td colSpan={10} className="px-3 py-10 text-center text-gray-400">无匹配记录</td></tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</main>
	);
}
