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
	return [{ title: "GTM Workspace · ProtoTrack" }];
}

export async function loader({ context }: Route.LoaderArgs) {
	return getGtmWorkspace(context.cloudflare.env);
}

export async function action({ request, context }: Route.ActionArgs) {
	const form = await request.formData();
	const intent = String(form.get("intent") || "");
	try {
		if (intent === "toggle-task") {
			await toggleGtmTask(context.cloudflare.env, String(form.get("id")), String(form.get("completed")) === "true");
		} else if (intent === "material-status") {
			await updateGtmMaterial(context.cloudflare.env, String(form.get("id")), String(form.get("status")));
		} else if (intent === "requirement") {
			await updateGtmRequirement(context.cloudflare.env, String(form.get("id")), Number(form.get("quantity")), String(form.get("eta") || ""));
		}
		return { ok: true };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

type Module = "progress" | "materials" | "prototypes";

export default function GtmWorkspace({ loaderData }: Route.ComponentProps) {
	const [module, setModule] = useState<Module>("progress");
	const [treeOpen, setTreeOpen] = useState(true);
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("");
	const [model, setModel] = useState("");
	const [prototypeType, setPrototypeType] = useState("");
	const data = loaderData;
	const products = useMemo(() => data.products.filter((product) => {
		const matchText = `${product.model} ${product.name}`.toLowerCase().includes(query.toLowerCase());
		return matchText && (!category || product.category === category) && (!model || product.model === model);
	}), [data.products, query, category, model]);
	const categories = [...new Set(data.products.map((p) => p.category).filter(Boolean))];
	const title = module === "progress" ? "Project Progress Management" : module === "materials" ? "Product Material Management" : "Prototype Management";
	const subtitle = module === "progress"
		? "Track upcoming products from project confirmation through launch."
		: module === "materials"
			? "Manage launch materials and readiness for upcoming products."
			: "Manage prototype requirements for upcoming product launches.";

	function navigateTo(next: Module, product?: GtmProduct, type?: string) {
		setModule(next);
		if (product) {
			setQuery(product.model || product.name);
			setModel("");
		}
		setPrototypeType(next === "prototypes" ? type || "" : "");
	}

	return (
		<main className="workspace">
			<aside className="workspace-sidebar">
				<div className="workspace-brand"><span className="brand-mark">◆</span><div><b>ProtoTrack</b><small>GTM Workspace</small></div></div>
				<nav className="workspace-tree">
					<div className="tree-root">
						<button className="tree-toggle" onClick={() => setTreeOpen((v) => !v)}>{treeOpen ? "▼" : "▶"}</button>
						<button className={module === "progress" ? "tree-item active" : "tree-item"} onClick={() => navigateTo("progress")}>Project Progress Management</button>
					</div>
					{treeOpen && <div className="tree-children">
						<button className={module === "materials" ? "tree-item active" : "tree-item"} onClick={() => navigateTo("materials")}>Product Material Management</button>
						<button className={module === "prototypes" ? "tree-item active" : "tree-item"} onClick={() => navigateTo("prototypes")}>Prototype Management</button>
					</div>}
				</nav>
				<div className="sidebar-bottom"><Link to="/">← Prototype Control Tower</Link><span>Europe · Live D1 data</span></div>
			</aside>
			<section className="workspace-content">
				<header className="page-head"><div><p className="eyebrow">GTM WORKSPACE</p><h1>{title}</h1><p>{subtitle}</p></div><div className="head-actions"><button className="secondary">⇧ Excel Import</button>{module === "materials" && <button className="primary">＋ Add Product</button>}{module === "prototypes" && <button className="primary">＋ Add Prototype</button>}</div></header>
				{data.usingFallback && <div className="demo-banner">Demo preview · GTM migration is pending, so local sample data is shown.</div>}
				<div className="filters">
					<label className="search"><span>⌕</span><input aria-label="Search" placeholder={module === "prototypes" ? "Search Model / Product Name" : "Search Product Name / Model"} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
					<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All Categories</option>{categories.map((x) => <option key={x}>{x}</option>)}</select>
					<select value={model} onChange={(e) => setModel(e.target.value)}><option value="">All Models</option>{data.products.map((p) => <option key={p.id}>{p.model}</option>)}</select>
					{module === "prototypes" && <select value={prototypeType} onChange={(e) => setPrototypeType(e.target.value)}><option value="">All Sample Types</option>{["Dummy","Engineering Sample","Preproduction Sample","Mass Production Sample"].map((x) => <option key={x}>{x}</option>)}</select>}
					{(query || category || model || prototypeType) && <button className="clear" onClick={() => { setQuery(""); setCategory(""); setModel(""); setPrototypeType(""); }}>Clear filters</button>}
				</div>
				<div hidden={module !== "progress"}><ProgressWorkspace products={products} stages={data.stages} tasks={data.tasks} onNavigate={navigateTo} /></div>
				<div hidden={module !== "materials"}><MaterialsWorkspace products={products} materials={data.materials} /></div>
				<div hidden={module !== "prototypes"}><PrototypeWorkspace products={products} requirements={data.requirements} typeFilter={prototypeType} /></div>
			</section>
		</main>
	);
}

function ProgressWorkspace({ products, stages, tasks, onNavigate }: { products: GtmProduct[]; stages: GtmStage[]; tasks: GtmTask[]; onNavigate: (m: Module, p?: GtmProduct, type?: string) => void }) {
	const [collapsed, setCollapsed] = useState(false);
	const first = products[0];
	return <>
		<div className="section-bar"><div><h2>Upcoming Project Progress</h2><span>{products.length} upcoming products</span></div><div className="section-actions"><button className="secondary" onClick={() => setCollapsed((v) => !v)}>{collapsed ? "Expand All" : "Collapse All"}</button><div className="owner-chip">👤 <span>Product Owner</span><b>{first?.product_owner || "—"}</b></div><div className="owner-chip">📣 <span>Marketing PM</span><b>{first?.marketing_project_manager || "—"}</b></div></div></div>
		{products.length ? <div className="table-shell"><table className={collapsed ? "data-table progress-table collapsed" : "data-table progress-table"}><thead><tr><th>Model</th><th>Product Name</th><th>Launch Date</th><th>Progress</th><th>Status</th><th>Project Pipeline</th></tr></thead><tbody>{products.map((p) => {
			const pt = tasks.filter((t) => t.product_id === p.id); const ps = stages.filter((s) => s.product_id === p.id);
			const progress = projectProgress(pt); const status = projectStatus(pt, ps);
			return <tr key={p.id}><td><span className="model-tag">{p.model}</span></td><td><b>{p.name}</b><small className="cell-sub">{p.category}</small></td><td>{p.planned_launch_date || "—"}</td><td><ProgressRing value={progress} done={pt.filter((t) => t.is_completed).length} total={pt.length} /></td><td><span className={`status-badge ${status.replaceAll(" ", "-").toLowerCase()}`}>{status}</span></td><td>{collapsed ? <CompactPipeline tasks={pt} /> : <Pipeline product={p} stages={ps} tasks={pt} onNavigate={onNavigate} />}</td></tr>;
		})}</tbody></table></div> : <Empty text="No matching projects found." />}
	</>;
}

function ProgressRing({ value, done, total }: { value: number; done: number; total: number }) {
	return <div className="progress-wrap"><div className="progress-ring" style={{ "--progress": `${value * 3.6}deg` } as CSSProperties}><span>{value}%</span></div><small>{done}/{total}</small></div>;
}

function CompactPipeline({ tasks }: { tasks: GtmTask[] }) {
	const current = currentStage(tasks);
	return <div className="compact-pipeline">{GTM_STAGES.map((stage, i) => { const st = tasks.filter((t) => t.stage_name === stage); const done = st.length === 0 || st.every((t) => t.is_completed); return <div className="compact-step" key={stage}><span className={done ? "done" : current === stage ? "current" : ""}>{done ? "✓" : i + 1}</span>{i < 5 && <i className={done ? "done" : ""} />}</div>; })}</div>;
}

function Pipeline({ product, stages, tasks, onNavigate }: { product: GtmProduct; stages: GtmStage[]; tasks: GtmTask[]; onNavigate: (m: Module, p?: GtmProduct, type?: string) => void }) {
	const current = currentStage(tasks);
	return <div className="pipeline"><div className="pipeline-line" /><div className="stage-grid">{GTM_STAGES.map((stage, i) => {
		const detail = stages.find((s) => s.stage_name === stage); const stageTasks = tasks.filter((t) => t.stage_name === stage); const done = stageTasks.length === 0 || stageTasks.every((t) => t.is_completed);
		return <div className="stage" key={stage}><div className={done ? "stage-node done" : current === stage ? "stage-node current" : "stage-node"}>{done ? "✓" : i + 1}</div><div className={current === stage ? "stage-card current" : "stage-card"}><b>{stage}</b><small>DDL: {detail?.deadline || "—"}</small>{stageTasks.map((task) => <TaskToggle key={task.id} task={task} onLabelClick={task.prototype_type ? () => onNavigate("prototypes", product, task.prototype_type!) : task.owner_role === "MARKETING" ? () => onNavigate("materials", product) : undefined} />)}{current === stage && <em>Tasks: {stageTasks.filter((t) => t.is_completed).length}/{stageTasks.length}</em>}</div></div>;
	})}</div><button className="pipeline-edit">Edit</button></div>;
}

function TaskToggle({ task, onLabelClick }: { task: GtmTask; onLabelClick?: () => void }) {
	const fetcher = useFetcher(); const optimistic = fetcher.formData ? String(fetcher.formData.get("completed")) === "true" : !!task.is_completed;
	return <div className="task-row"><fetcher.Form method="post"><input name="intent" type="hidden" value="toggle-task" /><input name="id" type="hidden" value={task.id} /><input name="completed" type="hidden" value={String(!optimistic)} /><button className={optimistic ? "task-check done" : "task-check"}>{optimistic ? "✓" : "○"}</button></fetcher.Form><button className={onLabelClick ? "task-label linked" : "task-label"} onClick={onLabelClick}>{task.owner_role === "MARKETING" ? "📣" : task.owner_role === "PRODUCT" ? "👤" : ""} {task.task_name}</button></div>;
}

function MaterialsWorkspace({ products, materials }: { products: GtmProduct[]; materials: GtmMaterial[] }) {
	const types = [...new Set(materials.map((m) => m.material_type))]; const relevant = materials.filter((m) => products.some((p) => p.id === m.product_id)); const completed = relevant.filter((m) => m.status === "COMPLETED").length;
	return <><div className="metric-grid"><Metric icon="◫" label="Upcoming Products" value={products.length} /><Metric icon="✓" label="Completed Materials" value={completed} tone="green" /><Metric icon="!" label="Open Materials" value={relevant.filter((m) => m.status === "NOT_COMPLETED").length} tone="red" /></div><div className="section-bar"><div><h2>Upcoming Product Materials</h2><span>💡 Click a material cell to edit</span></div></div><div className="table-shell"><table className="data-table material-table"><thead><tr><th>Model</th><th>Product Name</th><th>Category</th>{types.map((x) => <th key={x}>{x}</th>)}<th>Launch Date</th><th>Action</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><span className="model-tag">{p.model}</span></td><td><b>{p.name}</b></td><td>{p.category || "—"}</td>{types.map((type) => <td key={type}><MaterialCell material={materials.find((m) => m.product_id === p.id && m.material_type === type)} /></td>)}<td>{p.planned_launch_date || "—"}</td><td><button className="secondary small">Launch</button></td></tr>)}</tbody></table></div></>;
}

function Metric({ icon, label, value, tone = "" }: { icon: string; label: string; value: number; tone?: string }) { return <div className={`metric ${tone}`}><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></div>; }

function MaterialCell({ material }: { material?: GtmMaterial }) {
	const fetcher = useFetcher(); if (!material) return <span className="material-symbol muted">—</span>;
	const status = fetcher.formData ? String(fetcher.formData.get("status")) : material.status;
	return <fetcher.Form method="post" className="material-cell"><input name="intent" type="hidden" value="material-status" /><input name="id" type="hidden" value={material.id} /><select aria-label={`Edit ${material.material_type}`} name="status" value={status} onChange={(e) => fetcher.submit(e.currentTarget.form)}><option value="COMPLETED">Completed</option><option value="NOT_COMPLETED">Not Completed</option><option value="NOT_REQUIRED">Not Required</option></select><strong className={status === "COMPLETED" ? "ok" : status === "NOT_REQUIRED" ? "muted" : "bad"}>{status === "COMPLETED" ? "✓" : status === "NOT_REQUIRED" ? "—" : "✕"}</strong>{status === "NOT_COMPLETED" && <small>DDL: {material.deadline || "—"}<br />Owner: {material.owner || "—"}</small>}<i>✎</i></fetcher.Form>;
}

function PrototypeWorkspace({ products, requirements, typeFilter }: { products: GtmProduct[]; requirements: GtmRequirement[]; typeFilter: string }) {
	const visible = requirements.filter((r) => products.some((p) => p.id === r.product_id) && (!typeFilter || r.prototype_type === typeFilter));
	return <><div className="metric-grid"><Metric icon="◈" label="Prototype Requirements" value={visible.length} /><Metric icon="✓" label="Completed" value={visible.filter((r) => r.is_completed).length} tone="green" /><Metric icon="◷" label="In Progress" value={visible.filter((r) => !r.is_completed).length} /></div><div className="section-bar"><div><h2>Prototype Requirements</h2><span>{visible.length} linked project tasks</span></div></div><div className="table-shell"><table className="data-table prototype-table"><thead><tr><th>Model</th><th>Product Name</th><th>Sample Type</th><th>Project Stage</th><th>Required Quantity</th><th>ETA</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map((r) => <RequirementRow key={r.id} requirement={r} />)}</tbody></table></div>{!visible.length && <Empty text="No matching prototype requirements found." />}</>;
}

function RequirementRow({ requirement }: { requirement: GtmRequirement }) {
	const [editing, setEditing] = useState(false); const fetcher = useFetcher(); const status = requirement.is_completed ? "Completed" : "In Progress";
	return <tr className={editing ? "editing-row" : ""}><td><span className="model-tag">{requirement.model}</span></td><td><b>{requirement.product_name}</b></td><td>{requirement.prototype_type}</td><td>{requirement.stage_name}</td>{editing ? <td colSpan={4}><fetcher.Form method="post" className="inline-edit" onSubmit={() => setEditing(false)}><input name="intent" type="hidden" value="requirement" /><input name="id" type="hidden" value={requirement.id} /><label>Quantity<input min="1" name="quantity" type="number" defaultValue={requirement.required_quantity} /></label><label>ETA<input name="eta" type="date" defaultValue={requirement.eta || ""} /></label><button className="primary small">Save</button><button type="button" className="secondary small" onClick={() => setEditing(false)}>Cancel</button></fetcher.Form></td> : <><td>{requirement.required_quantity}</td><td>{requirement.eta || "—"}</td><td><span className={`status-badge ${status.toLowerCase().replace(" ", "-")}`}>{status}</span></td><td><button className="secondary small" onClick={() => setEditing(true)}>Edit</button></td></>}</tr>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>⌕</span><b>{text}</b><small>Try changing or clearing the filters.</small></div>; }
