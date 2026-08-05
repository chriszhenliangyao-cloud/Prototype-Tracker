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

## 成员接入

1. 首位管理员使用预先登记的管理员邮箱完成“受邀注册”和邮箱验证。
2. 管理员登录后，从右上角选择“邀请成员”，填写成员邮箱并选择“可编辑”或“只读”。
3. 成员使用相同邮箱完成“受邀注册”，随后自动加入共享工作区。
4. 对于项目模块的部门职责，管理员再从工具级“账号与权限”中分配部门、工作流和数据范围。

云端角色控制工作区级别的读写权限；工具内角色继续控制具体职能模块和操作入口。未被邀请的注册账号不会获得任何工作区数据权限。

## 数据同步

以下浏览器状态会保存为工作区共享文档：

- 产销计划、月度流程、版本与变更记录
- 项目列表、时间线修订和跨职能状态
- 项目编辑草稿、表单草稿和工具内账号权限

每次保存都使用文档版本号进行并发校验。其他成员更新后，当前页面会显示“加载团队版本”提示；用户确认后再载入远端数据，避免静默覆盖正在编辑的内容。

## 数据库变更

Supabase DDL 位于仓库根目录 `supabase/migrations/`。新增结构、策略或函数必须通过新 migration 发布，不直接修改已有 migration。
