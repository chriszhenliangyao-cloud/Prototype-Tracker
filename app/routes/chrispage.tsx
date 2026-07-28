import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/chrispage";

// 样机状态 = 看板的列（顺序即列顺序）
const STATUSES = [
	{ key: "to_receive", label: "待收货", color: "bg-gray-100 dark:bg-gray-800" },
	{ key: "in_stock", label: "在库", color: "bg-emerald-50 dark:bg-emerald-950/40" },
	{ key: "lent_out", label: "借出", color: "bg-amber-50 dark:bg-amber-950/40" },
	{ key: "testing", label: "测试中", color: "bg-blue-50 dark:bg-blue-950/40" },
	{ key: "returned", label: "已归还", color: "bg-indigo-50 dark:bg-indigo-950/40" },
	{ key: "scrapped", label: "报废", color: "bg-rose-50 dark:bg-rose-950/40" },
] as const;

type Unit = {
	id: number;
	sku_code: string;
	product_name: string | null;
	serial_no: string | null;
	status: string;
	holder: string | null;
	location: string | null;
	notes: string | null;
	updated_at: string;
};

type Sku = { code: string; name: string };

export function meta() {
	return [{ title: "样机管理 · Prototype Tracker" }];
}

export async function loader({ context }: Route.LoaderArgs) {
	const db = context.cloudflare.env.DB;
	const units = await db
		.prepare(
			`SELECT u.id, u.sku_code, s.name AS product_name, u.serial_no,
			        u.status, u.holder, u.location, u.notes, u.updated_at
			 FROM sample_unit u
			 LEFT JOIN sku s ON s.code = u.sku_code
			 ORDER BY u.updated_at DESC`,
		)
		.all<Unit>();
	const skus = await db
		.prepare("SELECT code, name FROM sku WHERE is_active = 1 ORDER BY sort_order, code")
		.all<Sku>();
	return { units: units.results, skus: skus.results };
}

export async function action({ request, context }: Route.ActionArgs) {
	const db = context.cloudflare.env.DB;
	const form = await request.formData();
	const intent = form.get("intent");

	if (intent === "add") {
		const sku_code = String(form.get("sku_code") || "").trim();
		if (!sku_code) return { ok: false, error: "请选择产品 SKU" };
		await db
			.prepare(
				`INSERT INTO sample_unit (sku_code, serial_no, status, holder, location, notes)
				 VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				sku_code,
				String(form.get("serial_no") || "") || null,
				String(form.get("status") || "in_stock"),
				String(form.get("holder") || "") || null,
				String(form.get("location") || "") || null,
				String(form.get("notes") || "") || null,
			)
			.run();
		return { ok: true };
	}

	if (intent === "move") {
		const id = Number(form.get("id"));
		const status = String(form.get("status") || "");
		await db
			.prepare("UPDATE sample_unit SET status = ?, updated_at = datetime('now') WHERE id = ?")
			.bind(status, id)
			.run();
		return { ok: true };
	}

	if (intent === "delete") {
		const id = Number(form.get("id"));
		await db.prepare("DELETE FROM sample_unit WHERE id = ?").bind(id).run();
		return { ok: true };
	}

	return { ok: false, error: "未知操作" };
}

export default function ChrisPage({ loaderData }: Route.ComponentProps) {
	const { units, skus } = loaderData;
	const nav = useNavigation();
	const busy = nav.state !== "idle";

	return (
		<main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
			<div className="mx-auto max-w-7xl px-6 py-8">
				<div className="flex items-center justify-between">
					<div>
						<Link to="/" className="text-sm text-blue-600 hover:underline">
							← 首页
						</Link>
						<h1 className="mt-1 text-2xl font-bold">样机管理</h1>
						<p className="text-sm text-gray-500">
							共 {units.length} 台样机 · 改动后对方刷新即可看到最新
						</p>
					</div>
				</div>

				{/* 新增样机 */}
				<Form
					method="post"
					className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 dark:border-gray-800 p-4 md:grid-cols-7"
				>
					<input type="hidden" name="intent" value="add" />
					<select
						name="sku_code"
						required
						className="col-span-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
						defaultValue=""
					>
						<option value="" disabled>
							选择产品 SKU…
						</option>
						{skus.map((s) => (
							<option key={s.code} value={s.code}>
								{s.code} · {s.name}
							</option>
						))}
					</select>
					<input
						name="serial_no"
						placeholder="样机编号"
						className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
					/>
					<select
						name="status"
						defaultValue="in_stock"
						className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
					>
						{STATUSES.map((s) => (
							<option key={s.key} value={s.key}>
								{s.label}
							</option>
						))}
					</select>
					<input
						name="holder"
						placeholder="持有人"
						className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
					/>
					<input
						name="location"
						placeholder="位置"
						className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
					/>
					<button
						type="submit"
						disabled={busy}
						className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					>
						+ 添加样机
					</button>
				</Form>

				{/* 看板 */}
				<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
					{STATUSES.map((col) => {
						const cards = units.filter((u) => u.status === col.key);
						return (
							<div key={col.key} className="flex flex-col">
								<div className="mb-2 flex items-center justify-between px-1">
									<span className="text-sm font-semibold">{col.label}</span>
									<span className="text-xs text-gray-400">{cards.length}</span>
								</div>
								<div
									className={`flex-1 space-y-2 rounded-xl p-2 ${col.color} min-h-24`}
								>
									{cards.map((u) => (
										<div
											key={u.id}
											className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm"
										>
											<div className="text-sm font-medium">
												{u.product_name ?? u.sku_code}
											</div>
											<div className="mt-0.5 text-xs text-gray-500">
												{u.sku_code}
												{u.serial_no ? ` · ${u.serial_no}` : ""}
											</div>
											{(u.holder || u.location) && (
												<div className="mt-1 text-xs text-gray-500">
													{u.holder ? `👤 ${u.holder}` : ""}
													{u.location ? `  📍 ${u.location}` : ""}
												</div>
											)}
											{u.notes && (
												<div className="mt-1 text-xs text-gray-400">{u.notes}</div>
											)}
											<div className="mt-2 flex items-center gap-2">
												<Form method="post" className="flex-1">
													<input type="hidden" name="intent" value="move" />
													<input type="hidden" name="id" value={u.id} />
													<select
														name="status"
														defaultValue={u.status}
														onChange={(e) => e.currentTarget.form?.requestSubmit()}
														className="w-full rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1 text-xs"
													>
														{STATUSES.map((s) => (
															<option key={s.key} value={s.key}>
																{s.label}
															</option>
														))}
													</select>
												</Form>
												<Form method="post">
													<input type="hidden" name="intent" value="delete" />
													<input type="hidden" name="id" value={u.id} />
													<button
														type="submit"
														title="删除"
														className="rounded px-1.5 py-1 text-xs text-gray-400 hover:text-rose-600"
													>
														✕
													</button>
												</Form>
											</div>
										</div>
									))}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</main>
	);
}
