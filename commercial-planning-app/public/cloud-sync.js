(function initializeCloudSync() {
  const SYNC_KEYS = new Set([
    "salesInventoryPlanningTool.v1",
    "projectTrackingData.v1",
    "projectDeletionAudit.v1",
    "projectTrackingAccess.v1",
    "marketingAssets.v1"
  ]);
  const LOCAL_ONLY_KEYS = new Set([
    "projectTrackingTool.v1",
    "projectTrackingDrafts.v1",
    "projectTrackingFormDrafts.v1"
  ]);
  const ACCESS_DOCUMENT_KEY = "projectTrackingAccess.v1";
  const OUTBOX_KEY = "operationsPlanningCloudOutbox.v1";
  const RECOVERY_KEY = "operationsPlanningLocalRecovery.v1";
  const REMOTE_NOTICE_KEY = "operationsPlanningRemoteNotices.v1";
  const REMOTE_ACTIVITY_KEY = "operationsPlanningRemoteActivity.v1";
  const REMOTE_SNOOZE_MS = 30 * 60 * 1000;
  const offline = new URLSearchParams(window.location.search).get("offline") === "1";

  const styles = `
    .cloud-auth-backdrop{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;background:#eef2f7;color:#172033;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .cloud-auth-panel{width:min(420px,calc(100vw - 32px));background:#fff;border:1px solid #d8e0eb;border-radius:8px;box-shadow:0 24px 64px rgba(24,35,55,.18);padding:28px}
    .cloud-auth-brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}.cloud-auth-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:7px;background:#172033;color:#fff;font-size:12px;font-weight:800}
    .cloud-auth-panel h1{font-size:21px;margin:0}.cloud-auth-panel p{margin:6px 0 20px;color:#65738a;font-size:13px;line-height:1.55}
    .cloud-google-login{width:100%;height:42px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #c7d2e2;border-radius:6px;background:#fff;color:#172033;font:700 13px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.cloud-google-login:hover{border-color:#8fa5c4;background:#f8fafc}.cloud-google-login:focus{outline:2px solid #b8ccff;border-color:#225be8}.cloud-google-login:disabled{opacity:.55;cursor:wait}.cloud-google-mark{display:grid;place-items:center;width:22px;height:22px;border:1px solid #d8e0eb;border-radius:50%;color:#4285f4;font-size:13px;font-weight:900}.cloud-auth-policy{margin:14px 0 0!important;text-align:center;color:#65738a!important;font-size:11px!important}.cloud-auth-message{min-height:18px;margin:12px 0 0!important;color:#d82331!important;font-size:12px!important;text-align:center}.cloud-auth-message.success{color:#11845b!important}
    .cloud-status{position:relative;z-index:10;display:inline-flex;align-items:center;flex:0 0 auto;font:600 10px/1.2 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#4d5b70}.cloud-status-trigger{height:28px;display:inline-flex;align-items:center;gap:6px;border:1px solid #d8e0eb;border-radius:5px;background:#fff;padding:0 8px;color:#4d5b70;font:inherit;cursor:pointer;white-space:nowrap}.cloud-status-trigger:hover,.cloud-status-trigger[aria-expanded="true"]{border-color:#9fb0c8;background:#f7f9fc}.cloud-status-dot{width:7px;height:7px;border-radius:50%;background:#11845b;flex:0 0 auto}.cloud-status.saving .cloud-status-dot{background:#225be8;animation:cloud-pulse 1s infinite}.cloud-status.error .cloud-status-dot,.cloud-status.conflict .cloud-status-dot{background:#e4232f}.cloud-status-chevron{width:6px;height:6px;border-right:1.5px solid #65738a;border-bottom:1.5px solid #65738a;transform:rotate(45deg) translateY(-2px);transition:transform .15s ease}.cloud-status-trigger[aria-expanded="true"] .cloud-status-chevron{transform:rotate(225deg) translate(-1px,-1px)}.cloud-account-menu{position:absolute;top:calc(100% + 6px);right:0;width:264px;border:1px solid #d8e0eb;border-radius:7px;background:#fff;box-shadow:0 14px 36px rgba(24,35,55,.18);padding:7px}.cloud-account-menu[hidden]{display:none}.cloud-account-summary{padding:7px 8px 9px;border-bottom:1px solid #e3e8f0;margin-bottom:5px}.cloud-account-email{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#172033;font-size:11px;font-weight:800}.cloud-account-role{display:block;margin-top:3px;color:#65738a;font-size:9px}.cloud-account-activity{margin:5px 0;padding:7px 8px;border-radius:5px;background:#f6f8fb;color:#65738a;font-size:9px;line-height:1.45}.cloud-account-menu button{width:100%;min-height:31px;display:flex;align-items:center;justify-content:space-between;border:0;border-radius:5px;background:transparent;padding:0 8px;color:#4d5b70;font:700 10px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.cloud-account-menu button:hover{background:#f1f4f8;color:#172033}.cloud-account-menu .cloud-review-conflict{color:#c42735}.cloud-account-menu .cloud-review-conflict b{display:grid;place-items:center;min-width:18px;height:18px;border-radius:9px;background:#fff0f1;color:#c42735;font-size:9px}.cloud-account-menu .cloud-logout{color:#b42331}
    .cloud-sync-toast{position:fixed;z-index:4550;right:14px;bottom:14px;display:flex;align-items:center;gap:8px;max-width:min(360px,calc(100vw - 28px));border:1px solid #b9dfcf;border-radius:6px;background:#f0faf6;color:#176b4d;padding:9px 11px;box-shadow:0 10px 28px rgba(24,35,55,.12);font:700 11px/1.35 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:cloud-toast-in .2s cubic-bezier(.16,1,.3,1)}.cloud-sync-toast::before{content:"";width:7px;height:7px;border-radius:50%;background:#11845b;flex:0 0 auto}
    .cloud-update-banner{position:fixed;z-index:4600;top:52px;right:14px;width:min(620px,calc(100vw - 28px));display:grid;gap:8px;border:1px solid #f2a6ad;border-radius:7px;background:#fff7f7;color:#172033;padding:11px 12px;box-shadow:0 14px 36px rgba(24,35,55,.16);font:700 11px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:cloud-toast-in .22s cubic-bezier(.16,1,.3,1)}.cloud-conflict-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.cloud-conflict-head strong{font-size:12px}.cloud-conflict-head small{display:block;margin-top:2px;color:#7a5960;font-size:9px;font-weight:600}.cloud-conflict-detail{padding:8px;border:1px solid #f3d3d6;border-radius:5px;background:#fff;color:#65738a;font-size:9px;font-weight:600}.cloud-conflict-context{display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:7px}.cloud-conflict-context span{display:flex;gap:5px}.cloud-conflict-context b{color:#172033}.cloud-conflict-table-wrap{max-height:210px;overflow:auto;border:1px solid #e3e8f0}.cloud-conflict-table{width:100%;border-collapse:collapse;table-layout:fixed}.cloud-conflict-table th,.cloud-conflict-table td{padding:6px;border-bottom:1px solid #e8edf4;text-align:left;vertical-align:top;overflow-wrap:anywhere}.cloud-conflict-table th{position:sticky;top:0;background:#f6f8fb;color:#4d5b70}.cloud-conflict-table td:nth-child(1){width:24%;color:#172033}.cloud-conflict-table td:nth-child(2){width:18%;color:#172033}.cloud-conflict-more{margin:7px 0 0}.cloud-conflict-owner-note{padding:7px 8px;border:1px solid #f0c36d;border-radius:5px;background:#fff8e8;color:#7a4b00;font-size:9px}.cloud-conflict-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.cloud-update-banner button{min-height:28px;border:1px solid #c7d2e2;border-radius:5px;background:#fff;color:#4d5b70;padding:4px 9px;font:800 9px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.cloud-update-banner button:hover{background:#f8fafc}.cloud-update-banner button:disabled{opacity:.45;cursor:not-allowed}.cloud-update-banner button.primary{border-color:#225be8;background:#225be8;color:#fff}.cloud-update-banner button.danger{border-color:#e4a4aa;color:#b42331}.cloud-update-banner .cloud-conflict-dismiss{min-width:24px;padding:3px 6px;border:0;background:transparent;font-size:14px}
    @keyframes cloud-pulse{50%{opacity:.35}}@keyframes cloud-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:760px){.cloud-update-banner{top:58px;right:12px;width:calc(100vw - 24px)}.cloud-sync-toast{right:12px;bottom:12px;max-width:calc(100vw - 24px)}}
  `;
  const style = document.createElement("style");
  style.textContent = styles;
  document.head.appendChild(style);

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let suppressSync = false;
  let cloudStatusNode = null;
  let remoteToastBatchTimer = null;
  let remoteToastHideTimer = null;
  const remoteToastDocuments = new Set();
  const unresolvedRemoteConflicts = new Map();

  function readJsonStorage(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function readOutbox() {
    return readJsonStorage(OUTBOX_KEY, {});
  }

  function writeOutbox(outbox) {
    if (Object.keys(outbox).length) originalSetItem.call(localStorage, OUTBOX_KEY, JSON.stringify(outbox));
    else originalRemoveItem.call(localStorage, OUTBOX_KEY);
  }

  function removeLegacyLocalOnlyOutboxEntries() {
    const outbox = readOutbox();
    let changed = false;
    LOCAL_ONLY_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(outbox, key)) return;
      delete outbox[key];
      changed = true;
    });
    if (changed) writeOutbox(outbox);
  }

  function storeOutboxEntry(key, entry) {
    const outbox = readOutbox();
    outbox[key] = entry;
    writeOutbox(outbox);
  }

  function removeOutboxEntry(key, mutationId = "") {
    const outbox = readOutbox();
    if (!outbox[key]) return;
    if (mutationId && outbox[key].mutationId !== mutationId) return;
    delete outbox[key];
    writeOutbox(outbox);
  }

  function archiveLocalRecovery(key, entry, reason) {
    if (!entry) return true;
    const records = readJsonStorage(RECOVERY_KEY, []);
    const next = Array.isArray(records) ? records : [];
    next.unshift({
      documentKey: key,
      payload: entry.payload,
      baseVersion: entry.baseVersion,
      mutationId: entry.mutationId,
      queuedAt: entry.queuedAt,
      archivedAt: new Date().toISOString(),
      reason
    });
    try {
      originalSetItem.call(localStorage, RECOVERY_KEY, JSON.stringify(next.slice(0, 30)));
      return true;
    } catch {
      return false;
    }
  }

  function setLocalValue(key, payload) {
    suppressSync = true;
    try {
      if (payload === null || payload === undefined) originalRemoveItem.call(localStorage, key);
      else originalSetItem.call(localStorage, key, JSON.stringify(payload));
    } finally {
      suppressSync = false;
    }
  }

  function readRemoteNotices() {
    const notices = readJsonStorage(REMOTE_NOTICE_KEY, {});
    return notices && !Array.isArray(notices) ? notices : {};
  }

  function writeRemoteNotices(notices) {
    originalSetItem.call(localStorage, REMOTE_NOTICE_KEY, JSON.stringify(notices));
  }

  function remoteNoticeFor(documentKey) {
    return readRemoteNotices()[documentKey] || {};
  }

  function updateRemoteNotice(documentKey, patch) {
    const notices = readRemoteNotices();
    notices[documentKey] = { ...(notices[documentKey] || {}), ...patch };
    writeRemoteNotices(notices);
    return notices[documentKey];
  }

  function documentLabel(documentKey) {
    return ({
      "salesInventoryPlanningTool.v1": "产销计划",
      "projectTrackingTool.v1": "项目视图",
      "projectTrackingData.v1": "项目数据",
      "projectDeletionAudit.v1": "项目审计",
      "projectTrackingDrafts.v1": "项目草稿",
      "projectTrackingAccess.v1": "项目权限",
      "projectTrackingFormDrafts.v1": "项目表单",
      "marketingAssets.v1": "营销物料"
    })[documentKey] || "共享数据";
  }

  function readRemoteActivity() {
    const activity = readJsonStorage(REMOTE_ACTIVITY_KEY, []);
    return Array.isArray(activity) ? activity : [];
  }

  function recordRemoteActivity(documentKey, version, type) {
    const activity = readRemoteActivity();
    const signature = `${documentKey}:${version}:${type}`;
    if (activity[0]?.signature !== signature) {
      activity.unshift({
        signature,
        documentKey,
        label: documentLabel(documentKey),
        version: Number(version || 0),
        type,
        at: new Date().toISOString()
      });
      originalSetItem.call(localStorage, REMOTE_ACTIVITY_KEY, JSON.stringify(activity.slice(0, 20)));
    }
    renderRemoteActivity();
  }

  function renderRemoteActivity() {
    if (!cloudStatusNode) return;
    const activityNode = cloudStatusNode.querySelector("[data-cloud-activity]");
    const latest = readRemoteActivity()[0];
    if (activityNode) {
      const typeLabel = latest?.type === "conflict"
        ? "检测到数据冲突"
        : latest?.type === "local-kept"
          ? "已保留本地版本"
          : latest?.type === "team-applied"
            ? "已采用团队版本"
            : latest?.type === "auto-merged"
              ? "已自动合并非冲突修改"
            : "已自动同步";
      activityNode.textContent = latest
        ? `${typeLabel} · ${latest.label}${latest.version ? ` v${latest.version}` : ""}`
        : "暂无新的团队数据更新";
    }
    const conflictButton = cloudStatusNode.querySelector("[data-cloud-review-conflict]");
    if (conflictButton) {
      conflictButton.hidden = unresolvedRemoteConflicts.size === 0;
      const count = conflictButton.querySelector("b");
      if (count) count.textContent = String(unresolvedRemoteConflicts.size);
    }
  }

  function activePlatformModule() {
    return document.querySelector(".platform-nav-item.active[data-module]")?.getAttribute("data-module") || "";
  }

  function remoteUpdateIsRelevant(documentKey) {
    const moduleKey = activePlatformModule();
    const relevantModules = ({
      "salesInventoryPlanningTool.v1": ["sales", "projects"],
      "projectTrackingTool.v1": ["projects", "prototype-management"],
      "projectTrackingData.v1": ["home", "projects", "market-assets", "prototype-management", "tasks", "exceptions"],
      "projectDeletionAudit.v1": ["projects", "system"],
      "projectTrackingDrafts.v1": ["projects", "prototype-management"],
      "projectTrackingAccess.v1": ["projects", "system"],
      "projectTrackingFormDrafts.v1": ["projects", "prototype-management"],
      "marketingAssets.v1": ["home", "projects", "market-assets", "tasks", "exceptions"]
    })[documentKey] || [];
    return relevantModules.includes(moduleKey);
  }

  function showRemoteSyncToast(documentKey) {
    if (!remoteUpdateIsRelevant(documentKey)) return;
    remoteToastDocuments.add(documentLabel(documentKey));
    window.clearTimeout(remoteToastBatchTimer);
    remoteToastBatchTimer = window.setTimeout(() => {
      let toast = document.querySelector(".cloud-sync-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.className = "cloud-sync-toast";
        toast.setAttribute("role", "status");
        document.body.appendChild(toast);
      }
      const labels = [...remoteToastDocuments];
      toast.textContent = labels.length === 1
        ? `${labels[0]}已同步团队更新`
        : `已同步团队更新 · ${labels.length}项`;
      remoteToastDocuments.clear();
      window.clearTimeout(remoteToastHideTimer);
      remoteToastHideTimer = window.setTimeout(() => toast.remove(), 4200);
    }, 700);
  }

  function jsonEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function cloneJson(value) {
    return value === undefined ? undefined : structuredClone(value);
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function mergeJsonValue(baseValue, localValue, remoteValue, path, conflicts) {
    if (jsonEqual(localValue, remoteValue)) return cloneJson(localValue);
    if (jsonEqual(localValue, baseValue)) return cloneJson(remoteValue);
    if (jsonEqual(remoteValue, baseValue)) return cloneJson(localValue);

    if (isPlainObject(localValue) && isPlainObject(remoteValue) && (isPlainObject(baseValue) || baseValue === undefined)) {
      const baseObject = isPlainObject(baseValue) ? baseValue : {};
      const keys = new Set([...Object.keys(baseObject), ...Object.keys(localValue), ...Object.keys(remoteValue)]);
      const merged = {};
      keys.forEach((key) => {
        const next = mergeJsonValue(baseObject[key], localValue[key], remoteValue[key], [...path, key], conflicts);
        if (next !== undefined) merged[key] = next;
      });
      return merged;
    }

    conflicts.push({ path, baseValue, localValue, remoteValue });
    return cloneJson(remoteValue);
  }

  function permissionMemberKey(user, index) {
    const email = String(user?.email || "").trim().toLowerCase();
    return email || String(user?.id || `member-${index + 1}`);
  }

  function permissionMemberMap(payload) {
    const map = new Map();
    (Array.isArray(payload) ? payload : []).forEach((user, index) => map.set(permissionMemberKey(user, index), user));
    return map;
  }

  function mergeAccessPayload(basePayload, localPayload, remotePayload, conflicts) {
    const baseMap = permissionMemberMap(basePayload);
    const localMap = permissionMemberMap(localPayload);
    const remoteMap = permissionMemberMap(remotePayload);
    const orderedKeys = [];
    [...remoteMap.keys(), ...localMap.keys(), ...baseMap.keys()].forEach((key) => {
      if (!orderedKeys.includes(key)) orderedKeys.push(key);
    });
    return orderedKeys.flatMap((key) => {
      const merged = mergeJsonValue(baseMap.get(key), localMap.get(key), remoteMap.get(key), ["members", key], conflicts);
      return merged === undefined ? [] : [merged];
    });
  }

  function analyzeDocumentConflict(documentKey, basePayload, localPayload, remotePayload) {
    const conflicts = [];
    const mergedPayload = documentKey === ACCESS_DOCUMENT_KEY
      ? mergeAccessPayload(basePayload, localPayload, remotePayload, conflicts)
      : mergeJsonValue(basePayload, localPayload, remotePayload, [], conflicts);
    return {
      conflicts,
      mergedPayload,
      hasReliableBase: basePayload !== undefined
    };
  }

  function conflictDocumentMeta(documentKey) {
    return ({
      "salesInventoryPlanningTool.v1": { module: "计划与交付 / 产销管理", authority: "计划负责人" },
      "projectTrackingData.v1": { module: "计划与交付 / 项目跟进", authority: "项目负责人" },
      "projectDeletionAudit.v1": { module: "系统管理 / 项目审计", authority: "平台所有者" },
      "projectTrackingAccess.v1": { module: "系统管理 / 权限管理", authority: "平台所有者" },
      "marketingAssets.v1": { module: "市场增长 / 营销物料", authority: "市场负责人" }
    })[documentKey] || { module: documentLabel(documentKey), authority: "模块负责人" };
  }

  function conflictFieldLabel(path) {
    const labels = {
      platformRole: "平台角色",
      functionalRoles: "职能角色",
      dataScopes: "数据范围",
      approval: "审批权限",
      status: "账号状态",
      cloudRole: "登录授权",
      name: "成员姓名",
      email: "Google 邮箱",
      department: "部门",
      activeUserId: "当前账号（个人状态）",
      view: "当前视图（个人状态）",
      filters: "筛选条件（个人状态）"
    };
    const leaf = path[path.length - 1];
    return labels[leaf] || String(leaf ?? "整条记录");
  }

  function conflictRecordLabel(path) {
    if (path[0] === "members") return path[1] || "成员";
    const meaningful = path.find((part) => typeof part === "string" && !/^\d+$/.test(part));
    return meaningful || "共享记录";
  }

  function conflictValueLabel(value) {
    if (value === undefined) return "未设置";
    if (value === null) return "空";
    if (typeof value === "boolean") return value ? "是" : "否";
    if (typeof value === "string" || typeof value === "number") return String(value);
    const serialized = JSON.stringify(value);
    return serialized.length > 90 ? `${serialized.slice(0, 87)}...` : serialized;
  }

  function renderConflictDetails(documentKey, analysis) {
    const meta = conflictDocumentMeta(documentKey);
    const rows = analysis.conflicts.slice(0, 8).map((item) => `
      <tr>
        <td>${escapeHtml(conflictRecordLabel(item.path))}</td>
        <td>${escapeHtml(conflictFieldLabel(item.path))}</td>
        <td>${escapeHtml(conflictValueLabel(item.localValue))}</td>
        <td>${escapeHtml(conflictValueLabel(item.remoteValue))}</td>
      </tr>`).join("");
    const remainder = analysis.conflicts.length > 8
      ? `<p class="cloud-conflict-more">另有 ${analysis.conflicts.length - 8} 项差异，请进入对应模块继续核对。</p>`
      : "";
    return `
      <div class="cloud-conflict-context"><span><b>位置</b>${escapeHtml(meta.module)}</span><span><b>最终决定</b>${escapeHtml(meta.authority)}</span></div>
      ${rows ? `<div class="cloud-conflict-table-wrap"><table class="cloud-conflict-table"><thead><tr><th>记录</th><th>字段</th><th>我的修改</th><th>团队版本</th></tr></thead><tbody>${rows}</tbody></table></div>${remainder}` : "<p>两端数据包不同，但当前旧草稿没有可用的共同基准。系统已保留本地副本。</p>"}`;
  }

  function clearRemoteConflict(documentKey) {
    unresolvedRemoteConflicts.delete(documentKey);
    document.querySelectorAll(".cloud-update-banner").forEach((node) => {
      if (node.dataset.documentKey === documentKey) node.remove();
    });
    renderRemoteActivity();
  }

  function renderRemoteConflict(payload, pending, handlers, { force = false } = {}) {
    const documentKey = payload.document_key;
    const version = Number(payload.version || 0);
    unresolvedRemoteConflicts.set(documentKey, { payload, pending, handlers });
    const notice = remoteNoticeFor(documentKey);
    const repeatedVersion = Number(notice.conflictVersion || 0) === version;
    const snoozed = Number(notice.snoozedUntil || 0) > Date.now();
    updateRemoteNotice(documentKey, { conflictVersion: version, lastSeenAt: Date.now() });
    if (!repeatedVersion) recordRemoteActivity(documentKey, version, "conflict");
    renderRemoteActivity();
    if (!force && (repeatedVersion || snoozed)) return;

    document.querySelectorAll(".cloud-update-banner").forEach((node) => node.remove());
    const banner = document.createElement("section");
    banner.className = "cloud-update-banner";
    banner.dataset.documentKey = documentKey;
    banner.setAttribute("role", "alertdialog");
    banner.setAttribute("aria-label", "数据冲突处理");
    const analysis = analyzeDocumentConflict(documentKey, pending?.basePayload, pending?.payload, payload.payload);
    const conflictCount = Math.max(1, analysis.conflicts.length);
    const canOverride = handlers.canOverride !== false;
    banner.innerHTML = `
      <div class="cloud-conflict-head">
        <div><strong>检测到${conflictCount}处数据冲突</strong><small>${escapeHtml(documentLabel(documentKey))}${version ? ` · 团队版本 v${version}` : ""}，本地修改已安全保留</small></div>
        <button class="cloud-conflict-dismiss" type="button" data-conflict-action="later" title="稍后处理">×</button>
      </div>
      <div class="cloud-conflict-detail" data-conflict-detail>${renderConflictDetails(documentKey, analysis)}</div>
      ${canOverride ? "" : '<div class="cloud-conflict-owner-note">权限配置受保护：只有平台所有者可以用本地版本覆盖团队权限。你仍可采用团队版本，或稍后交由平台所有者处理。</div>'}
      <div class="cloud-conflict-actions">
        <button type="button" data-conflict-action="details">收起差异</button>
        <button type="button" data-conflict-action="keep-local" ${canOverride ? "" : "disabled title=\"仅平台所有者可覆盖团队权限\""}>采用我的版本</button>
        <button class="danger" type="button" data-conflict-action="use-team">采用团队版本</button>
        <button class="primary" type="button" data-conflict-action="later">稍后处理</button>
      </div>`;
    banner.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-conflict-action]");
      if (!button) return;
      const action = button.getAttribute("data-conflict-action");
      if (action === "details") {
        const detail = banner.querySelector("[data-conflict-detail]");
        detail.hidden = !detail.hidden;
        button.textContent = detail.hidden ? "查看差异" : "收起差异";
        return;
      }
      if (action === "later") {
        updateRemoteNotice(documentKey, { snoozedUntil: Date.now() + REMOTE_SNOOZE_MS });
        banner.remove();
        handlers.later?.();
        return;
      }
      banner.querySelectorAll("button").forEach((item) => { item.disabled = true; });
      try {
        const result = action === "keep-local"
          ? await handlers.keepLocal?.()
          : await handlers.useTeam?.();
        if (result === false) {
          banner.querySelectorAll("button").forEach((item) => { item.disabled = false; });
          const detail = banner.querySelector("[data-conflict-detail]");
          detail.hidden = false;
          detail.textContent = "本地备份空间不足，系统没有覆盖任何数据。请释放浏览器存储空间后重试。";
        }
      } catch (error) {
        banner.querySelectorAll("button").forEach((item) => { item.disabled = false; });
        const detail = banner.querySelector("[data-conflict-detail]");
        detail.hidden = false;
        detail.textContent = "处理失败，数据仍保持原状。请稍后重试。";
      }
    });
    document.body.appendChild(banner);
  }

  function addStatus(identity) {
    const node = document.createElement("div");
    node.className = "cloud-status";
    const roleLabel = identity.platformRole === "platform_owner"
      ? "平台所有者"
      : identity.platformRole === "super_admin"
        ? "超级管理员"
      : identity.role === "admin"
        ? "云端管理员"
        : identity.role === "editor"
          ? "云端可编辑"
          : "云端只读";
    node.innerHTML = `
      <button class="cloud-status-trigger" type="button" aria-expanded="false" aria-haspopup="menu" title="云端账号与同步状态">
        <span class="cloud-status-dot"></span><span data-cloud-status-text>已同步</span><span class="cloud-status-chevron" aria-hidden="true"></span>
      </button>
      <div class="cloud-account-menu" role="menu" hidden>
        <div class="cloud-account-summary"><span class="cloud-account-email">${escapeHtml(identity.email)}</span><span class="cloud-account-role">${roleLabel}</span></div>
        <div class="cloud-account-activity" data-cloud-activity>暂无新的团队数据更新</div>
        <button class="cloud-review-conflict" type="button" data-cloud-review-conflict hidden><span>处理数据冲突</span><b>0</b></button>
        <button class="cloud-logout" type="button">退出登录</button>
      </div>`;
    const mount = document.getElementById("cloudStatusMount");
    (mount || document.body).appendChild(node);
    const trigger = node.querySelector(".cloud-status-trigger");
    const menu = node.querySelector(".cloud-account-menu");
    cloudStatusNode = node;
    renderRemoteActivity();
    const closeMenu = () => { menu.hidden = true; trigger.setAttribute("aria-expanded", "false"); };
    trigger.addEventListener("click", () => {
      const opening = menu.hidden;
      menu.hidden = !opening;
      trigger.setAttribute("aria-expanded", String(opening));
    });
    menu.addEventListener("click", (event) => { if (event.target.closest("button")) closeMenu(); });
    node.querySelector("[data-cloud-review-conflict]").addEventListener("click", () => {
      const conflict = unresolvedRemoteConflicts.values().next().value;
      if (conflict) renderRemoteConflict(conflict.payload, conflict.pending, conflict.handlers, { force: true });
    });
    document.addEventListener("click", (event) => { if (!node.contains(event.target)) closeMenu(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
    return node;
  }

  function setStatus(node, status, text) {
    if (!node) return;
    node.classList.remove("saving", "saved", "error", "conflict");
    if (status) node.classList.add(status);
    const label = node.querySelector("[data-cloud-status-text]");
    if (label) label.textContent = text;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function cloudErrorMessage(error, fallback) {
    const detail = String(error?.message || error || "");
    if (detail.includes("cannot_revoke_current_admin")) return "不能撤销当前登录管理员自身的权限。";
    if (detail.includes("admin_permission_required")) return "只有云端管理员可以管理成员授权。";
    if (detail.includes("invalid_email")) return "请输入有效的完整邮箱地址。";
    if (detail.includes("invalid_role")) return "请选择有效的云端权限。";
    if (detail.includes("platform_owner_permission_required")) return "只有平台所有者可以执行该操作。";
    if (detail.includes("protected_role_change_requires_owner")) return "平台所有者或超级管理员的受保护权限只能由平台所有者修改。";
    if (detail.includes("protected_account_change_requires_owner")) return "只有平台所有者可以修改、降级或撤销超级管理员。";
    if (detail.includes("protected_account_use_governance_action")) return "超级管理员升降必须通过平台治理操作完成。";
    if (detail.includes("platform_owner_cannot_be_modified")) return "平台所有者不能通过普通成员授权修改。";
    if (detail.includes("platform_owner_cannot_be_demoted")) return "平台所有者不能被降级；请使用所有权移交。";
    if (detail.includes("platform_owner_cannot_be_revoked")) return "平台所有者不能被撤销；请先移交平台所有权。";
    if (detail.includes("workspace_authorization_required")) return "请先授权该 Google 邮箱，再提升为超级管理员。";
    if (detail.includes("workspace_member_activation_required")) return "该邮箱需先完成一次登录激活，才能提升为超级管理员。";
    if (detail.includes("platform_owner_not_found")) return "新的平台所有者必须是已登录过的授权成员。";
    return fallback;
  }

  function renderAuthGate(supabase, deniedEmail = "", authError = "") {
    return new Promise(() => {
      const root = document.createElement("div");
      root.className = "cloud-auth-backdrop";
      root.innerHTML = `
        <section class="cloud-auth-panel" aria-labelledby="cloudAuthTitle">
          <div class="cloud-auth-brand"><span class="cloud-auth-mark">OP</span><div><h1 id="cloudAuthTitle">运营计划协同平台</h1><p style="margin:2px 0 0">使用已授权的 Google 邮箱进入团队空间</p></div></div>
          <button class="cloud-google-login" type="button"><span class="cloud-google-mark">G</span><span>使用 Google 登录</span></button>
          <p class="cloud-auth-policy">系统仅允许管理员预先授权的精确邮箱访问</p>
          <p class="cloud-auth-message" role="status">${escapeHtml(authError || (deniedEmail ? `${deniedEmail} 尚未获得访问授权。` : ""))}</p>
        </section>`;
      document.body.appendChild(root);
      const message = root.querySelector(".cloud-auth-message");
      const submit = root.querySelector(".cloud-google-login");
      submit.addEventListener("click", async () => {
        submit.disabled = true;
        message.textContent = "正在转到 Google...";
        const response = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: new URL(window.location.pathname, window.location.origin).toString(),
            queryParams: { prompt: "select_account" }
          }
        });
        if (response.error) {
          message.textContent = response.error.message;
          submit.disabled = false;
          return;
        }
      });
    });
  }

  async function getMembership(supabase, userId) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await supabase.from("workspace_members")
        .select("workspace_id, role, workspaces(name, slug)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (response.data) return response.data;
      if (response.error) throw response.error;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    throw new Error("google_email_not_authorized");
  }

  async function connectCommercialPlanningSession(session, commercialPlanningUrl) {
    if (!commercialPlanningUrl) return;
    const target = new URL(commercialPlanningUrl, window.location.href);
    if (target.origin !== window.location.origin) return;

    const response = await fetch("/auth/platform-session", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token
      })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "经营规划统一会话连接失败");
    }
  }

  async function start() {
    if (offline) {
      window.cloudStore = { enabled: false, offline: true };
      return;
    }
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    if (!configResponse.ok) throw new Error("云端配置不可用");
    const config = await configResponse.json();
    if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error("Supabase 环境变量未配置");
    window.platformRuntimeConfig = Object.freeze({
      commercialPlanningUrl: String(config.commercialPlanningUrl || "").replace(/\/$/, "")
    });
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.4");
    const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const session = (await supabase.auth.getSession()).data.session;
    const callbackParams = new URLSearchParams(window.location.hash.slice(1));
    const authError = callbackParams.get("error_description") || new URLSearchParams(window.location.search).get("error_description") || "";
    if (!session) {
      await renderAuthGate(supabase, "", authError);
      return;
    }
    let membership;
    try {
      membership = await getMembership(supabase, session.user.id);
    } catch (error) {
      const deniedEmail = session.user.email || "当前 Google 邮箱";
      await supabase.auth.signOut();
      await renderAuthGate(supabase, deniedEmail);
      return;
    }
    const workspaceId = membership.workspace_id;
    const identity = {
      id: session.user.id,
      email: session.user.email || "",
      role: membership.role,
      workspaceId,
      workspaceName: membership.workspaces?.name || "运营计划",
      locale: ""
    };
    const [sessionSyncResult, platformRoleResponse, preferenceResponse, cloudRows] = await Promise.all([
      connectCommercialPlanningSession(session, config.commercialPlanningUrl)
        .then(() => ({ ok: true }))
        .catch((error) => ({ ok: false, error })),
      supabase.from("workspace_platform_roles")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase.from("user_preferences")
        .select("locale, timezone")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase.from("workspace_documents")
        .select("document_key, payload, version")
        .eq("workspace_id", workspaceId)
        .in("document_key", [...SYNC_KEYS])
    ]);
    if (!sessionSyncResult.ok) {
      console.warn("Commercial planning session sync failed", sessionSyncResult.error);
    }
    if (!platformRoleResponse.error) identity.governanceRole = platformRoleResponse.data?.role || "";
    else console.warn("Platform governance role is not available yet", platformRoleResponse.error.message);
    identity.platformRole = identity.governanceRole || (membership.role === "admin" ? "super_admin" : "member");
    let preferencesAvailable = true;
    if (preferenceResponse.error) {
      preferencesAvailable = false;
      console.warn("User preferences are not available yet", preferenceResponse.error.message);
    } else if (preferenceResponse.data) {
      identity.locale = preferenceResponse.data.locale || "";
      identity.timezone = preferenceResponse.data.timezone || "Europe/Madrid";
    }
    const statusNode = addStatus(identity);
    statusNode.querySelector(".cloud-logout").addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.reload();
    });

    removeLegacyLocalOnlyOutboxEntries();
    const versions = new Map();
    const syncedPayloads = new Map();
    const initialOutbox = readOutbox();
    if (cloudRows.error) throw cloudRows.error;
    cloudRows.data.forEach((row) => {
      versions.set(row.document_key, Number(row.version || 0));
      syncedPayloads.set(row.document_key, cloneJson(row.payload));
      if (!SYNC_KEYS.has(row.document_key)) return;
      const pending = initialOutbox[row.document_key];
      setLocalValue(row.document_key, pending ? pending.payload : row.payload);
    });

    const timers = new Map();
    const pendingPayloads = new Map();
    const saveChains = new Map();
    let activeSaves = 0;

    function dispatchRemoteDocumentUpdate(row) {
      window.dispatchEvent(new CustomEvent("operations:cloud-document-updated", {
        detail: {
          documentKey: row.document_key,
          version: Number(row.version || 0),
          payload: row.payload
        }
      }));
    }

    async function handleRemoteUpdate(row) {
      const documentKey = row?.document_key;
      if (!documentKey || !SYNC_KEYS.has(documentKey)) return;
      const version = Number(row.version || 0);
      const pending = pendingPayloads.get(documentKey) || readOutbox()[documentKey] || null;
      versions.set(documentKey, version);

      if (!pending) {
        const notice = remoteNoticeFor(documentKey);
        if (version && Number(notice.lastAppliedVersion || 0) >= version) return;
        setLocalValue(documentKey, row.payload);
        syncedPayloads.set(documentKey, cloneJson(row.payload));
        updateRemoteNotice(documentKey, {
          lastAppliedVersion: version,
          conflictVersion: 0,
          snoozedUntil: 0,
          lastSeenAt: Date.now()
        });
        recordRemoteActivity(documentKey, version, "auto-applied");
        dispatchRemoteDocumentUpdate(row);
        showRemoteSyncToast(documentKey);
        setStatus(statusNode, "saved", "已更新");
        window.setTimeout(() => {
          if (!statusNode.classList.contains("conflict") && !statusNode.classList.contains("error")) {
            setStatus(statusNode, "", "已同步");
          }
        }, 1800);
        return;
      }

      const analysis = analyzeDocumentConflict(documentKey, pending.basePayload, pending.payload, row.payload);
      if (analysis.hasReliableBase && analysis.conflicts.length === 0) {
        syncedPayloads.set(documentKey, cloneJson(row.payload));
        if (jsonEqual(analysis.mergedPayload, row.payload)) {
          pendingPayloads.delete(documentKey);
          removeOutboxEntry(documentKey);
          setLocalValue(documentKey, row.payload);
          updateRemoteNotice(documentKey, { lastAppliedVersion: version, conflictVersion: 0, snoozedUntil: 0, lastSeenAt: Date.now() });
          clearRemoteConflict(documentKey);
          dispatchRemoteDocumentUpdate(row);
          recordRemoteActivity(documentKey, version, "auto-applied");
          setStatus(statusNode, "saved", "已自动合并");
          return;
        }
        const mergedEntry = {
          ...pending,
          payload: analysis.mergedPayload,
          basePayload: cloneJson(row.payload),
          baseVersion: version,
          mutationId: crypto.randomUUID(),
          queuedAt: new Date().toISOString(),
          attempts: 0
        };
        pendingPayloads.set(documentKey, mergedEntry);
        storeOutboxEntry(documentKey, mergedEntry);
        setLocalValue(documentKey, analysis.mergedPayload);
        clearRemoteConflict(documentKey);
        recordRemoteActivity(documentKey, version, "auto-merged");
        dispatchRemoteDocumentUpdate({ ...row, payload: analysis.mergedPayload });
        setStatus(statusNode, "saving", "自动合并并同步");
        queueKey(documentKey, 0);
        return;
      }

      setStatus(statusNode, "conflict", "有待处理冲突");
      renderRemoteConflict(row, pending, {
        canOverride: documentKey !== ACCESS_DOCUMENT_KEY || identity.platformRole === "platform_owner",
        later() {
          setStatus(statusNode, "conflict", "有待处理冲突");
          renderRemoteActivity();
        },
        async keepLocal() {
          const current = pendingPayloads.get(documentKey) || readOutbox()[documentKey];
          if (!current) return true;
          const rebased = {
            ...current,
            basePayload: cloneJson(row.payload),
            baseVersion: version,
            mutationId: crypto.randomUUID(),
            queuedAt: new Date().toISOString(),
            attempts: 0
          };
          pendingPayloads.set(documentKey, rebased);
          syncedPayloads.set(documentKey, cloneJson(row.payload));
          storeOutboxEntry(documentKey, rebased);
          updateRemoteNotice(documentKey, {
            conflictVersion: 0,
            snoozedUntil: 0,
            lastSeenAt: Date.now()
          });
          clearRemoteConflict(documentKey);
          recordRemoteActivity(documentKey, version, "local-kept");
          setStatus(statusNode, "saving", "同步本地版本");
          queueKey(documentKey, 0);
          return true;
        },
        async useTeam() {
          const current = pendingPayloads.get(documentKey) || readOutbox()[documentKey];
          if (current && !archiveLocalRecovery(documentKey, current, "team_version_applied")) {
            setStatus(statusNode, "error", "本地备份空间不足");
            return false;
          }
          pendingPayloads.delete(documentKey);
          window.clearTimeout(timers.get(documentKey));
          timers.delete(documentKey);
          removeOutboxEntry(documentKey);
          setLocalValue(documentKey, row.payload);
          syncedPayloads.set(documentKey, cloneJson(row.payload));
          updateRemoteNotice(documentKey, {
            lastAppliedVersion: version,
            conflictVersion: 0,
            snoozedUntil: 0,
            lastSeenAt: Date.now()
          });
          clearRemoteConflict(documentKey);
          recordRemoteActivity(documentKey, version, "team-applied");
          dispatchRemoteDocumentUpdate(row);
          showRemoteSyncToast(documentKey);
          setStatus(statusNode, "saved", "已采用团队版本");
          window.setTimeout(() => setStatus(statusNode, "", "已同步"), 1800);
          return true;
        }
      });
    }

    async function saveKey(key) {
      if (!pendingPayloads.has(key)) return;
      const entry = pendingPayloads.get(key);
      pendingPayloads.delete(key);
      activeSaves += 1;
      setStatus(statusNode, "saving", "同步中");
      let blockedByConflict = false;
      let retryDelay = 100;
      try {
        const response = await supabase.rpc("save_workspace_document", {
          p_workspace_id: workspaceId,
          p_document_key: key,
          p_payload: entry.payload,
          p_base_version: Number(entry.baseVersion || 0),
          p_client_mutation_id: entry.mutationId
        });
        if (response.error) throw response.error;
        const result = Array.isArray(response.data) ? response.data[0] : response.data;
        const savedVersion = Number(result?.version || (versions.get(key) || 0) + 1);
        versions.set(key, savedVersion);
        syncedPayloads.set(key, cloneJson(entry.payload));
        removeOutboxEntry(key, entry.mutationId);
        updateRemoteNotice(key, {
          lastAppliedVersion: savedVersion,
          conflictVersion: 0,
          snoozedUntil: 0,
          lastSeenAt: Date.now()
        });
        clearRemoteConflict(key);
        const nextEntry = pendingPayloads.get(key);
        if (nextEntry && Number(nextEntry.baseVersion || 0) === Number(entry.baseVersion || 0)) {
          nextEntry.baseVersion = savedVersion;
          pendingPayloads.set(key, nextEntry);
          storeOutboxEntry(key, nextEntry);
        }
        setStatus(statusNode, "saved", "已同步");
      } catch (error) {
        const conflict = String(error?.message || error).includes("version_conflict");
        blockedByConflict = conflict;
        const latest = pendingPayloads.get(key);
        if (!latest) {
          const failedEntry = { ...entry, attempts: Number(entry.attempts || 0) + 1, lastAttemptAt: new Date().toISOString() };
          pendingPayloads.set(key, failedEntry);
          storeOutboxEntry(key, failedEntry);
          retryDelay = Math.min(30000, 1500 * Math.max(1, failedEntry.attempts));
        }
        setStatus(statusNode, conflict ? "conflict" : "error", conflict ? "存在版本冲突" : "同步失败");
        if (conflict) {
          const remote = await supabase.from("workspace_documents")
            .select("document_key, payload, version, updated_by")
            .eq("workspace_id", workspaceId)
            .eq("document_key", key)
            .maybeSingle();
          if (remote.data) {
            await handleRemoteUpdate(remote.data);
          }
        }
      } finally {
        activeSaves -= 1;
        if (pendingPayloads.has(key) && !blockedByConflict) queueKey(key, retryDelay);
        else if (activeSaves === 0 && !statusNode.classList.contains("error") && !statusNode.classList.contains("conflict")) {
          window.setTimeout(() => setStatus(statusNode, "", "已同步"), 1600);
        }
      }
    }

    function queueKey(key, delay = 750) {
      window.clearTimeout(timers.get(key));
      timers.set(key, window.setTimeout(() => {
        const chain = (saveChains.get(key) || Promise.resolve()).then(() => saveKey(key));
        saveChains.set(key, chain.catch(() => {}));
      }, delay));
    }

    function queuePayload(key, value) {
      if (!SYNC_KEYS.has(key)) return;
      let payload = null;
      try { payload = value === null ? null : JSON.parse(value); } catch { return; }
      const unresolvedConflict = unresolvedRemoteConflicts.get(key);
      const existing = pendingPayloads.get(key) || readOutbox()[key] || null;
      const entry = {
        payload,
        basePayload: existing?.basePayload !== undefined
          ? cloneJson(existing.basePayload)
          : cloneJson(syncedPayloads.get(key)),
        baseVersion: unresolvedConflict && existing
          ? Number(existing.baseVersion || 0)
          : versions.get(key) || 0,
        mutationId: crypto.randomUUID(),
        queuedAt: new Date().toISOString(),
        attempts: 0
      };
      pendingPayloads.set(key, entry);
      storeOutboxEntry(key, entry);
      if (unresolvedConflict) {
        unresolvedConflict.pending = entry;
        setStatus(statusNode, "conflict", "有待处理冲突");
        renderRemoteActivity();
        return;
      }
      queueKey(key);
    }

    Object.entries(initialOutbox).forEach(([key, savedEntry]) => {
      if (!SYNC_KEYS.has(key) || !savedEntry || typeof savedEntry !== "object") return;
      const entry = {
        payload: savedEntry.payload,
        basePayload: savedEntry.basePayload,
        baseVersion: Number(savedEntry.baseVersion || 0),
        mutationId: savedEntry.mutationId || crypto.randomUUID(),
        queuedAt: savedEntry.queuedAt || new Date().toISOString(),
        attempts: Number(savedEntry.attempts || 0)
      };
      pendingPayloads.set(key, entry);
      storeOutboxEntry(key, entry);
      queueKey(key, 120);
    });

    Storage.prototype.setItem = function cloudAwareSetItem(key, value) {
      originalSetItem.call(this, key, value);
      if (!suppressSync && this === localStorage) queuePayload(key, value);
    };
    Storage.prototype.removeItem = function cloudAwareRemoveItem(key) {
      originalRemoveItem.call(this, key);
      if (!suppressSync && this === localStorage) queuePayload(key, null);
    };

    const channel = supabase.channel(`workspace-documents-${workspaceId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "workspace_documents",
        filter: `workspace_id=eq.${workspaceId}`
      }, (event) => {
        const row = event.new;
        if (!row || !SYNC_KEYS.has(row.document_key)) return;
        if (row.updated_by !== session.user.id) void handleRemoteUpdate(row);
      })
      .subscribe();

    const permissionApi = {
      superAdminManagementAvailable: true,
      async listMembers() {
        const response = await supabase.from("workspace_authorizations")
          .select("email, role, activated_at, created_at")
          .eq("workspace_id", workspaceId)
          .is("revoked_at", null)
          .order("created_at", { ascending: true });
        if (response.error) {
          console.error("Authorization list failed", response.error);
          throw new Error(cloudErrorMessage(response.error, "授权成员加载失败，请稍后重试。"));
        }
        return response.data || [];
      },
      async authorizeMember(email, role) {
        const response = await supabase.rpc("authorize_workspace_member", {
          p_workspace_id: workspaceId,
          p_email: String(email || "").trim(),
          p_role: String(role || "editor")
        });
        if (response.error) {
          console.error("Authorization save failed", response.error);
          throw new Error(cloudErrorMessage(response.error, "授权保存失败，请稍后重试。"));
        }
        return Array.isArray(response.data) ? response.data[0] : response.data;
      },
      async revokeMember(email) {
        const response = await supabase.rpc("revoke_workspace_member", {
          p_workspace_id: workspaceId,
          p_email: String(email || "").trim()
        });
        if (response.error) {
          console.error("Authorization revoke failed", response.error);
          throw new Error(cloudErrorMessage(response.error, "撤销失败，请稍后重试。"));
        }
        return Array.isArray(response.data) ? response.data[0] : response.data;
      },
      async listPlatformRoles() {
        const response = await supabase.from("workspace_platform_roles")
          .select("email, role, created_at, updated_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true });
        if (response.error) throw new Error(cloudErrorMessage(response.error, "平台治理角色加载失败，请稍后重试。"));
        return response.data || [];
      },
      async transferOwnership(email) {
        if (identity.platformRole !== "platform_owner") throw new Error("platform_owner_permission_required");
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const response = await supabase.rpc("transfer_workspace_ownership", {
          p_workspace_id: workspaceId,
          p_new_owner_email: normalizedEmail
        });
        if (response.error) throw new Error(cloudErrorMessage(response.error, "平台所有权更新失败，请稍后重试。"));
        const result = Array.isArray(response.data) ? response.data[0] : response.data;
        if (normalizedEmail === identity.email.toLowerCase()) {
          identity.governanceRole = "platform_owner";
          identity.platformRole = "platform_owner";
        } else {
          identity.governanceRole = "super_admin";
          identity.platformRole = "super_admin";
        }
        return result;
      },
      async setSuperAdmin(email, enabled) {
        if (identity.platformRole !== "platform_owner") throw new Error("platform_owner_permission_required");
        const response = await supabase.rpc("set_workspace_super_admin", {
          p_workspace_id: workspaceId,
          p_email: String(email || "").trim(),
          p_enabled: Boolean(enabled)
        });
        if (response.error) throw new Error(cloudErrorMessage(response.error, "超级管理员权限更新失败，请稍后重试。"));
        return Array.isArray(response.data) ? response.data[0] : response.data;
      }
    };

    const preferenceApi = {
      available: preferencesAvailable,
      async setLocale(locale) {
        if (!preferencesAvailable) return null;
        const normalizedLocale = locale === "en-GB" ? "en-GB" : "zh-CN";
        const response = await supabase.from("user_preferences").upsert({
          user_id: session.user.id,
          locale: normalizedLocale,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" }).select("locale, timezone").single();
        if (response.error) throw response.error;
        identity.locale = response.data.locale;
        identity.timezone = response.data.timezone;
        return response.data;
      }
    };

    const backupApi = {
      async listVersions(documentKey, limit = 50) {
        const response = await supabase.from("workspace_document_versions")
          .select("document_key, version, operation, source_version, created_by, created_at")
          .eq("workspace_id", workspaceId)
          .eq("document_key", documentKey)
          .order("version", { ascending: false })
          .limit(Math.min(200, Math.max(1, Number(limit || 50))));
        if (response.error) throw response.error;
        return response.data || [];
      },
      async getVersion(documentKey, version) {
        const response = await supabase.from("workspace_document_versions")
          .select("document_key, version, payload, operation, source_version, created_by, created_at")
          .eq("workspace_id", workspaceId)
          .eq("document_key", documentKey)
          .eq("version", Number(version))
          .single();
        if (response.error) throw response.error;
        return response.data;
      },
      async restoreVersion(documentKey, version) {
        if (identity.role !== "admin") throw new Error("admin_permission_required");
        const response = await supabase.rpc("restore_workspace_document_version", {
          p_workspace_id: workspaceId,
          p_document_key: documentKey,
          p_source_version: Number(version),
          p_client_mutation_id: crypto.randomUUID()
        });
        if (response.error) throw response.error;
        return Array.isArray(response.data) ? response.data[0] : response.data;
      },
      localRecoveryCount() {
        const records = readJsonStorage(RECOVERY_KEY, []);
        return Array.isArray(records) ? records.length : 0;
      }
    };

    window.cloudStore = {
      enabled: true,
      supabase,
      identity,
      permissions: permissionApi,
      preferences: preferenceApi,
      backups: backupApi,
      hasDocument(key) { return versions.has(key); },
      queuePayload,
      captureAll() {
        SYNC_KEYS.forEach((key) => {
          const value = localStorage.getItem(key);
          if (value !== null && !versions.has(key)) queuePayload(key, value);
        });
      },
      async flush() {
        timers.forEach((timer, key) => {
          window.clearTimeout(timer);
          timers.delete(key);
          const chain = (saveChains.get(key) || Promise.resolve()).then(() => saveKey(key));
          saveChains.set(key, chain.catch(() => {}));
        });
        await Promise.all([...saveChains.values()]);
      },
      destroy() { supabase.removeChannel(channel); }
    };

    window.addEventListener("online", () => {
      pendingPayloads.forEach((entry, key) => queueKey(key, 0));
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") window.cloudStore.flush();
    });
  }

  window.cloudSyncReady = start().catch((error) => {
    console.error("Cloud sync failed", error);
    const root = document.createElement("div");
    root.className = "cloud-auth-backdrop";
    root.innerHTML = `<section class="cloud-auth-panel"><div class="cloud-auth-brand"><span class="cloud-auth-mark">OP</span><h1>云端连接失败</h1></div><p>${escapeHtml(error.message || error)}</p><button class="cloud-auth-submit" type="button">重新加载</button></section>`;
    document.body.appendChild(root);
    root.querySelector("button").addEventListener("click", () => window.location.reload());
    throw error;
  });
})();
