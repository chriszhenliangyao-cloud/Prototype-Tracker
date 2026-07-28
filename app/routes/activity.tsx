import { Link } from "react-router";
import type { Route } from "./+types/activity";
import { getUser, getRecentLogs } from "../lib/protrack";

export function meta() {
	return [{ title: "活动日志 · ProtoTrack" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const me = await getUser(request, env);
	if (me.role === "denied") return { me, logs: [] };
	const logs = await getRecentLogs(env, me, 300);
	return { me, logs };
}

const ACTION_COLOR: Record<string, string> = {
	"Sample dispatched": "text-blue-600 dark:text-blue-400",
	"Received confirmed": "text-emerald-600 dark:text-emerald-400",
	"Stock entry": "text-gray-600 dark:text-gray-400",
	"Returned to stock": "text-indigo-600 dark:text-indigo-400",
	Shipped: "text-violet-600 dark:text-violet-400",
	"Partial dispatch": "text-amber-600 dark:text-amber-400",
};

export default function Activity({ loaderData }: Route.ComponentProps) {
	const { me, logs } = loaderData;
	return (
		<main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
			<div className="mx-auto max-w-5xl px-5 py-6">
				<Link to="/" className="text-sm text-blue-600 hover:underline">← 返回 Dashboard</Link>
				<h1 className="mt-1 text-2xl font-bold">活动日志</h1>
				<p className="text-sm text-gray-500">最近 {logs.length} 条{me.role === "admin" ? "（全部）" : "（本人相关）"}</p>

				<div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
					<table className="w-full text-sm">
						<thead className="bg-gray-100 dark:bg-gray-800/60 text-gray-500 text-xs uppercase">
							<tr>{["时间", "SN", "操作", "操作人", "备注"].map((h) => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
						</thead>
						<tbody>
							{logs.map((l) => (
								<tr key={l.id} className="border-t border-gray-100 dark:border-gray-800/60">
									<td className="px-3 py-2 text-gray-400 font-mono text-xs whitespace-nowrap">{l.ts}</td>
									<td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{l.sn}</td>
									<td className={`px-3 py-2 whitespace-nowrap font-medium ${ACTION_COLOR[l.action] || ""}`}>{l.action}</td>
									<td className="px-3 py-2 whitespace-nowrap">{l.actor}</td>
									<td className="px-3 py-2 text-gray-500">{l.note}</td>
								</tr>
							))}
							{logs.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">暂无日志</td></tr>}
						</tbody>
					</table>
				</div>
			</div>
		</main>
	);
}
