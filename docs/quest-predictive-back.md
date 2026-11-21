# Quest Android 预测返回

已按 Grok 录屏接入 Android 系统返回进度。项目列表、新建项目和项目详情支持边缘拖动时的圆角缩放预览；滑回边缘取消并恢复页面，松手提交后只返回一次。项目列表返回已展开的侧边栏，新建和详情返回项目列表。键盘存在时系统先收起键盘。

同一套动画已扩展至能力、设置、个人资料和语言页。侧边栏直接打开的能力和设置返回侧边栏；从设置打开的能力、个人资料、语言返回设置。移除设置旧的卸载时展开侧边栏逻辑，避免子页面返回目标错误。进入子页前如果搜索键盘仍显示，先收起再捕获完整页面。头像作为装饰嵌入账户按钮时使用普通 View，避免 Android 嵌套空 Pressable 吞掉点击。

实现保留 Expo Router 和现有页面，新增本地 Expo Android 模块 `modules/quest-predictive-back`，使用 AndroidX `OnBackPressedCallback` 的开始、进度、取消和提交回调，符合 [Android 官方 Progress API 用法](https://developer.android.com/guide/navigation/custom-back/support-animations-views)。每帧由 Android UI 线程绘制，不通过 JS 逐帧传递进度。JS 只在提交后更新导航；回调按当前聚焦页面的 owner 管理，过期页面的事件和清理不会影响新页面。

预览是进入页面前捕获的两份有界内存快照，不写入磁盘。图片宽度最大 1080 像素，Activity/module 销毁时释放。打开系统文件选择器只中止当前过渡，不清除返回目标。Android 14 及以上支持完整进度预览；较低版本保留正常返回。系统关闭动画时跳过预览。

`app.json` 已启用 `android.predictiveBackGestureEnabled`，原生 Manifest 同步启用。此功能需要重建原生包，Expo Go 不支持本地模块。原侧边栏手势和动画保留；项目页完成返回时直接恢复侧边栏位置，避免再次播放展开动画。

验证记录：

- TypeScript、相关文件 ESLint、`git diff --check` 通过。
- `node --test tests/*.test.cjs`：42 项通过，0 项失败。
- 原生模块 Kotlin 编译及最终 `:app:assembleRelease` 成功。
- Android 16 模拟器：右侧返回取消、提交，左侧详情返回取消，硬件返回，以及新建项目页第一次返回只收键盘均通过。
- Xiaomi 15 / Android 16：最终包安装成功。真实系统边缘手势在未松手时显示圆角缩放与侧边栏预览，取消恢复原页，提交返回侧边栏，均已截图确认。
- 本次扩展：模拟器验证能力、设置的取消与提交；设置内的能力、个人资料、语言逐级返回；搜索框有键盘时进入语言页并返回，预览完整且键盘已收起。Xiaomi 验证能力和设置右边缘取消/提交，以及设置内能力左边缘返回到设置。
- 最终包在 Xiaomi 覆盖安装后，再次确认点击侧边栏头像进入设置、点击设置头像进入个人资料；设置手势返回侧边栏，资料手势返回设置。证据：`quest-phone-final-avatar-settings.png`、`quest-phone-final-avatar-profile.png`、`quest-phone-final-settings-mid.png`、`quest-phone-final-profile-after.png`。

演示：`docs/screenshots/quest-back-phone-demo.mp4`。真机中间态：`quest-back-phone-cancel-mid.png`；取消结果：`quest-back-phone-cancel-after.png`；提交结果：`quest-back-phone-commit-after.png`。

能力与设置真机证据：`quest-phone-capabilities-cancel-mid.png`、`quest-phone-settings-cancel-mid.png`、`quest-phone-settings-child-capabilities-after.png`。设置子页与搜索证据：`quest-settings-child-profile-mid.png`、`quest-settings-child-language-mid.png`、`quest-settings-child-language-after.png`。

交付文件：`dist/Quest-preview.apk`。SHA-256：`AAD22F1BFE20619FAE4B17062B6741628227A6C2B052F85017FEEAFC646B597C`。
