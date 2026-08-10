export const dynamic = "force-dynamic";

export default function SignedOutPage() {
  return (
    <section className="mx-auto mt-12 grid max-w-lg gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:mt-20">
      <div>
        <p className="text-xs font-bold uppercase text-blue-600">
          Operations Planning
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-950">
          已退出登录
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          当前平台会话已清除。重新进入时将打开 Google 账号选择器，请选择本次使用的授权邮箱。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href="/auth/login?switchAccount=1&returnTo=%2Fplatform%2Fworkbench"
          className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          选择 Google 账号登录
        </a>
        <a
          href="/platform/workbench"
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          返回工作台
        </a>
      </div>
      <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        登录成功后，平台右上角会显示当前使用的邮箱与角色。
      </p>
    </section>
  );
}
