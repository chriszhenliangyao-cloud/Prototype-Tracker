import { Link, useFetcher } from "react-router";
import { useMemo, useState, type CSSProperties } from "react";
import type { Route } from "./+types/project-progress";
import {
	GTM_STAGES,
	currentStage,
	getGtmWorkspace,
	projectProgress,
	projectStatus,
	toggleGtmTask,
	updateGtmMaterial,
	updateGtmRequirement,
	type GtmMaterial,
	type GtmProduct,
	type GtmRequirement,
	type GtmStage,
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

	return (
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
					<Link className="gtm-back" to="/">← Prototype Control Tower</Link>
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
					{module === "progress" && <ProgressModule products={products} stages={data.stages} tasks={data.tasks} />}
					{module === "materials" && <MaterialModule products={products} materials={data.materials} />}
					{module === "prototypes" && <PrototypeModule products={products} requirements={data.requirements} />}
				</main>
			</div>
		</div>
	);
}

function ProgressModule({
	products,
	stages,
	tasks,
}: {
	products: GtmProduct[];
	stages: GtmStage[];
	tasks: GtmTask[];
}) {
	const [collapsed, setCollapsed] = useState(false);
	const first = products[0];
	return (
		<>
			<div className="gtm-section-head">
				<h2>Upcoming Project Progress</h2>
				<button className="gtm-btn" onClick={() => setCollapsed((value) => !value)}>
					{collapsed ? "Expand All" : "Collapse All"}
				</button>
				<span className="gtm-owner">👤 Product Owner: {first?.product_owner || "—"}</span>
				<span className="gtm-owner">📣 Marketing Project Manager: {first?.marketing_project_manager || "—"}</span>
			</div>
			{products.length ? (
				<div className="gtm-table-wrap">
					<table className="gtm-table">
						<thead><tr><th>Model</th><th>Product Name</th><th>Launch Date</th><th>Progress</th><th>Status</th><th>Project Pipeline</th></tr></thead>
						<tbody>
							{products.map((product) => {
								const productTasks = tasks.filter((task) => task.product_id === product.id);
								const productStages = stages.filter((stage) => stage.product_id === product.id);
								const progress = projectProgress(productTasks);
								const status = projectStatus(productTasks, productStages);
								return (
									<tr className="gtm-project-row" key={product.id}>
										<td><span className="gtm-model">{product.model}</span></td>
										<td>{product.name}</td>
										<td>{product.planned_launch_date || "—"}</td>
										<td><ProgressRing value={progress} total={productTasks.length} /></td>
										<td><span className={`gtm-badge ${status.replaceAll(" ", "-")}`}>{status}</span></td>
										<td>
											{collapsed ? (
												<CollapsedPipeline tasks={productTasks} />
											) : (
												<Pipeline stages={productStages} tasks={productTasks} />
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : <div className="gtm-empty">No matching projects found.</div>}
		</>
	);
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
		<div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 520 }}>
			{GTM_STAGES.map((stage, index) => {
				const stageTasks = tasks.filter((task) => task.stage_name === stage);
				const done = stageTasks.length === 0 || stageTasks.every((task) => !!task.is_completed);
				return (
					<div key={stage} style={{ display: "contents" }}>
						<span className={`gtm-node ${done ? "done" : current === stage ? "current" : ""}`} style={{ margin: 0 }}>{index + 1}</span>
						{index < 5 && <span style={{ height: 2, minWidth: 38, flex: 1, background: done ? "#12b76a" : "#e4e7ec" }} />}
					</div>
				);
			})}
		</div>
	);
}

function Pipeline({ stages, tasks }: { stages: GtmStage[]; tasks: GtmTask[] }) {
	const current = currentStage(tasks);
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
								{stageTasks.map((task) => <TaskToggle key={task.id} task={task} />)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function TaskToggle({ task }: { task: GtmTask }) {
	const fetcher = useFetcher();
	const optimistic = fetcher.formData
		? String(fetcher.formData.get("completed")) === "true"
		: !!task.is_completed;
	const icon = task.owner_role === "MARKETING" ? "📣" : task.owner_role === "PRODUCT" ? "👤" : "";
	return (
		<fetcher.Form method="post" className="gtm-task">
			<input name="intent" type="hidden" value="toggle-task" />
			<input name="id" type="hidden" value={task.id} />
			<input name="completed" type="hidden" value={String(!optimistic)} />
			<button className={optimistic ? "" : "todo"} title="Toggle task completion" type="submit">
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
