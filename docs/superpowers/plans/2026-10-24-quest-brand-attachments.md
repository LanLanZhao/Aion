# Quest branding, attachment flow and risk review

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in the current checkout. Preserve the user's committed UI changes.

**Goal:** Apply the reference ribbon icon and Quest identity, implement the requested camera/library/file flow, and fix confirmed major chat lifecycle defects.

**Architecture:** Keep Expo Router, Uniwind, Legend List and the current composer. Add one shared attachment draft provider above routes so native pickers can return results to the composer. Use the existing AI SDK file parts, not a second upload/backend stack. Keep mock mode explicitly simulated. Cancel prior generation when a chat is cleared or replaced.

**Tech Stack:** Existing Expo 57 / React Native 0.86 / AI SDK 6, expo-image-picker, SDK-compatible expo-document-picker and expo-file-system where required.

**Spec:** User's two reference images and explicit request; follow-up says skills/connectors are not to be integrated yet. No third-party accounts or tool engine will be fabricated.

## Constraints

- Android first; keep the user's current UI, drawer and animation behavior.
- Use the black/white folded ribbon reference for launcher artwork, with Android adaptive masking accounted for.
- Preserve com.aion.chat and existing development links so updates retain app data.
- Camera, library and file actions must return usable attachments, show preview/removal, and survive opening/dismissing pickers.
- Skills/connectors show a clear unavailable state; no fake switches or successful connection claims.
- No real model keys are placed in the client. Mock replies must not pretend to analyze attachments.
- Review public API access, private-chat claims, cancellation, request limits and model/API transport; document services that are still absent.

## Review focus

- Denied permission, cancelled selection, oversized/unsupported files, failed reads.
- Attachment-only messages and repeat selection, clearing drafts after send.
- Clearing/private-mode changes/unmount while a stream or picker is pending.
- Native API URL and streaming transport; selected model versus actual request.
- Native launcher icon/name changes require rebuilding the APK, not just Metro refresh.

## Tasks

- [x] 1. Inspect latest committed code; run current tests/typecheck/lint and record confirmed findings.
- [x] 2. Generate master and adaptive foreground artwork from image 1; configure icon, splash and Quest installation name.
- [x] 3. Add attachment validation/conversion and lifecycle regression tests that fail on missing behavior.
- [x] 4. Implement anchored plus menu, native camera/library/document selection, draft preview/removal and message file parts. Add only necessary Expo dependencies.
- [x] 5. Fix confirmed generation cancellation and private-chat/new-chat defects without redesigning the app.
- [x] 6. Run tests/typecheck/lint and Android bundle, perform independent review, regenerate/build Android and verify available device/emulator. Report exact limitations if tooling blocks device work.

## Execution result

19 tests, TypeScript and diff checks pass. ESLint has zero errors and three existing Markdown import warnings. Independent final review found no outstanding P1/P2 issues. Debug and standalone Release preview APKs built successfully. API 36 emulator verified camera, system photo picker, documents, previews/removal, attachment-only sends, keyboard/menu placement, launcher artwork/name and launch without Metro reverse. No physical device was attached for this round. Real model responses/authentication, durable conversation storage, skills and connectors remain explicitly unimplemented. Exact evidence, APK hash and screenshots are in `docs/quest-review.md`.

## Initial findings

- app.json already declares Quest, but has no launcher icon configured.
- Android camera/library buttons currently have no onPress; files has no handler on any platform; picker results are discarded.
- ChatMessage is text-only and the native API uses default useChat transport with no explicit Android-accessible URL or Expo streaming fetch.
- Clearing a mock/real generation does not cancel it; a later completion can refill the cleared conversation.
- Private chat UI promises exclusion from training without any backend enforcement; that wording must be corrected.
