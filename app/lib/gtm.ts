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
	project_status: string | null;
	status_review_stage: string | null;
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

export interface GtmPrototypeAllocation {
	requirement_id: string;
	country: string;
	channel: string;
	quantity: number;
}

export interface GtmDelayRecord {
	id: string;
	product_id: string;
	stage_name: string;
	task_name: string;
	original_deadline: string | null;
	delayed_until: string | null;
	schedule_impact: string | null;
	notes: string | null;
}

export interface GtmWorkspaceData {
	products: GtmProduct[];
	stages: GtmStage[];
	tasks: GtmTask[];
	materials: GtmMaterial[];
	requirements: GtmRequirement[];
	allocations: GtmPrototypeAllocation[];
	delayRecords: GtmDelayRecord[];
	usingFallback?: boolean;
}

export interface GtmExcelImport {
	products: Array<{
		model: string;
		name: string;
		category: string;
		launchDate: string;
		productOwner: string;
		marketingManager: string;
	}>;
	stages: Array<{ model: string; stage: string; deadline: string }>;
	tasks: Array<{
		model: string;
		stage: string;
		name: string;
		ownerRole: string;
		prototypeType: string;
		completed: boolean;
		requiredQuantity: number;
		eta: string;
	}>;
	materials: Array<{
		model: string;
		type: string;
		status: string;
		deadline: string;
		owner: string;
	}>;
}

export interface NewGtmProduct {
	model: string;
	name: string;
	category: string;
	launchDate: string;
	productOwner: string;
	marketingManager: string;
}

export async function getGtmWorkspace(env: Env): Promise<GtmWorkspaceData> {
	try {
		await syncGtmDelayRecords(env);
		const [products, stages, tasks, materials, requirements, allocations, delayRecords] = await Promise.all([
			env.DB.prepare(
				`SELECT * FROM gtm_product
				  ORDER BY CASE launch_status WHEN 'UNLAUNCHED' THEN 0 ELSE 1 END,
				           planned_launch_date, model`,
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
				`SELECT r.id AS requirement_id,
				        COALESCE(NULLIF(TRIM(proto.country), ''), '—') AS country,
				        COALESCE(NULLIF(TRIM(proto.customer), ''), '—') AS channel,
				        SUM(proto.qty) AS quantity
				   FROM gtm_prototype_requirement r
				   JOIN gtm_product p ON p.id=r.product_id
				   JOIN gtm_project_task t ON t.id=r.source_task_id
				   JOIN prototype proto
				     ON lower(TRIM(proto.model))=lower(TRIM(p.model))
				    AND lower(TRIM(proto.sample_type))=lower(TRIM(t.prototype_type))
				  WHERE proto.qty>0
				    AND NULLIF(TRIM(proto.customer), '') IS NOT NULL
				  GROUP BY r.id,
				           COALESCE(NULLIF(TRIM(proto.country), ''), '—'),
				           COALESCE(NULLIF(TRIM(proto.customer), ''), '—')
				  ORDER BY r.id, country, channel`,
			).all<GtmPrototypeAllocation>(),
			getGtmDelayRecords(env),
		]);
		return {
			products: products.results,
			stages: stages.results,
			tasks: tasks.results,
			materials: materials.results,
			requirements: requirements.results,
			allocations: allocations.results,
			delayRecords,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("no such table") || !message.includes("gtm_")) throw error;
		return getGtmFallbackData();
	}
}

async function getGtmDelayRecords(env: Env): Promise<GtmDelayRecord[]> {
	try {
		const records = await env.DB.prepare(
			`SELECT id, product_id, stage_name, task_name,
			        original_deadline, delayed_until, schedule_impact, notes
			   FROM gtm_delay_record
			  WHERE deleted_at IS NULL
			  ORDER BY product_id, created_at, id`,
		).all<GtmDelayRecord>();
		return records.results;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("no such table") && message.includes("gtm_delay_record")) return [];
		throw error;
	}
}

export async function syncGtmDelayRecords(env: Env) {
	const today = new Date().toISOString().slice(0, 10);
	try {
		await env.DB.prepare(
			`INSERT OR IGNORE INTO gtm_delay_record
			   (id, product_id, stage_name, task_name, original_deadline)
			 SELECT 'delay-auto-' || t.id,
			        t.product_id,
			        t.stage_name,
			        t.task_name,
			        s.deadline
			   FROM gtm_project_task t
			   JOIN gtm_project_stage s
			     ON s.product_id=t.product_id
			    AND s.stage_name=t.stage_name
			  WHERE t.is_completed=0
			    AND s.deadline IS NOT NULL
			    AND s.deadline<=?`,
		)
			.bind(today)
			.run();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("no such table") && message.includes("gtm_delay_record")) return;
		if (message.includes("no column named deleted_at")) return;
		throw error;
	}
}

function getGtmFallbackData(): GtmWorkspaceData {
	const products: GtmProduct[] = [
		{ id: "gtm-p61l-p1", model: "P61L-P1", name: "Pocket 10K", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-07-31", product_owner: "Ivy", marketing_project_manager: "Ivy", project_status: null, status_review_stage: null },
		{ id: "gtm-p61l-p2", model: "P61L-P2", name: "Pocket 10K 45W", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-07-30", product_owner: "Ivy", marketing_project_manager: "Ivy", project_status: null, status_review_stage: null },
		{ id: "gtm-p51l-p2", model: "P51L-P2", name: "Pocket 20K 45W", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-08-18", product_owner: "Ivy", marketing_project_manager: "Ivy", project_status: null, status_review_stage: null },
		{ id: "gtm-pm61-black", model: "PM61-Black", name: "MagPro Slim 10K Qi2.2 - Black", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-09-05", product_owner: "Ivy", marketing_project_manager: "Ivy", project_status: null, status_review_stage: null },
		{ id: "gtm-px51", model: "PX51", name: "MagPro Neo 10K Qi2.0", category: "Power Bank", launch_status: "UNLAUNCHED", planned_launch_date: "2026-09-22", product_owner: "Ivy", marketing_project_manager: "Ivy", project_status: null, status_review_stage: null },
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
		.filter((task) => {
			if (task.is_completed) return false;
			const deadline = stages.find(
				(stage) => stage.product_id === task.product_id && stage.stage_name === task.stage_name,
			)?.deadline;
			return !!deadline && deadline <= new Date().toISOString().slice(0, 10);
		})
		.map((task, index) => ({
			id: `fallback-delay-${index}`,
			product_id: task.product_id,
			stage_name: task.stage_name,
			task_name: task.task_name,
			original_deadline: stages.find((stage) => stage.product_id === task.product_id && stage.stage_name === task.stage_name)?.deadline || null,
			delayed_until: null,
			schedule_impact: null,
			notes: null,
		}));
	return { products, stages, tasks, materials, requirements, allocations: [], delayRecords, usingFallback: true };
}

export async function toggleGtmTask(env: Env, id: string, completed: boolean) {
	if (!id.trim()) throw new Error("Task id is required");
	await syncGtmDelayRecords(env);
	const task = await env.DB.prepare(
		"SELECT product_id, task_name, owner_role FROM gtm_project_task WHERE id=?",
	).bind(id).first<{ product_id: string; task_name: string; owner_role: string }>();
	if (!task) throw new Error("Task was not found");
	const statements = [
		env.DB.prepare("UPDATE gtm_project_task SET is_completed=? WHERE id=?")
			.bind(completed ? 1 : 0, id),
	];
	if (!completed) {
		statements.push(
			env.DB.prepare(
				`UPDATE gtm_product
				    SET project_status=NULL,
				        status_review_stage=NULL,
				        updated_at=CURRENT_TIMESTAMP
				  WHERE id=?`,
			).bind(task.product_id),
		);
	}
	if (task.owner_role === "MARKETING") {
		statements.push(
			env.DB.prepare(
				`INSERT INTO gtm_material_task
				   (id,product_id,material_type,status,deadline,owner,updated_at)
				 VALUES (?,?,?,?,NULL,NULL,CURRENT_TIMESTAMP)
				 ON CONFLICT(product_id,material_type) DO UPDATE SET
				   status=excluded.status, updated_at=CURRENT_TIMESTAMP`,
			).bind(
				`material-${id}`, task.product_id, task.task_name,
				completed ? "COMPLETED" : "NOT_COMPLETED",
			),
		);
	}
	await env.DB.batch(statements);
}

export async function launchGtmProduct(env: Env, id: string) {
	const result = await env.DB.prepare(
		"UPDATE gtm_product SET launch_status='LAUNCHED', updated_at=CURRENT_TIMESTAMP WHERE id=?",
	)
		.bind(id)
		.run();
	if (result.meta.changes !== 1) throw new Error("Product was not found");
}

export async function returnGtmProductToUpcoming(env: Env, id: string) {
	const result = await env.DB.prepare(
		"UPDATE gtm_product SET launch_status='UNLAUNCHED', updated_at=CURRENT_TIMESTAMP WHERE id=?",
	)
		.bind(id)
		.run();
	if (result.meta.changes !== 1) throw new Error("Product was not found");
}

export async function createGtmProduct(env: Env, input: NewGtmProduct) {
	const model = input.model.trim();
	const name = input.name.trim();
	const category = input.category.trim();
	const launchDate = input.launchDate.trim();
	if (!model || !name || !category || !launchDate) {
		throw new Error("Model, Product Name, Category, and Launch Date are required");
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate)) {
		throw new Error("Launch Date must use YYYY-MM-DD");
	}
	const duplicate = await env.DB.prepare(
		"SELECT id FROM gtm_product WHERE lower(model)=lower(?)",
	).bind(model).first<{ id: string }>();
	if (duplicate) throw new Error(`Model ${model} already exists`);

	const productId = `gtm-${crypto.randomUUID()}`;
	const taskTemplates: Array<{
		stage: GtmStageName;
		name: string;
		role: GtmTask["owner_role"];
		prototype: string | null;
	}> = [
		{ stage: "Project Confirm to Start", name: "Dummy", role: "PRODUCT", prototype: "Dummy" },
		{ stage: "DVT1", name: "Product Introduction Slides", role: "MARKETING", prototype: null },
		{ stage: "DVT1", name: "Engineering Sample", role: "PRODUCT", prototype: "Engineering Sample" },
		{ stage: "DVT2", name: "Packaging Design Final Draft", role: "MARKETING", prototype: null },
		{ stage: "DVT2", name: "Product Sheet", role: "PRODUCT", prototype: null },
		{ stage: "Trial Production Start", name: "Preproduction Sample", role: "PRODUCT", prototype: "Preproduction Sample" },
		{ stage: "Trial Production Start", name: "Product & Packaging Images & Manual", role: "MARKETING", prototype: null },
		{ stage: "Mass Production", name: "Mass Production Sample", role: "PRODUCT", prototype: "Mass Production Sample" },
		{ stage: "Mass Production", name: "POSM", role: "MARKETING", prototype: null },
		{ stage: "Launch", name: "Social Copy & PR Release", role: "MARKETING", prototype: null },
	];
	const statements: D1PreparedStatement[] = [
		env.DB.prepare(
			`INSERT INTO gtm_product
			   (id,model,name,category,launch_status,planned_launch_date,
			    product_owner,marketing_project_manager)
			 VALUES (?,?,?,?,'UNLAUNCHED',?,?,?)`,
		).bind(
			productId,
			model,
			name,
			category,
			launchDate,
			input.productOwner.trim() || null,
			input.marketingManager.trim() || null,
		),
		...GTM_STAGES.map((stage, index) =>
			env.DB.prepare(
				`INSERT INTO gtm_project_stage
				   (id,product_id,stage_name,deadline,estimated_shipping_date)
				 VALUES (?,?,?,NULL,NULL)`,
			).bind(`stage-${productId}-${index + 1}`, productId, stage)),
	];
	for (const [index, task] of taskTemplates.entries()) {
		const taskId = `task-${productId}-${index + 1}`;
		statements.push(
			env.DB.prepare(
				`INSERT INTO gtm_project_task
				   (id,product_id,stage_name,task_name,owner_role,
				    prototype_type,is_completed,sort_order)
				 VALUES (?,?,?,?,?,?,0,?)`,
			).bind(
				taskId,
				productId,
				task.stage,
				task.name,
				task.role,
				task.prototype,
				(index + 1) * 10,
			),
		);
		if (task.prototype) {
			const quantity =
				task.prototype === "Dummy" ? 2
					: task.prototype === "Engineering Sample" ? 4
						: task.prototype === "Preproduction Sample" ? 6 : 8;
			statements.push(
				env.DB.prepare(
					`INSERT INTO gtm_prototype_requirement
					   (id,product_id,source_task_id,required_quantity,eta)
					 VALUES (?,?,?,?,NULL)`,
				).bind(`requirement-${taskId}`, productId, taskId, quantity),
			);
		}
		if (task.role === "MARKETING" || task.name === "Product Sheet") {
			statements.push(
				env.DB.prepare(
					`INSERT INTO gtm_material_task
					   (id,product_id,material_type,status,deadline,owner)
					 VALUES (?,?,?,'NOT_COMPLETED',NULL,?)`,
				).bind(
					`material-${taskId}`,
					productId,
					task.name,
					task.role === "MARKETING"
						? input.marketingManager.trim() || null
						: input.productOwner.trim() || null,
				),
			);
		}
	}
	await env.DB.batch(statements);
	return { id: productId, model };
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

export async function updateGtmDelayRecord(
	env: Env,
	id: string,
	delayedUntil: string,
	scheduleImpact: string,
	notes: string,
) {
	if (!id.trim()) throw new Error("Delay record id is required");
	await env.DB.prepare(
		`UPDATE gtm_delay_record
		    SET delayed_until=?, schedule_impact=?, notes=?,
		        updated_at=CURRENT_TIMESTAMP
		  WHERE id=? AND deleted_at IS NULL`,
	)
		.bind(
			delayedUntil || null,
			scheduleImpact.trim() || null,
			notes.trim() || null,
			id,
		)
		.run();
}

export async function deleteGtmDelayRecord(env: Env, id: string) {
	if (!id.trim()) throw new Error("Delay record id is required");
	const result = await env.DB.prepare(
		`UPDATE gtm_delay_record
		    SET deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
		  WHERE id=? AND deleted_at IS NULL`,
	)
		.bind(id)
		.run();
	if (result.meta.changes !== 1) throw new Error("Delay record was not found");
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
		"SELECT id, task_name, owner_role, is_completed FROM gtm_project_task WHERE product_id=?",
	).bind(productId).all<{
		id: string;
		task_name: string;
		owner_role: string;
		is_completed: number;
	}>();
	const existingStages = await env.DB.prepare(
		"SELECT id, stage_name, deadline FROM gtm_project_stage WHERE product_id=?",
	).bind(productId).all<{
		id: string;
		stage_name: string;
		deadline: string | null;
	}>();
	const incomingIds = new Set(tasks.map((task) => task.id));
	const reopenedTask = tasks.some((task) => {
		const previous = existing.results.find((item) => item.id === task.id);
		return !!previous?.is_completed && !task.is_completed;
	});
	const incomingMarketingNames = new Set(
		tasks.filter((task) => task.owner_role === "MARKETING").map((task) => task.task_name.trim()),
	);
	const ddlChangeRecords = stages.flatMap((stage, index) => {
		const previous = existingStages.results.find((item) => item.id === stage.id);
		const nextDeadline = stage.deadline || null;
		if (!previous?.deadline || previous.deadline === nextDeadline) return [];
		return [
			env.DB.prepare(
				`INSERT INTO gtm_delay_record
				   (id, product_id, stage_name, task_name,
				    original_deadline, delayed_until)
				 VALUES (?, ?, ?, 'Stage DDL Change', ?, ?)`,
			).bind(
				`delay-ddl-${stage.id}-${Date.now()}-${index}`,
				productId,
				previous.stage_name,
				previous.deadline,
				nextDeadline,
			),
		];
	});
	const statements = [
		...ddlChangeRecords,
		...stages.map((stage) =>
			env.DB.prepare("UPDATE gtm_project_stage SET deadline=? WHERE id=? AND product_id=?")
				.bind(stage.deadline || null, stage.id, productId)),
		env.DB.prepare(
			`INSERT OR IGNORE INTO gtm_delay_record
			   (id, product_id, stage_name, task_name, original_deadline)
			 SELECT 'delay-auto-' || t.id,
			        t.product_id,
			        t.stage_name,
			        t.task_name,
			        s.deadline
			   FROM gtm_project_task t
			   JOIN gtm_project_stage s
			     ON s.product_id=t.product_id
			    AND s.stage_name=t.stage_name
			  WHERE t.product_id=?
			    AND t.is_completed=0
			    AND s.deadline IS NOT NULL
			    AND s.deadline<=?`,
		).bind(productId, new Date().toISOString().slice(0, 10)),
		...existing.results
			.filter((task) => !incomingIds.has(task.id))
			.map((task) => env.DB.prepare("DELETE FROM gtm_project_task WHERE id=? AND product_id=?").bind(task.id, productId)),
		...existing.results
			.filter((task) => task.owner_role === "MARKETING" && !incomingMarketingNames.has(task.task_name))
			.map((task) =>
				env.DB.prepare(
					`UPDATE gtm_material_task
					    SET status='NOT_REQUIRED', updated_at=CURRENT_TIMESTAMP
					  WHERE product_id=? AND material_type=?`,
				).bind(productId, task.task_name)),
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
		...tasks
			.filter((task) => task.owner_role === "MARKETING")
			.map((task) =>
				env.DB.prepare(
					`INSERT INTO gtm_material_task
					   (id,product_id,material_type,status,deadline,owner,updated_at)
					 VALUES (?,?,?,?,NULL,NULL,CURRENT_TIMESTAMP)
					 ON CONFLICT(product_id,material_type) DO UPDATE SET
					   status=excluded.status, updated_at=CURRENT_TIMESTAMP`,
				).bind(
					`material-${task.id}`,
					productId,
					task.task_name.trim(),
					task.is_completed ? "COMPLETED" : "NOT_COMPLETED",
				)),
		...(reopenedTask ? [
			env.DB.prepare(
				`UPDATE gtm_product
				    SET project_status=NULL,
				        status_review_stage=NULL,
				        updated_at=CURRENT_TIMESTAMP
				  WHERE id=?`,
			).bind(productId),
		] : []),
	];
	if (statements.length) await env.DB.batch(statements);
}

export async function importGtmWorkbook(env: Env, input: GtmExcelImport) {
	const date = (value: string, label: string) => {
		const normalized = value.trim();
		if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
			throw new Error(`${label} must use YYYY-MM-DD`);
		}
		return normalized || null;
	};
	const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
	const products = await env.DB.prepare("SELECT id, model FROM gtm_product").all<{ id: string; model: string }>();
	const productIds = new Map(products.results.map((product) => [product.model.trim().toLowerCase(), product.id]));
	const normalizedProducts = new Map<string, GtmExcelImport["products"][number]>();
	for (const product of input.products) {
		const model = product.model.trim();
		if (!model || !product.name.trim()) throw new Error("Products requires Model and Product Name");
		normalizedProducts.set(model.toLowerCase(), { ...product, model });
		if (!productIds.has(model.toLowerCase())) productIds.set(model.toLowerCase(), `gtm-import-${slug(model)}`);
	}
	const resolveProduct = (model: string) => {
		const id = productIds.get(model.trim().toLowerCase());
		if (!id) throw new Error(`Unknown product model: ${model || "(blank)"}`);
		return id;
	};
	const existingStages = await env.DB.prepare(
		"SELECT id, product_id, stage_name FROM gtm_project_stage",
	).all<{ id: string; product_id: string; stage_name: string }>();
	const existingTasks = await env.DB.prepare(
		"SELECT id, product_id, stage_name, task_name FROM gtm_project_task",
	).all<{ id: string; product_id: string; stage_name: string; task_name: string }>();
	const existingRequirements = await env.DB.prepare(
		"SELECT id, source_task_id FROM gtm_prototype_requirement",
	).all<{ id: string; source_task_id: string }>();
	const validStages = new Set<string>(GTM_STAGES);
	const validRoles = new Set(["PRODUCT", "MARKETING", "GTM"]);
	const validMaterialStatuses = new Set(["COMPLETED", "NOT_COMPLETED", "NOT_REQUIRED"]);
	const statements: D1PreparedStatement[] = [];
	for (const product of normalizedProducts.values()) {
		const id = resolveProduct(product.model);
		statements.push(env.DB.prepare(
			`INSERT INTO gtm_product
			   (id,model,name,category,launch_status,planned_launch_date,product_owner,marketing_project_manager,updated_at)
			 VALUES (?,?,?,?, 'UNLAUNCHED',?,?,?,CURRENT_TIMESTAMP)
			 ON CONFLICT(model) DO UPDATE SET
			   name=excluded.name, category=excluded.category,
			   planned_launch_date=excluded.planned_launch_date,
			   product_owner=excluded.product_owner,
			   marketing_project_manager=excluded.marketing_project_manager,
			   updated_at=CURRENT_TIMESTAMP`,
		).bind(
			id, product.model, product.name.trim(), product.category.trim(),
			date(product.launchDate, `${product.model} Launch Date`),
			product.productOwner.trim() || null, product.marketingManager.trim() || null,
		));
	}
	for (const [index, stage] of input.stages.entries()) {
		const productId = resolveProduct(stage.model);
		if (!validStages.has(stage.stage)) throw new Error(`Invalid stage: ${stage.stage}`);
		const existing = existingStages.results.find(
			(item) => item.product_id === productId && item.stage_name === stage.stage,
		);
		statements.push(env.DB.prepare(
			`INSERT INTO gtm_project_stage (id,product_id,stage_name,deadline)
			 VALUES (?,?,?,?)
			 ON CONFLICT(product_id,stage_name) DO UPDATE SET deadline=excluded.deadline`,
		).bind(
			existing?.id || `stage-import-${slug(productId)}-${index}`,
			productId, stage.stage, date(stage.deadline, `${stage.model} ${stage.stage} DDL`),
		));
	}
	for (const [index, task] of input.tasks.entries()) {
		const productId = resolveProduct(task.model);
		const stage = task.stage as GtmStageName;
		const role = task.ownerRole.trim().toUpperCase();
		if (!validStages.has(stage)) throw new Error(`Invalid stage: ${task.stage}`);
		if (!task.name.trim()) throw new Error("Tasks requires Task Name");
		if (!validRoles.has(role)) throw new Error(`Invalid Owner Role: ${task.ownerRole}`);
		const existing = existingTasks.results.find(
			(item) => item.product_id === productId && item.stage_name === stage && item.task_name === task.name.trim(),
		);
		const taskId = existing?.id || `task-import-${slug(productId)}-${index}`;
		statements.push(env.DB.prepare(
			`INSERT INTO gtm_project_task
			   (id,product_id,stage_name,task_name,owner_role,prototype_type,is_completed,sort_order)
			 VALUES (?,?,?,?,?,?,?,?)
			 ON CONFLICT(id) DO UPDATE SET
			   stage_name=excluded.stage_name, task_name=excluded.task_name,
			   owner_role=excluded.owner_role, prototype_type=excluded.prototype_type,
			   is_completed=excluded.is_completed, sort_order=excluded.sort_order`,
		).bind(
			taskId, productId, stage, task.name.trim(), role,
			task.prototypeType.trim() || null, task.completed ? 1 : 0, (index + 1) * 10,
		));
		const existingRequirement = existingRequirements.results.find(
			(requirement) => requirement.source_task_id === taskId,
		);
		if (task.prototypeType.trim()) {
			if (!Number.isInteger(task.requiredQuantity) || task.requiredQuantity < 1) {
				throw new Error(`${task.model} ${task.name} Required Quantity must be a positive integer`);
			}
			statements.push(env.DB.prepare(
				`INSERT INTO gtm_prototype_requirement
				   (id,product_id,source_task_id,required_quantity,eta)
				 VALUES (?,?,?,?,?)
				 ON CONFLICT(source_task_id) DO UPDATE SET
				   product_id=excluded.product_id,
				   required_quantity=excluded.required_quantity,
				   eta=excluded.eta`,
			).bind(
				existingRequirement?.id || `requirement-${taskId}`,
				productId, taskId, task.requiredQuantity,
				date(task.eta, `${task.model} ${task.name} ETA`),
			));
		} else if (existingRequirement) {
			statements.push(
				env.DB.prepare("DELETE FROM gtm_prototype_requirement WHERE source_task_id=?").bind(taskId),
			);
		}
		if (role === "MARKETING") {
			statements.push(env.DB.prepare(
				`INSERT INTO gtm_material_task
				   (id,product_id,material_type,status,deadline,owner,updated_at)
				 VALUES (?,?,?,?,NULL,NULL,CURRENT_TIMESTAMP)
				 ON CONFLICT(product_id,material_type) DO UPDATE SET
				   status=excluded.status, updated_at=CURRENT_TIMESTAMP`,
			).bind(
				`material-${taskId}`, productId, task.name.trim(),
				task.completed ? "COMPLETED" : "NOT_COMPLETED",
			));
		}
	}
	for (const [index, material] of input.materials.entries()) {
		const productId = resolveProduct(material.model);
		const status = material.status.trim().toUpperCase().replaceAll(" ", "_");
		if (!material.type.trim()) throw new Error("Materials requires Material Type");
		if (!validMaterialStatuses.has(status)) throw new Error(`Invalid material status: ${material.status}`);
		statements.push(env.DB.prepare(
			`INSERT INTO gtm_material_task
			   (id,product_id,material_type,status,deadline,owner,updated_at)
			 VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
			 ON CONFLICT(product_id,material_type) DO UPDATE SET
			   status=excluded.status, deadline=excluded.deadline,
			   owner=excluded.owner, updated_at=CURRENT_TIMESTAMP`,
		).bind(
			`material-import-${slug(productId)}-${index}`, productId, material.type.trim(), status,
			date(material.deadline, `${material.model} ${material.type} DDL`), material.owner.trim() || null,
		));
	}
	// Marketing tasks are the final source of truth when both Tasks and
	// Materials sheets contain the same material.
	for (const [index, task] of input.tasks.entries()) {
		if (task.ownerRole.trim().toUpperCase() !== "MARKETING") continue;
		const productId = resolveProduct(task.model);
		const existing = existingTasks.results.find(
			(item) => item.product_id === productId && item.stage_name === task.stage && item.task_name === task.name.trim(),
		);
		const taskId = existing?.id || `task-import-${slug(productId)}-${index}`;
		statements.push(env.DB.prepare(
			`INSERT INTO gtm_material_task
			   (id,product_id,material_type,status,deadline,owner,updated_at)
			 VALUES (?,?,?,?,NULL,NULL,CURRENT_TIMESTAMP)
			 ON CONFLICT(product_id,material_type) DO UPDATE SET
			   status=excluded.status, updated_at=CURRENT_TIMESTAMP`,
		).bind(
			`material-${taskId}`, productId, task.name.trim(),
			task.completed ? "COMPLETED" : "NOT_COMPLETED",
		));
	}
	if (!statements.length) throw new Error("The workbook does not contain any importable rows");
	await env.DB.batch(statements);
	return {
		products: normalizedProducts.size,
		stages: input.stages.length,
		tasks: input.tasks.length,
		materials: input.materials.length,
	};
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

export async function updateGtmProjectStatus(
	env: Env,
	id: string,
	status: string,
	reviewStage: string,
) {
	const normalizedStatus = status.trim().toUpperCase();
	if (!["COMPLETED", "ON_TRACK", "DELAYED"].includes(normalizedStatus)) {
		throw new Error("Project status must be Completed, On Track, or Delayed");
	}
	if (!GTM_STAGES.includes(reviewStage as GtmStageName)) {
		throw new Error("A valid current stage is required");
	}
	const result = await env.DB.prepare(
		`UPDATE gtm_product
		    SET project_status=?, status_review_stage=?, updated_at=CURRENT_TIMESTAMP
		  WHERE id=?`,
	)
		.bind(normalizedStatus, reviewStage, id)
		.run();
	if (result.meta.changes !== 1) throw new Error("Product was not found");
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

export function projectStatus(product: GtmProduct, tasks: GtmTask[], stages: GtmStage[]) {
	if (tasks.length && tasks.every((task) => !!task.is_completed)) return "Completed";
	const today = new Date().toISOString().slice(0, 10);
	const current = currentStage(tasks);
	if (current && product.status_review_stage === current) {
		if (product.project_status === "COMPLETED") return "Completed";
		if (product.project_status === "DELAYED") return "Delayed";
		if (product.project_status === "ON_TRACK") return "On Track";
	}
	const currentDeadline = stages.find((stage) => stage.stage_name === current)?.deadline;
	if (currentDeadline && currentDeadline <= today) return "Delayed";
	return "On Track";
}

export function projectNeedsStatusReview(
	product: GtmProduct,
	tasks: GtmTask[],
	stages: GtmStage[],
) {
	const current = currentStage(tasks);
	if (!current || product.status_review_stage === current) return false;
	const currentDeadline = stages.find((stage) => stage.stage_name === current)?.deadline;
	if (!currentDeadline) return false;
	const today = new Date().toISOString().slice(0, 10);
	const daysRemaining = Math.ceil(
		(new Date(`${currentDeadline}T00:00:00Z`).getTime() -
			new Date(`${today}T00:00:00Z`).getTime()) /
			86400000,
	);
	return daysRemaining >= 0 && daysRemaining <= 7;
}
