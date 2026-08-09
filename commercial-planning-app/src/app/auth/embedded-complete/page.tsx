"use client";

import { useEffect } from "react";

export default function EmbeddedLoginCompletePage() {
  useEffect(() => {
    window.close();
  }, []);

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-6 py-12">
      <section className="w-full rounded-lg border border-slate-200 bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">登录成功</h1>
        <p className="mt-2 text-sm text-slate-600">
          正在返回运营协同平台；如果窗口没有自动关闭，可以直接关闭本窗口。
        </p>
        <button
          className="mt-5 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => window.close()}
          type="button"
        >
          关闭窗口
        </button>
      </section>
    </main>
  );
}
