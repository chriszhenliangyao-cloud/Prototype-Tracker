export const dynamic = "force-dynamic";

export default function SignedOutPage() {
  return (
    <section className="mx-auto grid max-w-xl gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Signed out</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Your app session has been cleared. Sign in again to continue working
          in the system.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href="/auth/login?returnTo=%2F"
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
        >
          Sign in with Google
        </a>
        <a
          href="/"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to workbench
        </a>
      </div>
    </section>
  );
}
