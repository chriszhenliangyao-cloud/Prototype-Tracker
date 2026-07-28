export const GTM_STAGES = [
	"Project Confirm to Start",
	"DVT1",
	"DVT2",
	"Trial Production Start",
	"Mass Production",
	"Launch",
] as const;

export type GtmStageName = (typeof GTM_STAGES)[number];

export interface GtmProduct {
	id: string;
	model: string;
	name: string;
	category: string;
	launch_status: string;
	planned_launch_date: string | null;
	product_owner: string | null;
	marketing_project_manager: string | null;
}

export interface GtmStage {
	id: string;
	product_id: string;
	stage_name: GtmStageName;
	deadline: string | null;
	estimated_shipping_date: string | null;
}

export interface GtmTask {
	id: string;
	product_id: string;
	stage_name: GtmStageName;
	task_name: string;
	owner_role: "PRODUCT" | "MARKETING" | "GTM";
	prototype_type: string | null;
	is_completed: number;
	sort_order: number;
}

export interface GtmMaterial {
	id: string;
	product_id: string;
	material_type: string;
	status: string;
	deadline: string | null;
	owner: string | null;
}

export interface GtmRequirement {
	id: string;
	product_id: string;
	source_task_id: string;
	required_quantity: number;
	eta: string | null;
	model: string;
	product_name: string;
	stage_name: GtmStageName;
	prototype_type: string;
	is_completed: number;
}

export interface GtmWorkspaceData {
	products: GtmProduct[];
	stages: GtmStage[];
	tasks: GtmTask[];
	materials: GtmMaterial[];
	requirements: GtmRequirement[];
}

export async function getGtmWorkspace(env: Env): Promise<GtmWorkspaceData> {
	const [products, stages, tasks, materials, requirements] = await Promise.all([
		env.DB.prepare(
			"SELECT * FROM gtm_product WHERE launch_status='UNLAUNCHED' ORDER BY planned_launch_date, model",
		).all<GtmProduct>(),
		env.DB.prepare(
			"SELECT * FROM gtm_project_stage ORDER BY product_id, rowid",
		).all<GtmStage>(),
		env.DB.prepare(
			"SELECT * FROM gtm_project_task ORDER BY product_id, sort_order, rowid",
		).all<GtmTask>(),
		env.DB.prepare(
			"SELECT * FROM gtm_material_task ORDER BY product_id, rowid",
		).all<GtmMaterial>(),
		env.DB.prepare(
			`SELECT r.*, p.model, p.name AS product_name,
			        t.stage_name, t.prototype_type, t.is_completed
			   FROM gtm_prototype_requirement r
			   JOIN gtm_product p ON p.id=r.product_id
			   JOIN gtm_project_task t ON t.id=r.source_task_id
			  WHERE p.launch_status='UNLAUNCHED'
			  ORDER BY p.model, t.sort_order, r.id`,
		).all<GtmRequirement>(),
	]);
	return {
		products: products.results,
		stages: stages.results,
		tasks: tasks.results,
		materials: materials.results,
		requirements: requirements.results,
	};
}

export async function toggleGtmTask(env: Env, id: string, completed: boolean) {
	await env.DB.prepare(
		"UPDATE gtm_project_task SET is_completed=? WHERE id=?",
	)
		.bind(completed ? 1 : 0, id)
		.run();
}

export async function updateGtmMaterial(
	env: Env,
	id: string,
	status: string,
) {
	if (!["COMPLETED", "NOT_COMPLETED", "NOT_REQUIRED"].includes(status)) {
		throw new Error("Invalid material status");
	}
	await env.DB.prepare(
		"UPDATE gtm_material_task SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
	)
		.bind(status, id)
		.run();
}

export async function updateGtmRequirement(
	env: Env,
	id: string,
	quantity: number,
	eta: string,
) {
	if (!Number.isInteger(quantity) || quantity < 1) {
		throw new Error("Required quantity must be a positive integer");
	}
	await env.DB.prepare(
		"UPDATE gtm_prototype_requirement SET required_quantity=?, eta=? WHERE id=?",
	)
		.bind(quantity, eta || null, id)
		.run();
}

export function projectProgress(tasks: GtmTask[]) {
	if (!tasks.length) return 100;
	const done = tasks.filter((task) => !!task.is_completed).length;
	return Math.round((done / tasks.length) * 100);
}

export function currentStage(tasks: GtmTask[]): GtmStageName | null {
	for (const stage of GTM_STAGES) {
		if (tasks.some((task) => task.stage_name === stage && !task.is_completed)) {
			return stage;
		}
	}
	return null;
}

export function projectStatus(tasks: GtmTask[], stages: GtmStage[]) {
	if (tasks.length && tasks.every((task) => !!task.is_completed)) return "Completed";
	const today = new Date().toISOString().slice(0, 10);
	const current = currentStage(tasks);
	const currentDeadline = stages.find((stage) => stage.stage_name === current)?.deadline;
	if (currentDeadline && currentDeadline <= today) return "Delayed";
	if (currentDeadline) {
		const days = Math.ceil(
			(new Date(currentDeadline).getTime() - new Date(today).getTime()) / 86400000,
		);
		if (days <= 3) return "At Risk";
	}
	return "On Track";
}

