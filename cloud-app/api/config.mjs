export default function handler(_request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
    commercialPlanningUrl: process.env.COMMERCIAL_PLANNING_URL || ""
  });
}
