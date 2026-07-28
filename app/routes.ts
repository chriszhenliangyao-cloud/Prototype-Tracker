import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"), // ProtoTrack Dashboard（Control Tower）
	route("activity", "routes/activity.tsx"), // 活动日志
	// Bai 后续在这里加自己的页面：
	// route("baipage", "routes/baipage.tsx"),
] satisfies RouteConfig;
