# Quest 本轮检查与附件实现

> 后续已完成中文/English、Chiullian 头像资料、输入框边距及回复操作栏。最新 APK 已覆盖同一路径，当前文件哈希和验证记录请看 [中英界面与回复操作](quest-language-replies.md)；下文构建哈希是附件阶段的历史记录。

本次基于用户已经提交的界面（起点 `3e32ddb`）继续修改，保留当前聊天布局、侧边栏、Markdown、流式 store、原生手势和动画。技能、连接器按用户回复“暂不接入”处理。

## 已修复的主要问题

| 问题 | 结果 |
| --- | --- |
| Android 摄像头/图库按钮没有处理函数，文件按钮为空，选择结果被丢弃 | 加号弹出参考图的菜单；相机、系统图库、系统文档选择器接入共享附件草稿。支持预览、移除、仅附件消息和 AI SDK file parts。 |
| 清空/私密模式切换不取消生成，旧任务可写回新会话；未发送草稿仍保留 | mock 使用 AbortController 和当前任务校验；真实 SDK 停止请求并切换独立 Chat ID；清空输入与附件；卸载后不再写状态。 |
| 首个 token 前 `submitted` 未算忙碌，可并发重复发送 | 将 submitted 与 streaming 都视为生成中，并增加同步锁，防止同一帧双击。 |
| UI 显示模型与服务端实际模型不同，选择页面没有选项 | 模型选择状态、选择页面、请求模型白名单和 thinking 参数贯通；保留项目原模型名称，未替用户开通模型服务。 |
| 侧边栏与 Chats 删除/改名/置顶维护两份数据 | 同一 DrawerProvider 中共享状态。仍是内存中的演示列表，尚无真实历史存储。 |
| 真实模型 API 默认匿名开放且允许任意模型 | 生产接口在认证接入前固定返回 503；开发接口要求服务端密钥、模型白名单和有界输入。没有在客户端放入服务端密钥。 |
| 附件 URL 可触发服务端读取外部地址 | 只接受允许 MIME 的内联 base64，拒绝外部 URL；验证大小、角色、模型、会话结构和请求总量。文本附件按 UTF-8 转成用户上下文。 |
| SDK 第二轮历史包含 step-start/reasoning，简单校验会误拒绝 | 用实际 AI SDK Chat 生成首轮结果，验证第二轮可提交；合法步骤/思考部分被接受但仅可见文本与文件进入模型上下文。 |
| Android 默认 fetch/相对 API 路径不适合原生流式调用 | 真实模式使用 expo/fetch 与显式可访问 API URL；开发时可使用 Metro host 的 `/api/chat`。生产 URL 要求 HTTPS。 |
| 私密模式宣称“不用于训练”但后端没有保证 | 移除未经实现的承诺，说明应用内会话行为与模型服务政策的区别。 |
| Web 布局缺少首页需要的 Provider | 补齐上下文以避免缺失 Provider 崩溃。本轮附件仅交付原生 Android，Web 入口明确不可用。 |

## Quest 图标与名称

- 显示名称：`Quest`；原生 `app_name` 已同步，包名保留 `com.aion.chat`，便于覆盖已有安装。
- 普通图标：`assets/images/quest-icon.png`。
- Android 自适应前景：`assets/images/quest-adaptive-foreground.png`，透明背景；系统背景色 `#FFFCF5`，没有把示意图中的圆角外壳烘焙进去。
- 启动画面复用新标志，不修改聊天界面的配色。
- 图像由内置图像工具生成。生成提示与素材说明见 [Quest 图标素材](quest-artwork.md)。

## 附件范围

- 摄像头、图库：JPG、PNG、WebP、GIF。HEIC、视频等未支持的格式会说明原因，不能伪装为已发送成功。
- 文件：PDF、TXT、Markdown、CSV、JSON；文本要求 UTF-8。
- 单个附件最大 4 MB；每条消息最多 4 个、共 8 MB；文本文件最大 128 KB。
- 系统取消选择不添加内容；拒绝相机权限时说明原因，权限不可再申请时提供用户自行打开设置的入口。
- 草稿选择操作带任务标识，切换/清空会话后旧结果不会回填。读文件串行进行，避免同时读入多张大图。
- 当前 `EXPO_PUBLIC_MOCK_AI=1` 只验证选择、预览与消息传递。附件回复明确标明模拟模式，不声称识别了图片或文档内容。
- 真实解析需要另行接入有认证的模型后端；本轮没有接入技能、连接器或第三方账户。

## 验证记录

- 初始 TypeScript、8 项旧回归通过；初始 ESLint 为 0 errors、6 warnings。
- 全部 19 项回归通过，包含原有 Android 布局/返回键/手势测试及新增附件验证、草稿清空/取消/卸载、API 请求安全、真实 SDK 多轮历史和原生 URL 检查。
- mock 生命周期的三项回归先在旧代码上失败，修复后通过。
- 实际 AI SDK 多轮历史回归先失败，修复后通过。
- 当前 TypeScript 通过；ESLint 为 0 errors，保留上游 Markdown 工具文件的 3 条导入 warning。
- Android 调试 APK：构建成功，509 项任务，1m51s；已安装模拟器，安装包显示名称为 Quest。
- Android Hermes 导出通过；最终 Release 构建成功（846 项任务，15m57s），构建时已重新生成最终源码的内置 Hermes bundle。
- 独立预览包：[Quest-preview.apk](../dist/Quest-preview.apk)，78,591,760 字节，包含 `arm64-v8a` 与 `x86_64`；最低 Android 7 / API 24，目标 API 36。使用项目现有本地 debug keystore 签名，仅用于本地预览，不是商店发布签名。
- APK SHA-256：`C7A23EB12D3C9C42E1926B44D28088D4683CC0D2853840CEB0515DADAFD41A3F`。
- 预览包覆盖安装模拟器成功，移除 `tcp:8081` 的 ADB reverse 后直接启动成功，不依赖 Metro。首次冷启动 `am start -W` 的 TotalTime 为 7082 ms（本机软件图形模拟器单次记录，不能代表真机性能）。
- 加号五项菜单实际显示，技能/连接器为灰色并说明暂未接入。
- 系统文件选择器返回 TXT 后，输入框出现可移除卡片；仅附件消息已实际发送，消息中保留文件名，mock 回复明确说明未调用模型解析。
- Android 系统图库选中图片后正确返回预览，点击移除清除卡片；相机首次授权、拍摄、确认后返回 JPEG 草稿，图片仅附件消息实际发送成功。
- Release 包输入测试文本后输入框随键盘上移；键盘展开时点击加号可收起键盘并显示完整五项菜单。
- 启动器实际显示新自适应图标，APK 清单与启动器节点的名称均为 Quest。
- 独立复核确认无剩余 P1/P2 问题；额外验证旧附件读取晚完成不会覆盖清空后新选的附件。
- ESLint 排除 Expo 自动生成的 `.expo` 服务端 bundle，避免把构建产物当成应用源码检查；源码检查为 0 errors、3 条原有 warning。

操作截图：[加号菜单](screenshots/quest-release-menu.png)、[文件草稿](screenshots/quest-document-draft.png)、[图库草稿](screenshots/quest-gallery-draft.png)、[相机草稿](screenshots/quest-camera-draft.png)、[键盘联动](screenshots/quest-keyboard.png)、[独立包首页](screenshots/quest-release-home.png)、[启动器图标](screenshots/quest-launcher.png)。

## 尚不能视为上线完成的部分

当前没有用户认证、真实会话历史存储或第三方连接器。聊天列表与多个设置仍是内存/演示数据，不能把设置页面中的代码执行、搜索、记忆等开关当成已实现的后台能力。真实模型服务、PDF/图像识别准确性、生产账户权限与费用控制没有进行线上测试。

Android 调试环境仍有已有的 Reanimated render/shared-value 诊断和 InteractionManager 弃用提示，未通过静音隐藏。正式签名、商店发布、真机帧率和长时间内存压力需要单独验收。前述完整附件流程证据来自 API 36 模拟器，补充真机记录如下。

## 补充真机验收（2026-10-24）

用户重新连接 Xiaomi 15（设备型号 24129PN74C，Android 16）后，ADB 已授权。将相同 SHA-256 的 `Quest-preview.apk` 覆盖安装成功，保留包名 `com.aion.chat`。手机没有配置 ADB reverse，直接启动应用成功，`am start -W` 单次冷启动 TotalTime 为 1505 ms。

真机实际打开五项附件菜单，摄像头/图库/文件正常显示，技能/连接器灰色标明暂未接入。聚焦输入框时其 bounds 从 `[81,2355][1119,2498]` 上移到 `[81,1399][1119,1542]`，发送按钮与加号同步上移，检查结束后已收起键盘。见 [真机加号菜单](screenshots/quest-phone-menu.png)。本次未打开用户的个人相册或文件，也未进行真机帧率、长时间压力与真实模型调用测试。
