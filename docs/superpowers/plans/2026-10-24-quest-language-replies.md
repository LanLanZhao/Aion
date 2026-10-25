# Quest language and reply experience implementation plan

**Goal:** Deliver the user's four-image request in the existing Android app: Chinese/English with Chinese default, Chiullian and supplied cat avatar, complete composer outline, reply timing and working actions.

**Architecture:** One persisted preferences provider feeds existing screens. Keep the current chat hooks, store and Markdown renderer. Add reply metadata and a reusable assistant reply component; local feedback is clearly local and timing never fabricates model reasoning.

**Spec:** User request and four attached images, 2026-10-24. Preserve Quest identity, React Native + Expo and current style. Skills/connectors remain disconnected. Work continues in the user's current checkout with previous changes intact; no commit/publish requested.

## Tasks and verification

- [x] Preferences: `PreferencesProvider/usePreferences` with `language`, `setLanguage`, `profile`, `updateProfile`, `t`. Default zh/Chiullian; copy supplied avatar unchanged. Save on device. Test normalization and translation before implementation, verify restart and both languages on device.
- [x] Composer: confirm zero-bottom-inset phone geometry, reserve 12 dp bottom breathing room inside measured Android composer wrapper, include it in scroll footer. Regression test zero safe inset and keyboard positions before fix; verify full border on phone.
- [x] Replies: extend ChatMessage with timestamps, measure mock generation and real response/reasoning separately; add collapsible timing explanation, full Markdown and a wrapping action row. Copy, native share sheet, local vote toggle, device speech, regenerate final reply must work. Don't expose fabricated chain of thought. Test timing clamp, retry preservation/cancellation and action payloads before implementation.
- [x] Integrate provider and translated Chinese mock responses, run all tests/TypeScript/lint and fresh independent review. Build standalone APK, install connected phone, verify default identity/language, language persistence, composer and reply actions, report remaining real-service limits.

## Review focus

- Delayed preferences load must not overwrite a user change; failed saves must surface.
- New conversation/private change/unmount must still abort previous streams and speech.
- Regeneration retains the latest user text/files, replaces only the last assistant reply and rejects concurrent clicks.
- Reply timing freezes at completion; mock time is labelled simulated and real reasoning is not invented.
- Zero safe area, keyboard open, large fonts and a six-action row must stay on screen.

## Findings

Phone has no ADB reverse. Existing composer outline reaches the final screen row when Android reports a zero bottom safe area; there is no explicit exterior bottom gap. Its measured wrapper is already used by the list footer, so adding a measured gap addresses the geometry without a second keyboard offset.

Profile currently hardcodes Evan Bacon in three places; the language row has no handler; replies currently render Markdown only, without metadata or actions. Native copy/speech require the Expo SDK-compatible modules.


Final evidence: 34 tests passed; TypeScript and diff checks pass; ESLint 0 errors / 3 existing Markdown warnings. Both final P2 review findings reproduced then fixed with regression tests. Standalone build completed and installed on connected Xiaomi 15. Emulator verified language persistence and reply actions. See docs/quest-language-replies.md for APK hash and screenshots.
