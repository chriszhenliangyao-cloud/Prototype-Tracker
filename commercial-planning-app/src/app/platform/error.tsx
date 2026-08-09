"use client";

export default function PlatformError({ reset }: { reset: () => void }) {
  return (
    <section className="native-platform-error" role="alert">
      <strong>模块暂时无法加载</strong>
      <p>当前页面状态已保留，请重试加载。</p>
      <button type="button" onClick={reset}>重新加载</button>
    </section>
  );
}
