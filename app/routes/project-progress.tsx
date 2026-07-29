import { Link, useFetcher } from "react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Route } from "./+types/project-progress";
import {
	GTM_STAGES,
	currentStage,
	getGtmWorkspace,
	projectProgress,
	projectStatus,
	launchGtmProduct,
	updateGtmOwners,
	updateGtmProject,
	toggleGtmTask,
	updateGtmMaterial,
	updateGtmRequirement,
	type GtmMaterial,
	type GtmDelayRecord,
	type GtmProduct,
	type GtmRequirement,
	type GtmStage,
	type GtmStageName,
	type GtmTask,
} from "../lib/gtm";
import "../gtm.css";

export function meta() {
	return [{ title: "Project Progress Management · ProtoTrack" }];
}

export async function loader({ context }: Route.LoaderArgs) {
	return getGtmWorkspace(context.cloudflare.env);
}

export async function action({ request, context }: Route.ActionArgs) {
	const form = await request.formData();
	const intent = String(form.get("intent") || "");
	try {
		if (intent === "toggle-task") {
			await toggleGtmTask(
				context.cloudflare.env,
				String(form.get("id")),
				String(form.get("completed")) === "true",
			);
		} else if (intent === "material-status") {
			await updateGtmMaterial(
				context.cloudflare.env,
				String(form.get("id")),
				String(form.get("status")),
			);
		} else if (intent === "requirement") {
			await updateGtmRequirement(
				context.cloudflare.env,
				String(form.get("id")),
				Number(form.get("quantity")),
				String(form.get("eta") || ""),
			);
		} else if (intent === "launch-product") {
			await launchGtmProduct(context.cloudflare.env, String(form.get("id")));
		} else if (intent === "owners") {
			await updateGtmOwners(
				context.cloudflare.env,
				String(form.get("product_owner") || ""),
				String(form.get("marketing_manager") || ""),
			);
		} else if (intent === "project-edit") {
			const payload = JSON.parse(String(form.get("payload") || "{}"));
			await updateGtmProject(context.cloudflare.env, payload.productId, payload.stages, payload.tasks);
		}
		return { ok: true };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

type Module = "progress" | "materials" | "prototypes";

export default function ProjectProgress({ loaderData }: Route.ComponentProps) {
	const [module, setModule] = useState<Module>("progress");
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("");
	const [model, setModel] = useState("");
	const [theme, setTheme] = useState<string | null>(null);
	const data = loaderData;
	const products = useMemo(
		() =>
			data.products.filter((product) => {
				const text = `${product.model} ${product.name}`.toLowerCase();
				return (
					(!query || text.includes(query.toLowerCase())) &&
					(!category || product.category === category) &&
					(!model || product.model === model)
				);
			}),
		[data.products, query, category, model],
	);
	const categories = [...new Set(data.products.map((product) => product.category))];
	const title =
		module === "progress"
			? "Project Progress Management"
			: module === "materials"
				? "Product Material Management"
				: "Prototype Management";
	const subtitle =
		module === "progress"
			? "Track upcoming products from project confirmation through launch."
			: module === "materials"
				? "Manage launch materials and readiness for upcoming products."
				: "Manage prototype requirements for upcoming product launches.";

	useEffect(() => {
		const attr = document.documentElement.getAttribute("data-theme");
		setTheme(attr || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
	}, []);
	function toggleTheme() {
		const next = theme === "dark" ? "light" : "dark";
		document.documentElement.setAttribute("data-theme", next);
		try { localStorage.setItem("pt-theme", next); } catch { /* ignore */ }
		setTheme(next);
	}

	return (
		<div className="gtm-app">
			<header className="gtm-mode-bar">
				<div className="gtm-mode-brand">
					<div className="gtm-mode-icon">📦</div>
					<span className="gtm-mode-name">ProtoTrack</span>
					<span className="gtm-mode-sep">·</span>
					<span className="gtm-mode-sub">Europe Prototype Tracker</span>
				</div>
				<nav className="gtm-mode-toggle" aria-label="ProtoTrack modes">
					<Link className="gtm-mode-btn" to="/">🛰️ Control Tower</Link>
					<Link className="gtm-mode-btn" to="/?view=field">🧳 Field View</Link>
					<span className="gtm-mode-btn active">📈 Project Progress</span>
				</nav>
				<div className="gtm-mode-right">
					<button className="gtm-theme-btn" title="Toggle light / dark" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
					<span className="gtm-live"><i />Live sync</span>
				</div>
			</header>
			<div className="gtm">
			<div className="gtm-shell">
				<aside className="gtm-side">
					<div className="gtm-tree-root">
						<span aria-hidden="true">▼</span>
						<button
							className={module === "progress" ? "gtm-tree-title on" : "gtm-tree-title"}
							onClick={() => setModule("progress")}
						>
							Project Progress Management
						</button>
					</div>
					<nav className="gtm-nav" aria-label="GTM Workspace">
						<button className={module === "materials" ? "on" : ""} onClick={() => setModule("materials")}>
							Product Material Management
						</button>
						<button className={module === "prototypes" ? "on" : ""} onClick={() => setModule("prototypes")}>
							Prototype Management
						</button>
					</nav>
				</aside>
				<main className="gtm-main">
					<h1 className="gtm-title">{title}</h1>
					<p className="gtm-sub">{subtitle}</p>
					{data.usingFallback && (
						<div className="gtm-demo-banner">
							Demo preview · GTM database migration is pending. Data shown here is read-only sample content.
						</div>
					)}
					<div className="gtm-toolbar">
						<input
							className="gtm-input"
							placeholder="Search Product Name / Model"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
						<select className="gtm-select" value={category} onChange={(event) => setCategory(event.target.value)}>
							<option value="">All Categories</option>
							{categories.map((item) => <option key={item}>{item}</option>)}
						</select>
						<select className="gtm-select" value={model} onChange={(event) => setModel(event.target.value)}>
							<option value="">All Models</option>
							{data.products.map((product) => <option key={product.id}>{product.model}</option>)}
						</select>
					</div>
					{module === "progress" && <ProgressModule products={products} stages={data.stages} tasks={data.tasks} delayRecords={data.delayRecords} />}
					{module === "materials" && <MaterialModule products={products} materials={data.materials} />}
					{module === "prototypes" && <PrototypeModule products={products} requirements={data.requirements} />}
				</main>
			</div>
			</div>
		</div>
	);
}

function ProgressModule({
	products,
	stages,
	tasks,
	delayRecords,
}: {
	products: GtmProduct[];
	stages: GtmStage[];
	tasks: GtmTask[];
	delayRecords: GtmDelayRecord[];
}) {
	const [collapsed, setCollapsed] = useState(false);
	const [editingOwners, setEditingOwners] = useState(false);
	const [liveTasks, setLiveTasks] = useState(tasks.map((task) => ({ ...task })));
	useEffect(() => setLiveTasks(tasks.map((task) => ({ ...task }))), [tasks]);
	const first = products[0];
	const ownerFetcher = useFetcher();
	const [delayProduct, setDelayProduct] = useState<GtmProduct | null>(null);
	return (
		<>
			<div className="gtm-section-head">
				<h2>Upcoming Project Progress</h2>
				<button className="gtm-btn" onClick={() => setCollapsed((value) => !value)}>
					{collapsed ? "Expand All" : "Collapse All"}
				</button>
				{editingOwners ? (
					<ownerFetcher.Form className="gtm-owner-edit" method="post" onSubmit={() => setEditingOwners(false)}>
						<input name="intent" type="hidden" value="owners" />
						<label>👤<input name="product_owner" defaultValue={first?.product_owner || ""} placeholder="Product Owner" /></label>
						<label>📣<input name="marketing_manager" defaultValue={first?.marketing_project_manager || ""} placeholder="Marketing Project Manager" /></label>
						<button className="gtm-btn primary">Save</button>
						<button className="gtm-btn" type="button" onClick={() => setEditingOwners(false)}>Cancel</button>
					</ownerFetcher.Form>
				) : (
					<button className="gtm-owner" onClick={() => setEditingOwners(true)}>
						👤 Product Owner: {first?.product_owner || "—"}　 📣 Marketing Project Manager: {first?.marketing_project_manager || "—"}
					</button>
				)}
			</div>
			{products.length ? (
				<div className="gtm-table-wrap">
					<table className={`gtm-table gtm-progress-table${collapsed ? " is-collapsed" : ""}`}>
						<thead><tr><th>Model</th><th>Product Name</th><th>Launch Date</th><th>Progress</th><th>Status</th><th>Project Pipeline</th>{collapsed && <th>Action</th>}</tr></thead>
						<tbody>
							{products.map((product) => {
								const productTasks = liveTasks.filter((task) => task.product_id === product.id);
								const productStages = stages.filter((stage) => stage.product_id === product.id);
								const progress = projectProgress(productTasks);
								const status = projectStatus(productTasks, productStages);
								return (
									<tr className="gtm-project-row" key={product.id}>
										<td><span className="gtm-model">{product.model}</span></td>
										<td>{product.name}</td>
										<td>{product.planned_launch_date || "—"}</td>
										<td><ProgressRing value={progress} total={productTasks.length} /></td>
										<td>
											<span className={`gtm-badge ${status.replaceAll(" ", "-")}`}>{status}</span>
											<button className="gtm-delay-trigger" onClick={() => setDelayProduct(product)}>⏰ {delayRecords.filter((record) => record.product_id === product.id).length}</button>
										</td>
										<td>
											{collapsed ? (
												<CollapsedPipeline tasks={productTasks} />
											) : (
												<Pipeline
													product={product}
													stages={productStages}
													tasks={productTasks}
													onTaskToggle={(id, completed) => setLiveTasks((items) => items.map((item) => item.id === id ? { ...item, is_completed: completed ? 1 : 0 } : item))}
												/>
											)}
										</td>
										{collapsed && <td><LaunchButton product={product} /></td>}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : <div className="gtm-empty">No matching projects found.</div>}
			{delayProduct && <DelayDrawer product={delayProduct} records={delayRecords.filter((record) => record.product_id === delayProduct.id)} onClose={() => setDelayProduct(null)} />}
		</>
	);
}

function DelayDrawer({ product, records, onClose }: { product: GtmProduct; records: GtmDelayRecord[]; onClose: () => void }) {
	return <div className="gtm-delay-overlay" onClick={onClose}>
		<aside className="gtm-delay-drawer" onClick={(event) => event.stopPropagation()}>
			<header><div><h2>Delay Records — {product.model}</h2><p>{records.length} Delay Record{records.length === 1 ? "" : "s"}</p></div><button onClick={onClose}>×</button></header>
			<div className="gtm-delay-list">{records.length ? records.map((record) => <article key={record.id}>
				<h3>{record.stage_name} · {record.task_name}</h3>
				<p>Original DDL: {record.original_deadline || "Not set"}</p>
				<p>Delayed Until: {record.delayed_until || "Not set"}</p>
				<p>Notes: {record.notes || "No notes"}</p>
			</article>) : <div className="gtm-empty">No delay records.</div>}</div>
		</aside>
	</div>;
}

function ProgressRing({ value, total }: { value: number; total: number }) {
	return (
		<div className="gtm-progress">
			<div className="gtm-ring" style={{ "--p": value } as CSSProperties}><span>{value}%</span></div>
			<small className="gtm-muted">{Math.round((value / 100) * total)} / {total}</small>
		</div>
	);
}

function CollapsedPipeline({ tasks }: { tasks: GtmTask[] }) {
	const current = currentStage(tasks);
	return (
		<div className="gtm-collapsed-pipeline">
			<div className="gtm-current-stage"><span>Current Stage</span><b>{current || "Completed"}</b></div>
			<div className="gtm-mini-track">
				{GTM_STAGES.map((stage, index) => {
					const stageTasks = tasks.filter((task) => task.stage_name === stage);
					const done = stageTasks.length === 0 || stageTasks.every((task) => !!task.is_completed);
					return (
						<div className="gtm-mini-step" key={stage}>
							<span className={done ? "done" : current === stage ? "current" : ""}>{index + 1}</span>
							{index < GTM_STAGES.length - 1 && <i className={done ? "done" : ""} />}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function LaunchButton({ product }: { product: GtmProduct }) {
	const fetcher = useFetcher();
	return (
		<fetcher.Form method="post">
			<input name="intent" type="hidden" value="launch-product" />
			<input name="id" type="hidden" value={product.id} />
			<button className="gtm-launch-btn" disabled={fetcher.state !== "idle"} type="submit">Launch</button>
		</fetcher.Form>
	);
}

function Pipeline({ product, stages, tasks, onTaskToggle }: { product: GtmProduct; stages: GtmStage[]; tasks: GtmTask[]; onTaskToggle: (id: string, completed: boolean) => void }) {
	const current = currentStage(tasks);
	const [editing, setEditing] = useState(false);
	const [draftStages, setDraftStages] = useState(stages.map((stage) => ({ ...stage })));
	const [draftTasks, setDraftTasks] = useState(tasks.map((task) => ({ ...task })));
	const fetcher = useFetcher();

	function resetDraft() {
		setDraftStages(stages.map((stage) => ({ ...stage })));
		setDraftTasks(tasks.map((task) => ({ ...task })));
	}
	function updateTask(id: string, patch: Partial<GtmTask>) {
		setDraftTasks((items) => items.map((task) => task.id === id ? { ...task, ...patch } : task));
	}
	function addTask(stage: GtmStageName) {
		setDraftTasks((items) => [...items, {
			id: `new-${product.id}-${Date.now()}`,
			product_id: product.id,
			stage_name: stage,
			task_name: "New Task",
			owner_role: "PRODUCT",
			prototype_type: null,
			is_completed: 0,
			sort_order: items.filter((task) => task.stage_name === stage).length * 10 + 10,
		}]);
	}
	if (editing) {
		const payload = JSON.stringify({
			productId: product.id,
			stages: draftStages.map((stage) => ({ id: stage.id, deadline: stage.deadline || "" })),
			tasks: draftTasks.map(({ id, stage_name, task_name, owner_role, prototype_type, is_completed, sort_order }) =>
				({ id, stage_name, task_name, owner_role, prototype_type, is_completed, sort_order })),
		});
		return (
			<fetcher.Form method="post" className="gtm-project-editor" onSubmit={() => setEditing(false)}>
				<input name="intent" type="hidden" value="project-edit" />
				<input name="payload" type="hidden" value={payload} />
				<div className="gtm-editor-grid">
					{GTM_STAGES.map((stageName) => {
						const stage = draftStages.find((item) => item.stage_name === stageName);
						const stageTasks = draftTasks.filter((task) => task.stage_name === stageName);
						return <div className="gtm-editor-stage" key={stageName}>
							<b>{stageName}</b>
							<label>DDL<input type="date" value={stage?.deadline || ""} onChange={(e) => setDraftStages((items) => items.map((item) => item.stage_name === stageName ? { ...item, deadline: e.target.value } : item))} /></label>
							{stageTasks.map((task) => <div className="gtm-editor-task" key={task.id}>
								<div><input type="checkbox" checked={!!task.is_completed} onChange={(e) => updateTask(task.id, { is_completed: e.target.checked ? 1 : 0 })} /><input value={task.task_name} onChange={(e) => updateTask(task.id, { task_name: e.target.value })} /></div>
								<select value={task.owner_role} onChange={(e) => updateTask(task.id, { owner_role: e.target.value as GtmTask["owner_role"] })}><option value="PRODUCT">👤 Product</option><option value="MARKETING">📣 Marketing</option><option value="GTM">GTM</option></select>
								<select value={task.prototype_type || ""} onChange={(e) => updateTask(task.id, { prototype_type: e.target.value || null })}><option value="">Not a Sample</option><option>Dummy</option><option>Engineering Sample</option><option>Preproduction Sample</option><option>Mass Production Sample</option></select>
								<button type="button" onClick={() => setDraftTasks((items) => items.filter((item) => item.id !== task.id))}>×</button>
							</div>)}
							<button className="gtm-add-task" type="button" onClick={() => addTask(stageName)}>＋ Add Task</button>
						</div>;
					})}
				</div>
				<div className="gtm-editor-actions"><button className="gtm-btn" type="button" onClick={() => { resetDraft(); setEditing(false); }}>Cancel</button><button className="gtm-btn primary">Save</button></div>
			</fetcher.Form>
		);
	}
	return (
		<div className="gtm-pipeline">
			<div className="gtm-line" />
			<div className="gtm-stages">
				{GTM_STAGES.map((stage, index) => {
					const stageTasks = tasks.filter((task) => task.stage_name === stage);
					const done = stageTasks.length === 0 || stageTasks.every((task) => !!task.is_completed);
					const isCurrent = current === stage;
					const detail = stages.find((item) => item.stage_name === stage);
					return (
						<div className="gtm-stage-wrap" key={stage}>
							<div className={`gtm-node ${done ? "done" : isCurrent ? "current" : ""}`}>{index + 1}</div>
							<div className={`gtm-stage ${done ? "done" : isCurrent ? "current" : ""}`}>
								<div className="gtm-stage-title">{stage}</div>
								<div className="gtm-ddl">DDL: {detail?.deadline || "—"}</div>
								{stageTasks.map((task) => <TaskToggle key={task.id} task={task} onToggle={(completed) => {
									onTaskToggle(task.id, completed);
								}} />)}
							</div>
						</div>
					);
				})}
			</div>
			<button className="gtm-btn gtm-edit-project" onClick={() => { resetDraft(); setEditing(true); }}>Edit</button>
		</div>
	);
}

function TaskToggle({ task, onToggle }: { task: GtmTask; onToggle?: (completed: boolean) => void }) {
	const fetcher = useFetcher();
	const [checked, setChecked] = useState(!!task.is_completed);
	useEffect(() => setChecked(!!task.is_completed), [task.is_completed]);
	const optimistic = fetcher.formData ? String(fetcher.formData.get("completed")) === "true" : checked;
	const icon = task.owner_role === "MARKETING" ? "📣" : task.owner_role === "PRODUCT" ? "👤" : "";
	return (
		<fetcher.Form method="post" className="gtm-task">
			<input name="intent" type="hidden" value="toggle-task" />
			<input name="id" type="hidden" value={task.id} />
			<input name="completed" type="hidden" value={String(!optimistic)} />
			<button className={optimistic ? "" : "todo"} title="Toggle task completion" type="submit" onClick={() => { setChecked(!optimistic); onToggle?.(!optimistic); }}>
				{optimistic ? "✓" : "○"}
			</button>
			<span>{icon} {task.task_name}</span>
		</fetcher.Form>
	);
}

function MaterialModule({ products, materials }: { products: GtmProduct[]; materials: GtmMaterial[] }) {
	const types = [...new Set(materials.map((material) => material.material_type))];
	const completed = materials.filter((material) => material.status === "COMPLETED").length;
	return (
		<>
			<div className="gtm-cards">
				<div className="gtm-card"><span className="gtm-muted">Upcoming Products</span><b>{products.length}</b></div>
				<div className="gtm-card"><span className="gtm-muted">Completed Materials</span><b>{completed}</b></div>
				<div className="gtm-card"><span className="gtm-muted">Open Materials</span><b>{materials.length - completed}</b></div>
			</div>
			<div className="gtm-section-head"><h2>Upcoming Product Materials</h2><span className="gtm-muted">💡 Click a status to edit</span></div>
			<div className="gtm-table-wrap">
				<table className="gtm-table">
					<thead><tr><th>Model</th><th>Product Name</th><th>Category</th><th>Launch Date</th>{types.map((type) => <th key={type}>{type}</th>)}</tr></thead>
					<tbody>{products.map((product) => (
						<tr key={product.id}>
							<td className="gtm-model">{product.model}</td><td>{product.name}</td><td>{product.category}</td><td>{product.planned_launch_date}</td>
							{types.map((type) => {
								const material = materials.find((item) => item.product_id === product.id && item.material_type === type);
								return <td className="gtm-material-cell" key={type}>{material ? <MaterialStatus material={material} /> : "—"}</td>;
							})}
						</tr>
					))}</tbody>
				</table>
			</div>
		</>
	);
}

function MaterialStatus({ material }: { material: GtmMaterial }) {
	const fetcher = useFetcher();
	const status = fetcher.formData ? String(fetcher.formData.get("status")) : material.status;
	return (
		<fetcher.Form method="post">
			<input name="intent" type="hidden" value="material-status" />
			<input name="id" type="hidden" value={material.id} />
			<div className={`gtm-status ${status}`}>
				<select name="status" value={status} onChange={(event) => fetcher.submit(event.currentTarget.form)}>
					<option value="COMPLETED">✓ Completed</option>
					<option value="NOT_COMPLETED">✗ Not Completed</option>
					<option value="NOT_REQUIRED">— Not Required</option>
				</select>
			</div>
			{status === "NOT_COMPLETED" && <small className="gtm-muted">DDL: {material.deadline || "—"}<br />Owner: {material.owner || "—"}</small>}
		</fetcher.Form>
	);
}

function PrototypeModule({ products, requirements }: { products: GtmProduct[]; requirements: GtmRequirement[] }) {
	const visible = requirements.filter((requirement) => products.some((product) => product.id === requirement.product_id));
	return (
		<>
			<div className="gtm-section-head"><h2>Prototype Requirements</h2><button className="gtm-btn primary">+ Add Prototype</button></div>
			<div className="gtm-table-wrap">
				<table className="gtm-table">
					<thead><tr><th>Model</th><th>Product Name</th><th>Sample Type</th><th>Project Stage</th><th>Required Quantity</th><th>ETA</th><th>Status</th><th>Action</th></tr></thead>
					<tbody>{visible.map((requirement) => <RequirementRow key={requirement.id} requirement={requirement} />)}</tbody>
				</table>
			</div>
		</>
	);
}

function RequirementRow({ requirement }: { requirement: GtmRequirement }) {
	const [editing, setEditing] = useState(false);
	const fetcher = useFetcher();
	const status = requirement.is_completed ? "Completed" : "In Progress";
	return (
		<tr>
			<td className="gtm-model">{requirement.model}</td>
			<td>{requirement.product_name}</td>
			<td>{requirement.prototype_type}</td>
			<td>{requirement.stage_name}</td>
			<td colSpan={editing ? 4 : 1}>
				{editing ? (
					<fetcher.Form className="gtm-req-edit" method="post" onSubmit={() => setEditing(false)}>
						<input name="intent" type="hidden" value="requirement" />
						<input name="id" type="hidden" value={requirement.id} />
						<label>Qty <input min="1" name="quantity" type="number" defaultValue={requirement.required_quantity} /></label>
						<label>ETA <input name="eta" type="date" defaultValue={requirement.eta || ""} /></label>
						<button className="gtm-btn primary" type="submit">Save</button>
						<button className="gtm-btn" type="button" onClick={() => setEditing(false)}>Cancel</button>
					</fetcher.Form>
				) : requirement.required_quantity}
			</td>
			{!editing && <><td>{requirement.eta || "—"}</td><td><span className={`gtm-badge ${status.replaceAll(" ", "-")}`}>{status}</span></td><td><button className="gtm-btn" onClick={() => setEditing(true)}>Edit</button></td></>}
		</tr>
	);
}
