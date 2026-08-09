(function () {
  "use strict";

  const S = window.S;
  const h = S.h;

  const workspaces = [
    { name: "研发准备", ownerGroup: "研发与工程", data: "DVT / EVT / 设计冻结", owner: "Leo", pending: 3, status: "正常", tone: "green" },
    { name: "样机管理", ownerGroup: "样机与测试", data: "申请、借用、寄送和归还", owner: "Evan", pending: 5, status: "预警", tone: "amber", route: "prototype" },
    { name: "质量验证", ownerGroup: "质量", data: "测试计划、问题与 CAPA", owner: "Marta", pending: 2, status: "风险", tone: "red" },
    { name: "供应执行", ownerGroup: "供应链", data: "首批、排产、交付与库存", owner: "Owen", pending: 4, status: "预警", tone: "amber" },
    { name: "营销物料", ownerGroup: "市场", data: "文案、图片、视频和渠道交付", owner: "Lena", pending: 3, status: "预警", tone: "amber" },
    { name: "销售准备", ownerGroup: "销售", data: "预测、渠道清单和上市准备", owner: "Ivy", pending: 2, status: "正常", tone: "green" }
  ];

  function render(root) {
    S.clear(root);
    const page = h("div.functional-workspace");
    page.append(header(), summary(), body());
    root.append(page);
  }

  function header() {
    return S.pageHeader({
      overline: "专业与管理 · PROFESSIONAL WORKSPACES",
      title: "职能工作台",
      pill: { text: "专业数据维护入口", color: "var(--c-success)" }
    });
  }

  function summary() {
    return h("section.functional-summary", { "aria-label": "职能工作台摘要" }, [
      metric("职能工作台", "6", "当前规划范围"),
      metric("待处理事项", "19", "各部门合计"),
      metric("项目阻塞", "4", "已同步项目跟进", "danger"),
      metric("数据同步", "5/6", "物流接口测试中")
    ]);
  }

  function metric(label, value, foot, tone) {
    return h("div.functional-metric", { class: tone || "" }, [h("span", label), h("strong", value), h("small", foot)]);
  }

  function body() {
    return h("div.functional-grid", [workspacePanel(), ownershipPanel()]);
  }

  function workspacePanel() {
    const rows = workspaces.map((workspace) => h("tr", { class: workspace.route ? "featured" : "" }, [
      h("td", h("strong", workspace.name)),
      h("td", workspace.ownerGroup),
      h("td", workspace.data),
      h("td", workspace.owner),
      h("td", h("strong.functional-pending", String(workspace.pending))),
      h("td", status(workspace.status, workspace.tone)),
      h("td", h("button.btn", {
        dataset: workspace.route ? { functionalEntry: workspace.route } : { functionalPlaceholder: workspace.name },
        onclick: () => openWorkspace(workspace)
      }, "进入"))
    ]));

    const table = h("div.functional-table-wrap", h("table.functional-table", [
      h("thead", h("tr", ["职能工作台", "归属", "专业数据", "负责人", "待处理", "状态", "入口"].map((label) => h("th", label)))),
      h("tbody", rows)
    ]));

    return panel("职能入口", "按数据责任归属", table);
  }

  function ownershipPanel() {
    const rows = [
      ["职能工作台负责维护", "各部门维护专业明细、附件、问题和交付记录。", "数据源", "neutral"],
      ["项目跟进负责监控", "项目页只汇总准备度、关键卡点与时间影响。", "控制塔", "blue"],
      ["审批中心负责决策", "需要授权、变更或跨部门确认的事项统一进入审批。", "决策入口", "green"]
    ];
    return panel("模块定位", "维护、监控与决策分层", h("div.functional-principles", rows.map((row) => h("div.functional-principle", [
      h("div", [h("strong", row[0]), h("small", row[1])]),
      status(row[2], row[3])
    ]))));
  }

  function panel(title, subtitle, content) {
    return h("section.functional-panel", [
      h("header.functional-panel-head", [h("h2", title), h("span", subtitle)]),
      content
    ]);
  }

  function status(label, tone) {
    return h("span.functional-status", { class: tone }, label);
  }

  function openWorkspace(workspace) {
    if (workspace.route === "prototype") {
      window.location.hash = "#module=functions&workspace=prototype";
      return;
    }
    S.toast(`${workspace.name}沿用现有平台，本地测试暂未改动`);
  }

  window.Modules.functions = { render };
})();
