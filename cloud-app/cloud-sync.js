(function initializeCloudSync() {
  const SYNC_KEYS = new Set([
    "salesInventoryPlanningTool.v1",
    "projectTrackingTool.v1",
    "projectTrackingData.v1",
    "projectTrackingDrafts.v1",
    "projectTrackingAccess.v1",
    "projectTrackingFormDrafts.v1"
  ]);
  const offline = new URLSearchParams(window.location.search).get("offline") === "1";

  const styles = `
    .cloud-auth-backdrop{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;background:#eef2f7;color:#172033;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .cloud-auth-panel{width:min(420px,calc(100vw - 32px));background:#fff;border:1px solid #d8e0eb;border-radius:8px;box-shadow:0 24px 64px rgba(24,35,55,.18);padding:28px}
    .cloud-auth-brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}.cloud-auth-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:7px;background:#172033;color:#fff;font-size:12px;font-weight:800}
    .cloud-auth-panel h1{font-size:21px;margin:0}.cloud-auth-panel p{margin:6px 0 20px;color:#65738a;font-size:13px;line-height:1.55}
    .cloud-google-login{width:100%;height:42px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #c7d2e2;border-radius:6px;background:#fff;color:#172033;font:700 13px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.cloud-google-login:hover{border-color:#8fa5c4;background:#f8fafc}.cloud-google-login:focus{outline:2px solid #b8ccff;border-color:#225be8}.cloud-google-login:disabled{opacity:.55;cursor:wait}.cloud-google-mark{display:grid;place-items:center;width:22px;height:22px;border:1px solid #d8e0eb;border-radius:50%;color:#4285f4;font-size:13px;font-weight:900}.cloud-auth-policy{margin:14px 0 0!important;text-align:center;color:#65738a!important;font-size:11px!important}.cloud-auth-message{min-height:18px;margin:12px 0 0!important;color:#d82331!important;font-size:12px!important;text-align:center}.cloud-auth-message.success{color:#11845b!important}
    .cloud-status{position:relative;z-index:30;display:inline-flex;align-items:center;flex:0 0 auto;font:600 10px/1.2 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#4d5b70}.cloud-status-trigger{height:28px;display:inline-flex;align-items:center;gap:6px;border:1px solid #d8e0eb;border-radius:5px;background:#fff;padding:0 8px;color:#4d5b70;font:inherit;cursor:pointer;white-space:nowrap}.cloud-status-trigger:hover,.cloud-status-trigger[aria-expanded="true"]{border-color:#9fb0c8;background:#f7f9fc}.cloud-status-dot{width:7px;height:7px;border-radius:50%;background:#11845b;flex:0 0 auto}.cloud-status.saving .cloud-status-dot{background:#225be8;animation:cloud-pulse 1s infinite}.cloud-status.error .cloud-status-dot,.cloud-status.conflict .cloud-status-dot{background:#e4232f}.cloud-status-chevron{width:6px;height:6px;border-right:1.5px solid #65738a;border-bottom:1.5px solid #65738a;transform:rotate(45deg) translateY(-2px);transition:transform .15s ease}.cloud-status-trigger[aria-expanded="true"] .cloud-status-chevron{transform:rotate(225deg) translate(-1px,-1px)}.cloud-account-menu{position:absolute;top:calc(100% + 6px);right:0;width:244px;border:1px solid #d8e0eb;border-radius:7px;background:#fff;box-shadow:0 14px 36px rgba(24,35,55,.18);padding:7px}.cloud-account-menu[hidden]{display:none}.cloud-account-summary{padding:7px 8px 9px;border-bottom:1px solid #e3e8f0;margin-bottom:5px}.cloud-account-email{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#172033;font-size:11px;font-weight:800}.cloud-account-role{display:block;margin-top:3px;color:#65738a;font-size:9px}.cloud-account-menu button{width:100%;min-height:31px;display:flex;align-items:center;border:0;border-radius:5px;background:transparent;padding:0 8px;color:#4d5b70;font:700 10px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.cloud-account-menu button:hover{background:#f1f4f8;color:#172033}.cloud-account-menu .cloud-logout{color:#b42331}
    .cloud-update-banner{position:fixed;z-index:4600;left:50%;top:72px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;border:1px solid #b8ccff;border-radius:6px;background:#edf3ff;color:#172033;padding:9px 12px;box-shadow:0 10px 28px rgba(34,91,232,.14);font:700 12px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.cloud-update-banner button{border:0;border-radius:5px;background:#225be8;color:#fff;padding:6px 10px;font-weight:800;cursor:pointer}
    @keyframes cloud-pulse{50%{opacity:.35}}
    @media(max-width:760px){.cloud-update-banner{top:58px;width:calc(100vw - 24px);justify-content:space-between}}
  `;
  const style = document.createElement("style");
  style.textContent = styles;
  document.head.appendChild(style);

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let suppressSync = false;

  function setLocalValue(key, payload) {
    suppressSync = true;
    try {
      if (payload === null || payload === undefined) originalRemoveItem.call(localStorage, key);
      else originalSetItem.call(localStorage, key, JSON.stringify(payload));
    } finally {
      suppressSync = false;
    }
  }

  function addStatus(identity) {
    const node = document.createElement("div");
    node.className = "cloud-status";
    const roleLabel = identity.role === "admin" ? "云端管理员" : identity.role === "editor" ? "云端可编辑" : "云端只读";
    node.innerHTML = `
      <button class="cloud-status-trigger" type="button" aria-expanded="false" aria-haspopup="menu" title="云端账号与同步状态">
        <span class="cloud-status-dot"></span><span data-cloud-status-text>已同步</span><span class="cloud-status-chevron" aria-hidden="true"></span>
      </button>
      <div class="cloud-account-menu" role="menu" hidden>
        <div class="cloud-account-summary"><span class="cloud-account-email">${escapeHtml(identity.email)}</span><span class="cloud-account-role">${roleLabel}</span></div>
        <button class="cloud-logout" type="button">退出登录</button>
      </div>`;
    const mount = document.getElementById("cloudStatusMount");
    (mount || document.body).appendChild(node);
    const trigger = node.querySelector(".cloud-status-trigger");
    const menu = node.querySelector(".cloud-account-menu");
    const closeMenu = () => { menu.hidden = true; trigger.setAttribute("aria-expanded", "false"); };
    trigger.addEventListener("click", () => {
      const opening = menu.hidden;
      menu.hidden = !opening;
      trigger.setAttribute("aria-expanded", String(opening));
    });
    menu.addEventListener("click", (event) => { if (event.target.closest("button")) closeMenu(); });
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

  function showRemoteUpdate(payload) {
    let banner = document.querySelector(".cloud-update-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "cloud-update-banner";
      document.body.appendChild(banner);
    }
    banner.innerHTML = `<span>其他成员更新了共享数据</span><button type="button">加载团队版本</button>`;
    banner.querySelector("button").addEventListener("click", () => {
      setLocalValue(payload.document_key, payload.payload);
      window.location.reload();
    });
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
            redirectTo: window.location.origin,
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

  async function start() {
    if (offline) {
      window.cloudStore = { enabled: false, offline: true };
      return;
    }
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    if (!configResponse.ok) throw new Error("云端配置不可用");
    const config = await configResponse.json();
    if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error("Supabase 环境变量未配置");
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
      workspaceName: membership.workspaces?.name || "运营计划"
    };
    const statusNode = addStatus(identity);
    statusNode.querySelector(".cloud-logout").addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.reload();
    });

    const versions = new Map();
    const cloudRows = await supabase.from("workspace_documents")
      .select("document_key, payload, version")
      .eq("workspace_id", workspaceId);
    if (cloudRows.error) throw cloudRows.error;
    cloudRows.data.forEach((row) => {
      versions.set(row.document_key, Number(row.version || 0));
      if (SYNC_KEYS.has(row.document_key)) setLocalValue(row.document_key, row.payload);
    });

    const timers = new Map();
    const pendingPayloads = new Map();
    const saveChains = new Map();
    let activeSaves = 0;

    async function saveKey(key) {
      if (!pendingPayloads.has(key)) return;
      const payload = pendingPayloads.get(key);
      pendingPayloads.delete(key);
      activeSaves += 1;
      setStatus(statusNode, "saving", "同步中");
      try {
        const response = await supabase.rpc("save_workspace_document", {
          p_workspace_id: workspaceId,
          p_document_key: key,
          p_payload: payload,
          p_base_version: versions.get(key) || 0,
          p_client_mutation_id: crypto.randomUUID()
        });
        if (response.error) throw response.error;
        const result = Array.isArray(response.data) ? response.data[0] : response.data;
        versions.set(key, Number(result?.version || (versions.get(key) || 0) + 1));
        setStatus(statusNode, "saved", "已同步");
      } catch (error) {
        const conflict = String(error?.message || error).includes("version_conflict");
        setStatus(statusNode, conflict ? "conflict" : "error", conflict ? "存在版本冲突" : "同步失败");
      } finally {
        activeSaves -= 1;
        if (pendingPayloads.has(key)) queueKey(key, 100);
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
      pendingPayloads.set(key, payload);
      queueKey(key);
    }

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
        versions.set(row.document_key, Number(row.version || 0));
        if (row.updated_by !== session.user.id) showRemoteUpdate(row);
      })
      .subscribe();

    const permissionApi = {
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
      }
    };

    window.cloudStore = {
      enabled: true,
      supabase,
      identity,
      permissions: permissionApi,
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
