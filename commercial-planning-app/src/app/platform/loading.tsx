export default function PlatformLoading() {
  return (
    <div className="native-platform-loading" role="status" aria-live="polite">
      <span />
      <div>
        <strong>正在打开模块</strong>
        <small>Loading workspace</small>
      </div>
    </div>
  );
}
