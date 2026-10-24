# Android baseline implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Build and run EvanBacon/chat-template on Android with its existing UI and interactions.

**Architecture:** Keep upstream Expo Router routes, Legend List, streaming store, Markdown renderer, drawer and Reanimated transitions. Fix platform-specific integration defects in place; use the existing mock streaming mode for offline UI verification.

**Tech Stack:** Upstream Expo 56 / React Native 0.85.3; validated maintenance target Expo 57.0.31 / React Native 0.86.3, React 19.2.3, Bun lockfile, Android SDK.

**Spec:** User request in this chat: Android first; reuse upstream; preserve UI, sidebar, streaming, Markdown, gestures and animations; no new features.

## Global Constraints

- No redesign, feature additions, framework migration or dependency upgrades without evidence of a compatibility requirement.
- Use the custom development client, not Expo Go.
- Keep API credentials on the server; mock responses need no credentials.
- Distinguish static/bundle/build verification from actual device verification.

## Review Focus

- Long messages remain reachable above the composer and keyboard on Android (contentInset is iOS-only).
- Keyboard dismissal and reopen preserve composer alignment and list scrolling.
- Light/dark themes retain visible submit and scroll icons.
- Drawer swipes do not break vertical scrolling; Android Back closes an open drawer.
- Mock streaming completes and Markdown/code blocks still render with the existing renderer.

## Tasks

- [x] 1. Clone and inspect upstream, pin source revision, inspect local Android tools.
- [x] 2. Install the original frozen lockfile; run baseline TypeScript, lint, Expo dependency checks and Android bundle/prebuild to identify real incompatibilities.
- [x] 3. Fix confirmed Android integration defects in existing components; add focused behavior regression checks for keyboard/list geometry and icon/submit rendering where feasible.
- [x] 4. Configure Android application identity/keyboard behavior and document the existing mock mode; generate native project and build a debug APK.
- [x] 5. Install and launch on an attached device or available emulator; verify drawer, streaming, Markdown, keyboard, scrolling, dark/light mode, and Back. Record evidence and any unavailable checks in docs/android-baseline.md.

## Execution record

- Upstream revision: 40379fcbc8d57025e09eef77ae129b7b30b100c7.
- Fresh workspace, no existing user edits. User explicitly requested immediate implementation, so execution continues in this session.
- Local tools: Node 26.6.0, npm 11.18.0, JDK 21.0.12, SDK platform android-36 and build-tools 35/36. No device connected; no emulator package or AVD installed.
- Initial Git network access required sandbox escalation. System npm cache is unwritable; installation uses project-local ignored caches.
- Official online Expo validation found SDK 56 native package version drift. Applied SDK 56 patch alignment with `bunx expo install expo@~56.0.24 --fix --bun`; React Native remains 0.85.3. Doctor now passes 21/22, with the known Hermes V1 memory regression still reported.
- Android layout regression tests first failed 3/4 on upstream, then passed 4/4 after the footer/scroll fix. Added four drawer event/lifecycle checks; suite now passes 8/8.
- TypeScript passes; ESLint passes with six upstream style/import warnings. Final Android Hermes export succeeds (4,835 modules) at `dist/android`.
- Installed official Android emulator and API 36 x86_64 image; project-local AVD `Aion_API_36` boots with WHPX hardware acceleration. Firmware flag reported false initially, but the emulator's actual accelerator check confirmed usable WHPX.
- First native build exposed missing JDK 17 toolchain and Foojay auto-provisioner failure under Gradle 9.3.1. A portable JDK 17 and an explicit toolchain path with a fresh daemon allow native plugin compilation to proceed. NDK 27.1.12297006 has been installed.
- Pinned Expo's bare template at 56.0.38 after the default prebuild selected a template recommending SDK 57. The pinned SDK 56 template also uses Gradle 9.3.1; pinning is for reproducibility, not a claim that it alone fixed the toolchain error.
- Independent review found that `viewOffset: 0` overrides LegendList's built-in footer adjustment. Verified against the installed dependency, added a regression that executes its actual scrollToEnd method (failed 392 vs 492), then omitted the Android override. The full suite passes after the fix.
- Native build completed successfully: 505 tasks in 25m49s; APK 161,876,272 bytes, arm64-v8a + x86_64, installed successfully on API 36 emulator.
- Device checks confirmed streaming, Markdown, keyboard/list geometry, themes, and drawer gestures. Actual gesture navigation exposed system Back swallowing the original 32dp edge area; Android now allows drawer swipes within 64dp, just inside the reserved system edge. Input color classes were corrected to Uniwind accent utilities after a runtime warning.
- SDK 56 cold starts still showed long waits, and one development reload raised a Reanimated native context exception. A tentative Metro bytecode rewrite was investigated and reverted because response inspection did not support the proposed cause. Metro remains unchanged.
- Upgraded through Expo's official installer to SDK 57.0.31 / RN 0.86.3, including the documented Hermes memory and development startup fixes. Regenerated Android with official template 57.0.33. SDK 57 Doctor passes 21/21, TypeScript and all eight regression checks pass; native build and device revalidation are in progress.
- Metro's cache index proved that 55,724 locally cached tool files were included in its scan. The local AVD/log/cache changes also caused a development server to stop responding. Added only a `.cache` resolver blockList entry, retaining Expo defaults; the rebuilt index contains zero cache entries, and the status endpoint responds during native builds (~0.49s in one check). This is independent of the reverted bytecode experiment.
- SDK 57 device validation exposed Reanimated rejecting LegendList's imperative API ref from the upstream manual wrapper. Switched to the existing package's official AnimatedLegendList integration, which forwards its native ScrollView ref; no native rebuild was needed for this JS-only fix. TypeScript and 8/8 regression checks pass again.
- Final SDK 57 native build passed (509 tasks, 13m11s), APK installed successfully. Final source export passed (4,869 modules, 12MB HBC). Repeated all interaction checks and refreshed five device screenshots. Last paragraph remains above the composer with the keyboard open and after scrolling to the end.
- Two final project-link cold starts reached the actual composer, observed at 29,976ms and 29,053ms, with no JS errors or AndroidRuntime crashes in the captured logs. Debug startup remains slow on this software-rendered emulator; Reanimated diagnostic warnings remain visible. Functional phase-one acceptance is complete; release/physical-device FPS and memory stress measurements remain explicitly outside the completed checks.
