import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildAuthorizationUrl } from "@/lib/auth/cognito";
import { getAuthConfig } from "@/lib/auth/config";
import {
  authFlowCookieName,
  createAuthFlowCookie
} from "@/lib/auth/flowCookie";
import { createCodeChallenge, createRandomToken } from "@/lib/auth/pkce";
import { normalizeAuthReturnTo } from "@/lib/auth/returnTo";
import {
  authCookieOptions,
  getCurrentSession,
  getSessionFromCookieValue
} from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { createSupabaseRouteClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  const returnTo = normalizeAuthReturnTo(
    request.nextUrl.searchParams.get("returnTo")
  );

  if (!config.enabled) {
    return NextResponse.redirect(new URL(returnTo, config.appUrl));
  }

  const switchAccount =
    request.nextUrl.searchParams.get("switchAccount") === "1";
  const currentSession = config.provider === "supabase"
    ? await getCurrentSession()
    : getSessionFromCookieValue(request.cookies.get(sessionCookieName)?.value);

  if (currentSession && !switchAccount) {
    const response = NextResponse.redirect(new URL(returnTo, config.appUrl));
    response.headers.set("cache-control", "no-store");
    return response;
  }

  if (config.provider === "supabase") {
    const embedded =
      request.nextUrl.searchParams.get("platformEmbed") === "1" ||
      request.headers.get("sec-fetch-dest") === "iframe";
    const standalone = request.nextUrl.searchParams.get("standalone") === "1";
    if (embedded && !standalone) {
      return embeddedLoginResponse(config.appUrl, returnTo);
    }

    const response = NextResponse.redirect(new URL(returnTo, config.appUrl));
    const client = createSupabaseRouteClient(request, response, config);
    const callbackUrl = new URL("/auth/callback", config.appUrl);
    callbackUrl.searchParams.set("returnTo", returnTo);
    const result = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: "select_account" }
      }
    });
    if (result.error || !result.data.url) {
      throw result.error || new Error("Supabase did not return an OAuth URL.");
    }
    response.headers.set("location", result.data.url);
    response.headers.set("cache-control", "no-store");
    return response;
  }

  const state = createRandomToken();
  const verifier = createRandomToken(64);
  const challenge = createCodeChallenge(verifier);
  const response = NextResponse.redirect(
    buildAuthorizationUrl(config, state, challenge, {
      prompt: "select_account"
    })
  );

  response.cookies.set(
    authFlowCookieName(state),
    createAuthFlowCookie({ state, verifier, returnTo }),
    authCookieOptions(600)
  );
  response.headers.set("cache-control", "no-store");

  return response;
}

function embeddedLoginResponse(appUrl: string, returnTo: string) {
  const loginUrl = new URL("/auth/login", appUrl);
  loginUrl.searchParams.set("returnTo", "/auth/embedded-complete");
  loginUrl.searchParams.set("standalone", "1");
  const scriptValues = JSON.stringify({
    returnTo,
    loginUrl: loginUrl.toString()
  }).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>连接经营规划工作区</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f7f9fc;color:#172033;font:14px/1.5 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{min-height:100vh;display:grid;place-items:center;padding:24px}.panel{width:min(460px,100%);border:1px solid #d7e0ee;border-radius:8px;background:#fff;padding:28px;box-shadow:0 12px 32px rgba(23,32,51,.08)}.mark{display:grid;place-items:center;width:36px;height:36px;border-radius:7px;background:#172033;color:#fff;font-size:12px;font-weight:800}.title{margin:16px 0 6px;font-size:20px}.copy{margin:0;color:#66758c}.status{margin:20px 0 0;padding:12px 14px;border:1px solid #cfdbef;border-radius:6px;background:#f2f6ff;color:#2459c4;font-weight:700}.actions{display:none;gap:10px;margin-top:16px}.actions.ready{display:flex}.button{min-height:40px;border:1px solid #c7d2e2;border-radius:6px;background:#fff;color:#172033;padding:0 16px;font-weight:750;cursor:pointer}.button.primary{border-color:#245eea;background:#245eea;color:#fff}.hint{margin:14px 0 0;color:#7a879b;font-size:12px}
  </style>
</head>
<body>
  <main class="shell"><section class="panel" aria-labelledby="title">
    <div class="mark">OP</div>
    <h1 class="title" id="title">连接经营规划模块</h1>
    <p class="copy">当前平台会话尚未同步，请在新窗口重新确认 Google 登录。</p>
    <div class="status" id="status" role="status">完成登录后，此页面会自动刷新。</div>
    <div class="actions ready" id="actions">
      <button class="button primary" id="login" type="button">在新窗口确认登录</button>
      <button class="button" id="retry" type="button">我已登录，重新加载</button>
    </div>
    <p class="hint">登录在当前平台域名内完成，不会跳转到独立应用。</p>
  </section></main>
  <script>
    const config = ${scriptValues};
    const statusNode = document.getElementById("status");
    document.getElementById("retry").addEventListener("click", () => window.location.replace(config.returnTo));
    document.getElementById("login").addEventListener("click", () => {
      const popup = window.open(config.loginUrl, "commercial-planning-login", "popup,width=520,height=720");
      if (!popup) {
        window.open(config.loginUrl, "_blank", "noopener");
        statusNode.textContent = "登录页已在新标签打开，完成后点击“我已登录，重新加载”。";
        return;
      }
      statusNode.textContent = "等待新窗口完成登录...";
      const poll = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(poll);
          window.location.replace(config.returnTo);
        }
      }, 500);
    });
  </script>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
