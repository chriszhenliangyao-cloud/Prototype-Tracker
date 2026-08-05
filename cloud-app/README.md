# 运营计划协同平台

该目录是现有产销管理与项目跟进工具的独立云端版本。前端部署在 Vercel，Supabase 提供登录、团队成员、共享数据、版本号、审计事件和实时更新通知。

## 线上环境

- Production: `https://operations-planning-hub.vercel.app`
- Vercel project: `operations-planning-hub`
- Supabase project ref: `yzsmdwbuuwhsqrewecle`
- Supabase region: `eu-west-1`

## 本地运行

1. 复制 `.env.example` 为 `.env.local` 并填写 Supabase URL 和 publishable key。
2. 执行 `npm run dev`，或用任意静态服务器打开该目录。
3. 静态服务器调试原型时可使用 `?offline=1` 跳过云端登录。

`.env.local` 和 `.vercel/` 已被忽略，不能提交密钥或本机项目元数据。

## 部署

```bash
cd cloud-app
npx vercel@latest --prod --yes
```

Vercel Production 环境需要配置：

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

`/api/config` 只向浏览器返回这两个公开配置。数据库权限由 Supabase Auth、RLS 和 RPC 内部角色校验控制。

## Google 登录配置

生产环境采用“精确邮箱预授权 + Google OAuth”，不提供密码注册入口。上线前需要完成以下一次性配置：

1. 在 Google Cloud Console 配置 OAuth consent screen。
2. 创建类型为 Web application 的 OAuth 2.0 Client。
3. Authorized JavaScript origin 添加 `https://operations-planning-hub.vercel.app`。
4. Authorized redirect URI 添加 `https://yzsmdwbuuwhsqrewecle.supabase.co/auth/v1/callback`。
5. 在 Supabase Dashboard 的 Authentication > Sign In / Providers > Google 中启用 Google，并填写 Client ID 和 Client Secret。
6. 在 Authentication > URL Configuration 中，将 Site URL 设置为 `https://operations-planning-hub.vercel.app`，并把相同地址加入 Redirect URLs。

Google Client Secret 只保存在 Google Cloud 和 Supabase，不写入 Vercel、前端代码或本仓库。

## 成员接入

1. 首位管理员使用预先授权的 Google 邮箱登录。
2. 管理员从工具顶栏打开“权限管理”，填写成员的完整 Google 邮箱并选择“可编辑”或“只读”。
3. 授权成功后，成员会自动加入同一张权限表，工具角色默认设为“只读用户”；管理员继续分配部门、工作流和项目范围，再保存职责。
4. 成员点击“使用 Google 登录”；邮箱精确匹配授权记录后自动进入共享工作区。
5. 管理员可在成员行更新云端角色或撤销登录。撤销会立即移除工作区关系，但保留工具职责记录用于审计或后续恢复。

统一权限界面同时展示邮箱授权状态、云端角色、工具角色、部门、职能和项目范围。云端角色控制工作区级别的读写权限并即时生效；工具内角色控制具体职能模块和操作入口，自动保存为草稿后仍需“保存职责并生效”。Google 登录只负责确认邮箱身份，未预先授权的邮箱即使完成 Google 验证也无法读取任何工作区数据。

## 数据同步

以下浏览器状态会保存为工作区共享文档：

- 产销计划、月度流程、版本与变更记录
- 项目列表、时间线修订和跨职能状态
- 项目编辑草稿、表单草稿和工具内账号权限

每次保存都使用文档版本号进行并发校验。其他成员更新后，当前页面会显示“加载团队版本”提示；用户确认后再载入远端数据，避免静默覆盖正在编辑的内容。

## 数据库变更

Supabase DDL 位于仓库根目录 `supabase/migrations/`。新增结构、策略或函数必须通过新 migration 发布，不直接修改已有 migration。
