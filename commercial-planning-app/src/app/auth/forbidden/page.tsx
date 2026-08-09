export default function ForbiddenPage() {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-lg font-semibold text-amber-950">Access restricted</h2>
      <p className="mt-2 text-sm text-amber-800">
        Your account can view the calculator, but this action requires a finance
        or administrator role.
      </p>
    </section>
  );
}
