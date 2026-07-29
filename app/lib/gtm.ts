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

export interface GtmDelayRecord {
	id: string;
	product_id: string;
	stage_name: string;
	task_name: string;
	original_deadline: string | null;
	delayed_until: string | null;
	notes: string | null;
}

export interface GtmWorkspaceData {
	products: GtmProduct[];
	stages: GtmStage[];
	tasks: GtmTask[];
	materials: GtmMaterial[];
	requirements: GtmRequirement[];
	delayRecords: GtmDelayRecord[];
	usingFallback?: boolean;
}

export async function getGtmWorkspace(env: Env): Promise<GtmWorkspaceData> {
	try {
		const [products, stages, tasks, materials, requirements, delayRecords] = await Promise.all([
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
			env.DB.prepare(
				"SELECT * FROM gtm_delay_record ORDER BY product_id, original_deadline DESC, id",
			).all<GtmDelayRecord>(),
		]);
		return {
			products: products.results,
			stages: stages.results,
			tasks: tasks.results,
			materials: materials.results,
			requirements: requirements.results,
			delayRecords: delayRecords.results,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("no such table") || !message.includes("gtm_")) throw error;
		return getGtmFallbackData();
	}
}

function getGtmFallbackData(): GtmWorkspaceData {
	const products: GtmProduct[] = [
		{ id: "gtm-p61l-p1", model: "P61L-P1", name: "Pocket 10K", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-07-31", product_owner: "Ivy", marketing_project_manager: "Ivy" },
		{ id: "gtm-p61l-p2", model: "P61L-P2", name: "Pocket 10K 45W", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-07-30", product_owner: "Ivy", marketing_project_manager: "Ivy" },
		{ id: "gtm-p51l-p2", model: "P51L-P2", name: "Pocket 20K 45W", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-08-18", product_owner: "Ivy", marketing_project_manager: "Ivy" },
		{ id: "gtm-pm61-black", model: "PM61-Black", name: "MagPro Slim 10K Qi2.2 - Black", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-09-05", product_owner: "Ivy", marketing_project_manager: "Ivy" },
		{ id: "gtm-px51", model: "PX51", name: "MagPro Neo 10K Qi2.0", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-09-22", product_owner: "Ivy", marketing_project_manager: "Ivy" },
	];
	const deadlines = [
		["2026-07-03", "2026-07-10", "2026-07-18", "2026-07-23", "2026-07-28", "2026-07-31"],
		["2026-07-02", "2026-07-09", "2026-07-17", "2026-07-22", "2026-07-27", "2026-07-30"],
		["2026-07-28", "2026-08-01", "2026-08-06", "2026-08-10", "2026-08-14", "2026-08-18"],
		["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-05"],
		["2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-15", "2026-09-22"],
	];
	const stages: GtmStage[] = products.flatMap((product, productIndex) =>
		GTM_STAGES.map((stage, index) => ({
			id: `fallback-stage-${productIndex}-${index}`,
			product_id: product.id,
			stage_name: stage,
			deadline: deadlines[productIndex][index],
			estimated_shipping_date: stage === "Mass Production" ? "2026-07-29" : null,
		})),
	);
	const taskTemplates = [
		["Project Confirm to Start", "Dummy", "PRODUCT", "Dummy"],
		["DVT1", "Engineering Sample", "PRODUCT", "Engineering Sample"],
		["DVT1", "Product Introduction Slides", "MARKETING", null],
		["DVT2", "Packaging Design Final Draft", "MARKETING", null],
		["DVT2", "Product Sheet", "PRODUCT", null],
		["Trial Production Start", "Preproduction Sample", "PRODUCT", "Preproduction Sample"],
		["Trial Production Start", "Product & Packaging Images & Manual", "MARKETING", null],
		["Mass Production", "Mass Production Sample", "PRODUCT", "Mass Production Sample"],
		["Mass Production", "POSM", "MARKETING", null],
		["Launch", "Social Copy & PR Release", "MARKETING", null],
	] as const;
	const tasks: GtmTask[] = products.flatMap((product, productIndex) =>
		taskTemplates.map(([stage, name, role, prototype], index) => ({
			id: `fallback-task-${productIndex}-${index}`,
			product_id: product.id,
			stage_name: stage,
			task_name: name,
			owner_role: role,
			prototype_type: prototype,
			is_completed: index < [9, 6, 5, 3, 1][productIndex] ? 1 : 0,
			sort_order: (index + 1) * 10,
		})),
	);
	const materialTypes = [
		"Product Introduction Slides",
		"Packaging Design Final Draft",
		"Product Sheet",
		"Product & Packaging Images & Manual",
		"POSM",
		"Social Copy & PR Release",
		"Launch Assets Archive",
	];
	const materials: GtmMaterial[] = products.flatMap((product, productIndex) =>
		materialTypes.map((type, index) => ({
			id: `fallback-material-${productIndex}-${index}`,
			product_id: product.id,
			material_type: type,
			status: index < [4, 3, 3, 2, 1][productIndex] ? "COMPLETED" : index === 6 ? "NOT_REQUIRED" : "NOT_COMPLETED",
			deadline: deadlines[productIndex][Math.min(index + 1, 5)],
			owner: index === 2 ? "Product" : "Ivy",
		})),
	);
	const requirements: GtmRequirement[] = tasks
		.filter((task) => !!task.prototype_type)
		.map((task, index) => {
			const product = products.find((item) => item.id === task.product_id)!;
			return {
				id: `fallback-requirement-${index}`,
				product_id: task.product_id,
				source_task_id: task.id,
				required_quantity: task.prototype_type === "Dummy" ? 2 : task.prototype_type === "Engineering Sample" ? 4 : task.prototype_type === "Preproduction Sample" ? 6 : 8,
				eta: stages.find((stage) => stage.product_id === task.product_id && stage.stage_name === task.stage_name)?.deadline || null,
				model: product.model,
				product_name: product.name,
				stage_name: task.stage_name,
				prototype_type: task.prototype_type!,
				is_completed: task.is_completed,
			};
		});
	const delayRecords: GtmDelayRecord[] = tasks
		.filter((task) => !task.is_completed)
		.slice(0, 8)
		.map((task, index) => ({
			id: `fallback-delay-${index}`,
			product_id: task.product_id,
			stage_name: task.stage_name,
			task_name: task.task_name,
			original_deadline: stages.find((stage) => stage.product_id === task.product_id && stage.stage_name === task.stage_name)?.deadline || null,
			delayed_until: null,
			notes: null,
		}));
	return { products, stages, tasks, materials, requirements, delayRecords, usingFallback: true };
}

export async function toggleGtmTask(env: Env, id: string, completed: boolean) {
	await env.DB.prepare(
		"UPDATE gtm_project_task SET is_completed=? WHERE id=?",
	)
		.bind(completed ? 1 : 0, id)
		.run();
}

export async function launchGtmProduct(env: Env, id: string) {
	await env.DB.prepare(
		"UPDATE gtm_product SET launch_status='LAUNCHED', updated_at=CURRENT_TIMESTAMP WHERE id=?",
	)
		.bind(id)
		.run();
}

export async function updateGtmOwners(env: Env, productOwner: string, marketingManager: string) {
	await env.DB.prepare(
		`UPDATE gtm_product
		    SET product_owner=?, marketing_project_manager=?, updated_at=CURRENT_TIMESTAMP
		  WHERE launch_status='UNLAUNCHED'`,
	)
		.bind(productOwner, marketingManager)
		.run();
}

export async function updateGtmDelayRecord(env: Env, id: string, delayedUntil: string, notes: string) {
	if (!id.trim()) throw new Error("Delay record id is required");
	await env.DB.prepare(
		"UPDATE gtm_delay_record SET delayed_until=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
	)
		.bind(delayedUntil || null, notes.trim() || null, id)
		.run();
}

export async function updateGtmProject(
	env: Env,
	productId: string,
	stages: Array<{ id: string; deadline: string }>,
	tasks: Array<{
		id: string;
		stage_name: GtmStageName;
		task_name: string;
		owner_role: "PRODUCT" | "MARKETING" | "GTM";
		prototype_type: string | null;
		is_completed: number;
		sort_order: number;
	}>,
) {
	const existing = await env.DB.prepare(
		"SELECT id FROM gtm_project_task WHERE product_id=?",
	).bind(productId).all<{ id: string }>();
	const incomingIds = new Set(tasks.map((task) => task.id));
	const statements = [
		...stages.map((stage) =>
			env.DB.prepare("UPDATE gtm_project_stage SET deadline=? WHERE id=? AND product_id=?")
				.bind(stage.deadline || null, stage.id, productId)),
		...existing.results
			.filter((task) => !incomingIds.has(task.id))
			.map((task) => env.DB.prepare("DELETE FROM gtm_project_task WHERE id=? AND product_id=?").bind(task.id, productId)),
		...tasks.map((task) =>
			env.DB.prepare(
				`INSERT INTO gtm_project_task
				   (id,product_id,stage_name,task_name,owner_role,prototype_type,is_completed,sort_order)
				 VALUES (?,?,?,?,?,?,?,?)
				 ON CONFLICT(id) DO UPDATE SET
				   stage_name=excluded.stage_name, task_name=excluded.task_name,
				   owner_role=excluded.owner_role, prototype_type=excluded.prototype_type,
				   is_completed=excluded.is_completed, sort_order=excluded.sort_order`,
			).bind(
				task.id, productId, task.stage_name, task.task_name.trim(),
				task.owner_role, task.prototype_type, task.is_completed ? 1 : 0, task.sort_order,
			)),
	];
	if (statements.length) await env.DB.batch(statements);
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
