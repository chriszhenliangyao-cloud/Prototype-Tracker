import { ValueChainTabs } from "@/components/platform/ValueChainTabs";

export default function ValueChainLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="native-platform-module-stack">
      <ValueChainTabs />
      {children}
    </div>
  );
}
