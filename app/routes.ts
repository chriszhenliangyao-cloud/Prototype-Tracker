import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"), // ProtoTrack Dashboard（Control Tower）
	route("activity", "routes/activity.tsx"), // 活动日志
	route("project-progress", "routes/project-progress.tsx"), // GTM Workspace（全屏）
	route("sales-inventory", "routes/sales-inventory.tsx"), // Sales & Inventory Planning
] satisfies RouteConfig;
