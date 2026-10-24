# Android 第一阶段记录

## 来源与范围

- 上游：[EvanBacon/chat-template](https://github.com/EvanBacon/chat-template)
- 基线提交：`40379fcbc8d57025e09eef77ae129b7b30b100c7`
- 工作分支：`android-baseline`
- 保留原有路由、聊天布局、侧边栏、Markdown AST 渲染器、流式 store、Legend List、抽屉手势和 Reanimated 弹簧动画。
- 第一阶段使用原项目已有的模拟流式响应，不添加功能、不接入新服务。

## 项目结构

| 位置 | 职责 |
| --- | --- |
| `src/app/_layout.tsx` | 原生主题、键盘、抽屉、导航栈 |
| `src/app/index.tsx` | 聊天页面、真实 API / 模拟流式 hook |
| `src/components/chat/` | 虚拟列表、键盘动画、输入框、消息与流式 store |
| `src/components/drawer-layout.tsx` | 自定义原生抽屉及 UI 线程手势动画 |
| `src/components/drawer-content.tsx` | 侧边栏内容与导航 |
| `src/components/markdown/` | Markdown 解析、原生 AST 渲染、代码高亮 |
| `src/components/main-header.android.tsx` | Android 顶栏入口，复用上游 fallback |
| `src/app/api/chat+api.ts` | 原有服务端 Anthropic API 路由 |
| `app.json` / `metro.config.js` | Expo 配置 / Metro 与 Uniwind 集成 |

## 依赖与改动

上游实际为 Expo SDK 56、React Native 0.85.3、React 19.2.3，README 原先列出的 SDK 55 / RN 0.83 已过时。先完成 SDK 56 补丁对齐、原生编译和模拟器交互验证，但仍观察到冷启动长等待及一次 Reanimated 初始化异常。Expo Doctor 同时报告 SDK 56 自带 Hermes 的已知内存回归，因此改用官方已修复这些回归的 SDK 57 维护版本：Expo 57.0.31、React Native 0.86.3、Reanimated 4.5.1、Worklets 0.10.1，React 仍为 19.2.3；通过 Expo 安装器对齐原生依赖并更新 `bun.lock`。沿用原 React Native + Expo 架构和界面代码。

1. Android 忽略 iOS 专属的 `ScrollView.contentInset`。在原列表 footer 中加入输入框与键盘占用空间，并避免滚动终点计算重复叠加 inset；空状态内容仍在可见区域居中。
2. 保留键盘控制器的交互收起手势；Android 原生列表不再使用无效的 `keyboardDismissMode="interactive"`，避免与键盘手势控制冲突。
3. `SymbolImage` 的 Android Lucide 回退通过已有 `Icon` / Uniwind 包装应用主题颜色，修复深浅主题下图标不可见问题。
4. 发送按钮使用静态 style 和 `active:opacity-70`，符合仓库对 Uniwind Pressable 的约束。原生输入框光标、选区和 spinner 使用 Uniwind 的 `accent-*` 颜色映射，消除实际运行中的无效颜色类警告。
5. Android Back 优先关闭展开的抽屉；取消拖动和卸载时释放 InteractionManager handle，保留原动画参数。Android 的关闭态滑动触发区由 32dp 扩为 64dp：系统最外侧边缘继续用于 Back，从稍内侧滑动可打开原抽屉，解决手势导航抢占几乎整个原触发区的问题。
6. Android 包名固定为 `com.aion.chat`，应用显示名称仍为上游 `chat`，键盘模式为 `adjustResize`。
7. 补充 CSS 类型声明，修正上游条件 hook 调用和 JSX 文本转义，提供检查脚本。两个使用 `.value` 的动画组件显式退出 React Compiler；仅针对其 worklet / gesture 的误报配置局部 lint 例外。
8. 固定官方原生模板 `expo-template-bare-minimum@57.0.33`，使重新生成 Android 工程可复现；常规启动保留已生成的原生工程，迁移 SDK 时才执行干净预构建。
9. Metro 保留原解析器与 Uniwind 配置，只额外排除本地 `.cache` 工具目录。实际文件索引曾包含 55,724 个缓存条目；排除后缓存条目为 0，避免监听模拟器数据、JDK、包缓存和运行日志。没有改写 bundle 请求或禁用 Hermes。
10. 改用已安装的 `@legendapp/list/reanimated` 官方 `AnimatedLegendList` 入口。SDK 57 模拟器首测证实，手工 `createAnimatedComponent(LegendList)` 会把列表 API 引用交给新版 Reanimated，导致原生视图解析报错；官方入口将动画引用转发到内部 ScrollView，同时保留列表 API、现有 footer、滚动和动画逻辑。

## 本地启动

需要 Bun、Android SDK 36 / build-tools 36.0.0、ADB，以及 Gradle 可发现的 JDK 17 工具链。应用使用自定义 development client，不能用 Expo Go。

```powershell
bun install --frozen-lockfile
Copy-Item .env.example .env
bun run android
```

本机尚未全局安装 Bun，也可在项目目录使用已缓存的 npm 启动器：

```powershell
$env:npm_config_cache = "$PWD/.cache/npm"
npx --yes bun run android
```

`preandroid` 会先使用固定的 SDK 57 模板生成原生工程。也可以单独执行：

```powershell
bun run android:prebuild
bun start --dev-client
```

本次已创建并运行后台模拟器 `Aion_API_36`（Pixel 6 配置、Android 16 / API 36、x86_64、WHPX 加速，验收分辨率 720×1600）。AVD 存储在 `.cache/avd/`，开发服务器监听 `127.0.0.1:8081`，ADB 已反向转发端口。当前调试 APK 依赖 Metro，不是离线独立安装包。从应用图标打开会进入 Expo 开发启动器；使用 `bun run android` 打开项目，或在启动器连接对应开发服务器。

如要在本机显示可交互的模拟器窗口，可在项目目录执行以下命令（先结束当前后台模拟器，应用数据保留）：

```powershell
adb -e emu kill
$env:ANDROID_AVD_HOME = "$PWD/.cache/avd"
& "$env:LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd Aion_API_36
```

`.env` 中 `EXPO_PUBLIC_MOCK_AI=1` 使用原有模拟流式回复，不需要 API Key。该模式不验证真实 Anthropic 服务。后续接回真实服务时，`ANTHROPIC_API_KEY` 只能配置在服务端，不要改为 `EXPO_PUBLIC_` 变量；Android 还需要可访问的 API 地址。

如果 npm 全局缓存不可写，可在当前终端将 `npm_config_cache` 指向 `.cache/npm`。Java 下载工具通常需要单独配置 `http.proxyHost` / `https.proxyHost`，不会自动采用 `HTTPS_PROXY`。

本次机器 JDK 21 已装，但 React Native Gradle 插件需要 JDK 17。便携 JDK 17 放在忽略的 `.cache/jdk17/`，本机生成的 `android/gradle.properties` 已登记其工具链路径。命令行也可通过 `-Dorg.gradle.java.installations.paths=<JDK17绝对目录>` 传给 Gradle，并用 `--no-daemon` 避免旧 daemon 缓存工具链错误。不要提交本机绝对路径或代理配置。

## 验证命令

```powershell
bun run typecheck
bun run test
bun run lint
bun run android:bundle
npx expo-doctor
```

回归检查在轻量原生模块替身中执行真实组件的布局 worklet 与事件回调，不能证明实际设备上的帧率和键盘手势。原生工程与缓存均已忽略；`dist/android` 是 Android Hermes bundle，不是 APK。

## 当前证据

- TypeScript：通过。
- 键盘/列表布局与抽屉行为回归：8/8 通过。
- ESLint：0 errors；仍有上游 6 条格式/导入 warning。
- Expo Doctor：SDK 57 最终检查 21/21 通过，包括原生依赖一致性和 Hermes 回归检查。
- 原生预构建：通过。
- Android Hermes 导出：最终源码导出通过，4,869 个模块，12MB HBC，输出位于 `dist/android`。
- APK 原生编译：SDK 57 `BUILD SUCCESSFUL`，509 个任务，耗时 13m11s。此前 SDK 56 的首次下载与编译耗时 25m49s，仅作为环境准备历史记录。
- APK：`android/app/build/outputs/apk/debug/app-debug.apk`，165,906,736 字节，包名 `com.aion.chat`，显示名称 `chat`，包含 `arm64-v8a` / `x86_64`，minSdk 24 / targetSdk 36。
- SHA-256：`BB89BF077F20D6AF6C14480BBDCDC190BEAE7CBED2C29B78AFF3B7A557F479E9`。
- 模拟器安装：ADB 返回 `Success`，Fabric 原生页面成功运行。
- 实际交互：连续模拟流式回复、光标与 spinner、Markdown 加粗/代码高亮/引用/有序与无序列表、长对话滚动和返回底部、键盘展开与滑动收起、抽屉打开/滑动关闭/Back 关闭、深浅主题切换均已操作验证。
- SDK 57 长对话键盘展开时，最后段落在屏幕 y=727–815，输入框在 y=887–978，键盘起始约 y=1000，内容未被遮挡。滑动收起键盘后可滚动；点击返回底部，最后段落在 y=1277–1365，完整位于输入框之上，返回底部按钮随之隐藏。
- 最终源码连续两次通过项目链接冷启动，以 UIAutomator 观察到实际聊天输入框为成功条件，分别为 29,976ms / 29,053ms（包含启动、开发 bundle 加载和 UI 轮询开销）。两次 ReactNativeJS / AndroidRuntime 日志均未记录 JS error 或运行时崩溃；不能把该耗时当作发布构建性能。

截图均已更新为 SDK 57 实际运行画面：[逐词流式输出](screenshots/android-streaming.png)、[Markdown 浅色界面](screenshots/android-chat-markdown.png)、[深色长对话](screenshots/android-dark.png)、[键盘联动](screenshots/android-keyboard.png)、[原侧边栏](screenshots/android-drawer.png)。Expo 调试工具浮钮已通过开发菜单关闭，未修改产品界面。

最终日志保存在忽略的 `.cache/`：`android-build-sdk57.log`、`expo-doctor-sdk57.log`、`android-export-sdk57-final.log`、`android-sdk57-interactions.log`、`android-sdk57-cold1.log`、`android-sdk57-cold2.log`；冷启动测量为 `sdk57-cold1-result.json` / `sdk57-cold2-result.json`。开发服务器日志为 `metro.log` / `metro-error.log`。调试 APK 从 Metro 加载源码，最终列表适配已包含在运行源码和 Hermes 导出中。

## 已知限制

SDK 56 的 Hermes 已知回归已通过维护升级处理，最终 Doctor 不再报警。SDK 56 切换开发服务器并重载时曾出现原生上下文初始化异常；SDK 57 首测出现的列表引用错误也已通过官方适配入口修复，原失败日志分别保留在 `runtime-reload.log` / `android-sdk57-first.log`，不能与最终通过的复测混为一谈。

当前调试构建在本机软件图形渲染模拟器上冷启动仍约 29–30 秒，需后续用真机和发布构建定位、优化。开发日志仍有 Reanimated 的 render 期间读取 shared value 诊断及上游 InteractionManager 弃用警告，未关闭日志来掩盖问题。第一阶段完成的是原项目在 Android 的功能运行验收，没有完成真机帧率、发布构建或长时间内存压力测试，也未接入真实模型 API。

参考：[Expo 官方 SDK 57 回归说明](https://expo.dev/changelog/sdk-57#known-regressions)、[React Native ScrollView 平台属性](https://reactnative.dev/docs/scrollview)、[Reanimated React Compiler 支持](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/#react-compiler-support)。
