import { createRequestHandler } from "react-router";
import { getGtmWorkspace, syncGtmFollowUpNotifications } from "../app/lib/gtm";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	fetch(request, env, ctx) {
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil((async () => {
			const workspace = await getGtmWorkspace(env);
			await syncGtmFollowUpNotifications(env, workspace);
		})().catch((error) => {
			console.error(JSON.stringify({ event: "scheduled_follow_up_email_sync_failed", error: error instanceof Error ? error.message : String(error) }));
		}));
	},
} satisfies ExportedHandler<Env>;
