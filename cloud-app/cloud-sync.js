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
    .cloud-status{position:fixed;z-index:4500;right:14px;top:66px;display:flex;align-items:center;gap:8px;min-height:34px;padding:6px 9px;border:1px solid #d8e0eb;border-radius:6px;background:rgba(255,255,255,.97);box-shadow:0 8px 24px rgba(30,42,64,.12);font:600 11px/1.2 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#4d5b70}
    .cloud-status-dot{width:7px;height:7px;border-radius:50%;background:#11845b}.cloud-status.saving .cloud-status-dot{background:#225be8;animation:cloud-pulse 1s infinite}.cloud-status.error .cloud-status-dot,.cloud-status.conflict .cloud-status-dot{background:#e4232f}.cloud-status button{border:0;background:transparent;color:#225be8;font:inherit;cursor:pointer;padding:2px 3px}.cloud-status .cloud-logout{color:#65738a;border-left:1px solid #d8e0eb;padding-left:8px}
    .cloud-update-banner{position:fixed;z-index:4600;left:50%;top:72px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;border:1px solid #b8ccff;border-radius:6px;background:#edf3ff;color:#172033;padding:9px 12px;box-shadow:0 10px 28px rgba(34,91,232,.14);font:700 12px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.cloud-update-banner button{border:0;border-radius:5px;background:#225be8;color:#fff;padding:6px 10px;font-weight:800;cursor:pointer}
    .cloud-dialog-backdrop{position:fixed;inset:0;z-index:4800;display:grid;place-items:center;background:rgba(23,32,51,.42);padding:16px}.cloud-dialog{width:min(540px,100%);background:#fff;border:1px solid #d8e0eb;border-radius:8px;box-shadow:0 24px 64px rgba(24,35,55,.22);padding:22px}.cloud-dialog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.cloud-dialog h2{margin:0;font-size:18px}.cloud-dialog-header p{margin:5px 0 0;color:#65738a;font-size:12px;line-height:1.5}.cloud-dialog-close{width:30px;height:30px;border:1px solid #d8e0eb;border-radius:5px;background:#fff;color:#65738a;font-size:18px;cursor:pointer}.cloud-invite-form{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:12px}.cloud-invite-form label{display:grid;gap:6px;color:#4d5b70;font-size:12px;font-weight:700}.cloud-invite-form input,.cloud-invite-form select{height:40px;border:1px solid #c7d2e2;border-radius:6px;background:#fff;padding:0 10px;color:#172033;font:inherit}.cloud-invite-form input:focus,.cloud-invite-form select:focus{outline:2px solid #b8ccff;border-color:#225be8}.cloud-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:18px}.cloud-dialog-actions button{height:38px;border-radius:6px;padding:0 16px;font-weight:800;cursor:pointer}.cloud-dialog-cancel{border:1px solid #c7d2e2;background:#fff;color:#4d5b70}.cloud-dialog-submit{border:0;background:#225be8;color:#fff}.cloud-dialog-submit:disabled{opacity:.55;cursor:wait}.cloud-invite-message{min-height:18px;margin:12px 0 0;color:#d82331;font-size:12px}.cloud-invite-message.success{color:#11845b}.cloud-authorization-list{margin-top:18px;border-top:1px solid #e3e8f0;padding-top:14px}.cloud-authorization-list h3{margin:0 0 9px;font-size:12px;color:#4d5b70}.cloud-authorization-items{display:grid;gap:7px;max-height:210px;overflow:auto}.cloud-authorization-row{display:grid;grid-template-columns:minmax(0,1fr) 64px 70px;align-items:center;gap:8px;min-height:38px;border:1px solid #e3e8f0;border-radius:6px;padding:6px 8px;font-size:11px}.cloud-authorization-email{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#172033;font-weight:700}.cloud-authorization-state{color:#65738a}.cloud-authorization-revoke{height:28px;border:1px solid #f0b7bc;border-radius:5px;background:#fff;color:#c91d2e;font-size:11px;font-weight:700;cursor:pointer}.cloud-authorization-empty{padding:12px;border:1px dashed #d8e0eb;border-radius:6px;text-align:center;color:#65738a;font-size:11px}
    @keyframes cloud-pulse{50%{opacity:.35}}
    @media(max-width:760px){.cloud-status{top:auto;bottom:10px;right:10px}.cloud-status .cloud-email{display:none}.cloud-update-banner{top:58px;width:calc(100vw - 24px);justify-content:space-between}}
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
    const inviteButton = identity.role === "admin" ? '<button class="cloud-invite" type="button">授权成员</button>' : "";
    node.innerHTML = `<span class="cloud-status-dot"></span><span data-cloud-status-text>云端已连接</span><span class="cloud-email">${escapeHtml(identity.email)}</span>${inviteButton}<button class="cloud-logout" type="button">退出</button>`;
    document.body.appendChild(node);
    return node;
  }

  function renderAuthorizationDialog(supabase, identity) {
    document.querySelector(".cloud-dialog-backdrop")?.remove();
    const root = document.createElement("div");
    root.className = "cloud-dialog-backdrop";
    root.innerHTML = `
      <section class="cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="cloudInviteTitle">
        <div class="cloud-dialog-header">
          <div><h2 id="cloudInviteTitle">授权 Google 邮箱</h2><p>仅精确匹配的邮箱可以使用 Google 登录进入当前团队空间。</p></div>
          <button class="cloud-dialog-close" type="button" aria-label="关闭">×</button>
        </div>
        <form>
          <div class="cloud-invite-form">
            <label>Google 邮箱<input name="email" type="email" autocomplete="email" placeholder="name@company.com" required></label>
            <label>云端权限<select name="role"><option value="editor">可编辑</option><option value="viewer">只读</option></select></label>
          </div>
          <p class="cloud-invite-message" role="status"></p>
          <div class="cloud-dialog-actions"><button class="cloud-dialog-cancel" type="button">关闭</button><button class="cloud-dialog-submit" type="submit">确认授权</button></div>
        </form>
        <section class="cloud-authorization-list"><h3>当前有效授权</h3><div class="cloud-authorization-items" data-cloud-authorization-items><div class="cloud-authorization-empty">正在加载...</div></div></section>
      </section>`;
    document.body.appendChild(root);
    const emailInput = root.querySelector('input[name="email"]');
    const message = root.querySelector(".cloud-invite-message");
    const submit = root.querySelector(".cloud-dialog-submit");
    const items = root.querySelector("[data-cloud-authorization-items]");
    const close = () => root.remove();
    root.querySelector(".cloud-dialog-close").addEventListener("click", close);
    root.querySelector(".cloud-dialog-cancel").addEventListener("click", close);
    root.addEventListener("click", (event) => { if (event.target === root) close(); });

    async function loadAuthorizations() {
      const response = await supabase.from("workspace_authorizations")
        .select("email, role, activated_at")
        .eq("workspace_id", identity.workspaceId)
        .is("revoked_at", null)
        .order("created_at", { ascending: true });
      if (response.error) {
        items.innerHTML = `<div class="cloud-authorization-empty">${escapeHtml(response.error.message)}</div>`;
        return;
      }
      if (!response.data.length) {
        items.innerHTML = '<div class="cloud-authorization-empty">暂无有效授权</div>';
        return;
      }
      items.innerHTML = response.data.map((item) => `
        <div class="cloud-authorization-row">
          <span class="cloud-authorization-email" title="${escapeHtml(item.email)}">${escapeHtml(item.email)}</span>
          <span class="cloud-authorization-state">${item.role === "editor" ? "可编辑" : "只读"}</span>
          <button class="cloud-authorization-revoke" type="button" data-revoke-email="${escapeHtml(item.email)}">撤销</button>
        </div>`).join("");
      items.querySelectorAll("[data-revoke-email]").forEach((button) => button.addEventListener("click", async () => {
        const email = button.dataset.revokeEmail;
        if (!window.confirm(`确认撤销 ${email} 的访问权限？`)) return;
        button.disabled = true;
        const revokeResponse = await supabase.rpc("revoke_workspace_member", {
          p_workspace_id: identity.workspaceId,
          p_email: email
        });
        if (revokeResponse.error) {
          message.textContent = revokeResponse.error.message.includes("cannot_revoke_current_admin") ? "不能撤销当前登录管理员自身的权限。" : revokeResponse.error.message;
          button.disabled = false;
          return;
        }
        message.textContent = "访问权限已撤销。";
        message.classList.add("success");
        await loadAuthorizations();
      }));
    }

    root.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      submit.disabled = true;
      message.textContent = "正在保存授权...";
      message.classList.remove("success");
      const response = await supabase.rpc("authorize_workspace_member", {
        p_workspace_id: identity.workspaceId,
        p_email: String(form.get("email") || "").trim(),
        p_role: String(form.get("role") || "editor")
      });
      submit.disabled = false;
      if (response.error) {
        message.textContent = response.error.message;
        return;
      }
      const result = Array.isArray(response.data) ? response.data[0] : response.data;
      message.textContent = result?.status === "active" ? "该成员已激活，新权限立即生效。" : "邮箱已授权，成员现在可以使用 Google 登录。";
      message.classList.add("success");
      emailInput.value = "";
      emailInput.focus();
      await loadAuthorizations();
    });
    loadAuthorizations();
    window.setTimeout(() => emailInput.focus(), 0);
  }

  function setStatus(node, status, text) {
    if (!node) return;
    node.className = `cloud-status ${status || ""}`.trim();
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
    statusNode.querySelector(".cloud-invite")?.addEventListener("click", () => renderAuthorizationDialog(supabase, identity));
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
      setStatus(statusNode, "saving", "正在同步");
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
        setStatus(statusNode, "saved", "刚刚已同步");
      } catch (error) {
        const conflict = String(error?.message || error).includes("version_conflict");
        setStatus(statusNode, conflict ? "conflict" : "error", conflict ? "存在版本冲突" : "同步失败");
      } finally {
        activeSaves -= 1;
        if (pendingPayloads.has(key)) queueKey(key, 100);
        else if (activeSaves === 0 && !statusNode.classList.contains("error") && !statusNode.classList.contains("conflict")) {
          window.setTimeout(() => setStatus(statusNode, "", "云端已连接"), 1600);
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

    window.cloudStore = {
      enabled: true,
      supabase,
      identity,
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
