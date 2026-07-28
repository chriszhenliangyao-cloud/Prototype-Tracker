import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Prototype Tracker" },
		{ name: "description", content: "样机与原型协作看板" },
	];
}

export async function loader({ context }: Route.LoaderArgs) {
	const db = context.cloudflare.env.DB;
	const sku = await db.prepare("SELECT COUNT(*) AS n FROM sku").first<{ n: number }>();
	const units = await db
		.prepare("SELECT COUNT(*) AS n FROM sample_unit")
		.first<{ n: number }>();
	return { skuCount: sku?.n ?? 0, unitCount: units?.n ?? 0 };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { skuCount, unitCount } = loaderData;
	return (
		<main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
			<div className="mx-auto max-w-3xl px-6 py-16">
				<h1 className="text-3xl font-bold">Prototype Tracker</h1>
				<p className="mt-2 text-gray-500 dark:text-gray-400">
					样机与原型协作看板 · 共用一个数据库（伦敦 D1）
				</p>

				<div className="mt-8 grid grid-cols-2 gap-4">
					<div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
						<div className="text-sm text-gray-500">产品 SKU</div>
						<div className="mt-1 text-2xl font-semibold">{skuCount}</div>
					</div>
					<div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
						<div className="text-sm text-gray-500">样机台数</div>
						<div className="mt-1 text-2xl font-semibold">{unitCount}</div>
					</div>
				</div>

				<div className="mt-10 space-y-3">
					<h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
						页面
					</h2>
					<Link
						to="/chrispage"
						className="block rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition"
					>
						<div className="font-medium">Chris · 样机管理</div>
						<div className="text-sm text-gray-500">
							按状态看板管理样机（待收货 / 在库 / 借出 / 测试 / 已归还 / 报废）
						</div>
					</Link>
					<div className="block rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-5 text-gray-400">
						<div className="font-medium">Bai · 待开拓</div>
						<div className="text-sm">Bai 后续在同一个 webapp 里添加自己的页面</div>
					</div>
				</div>
			</div>
		</main>
	);
}
