// ProtoTrack 数据访问层 + 业务逻辑（从 Apps Script Code.gs 迁移）
// D1 表：app_user / prototype / proto_log / sku

export type Role = "admin" | "sales" | "denied";
export interface User {
	email: string;
	name: string;
	role: Role;
}
export interface Proto {
	id: number;
	sn: string;
	model: string | null;
	pname: string | null;
	sample_type: string | null;
	owner: string | null;
	customer: string | null;
	country: string | null;
	qty: number;
	co: string | null;
	ret: string | null;
	status: string;
	notes: string | null;
	updated_at: string | null;
	tracking_no: string | null;
	ship_date: string | null;
	received: string | null;
}
export interface LogRow {
	id: number;
	ts: string;
	sn: string;
	action: string;
	actor: string;
	note: string;
}

export const STATUSES = [
	"In Stock",
	"In Transit",
	"On Loan",
	"Returned",
	"Gifted",
] as const;

// ── 时间helper（UTC 'YYYY-MM-DD HH:mm:ss' / 'YYYY-MM-DD'）──
export function nowStr(): string {
	return new Date().toISOString().slice(0, 19).replace("T", " ");
}
export function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

// ── 鉴权：读取 Cloudflare Access 注入的邮箱头 ──
// 生产环境走 Access（Cf-Access-Authenticated-User-Email）。
// 未启用 Access 时回退到 dev 管理员，并由页面显示警告横幅。
export async function getUser(
	request: Request,
	env: Env,
): Promise<User & { viaAccess: boolean }> {
	let email = (
		request.headers.get("Cf-Access-Authenticated-User-Email") || ""
	)
		.toLowerCase()
		.trim();
	const viaAccess = !!email;
	if (!email) email = "chris.yao@iniushop.com"; // dev/未配 Access 时的回退身份
	const row = await env.DB.prepare(
		"SELECT email, name, role FROM app_user WHERE lower(email) = ?",
	)
		.bind(email)
		.first<User>();
	if (!row)
		return { email, name: email.split("@")[0], role: "denied", viaAccess };
	return { ...row, viaAccess };
}

// ── 读取：按角色过滤样机 ──
export async function getProtos(env: Env, me: User): Promise<Proto[]> {
	if (me.role === "denied") return [];
	if (me.role === "admin") {
		const r = await env.DB.prepare(
			"SELECT * FROM prototype ORDER BY updated_at DESC",
		).all<Proto>();
		return r.results;
	}
	const r = await env.DB.prepare(
		"SELECT * FROM prototype WHERE owner = ? ORDER BY updated_at DESC",
	)
		.bind(me.name)
		.all<Proto>();
	return r.results;
}

export async function getRecentLogs(
	env: Env,
	me: User,
	limit = 200,
): Promise<LogRow[]> {
	if (me.role === "denied") return [];
	if (me.role === "admin") {
		const r = await env.DB.prepare(
			"SELECT * FROM proto_log ORDER BY id DESC LIMIT ?",
		)
			.bind(limit)
			.all<LogRow>();
		return r.results;
	}
	// sales：只看自己名下样机的日志
	const r = await env.DB.prepare(
		`SELECT l.* FROM proto_log l
		 WHERE l.sn IN (SELECT sn FROM prototype WHERE owner = ?)
		 ORDER BY l.id DESC LIMIT ?`,
	)
		.bind(me.name, limit)
		.all<LogRow>();
	return r.results;
}

export async function listOwners(env: Env): Promise<string[]> {
	// owner 字段存的是用户 name；直接从 app_user 取名单
	const u = await env.DB.prepare(
		"SELECT name FROM app_user ORDER BY role, name",
	).all<{ name: string }>();
	return u.results.map((x) => x.name);
}

export async function log(
	env: Env,
	sn: string,
	action: string,
	actor: string,
	note: string,
) {
	await env.DB.prepare(
		"INSERT INTO proto_log (ts, sn, action, actor, note) VALUES (?,?,?,?,?)",
	)
		.bind(nowStr(), sn, action, actor, note || "")
		.run();
}

// ── 写入：添加样机（状态自动判定，迁移自 addPrototypeData）──
export async function addProto(
	env: Env,
	data: Partial<Proto>,
	actor: string,
) {
	const sn = (data.sn || "").trim();
	if (!sn) throw new Error("SN 不能为空");
	const hasTracking = !!(data.tracking_no && data.tracking_no.trim());
	const hasShipDate = !!(data.ship_date && String(data.ship_date).trim());
	const hasCustomer = !!(data.customer && String(data.customer).trim());
	const hasCO = !!(data.co && String(data.co).trim());

	let status = "In Stock";
	let received = "yes";
	let co = "";
	let ship_date = "";
	let tracking_no = "";
	if (hasCustomer && hasCO) {
		status = "On Loan";
		received = "yes";
		co = String(data.co);
		ship_date = String(data.ship_date || data.co);
		tracking_no = data.tracking_no || "";
	} else if (hasTracking || hasShipDate) {
		status = "In Transit";
		received = "";
		ship_date = String(data.ship_date || todayStr());
		tracking_no = data.tracking_no || "";
	}

	await env.DB.prepare(
		`INSERT INTO prototype (sn,model,pname,sample_type,owner,customer,country,qty,co,ret,status,notes,updated_at,tracking_no,ship_date,received)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
	)
		.bind(
			sn,
			data.model || "",
			data.pname || "",
			data.sample_type || "",
			data.owner || "",
			hasCustomer ? String(data.customer) : "",
			data.country || "",
			Number(data.qty) || 0,
			co,
			"",
			status,
			data.notes || "",
			nowStr(),
			tracking_no,
			ship_date,
			received,
		)
		.run();

	let action = "Stock entry";
	let msg = "Added to stock for " + (data.owner || "");
	if (status === "On Loan") {
		action = "Sample dispatched";
		msg = `Direct shipment from HQ → ${data.customer} (for ${data.owner})`;
	} else if (status === "In Transit") {
		action = "Shipped";
		msg = `Shipped to ${data.owner}` + (tracking_no ? ` (tracking: ${tracking_no})` : " (tracking pending)");
	}
	await log(env, sn, action, data.owner || actor, msg);
}

async function getById(env: Env, id: number): Promise<Proto | null> {
	return await env.DB.prepare("SELECT * FROM prototype WHERE id = ?")
		.bind(id)
		.first<Proto>();
}

// 权限校验：sales 只能操作自己名下的
function assertCanEdit(me: User, p: Proto) {
	if (me.role === "admin") return;
	if (me.role === "sales" && p.owner === me.name) return;
	throw new Error("无权操作此样机");
}

export async function updateStatus(
	env: Env,
	id: number,
	status: string,
	me: User,
	note = "",
) {
	const p = await getById(env, id);
	if (!p) throw new Error("样机不存在");
	assertCanEdit(me, p);
	const ret = status === "Returned" ? todayStr() : p.ret;
	await env.DB.prepare(
		"UPDATE prototype SET status=?, ret=?, updated_at=? WHERE id=?",
	)
		.bind(status, ret, nowStr(), id)
		.run();
	await log(env, p.sn, "Status changed → " + status, me.name, note);
}

export async function returnToStock(env: Env, id: number, me: User) {
	const p = await getById(env, id);
	if (!p) throw new Error("样机不存在");
	assertCanEdit(me, p);
	await env.DB.prepare(
		"UPDATE prototype SET status='In Stock', customer='', co='', ret='', updated_at=? WHERE id=?",
	)
		.bind(nowStr(), id)
		.run();
	await log(env, p.sn, "Returned to stock", me.name, "Back in personal stock");
}

export async function confirmReceive(env: Env, id: number, me: User) {
	const p = await getById(env, id);
	if (!p) throw new Error("样机不存在");
	assertCanEdit(me, p);
	await env.DB.prepare(
		"UPDATE prototype SET received='yes', status='In Stock', updated_at=? WHERE id=?",
	)
		.bind(nowStr(), id)
		.run();
	await log(env, p.sn, "Received confirmed", me.name, "Confirmed receipt into stock");
}

// 发货（整批或拆分，迁移自 dispatchSampleData）
export async function dispatch(
	env: Env,
	id: number,
	qty: number,
	channel: string,
	date: string,
	me: User,
) {
	const p = await getById(env, id);
	if (!p) throw new Error("样机不存在");
	assertCanEdit(me, p);
	const sendQty = Number(qty);
	const dispDate = date || todayStr();
	if (sendQty <= 0 || sendQty > p.qty) throw new Error("发货数量不合法");

	if (sendQty === p.qty) {
		await env.DB.prepare(
			"UPDATE prototype SET status='On Loan', customer=?, co=?, updated_at=? WHERE id=?",
		)
			.bind(channel, dispDate, nowStr(), id)
			.run();
		await log(env, p.sn, "Sample dispatched", me.name, `${sendQty} units → ${channel}`);
	} else {
		const remaining = p.qty - sendQty;
		await env.DB.prepare(
			"UPDATE prototype SET qty=?, updated_at=? WHERE id=?",
		)
			.bind(remaining, nowStr(), id)
			.run();
		const suffix = 100 + ((p.id * 37 + sendQty) % 900); // 确定性后缀，避免随机
		const newSn = `${p.sn}-S${suffix}`;
		await env.DB.prepare(
			`INSERT INTO prototype (sn,model,pname,sample_type,owner,customer,country,qty,co,ret,status,notes,updated_at,tracking_no,ship_date,received)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		)
			.bind(
				newSn, p.model, p.pname, p.sample_type, p.owner, channel, p.country,
				sendQty, dispDate, "", "On Loan", p.notes, nowStr(), "", "", p.received,
			)
			.run();
		await log(env, p.sn, "Partial dispatch", me.name, `Sent ${sendQty} units, remaining: ${remaining} units`);
		await log(env, newSn, "Sample dispatched", me.name, `Split from ${p.sn} → ${channel}`);
	}
}
