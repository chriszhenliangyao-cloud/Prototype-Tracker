import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import {
  getPlatformApprovalTaskInbox,
  type PlatformApprovalTaskInbox
} from "@/lib/platformApprovalTasks";

export const dynamic = "force-dynamic";

export default function PlatformWorkbenchPage() {
  return (
    <div className="native-workbench">
      <section className="native-workbench-intro">
        <div>
          <p>COLLABORATION CENTER</p>
          <h1>我的工作台</h1>
          <span>跨模块个人执行清单</span>
        </div>
        <div className="native-workbench-quicklinks" aria-label="常用入口">
          <Link href="/platform/planning/projects">项目跟进</Link>
          <Link href="/platform/planning/sales">产销管理</Link>
          <Link href="/platform/business/value-chain/on-sale">价值链测算</Link>
        </div>
      </section>
      <Suspense fallback={<WorkbenchSkeleton />}>
        <ApprovalInbox />
      </Suspense>
    </div>
  );
}

async function ApprovalInbox() {
  const session = await requireUser("/platform/workbench");
  const inbox = await getPlatformApprovalTaskInbox(session);
  return <ApprovalInboxView inbox={inbox} />;
}

function ApprovalInboxView({ inbox }: { inbox: PlatformApprovalTaskInbox }) {
  const summary = inbox.summary;
  return (
    <>
      <section className="native-workbench-summary" aria-label="待办摘要">
        <Metric label="全部审批待办" value={summary.visibleApprovals} note={`月促 ${summary.monthlyPending} · 其他 ${summary.otherPending}`} />
        <Metric label="待我审批" value={summary.actionableApprovals} note="当前可直接处理" danger={summary.actionableApprovals > 0} />
        <Metric label="等待前序" value={summary.waitingForPreviousStage} note="可查看，暂不可审批" />
        <Metric label="邮件异常" value={summary.emailIssues + summary.deliveryIssues} note={`提醒 ${summary.emailIssues} · 结果 ${summary.deliveryIssues}`} danger={summary.emailIssues + summary.deliveryIssues > 0} />
      </section>
      <section className="native-workbench-queue">
        <header>
          <h2>审批与执行队列</h2>
          <span>审批优先，其余按等待时间排序</span>
        </header>
        {inbox.tasks.length === 0 ? (
          <div className="native-workbench-empty">当前没有等待您处理的审批。</div>
        ) : (
          <div className="native-workbench-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>待办事项</th>
                  <th>来源模块</th>
                  <th>责任</th>
                  <th>等待</th>
                  <th>状态</th>
                  <th>邮件</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {inbox.tasks.map((task) => (
                  <tr key={task.id}>
                    <td><strong>{task.title}</strong><small>{task.context}</small></td>
                    <td>{task.sourceModule}</td>
                    <td>{task.responsibility}</td>
                    <td>{task.waitingHours}小时</td>
                    <td><span className={`native-status ${task.statusTone}`}>{task.statusLabel}</span></td>
                    <td><span className={`native-status ${task.email.tone}`}>{task.email.label}</span></td>
                    <td><Link className="native-workbench-action" href={nativeTaskRoute(task.targetRoute)}>进入处理</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  note,
  danger = false
}: {
  label: string;
  value: number;
  note: string;
  danger?: boolean;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong className={danger ? "danger" : undefined}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function nativeTaskRoute(route: string) {
  if (route.startsWith("/promotion?")) {
    const query = route.slice(route.indexOf("?"));
    return query.includes("workspace=other-approvals")
      ? `/platform/collaboration/other-approvals${query}`
      : `/platform/collaboration/monthly-approvals${query}`;
  }
  return route;
}

function WorkbenchSkeleton() {
  return (
    <div className="native-workbench-skeleton" aria-label="正在加载审批队列">
      <div /><div /><div /><div />
    </div>
  );
}
