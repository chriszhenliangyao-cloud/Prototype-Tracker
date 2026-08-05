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

## 权限模型

最终业务权限由四层共同决定：平台角色、一个或多个职能角色、数据范围、审批权限。权限管理固定分为“成员账号、角色模板、数据范围、审批权限”四个标签，切换时弹窗尺寸保持不变。

- 平台角色控制系统级能力，包括超级管理员、权限管理员、普通成员、审计只读和外部协作。
- 职能角色控制模块和业务操作，可按岗位叠加；内置管理层、计划、PMO、销售预测、供应、物流、经营、结算、市场、部门协作、审批和审计等角色模板。
- 数据范围按市场、客户、产品、项目、工作流和财务主体配置；默认拒绝，“全部”与具体选项互斥。
- 审批权限独立配置审批类型、发布/月结/归档权限、单笔额度、币种、替代审批人和有效期。
- 登录授权即时生效；业务权限修改自动保存为个人草稿，点击“保存权限并生效”后应用，并生成不可覆盖的审计记录。
- 成员只停用或撤销，不硬删除。新增成员默认仅有登录和工作台权限，符合最小权限原则。

## 数据同步

以下浏览器状态会保存为工作区共享文档：

- 产销计划、月度流程、版本与变更记录
- 项目列表、时间线修订和跨职能状态
- 项目编辑草稿、表单草稿和工具内账号权限

每次保存都使用文档版本号进行并发校验。其他成员更新后，当前页面会显示“加载团队版本”提示；用户确认后再载入远端数据，避免静默覆盖正在编辑的内容。

## 数据版本、恢复与备份

共享业务文档采用“当前版本 + 不可覆盖历史版本”双层存储：

- `workspace_documents` 保存每份文档的最新数据和当前版本号。
- `workspace_document_versions` 在每次成功同步时保存一份完整 JSON 数据，记录文档、版本、操作人、时间、操作类型和客户端变更 ID；客户端没有更新或删除权限。
- 保存当前数据、写入历史版本和生成审计事件在同一个数据库事务中完成，任一步失败都会整体回滚。
- 管理员恢复历史版本时不会覆盖或删除历史记录，而是以历史内容生成一个新的当前版本，并记录来源版本。
- 浏览器使用 `operationsPlanningCloudOutbox.v1` 持久化待同步数据。云端确认保存成功后才清除；断网、临时错误或页面关闭后会继续重试。
- 发生多人版本冲突时，本地数据不会被静默覆盖。选择加载团队版本前，未同步内容会保留到本地恢复记录。

已登录管理员可通过 `window.cloudStore.backups.listVersions(documentKey)` 查询版本，通过 `getVersion(documentKey, version)`读取备份，并通过 `restoreVersion(documentKey, version)`恢复。恢复属于高风险操作，正式接入界面时必须增加版本对比和二次确认。

当前 Supabase 组织使用 Free 计划。上述应用级版本链可防止日常误操作、并发覆盖和前端持续迭代造成的数据丢失，但不能替代跨项目的基础设施灾备。Supabase 官方仅为 Pro、Team 和 Enterprise 项目提供可访问的自动数据库备份；生产正式使用前应升级到含每日备份的计划，或配置定期 `supabase db dump` 到独立存储。需要分钟级恢复点时再启用 PITR。

任何后续开发必须遵守：不复用或删除现有文档键；不清空 `workspace_document_versions`；数据结构升级只做兼容迁移；上线前验证当前文档与最新历史版本内容一致。

## 双语界面

- 顶栏语言选择支持 `简体中文 (zh-CN)` 与 `English (en-GB)`，每次仅显示一种界面语言。
- 语言偏好按登录账号保存；离线测试模式使用本地账号偏好，云端环境使用 `user_preferences` 表。
- SKU、项目编号、EOH、FCST、First Batch 等稳定业务代码不随语言切换改变。
- 项目原因、卡点、备注、交接说明等用户录入内容保留原文，不由界面翻译覆盖。
- 共用术语和日期、数字、货币格式集中维护在 `i18n.js`，新增模块应复用同一接口。

生产发布双语版本前，需要先应用 `supabase/migrations/20260805170000_user_locale_preferences.sql`，再部署前端，以启用跨设备的账号语言偏好同步。

## 经营管理模块

经营管理当前包含经营总览、BP达成、经营分析、Value Chain Simulation 和结算台账。结算台账用于按客户及账期管理账单金额、扣款差异、已收与未结金额、到期日、客户对账、回款核销和结算归档；当前为本地结构与交互测试版本。

## 样机管理模块

“专业与管理 > 职能工作台”中的样机管理拥有独立页面，但不创建第二份样机数据。页面直接聚合项目跟进中每个项目的 `prototype` 工作流，展示样机准备度、健康状态、负责人、截止日期、当前任务、阻塞和下一步。

- 从样机台账点击“查看”会打开对应项目的样机工作流抽屉。
- 点击“更新”复用项目部门更新弹窗；发布后样机台账和项目矩阵同步刷新。
- 项目抽屉中的样机来源可反向进入样机管理，并按项目型号自动定位。
- 页面支持项目搜索、健康状态、项目阶段和样机负责人筛选，以及当前结果CSV导出。
- 超级管理员、PMO和拥有样机职能范围的部门编辑可访问；其他职能只看到已连接来源，不获得页面或编辑权限。

## 数据库变更

Supabase DDL 位于仓库根目录 `supabase/migrations/`。新增结构、策略或函数必须通过新 migration 发布，不直接修改已有 migration。
