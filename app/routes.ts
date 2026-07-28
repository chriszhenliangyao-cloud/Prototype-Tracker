import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("chrispage", "routes/chrispage.tsx"),
	// Bai 后续在这里加自己的页面，例如：
	// route("baipage", "routes/baipage.tsx"),
] satisfies RouteConfig;
